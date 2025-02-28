import {inject, Injectable, Query, signal, WritableSignal} from '@angular/core';
import {
  arrayRemove,
  arrayUnion, Bytes,
  collection,
  doc,
  DocumentReference, DocumentSnapshot,
  Firestore, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, QueryConstraint,
  setDoc, updateDoc, where, writeBatch, startAfter
} from '@angular/fire/firestore';
import {MessageService} from './message.service';
import {BehaviorSubject, of, ReplaySubject, Subject} from 'rxjs';
import {HmacService} from './hmac.service';
import {deleteObject, getDownloadURL, ref, Storage, StorageReference, uploadBytes} from '@angular/fire/storage';
import {LRUCache} from 'lru-cache';
import {EncryptionService, FakeEncryptionService} from './encryption.service';
import {hex, shortenId} from './common';
import {ImageScaleService} from './image-scale.service';
import {TagUpdateCallback} from './tag.service';
import { Image, ImageData, ImageSubscription } from '../lib/models/image.model';
import {ImageConversionService, StoredImageData} from './image-conversion.service';
import {ImageDataCacheService} from './image-data-cache.service';

const imagesCollectionPath = 'images'
const cloudDataPath = 'data'

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private encryption: EncryptionService = inject(EncryptionService);
  private firestore: Firestore = inject(Firestore);
  private hmac: HmacService = inject(HmacService);
  private message: MessageService = inject(MessageService);
  private storage = inject(Storage);
  private scale = inject(ImageScaleService);
  private convert: ImageConversionService = inject(ImageConversionService);
  private imageCache: ImageDataCacheService = inject(ImageDataCacheService);

  private readonly imagesCollection: any;
  private imgCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0)
  private readonly cloudStorageRef = ref(this.storage, cloudDataPath)
  private tagUpdateCallback: TagUpdateCallback = (tags: DocumentReference[]): Promise<void> => {return Promise.resolve()};

  lastTagsAdded: WritableSignal<DocumentReference[]> = signal([]);

  constructor() {
    this.imagesCollection = collection(this.firestore, imagesCollectionPath).withConverter(this.convert.imageConverter())
  }

  /**
   * Get a reference to StoredImage in Firestore.
   */
  GetImageReferenceFromId(imageId: string): DocumentReference {
    return doc(this.firestore, imagesCollectionPath, imageId)
  }

  /**
   * Get a reference to cloud stored bytes containing the full-sized image.  Possibly encrypted.
   */
  GetStorageReferenceFromId(imageId: string): StorageReference {
    return ref(this.cloudStorageRef, imageId)
  }

  /**
   * Add the specified tags to the specified image.
   */
  async AddTags(iRef: DocumentReference, tags: DocumentReference[]) {
    return updateDoc(iRef, {tags: arrayUnion(...tags)})
      .then(()=> {
        this.message.Info(`Added ${tags.length} to image *${shortenId(iRef.id)}`)
        this.tagUpdateCallback(tags)
        this.lastTagsAdded.set(tags);
      })
      .catch((error: Error) => {this.message.Error(`Error adding tags ${tags} ${iRef.path}: ${error}`)});
  }

  /**
  * Add the last set of tags to a new image.
  */
  async AddLastTags(iRef: DocumentReference): Promise<void> {
    return this.AddTags(iRef, this.lastTagsAdded());
  }

  /**
   * Replace all the tags on the specified image.
   */
  async ReplaceTags(iRef: DocumentReference, tags: DocumentReference[]) {
    return updateDoc(iRef, {'tags': tags})
      .then(()=> {
        this.message.Info(`Updated tags (${tags.length}) for image ${shortenId(iRef.id)}`)
        this.tagUpdateCallback(tags)
        this.lastTagsAdded.set(tags);
      })
      .catch( e => this.message.Error(`ReplaceImageTags error: ${e}`));
  }

  /**
   * Remove the specified tags from the specified image.
   */
  async RemoveTags(iRef: DocumentReference, tags: DocumentReference[]): Promise<void> {
    return updateDoc(iRef, {tags: arrayRemove(...tags)})
      .then(()=>{
        this.message.Info(`Removed ${tags.length} tags from image ${shortenId(iRef.id)}`)
        this.tagUpdateCallback(tags)
      })
      .catch((err: Error) => {this.message.Error(`Error removing tags ${tags.map(t=>shortenId(t.id))} from image ${shortenId(iRef.id)}: ${err}`)}
    )
  }

  /**
   * Store a new image from its contents and tags to be associated with it.
   */
  async StoreImage(blob: Blob, tags: DocumentReference[]): Promise<void> {
    const iRef = await this.GetImageReferenceFromBlob(blob);

    const newImage: Image = {
      tags: tags,
      reference: iRef,
    }

    // This assumes brand new upload.  No inconsistencies.
    const snapshot = await getDoc(newImage.reference)
    if (snapshot.exists()) {
      if (tags.length > 0) {
        return this.AddTags(newImage.reference, newImage.tags)
          .then(()=>{this.message.Info(`Added ${newImage.tags.length} to image ${shortenId(newImage.reference.id)})`)})
          .catch((err: Error) => {this.message.Error(`Error adding tags to image ${shortenId(newImage.reference.id)}: ${err}`)});
      }
      // Need to add ability to deal with missing data in Firestore and Cloud storage.
      return;
    }

    try {
      // This stats business needs re-thinking.  Perhaps it lives in another service?  How much value is this brining?
      await setDoc(newImage.reference, newImage).then(()=> {this.imgCount$.next(this.imgCount$.value + 1)})
      if (this.encryption.enabled()) {
        await this.StoreEncryptedImageData(iRef, blob)
      } else {
        await this.StorePlainImageData(iRef, blob)
      }
      this.message.Info(`Added new image ${shortenId(newImage.reference.id)}`)
    } catch (err: unknown) {
      this.message.Error(`Error adding image ${shortenId(newImage.reference.id)}: ${err}`)
      return Promise.reject(err);
    }
  }

  /**
   * Delete the specified image and its data.
   */
  async DeleteImage(imageRef: DocumentReference) {
    const batch = writeBatch(this.firestore)
    batch.delete(doc(this.firestore, this.imagesCollection.path, imageRef.id, 'data', 'thumbnail'));
    batch.delete(imageRef);
    try {
      await batch.commit()
      await deleteObject(this.GetStorageReferenceFromId(imageRef.id))
    } catch (err: unknown) {
      this.message.Error(`Error deleting image ${shortenId(imageRef.id)}: ${err}`)
      return Promise.reject(err)
    }
    return Promise.resolve()
  }

  /**
   * Subscribe to updates about image data.  In practice there is only one update expected.
   */
  SubscribeToImageData(imageId: string): ImageSubscription<ImageData> {
    if ( this.imageCache.has(imageId) ) {
      return {results$: of(this.imageCache.get(imageId)), unsubscribe: ()=> {}} as ImageSubscription<ImageData>
    }

    const imageData$ = new Subject<ImageData>();
    const unsub = onSnapshot(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'),
      doc => {
        if (!doc.exists()) {
          return;  // This happens right after creation, it is not an error.
        }
        this.convert.snapshotToImageData(doc)
          .then(imageData => {
            imageData$.next(imageData as ImageData)
          })
          .catch((err) => {
            this.message.Error(`SubImageData(${imageId}): ${err}`)
          })
      })

    return {results$: imageData$, unsubscribe: () => {imageData$.complete(); unsub()} } as ImageSubscription<ImageData>
  }

  /**
   * Subscribe to images that contain a particular tag.  Limit results to last N images based on creation time.
   */
  SubscribeToTag(tagRef: DocumentReference, last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }

    const q = query(
      this.imagesCollection,
      where("tags", "array-contains", tagRef),
      ...constraints)

    const imagesObservable = new Subject<Image[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
      const images: Image[] = [];
      querySnapshot.forEach((doc) => {
        images.push(doc.data() as Image)
      })
      imagesObservable.next(images)
      this.message.Info(`Tag ${shortenId(tagRef.id)} now has ${images.length} images`)
    })

    return {results$: imagesObservable, unsubscribe: () => { unsub(); imagesObservable.complete()}} as ImageSubscription<Image[]>;
  }

  /**
   * Subscribe to the latest images added to storage up to last N images based on creation time.
   */
  SubscribeToLatestImages(last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }
    const q = query(this.imagesCollection, ...constraints)

    const out$ = new Subject<Image[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
      const images: Image[] = [];
      querySnapshot.forEach((doc) => {
        images.push(doc.data() as Image)
      })
      out$.next(images);
      this.message.Info(`Fetched ${images.length} latest images`)
    })

    return {results$: out$, unsubscribe: ()=>{unsub(); out$.complete()}} as ImageSubscription<Image[]>;
  }

  /**
   * Subscribe to updates for a particular image.
   */
  SubscribeToImage(imageRef: DocumentReference): ImageSubscription<Image> {
    const out = new Subject<Image>();
    const unsub = onSnapshot(imageRef, (snapshot) => {
      if (!snapshot.exists()) {
        return
      }
      this.convert.snapshotToImage(snapshot)
        .then(img=>out.next(img))
        .catch((err) => {this.message.Error(`SubscribeToImage(${shortenId(imageRef.id)}): ${err}`)})
    });
    return {
      results$: out,
      unsubscribe: ()=>{
        unsub()
        out.complete()
      }
    } as ImageSubscription<Image>;
  }

  async loadImagesBatched(params: {batchSize: number, constraint?: QueryConstraint, lastSeen?: unknown}): Promise<{images: Image[], last: unknown}> {
    return new Promise(async (resolve, reject) => {
      const queryContraints: unknown[] =  [orderBy("added", "desc"), limit(params.batchSize)]
      if ( params.lastSeen !== undefined ) {
        //@ts-ignore
        queryContraints.push(startAfter(params.lastSeen))
      }
      if ( params.constraint !== undefined ) {
        queryContraints.push(params.constraint)
      }
      const q = query(this.imagesCollection, ...queryContraints as QueryConstraint[])
      const snapshot = await getDocs(q)
      //@ts-ignore
      Promise.all(snapshot.docs.map(doc => this.convert.snapshotToImage(doc)))

        .then(imgResults => {
          const ret = {images: imgResults, last: snapshot.docs[snapshot.size - 1]}
          resolve(ret)
        })
        .catch(err => reject(err))
    })
  }

  /**
   * Load image data associated with the specified image by its id.
   */
  async LoadImageData(imageId: string): Promise<ImageData> {
    return new Promise(async(resolve, reject) => {
      const cached = this.imageCache.get(imageId);
      if ( cached ) {
        resolve(cached);
      }
      getDoc(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'))
        .then((doc) => {
          if ( !doc.exists() ) {
            const msg = `LoadImageData(${imageId}): not found`
            this.message.Error(msg)
            reject(msg)
          }
          this.convert.snapshotToImageData(doc)
            .then(imageData => {resolve(imageData as ImageData)})
            .catch((err: unknown) => {
              const msg = `LoadImageData(${imageId}): ${err}`
              this.message.Error(msg)
              reject(err)
            })
        })
    })
  }


  /**
   * Register a callback to use when tags are being applied, removed, etc.
   */
  RegisterTagUpdateCallback(func: TagUpdateCallback): void {
    this.tagUpdateCallback = func;
  }

  /**
   * Get a count of images associated with a particular tag.
   */
  async CountTagImages(tagRef: DocumentReference): Promise<number> {
    const q = query(this.imagesCollection,  where("tags", "array-contains", tagRef))
    return getCountFromServer(q).then(snap=>snap.data().count)
  }

  /**
   * Get a count of all images in the database.
   */
  async CountAllImages(): Promise<number> {
    return getCountFromServer(query(this.imagesCollection))
      .then(snap => snap.data().count)
  }

  private async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
    const hmac = await this.hmac.getHmacHex(image)
    return doc(this.firestore, imagesCollectionPath, hmac).withConverter(this.convert.imageConverter())
  }

  private async StorePlainImageData (ref: DocumentReference,  blob: Blob): Promise<void> {
    let scaledDown: Blob;
    try {
      scaledDown = await this.scale.ScaleImage(blob)
    } catch (err: unknown) {
      return Promise.reject(`Error scaling down image ${ref.id}: ${err}`);
    }

    const data = {
      'mimeType': blob.type,
      'thumbnail': await this.BytesFromBlob(scaledDown),
      'fullUrl': await this.StoreFullImage(ref, blob),
    } as StoredImageData

    try {
      await setDoc(doc(ref, 'data', 'thumbnail'), data)
    } catch(err: unknown) {
      return Promise.reject(`StorePlainImageData(${ref.id}): ${err}`)
    }
  }

  private async StoreEncryptedImageData(ref: DocumentReference, blob: Blob): Promise<void> {
    let scaledDown: Blob;
    try {
      scaledDown = await this.scale.ScaleImage(blob)
    } catch (err: unknown) {
      return Promise.reject(`Error scaling down image ${ref.id}: ${err}`);
    }

    try {
      const encryptedThumb = await this.encryption.Encrypt(await scaledDown.arrayBuffer())
      const encryptedFull = await this.encryption.Encrypt(await blob.arrayBuffer())
      const fullUrl = await this.StoreFullImage(ref, new Blob([encryptedFull.ciphertext], {type: blob.type}))
      return setDoc(doc(ref, 'data', 'thumbnail'), {
        'mimeType': blob.type,
        'thumbnail': await this.BytesFromBlob(new Blob([encryptedThumb.ciphertext], {type: blob.type})),
        'thumbnailIV': Bytes.fromUint8Array(new Uint8Array(encryptedThumb.iv)),
        'thumbnailKeyRef': encryptedThumb.keyReference,
        'fullUrl': fullUrl,
        'fullIV': Bytes.fromUint8Array(new Uint8Array(encryptedFull.iv)),
        'fullKeyRef': encryptedFull.keyReference,
      } as StoredImageData)
    } catch (err: unknown) {
      return Promise.reject(`Error encrypting ${shortenId(ref.id)} thumbnail: ${err}`)
    }
  }


  private async StoreFullImage(imageRef: DocumentReference, blob: Blob ): Promise<string> {
    const storageRef = ref(this.cloudStorageRef, imageRef.id);
    try {
      await uploadBytes(storageRef, blob)
      return getDownloadURL(storageRef);
    } catch (err: unknown) {
      return Promise.reject(`Error uploading ${shortenId(imageRef.id)} to cloud: ${err}`)
    }
  }

  private async BytesFromBlob(b: Blob): Promise<Bytes> {
    return Bytes.fromUint8Array(new Uint8Array(await b.arrayBuffer()))
  }
}

export class FakeImageService {

  images = new LRUCache<string, Image>({max:10})
  imageData = new LRUCache<string, ImageData>({max:10})
  encryption = new FakeEncryptionService();

  GetImageReferenceFromId(imageId: string): DocumentReference {
    return {id: imageId, path: `images/${imageId}`} as DocumentReference
  }

  GetStorageReferenceFromId(imageId: string): StorageReference {
    return {fullPath: `data/${imageId}`} as StorageReference
  }

  async AddTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const img = this.images.get(iRef.id)
    if ( img ) {
      const existing = img.tags.map(t=>t.id)
      for (const tag of tags) {
        if ( !existing.includes(tag.id) ) {
          img.tags.push(tag)
        }
      }
    }
  }

  async ReplaceTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const img = this.images.get(iRef.id)
    if ( img ) {
      img.tags = tags
    }
  }

  async RemoveTags(iRef: DocumentReference, tags: DocumentReference[]): Promise<void> {
    const img = this.images.get(iRef.id)
    if ( img ) {
      const existing = img.tags.map(t=>t.id)
      for (const tag of tags) {
        if ( !existing.includes(tag.id) ) {
          img.tags.push(tag)
        }
      }
    }
  }

  async StoreImage(blob: Blob, tags: DocumentReference[]): Promise<void> {
    const encoded = hex(await blob.arrayBuffer())
    const key = encoded.padEnd(16, "f").slice(0, 15)
    this.images.set(key, { tags: tags, reference: {id: key, path: `images/${key}`} as DocumentReference })
    const data = {
      thumbnail: blob,
      fullSize: ()=> Promise.resolve(blob),
      encryptionPresent: this.encryption.enabled(),
      decrypted: this.encryption.enabled(),
    } as ImageData
    this.imageData.set(key, data)
  }

  async DeleteImage(imageRef: DocumentReference) {
    this.images.delete(imageRef.id)
    this.imageData.delete(imageRef.id)
  }

  SubscribeToImageData(imageId: string): ImageSubscription<ImageData> {
    const sub = new Subject<ImageData>()
    const ret = {
      results$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageSubscription<ImageData>
    const cached = this.imageData.get(imageId)
    if (cached) {
      sub.next(cached)
    }
    return ret
  }

  SubscribeToTag(tagRef: DocumentReference, last_n_images: number): ImageSubscription<Image[]> {
    const sub = new Subject<Image[]>()
    const ret = {
      results$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageSubscription<Image[]>
    const images: Image[] = []
    for (const img of this.images.values()) {
      if (img.tags.map(t=>t.id).includes(tagRef.id)) {
        images.push(img)
        if (images.length == last_n_images) {
          break
        }
      }
    }
    sub.next(images)
    return ret
  }

  SubscribeToLatestImages(last_n_images: number): ImageSubscription<Image[]> {
    const sub = new Subject<Image[]>()
    const ret = {
      results$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageSubscription<Image[]>
    const images: Image[] = []
    for (const img of this.images.values()) {
      images.push(img)
      if (images.length == last_n_images) {
        break
      }
    }
    sub.next(images)
    return ret
  }

  async LoadImageData(imageId: string): Promise<ImageData> {
    const cached = this.imageData.get(imageId)
    if (cached) {
      return Promise.resolve(cached)
    }
    return Promise.reject(new Error(`Image ${imageId} not found`))
  }

  SubscribeToImage(imageRef: DocumentReference): ImageSubscription<Image> {
    const sub = new ReplaySubject<Image>()
    const ret = {
      results$: sub,
      unsubscribe: () => {sub.complete()},
    } as ImageSubscription<Image>
    const cached = this.images.get(imageRef.id)
    if (cached) {
      sub.next(cached)
    }
    return ret
  }

  RegisterTagUpdateCallback(func: TagUpdateCallback): void {}
}
