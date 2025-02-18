import {inject, Injectable} from '@angular/core';
import {
  arrayRemove,
  arrayUnion, Bytes,
  collection,
  doc,
  DocumentReference,
  DocumentSnapshot,
  Firestore, getDoc, limit, onSnapshot, orderBy, query, QueryConstraint,
  serverTimestamp, setDoc, updateDoc, where, writeBatch
} from '@angular/fire/firestore';
import {MessageService} from './message.service';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {HmacService} from './hmac.service';
import {deleteObject, getDownloadURL, ref, Storage, StorageReference, uploadBytes} from '@angular/fire/storage';
import {LRUCache} from 'lru-cache';
import {EncryptionService, FakeEncryptionService} from './encryption.service';
import {SnapshotOptions} from '@angular/fire/compat/firestore';
import {hex, shortenId} from './common';
import {ImageScaleService} from './image-scale.service';

export type Image = {
  // Tags that this image is associated with.
  tags: DocumentReference[]
  // Reference to this image.
  reference: DocumentReference
  // This is lazily loaded and cached.
  data?: ImageData
}

export type ImageData = {
  // The thumbnail blob.  Can be served up as a URL.
  thumbnail: Blob
  // A lazy loading function for fetching the full-sized image.
  fullSize: ()=>Promise<Blob>
  // Was the data encrypted in storage?
  encryptionPresent?: boolean
  // Was it successfully decrypted?
  decrypted?: boolean
}

// Maybe reconsider this interface.  The caller to subscribe can provide the observable.  And unsub can cancel and call complete.
export type ImageSubscription = {
  images$: Observable<Image[]>,
  unsubscribe: () => void,
}

export type ImageDataSubscription = {
  imageData$: Observable<ImageData>,
  unsubscribe: () => void,
}

type StoredImage = {
  added: unknown
  tags: DocumentReference[],
}

type StoredImageData = {
  // Mime-type of the image.
  mimeType: string,
  // Thumbnail data.
  thumbnail: Bytes,
  thumbnailIV?: Bytes,
  thumbnailKeyRef?: DocumentReference,
  // URL where the full-size image is stored.  May be encrypted
  fullUrl: string,
  fullIV?: Bytes,
  fullKeyRef?: DocumentReference,
}

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

  private imageCache: LRUCache<string, ImageData> = new LRUCache({'max': 100})
  private readonly imagesCollection: any;
  private imgCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0)
  private readonly cloudStorageRef = ref(this.storage, cloudDataPath)

  constructor() {
    this.imagesCollection = collection(this.firestore, imagesCollectionPath).withConverter(
      {toFirestore: this.imageToFirestore, fromFirestore: this.imageFromFirestore})
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
      .then(()=> this.message.Info(`Added ${tags.length} to image *${shortenId(iRef.id)}`))
      .catch((error: Error) => {this.message.Error(`Error adding tags ${tags} ${iRef.path}: ${error}`)});
  }

  /**
   * Replace all the tags on the specified image.
   */
  async ReplaceTags(iRef: DocumentReference, tags: DocumentReference[]) {
    return updateDoc(iRef, {'tags': tags})
      .then(()=>this.message.Info(`Updated tags (${tags.length}) for image ${shortenId(iRef.id)}`))
      .catch( e => this.message.Error(`ReplaceImageTags error: ${e}`));
  }

  /**
   * Remove the specified tags from the specified image.
   */
  async RemoveTags(iRef: DocumentReference, tags: DocumentReference[]): Promise<void> {
    return updateDoc(iRef, {tags: arrayRemove(...tags)})
      .then(()=>this.message.Info(`Removed ${tags.length} tags from image ${shortenId(iRef.id)}`))
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

    const snapshot = await getDoc(newImage.reference)
    if (snapshot.exists()) {
      this.AddTags(newImage.reference, newImage.tags)
        .then(()=>{this.message.Info(`Added ${newImage.tags.length} to image ${shortenId(newImage.reference.id)})`)})
        .catch((err: Error) => {this.message.Error(`Error adding tags to image ${shortenId(newImage.reference.id)}: ${err}`)});
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
  SubscribeToImageData(imageId: string): ImageDataSubscription {
    const imageData$ = new Subject<ImageData>();
    if ( this.imageCache.has(imageId) ) {
      imageData$.next(this.imageCache.get(imageId)!);
      return {imageData$: imageData$, unsubscribe: ()=> {imageData$.complete()}} as ImageDataSubscription
    }

    const unsub = onSnapshot(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'),
      doc => {
        if (!doc.exists()) {
          this.message.Error(`SubImageData(${imageId}): not found`)
          return;
        }
        const stored = doc.data() as StoredImageData;
        this.StoredImageDataToLive(stored, doc.ref)
          .then(imageData => {
            imageData$.next(imageData as ImageData)
          })
          .catch((err) => {
            this.message.Error(`SubImageData(${imageId}): ${err}`)
          })
      })

    return {imageData$: imageData$, unsubscribe: () => {imageData$.complete(); unsub()} } as ImageDataSubscription
  }

  /**
   * Subscribe to images that contain a particular tag.  Limit results to last N images based on creation time.
   */
  SubscribeToTag(tagRef: DocumentReference, last_n_images: number): ImageSubscription {
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

    return {images$: imagesObservable, unsubscribe: () => { unsub(); imagesObservable.complete()}} as ImageSubscription;
  }

  /**
   * Subscribe to the latest images added to storage up to last N images based on creation time.
   */
  SubscribeToLatestImages(last_n_images: number): ImageSubscription {
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

    return {images$: out$, unsubscribe: ()=>{unsub(); out$.complete()}} as ImageSubscription;
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
          const stored = doc.data() as StoredImageData;
          this.StoredImageDataToLive(stored, doc.ref)
            .then(imageData => {resolve(imageData as ImageData)})
            .catch((err: unknown) => {
              const msg = `LoadImageData(${imageId}): ${err}`
              this.message.Error(msg)
              reject(err)
            })
        })
    })
  }

  private imageToFirestore(liveImage: Image): StoredImage {
    return {
      added: serverTimestamp(),
      tags: liveImage.tags,
    };
  }

  private imageFromFirestore(snapshot:DocumentSnapshot, options: SnapshotOptions): Image {
    const data = snapshot.data(options) as StoredImage;
    if ( !snapshot.exists() ) {
      this.message.Error(`Error loading ${snapshot.id} from Firestore:  does not exist.`)
    }
    return {
      tags: data['tags'],
      reference: snapshot.ref,
    } as Image;
  }

  private imageConverter() {
    return {
      'toFirestore': this.imageToFirestore,
      'fromFirestore': this.imageFromFirestore,
    }
  }

  private async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
    const hmac = await this.hmac.getHmacHex(image)
    return doc(this.firestore, imagesCollectionPath, hmac).withConverter(this.imageConverter())
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

  private async StoredImageDataToLive(stored: StoredImageData, ref: DocumentReference): Promise<ImageData> {
    return new Promise(async (resolve, reject) => {
      if (!(stored?.thumbnailIV || stored?.thumbnailKeyRef || stored?.fullIV || stored?.fullKeyRef)) {
        const thumb = new Blob([stored.thumbnail.toUint8Array()], {type: stored.mimeType})
        const ret = {
          thumbnail: thumb,
          fullSize: () => Promise.resolve(fetch(stored.fullUrl).then(r=>r.blob())),
          encryptionPresent: false,
          decrypted: false,
        } as ImageData
        // Image data is stored under image/data/thumb, so we need the id of the parent image.
        this.imageCache.set(ref.parent!.parent!.id, ret)
        resolve(ret);
      }

      if ( !this.encryption.enabled() ) {
        this.message.Error(`Stored image ${ref.id} is encrypted, but encryption is not enabled.`)
        resolve({
          thumbnail: new Blob([stored.thumbnail.toUint8Array()], {type: stored.mimeType}),
          fullSize: () => Promise.resolve(fetch(stored.fullUrl).then(r=>r.blob())),
          encryptionPresent: true,
          decrypted: false,
        } as ImageData)
      }

      if (!stored?.thumbnailIV) {
        reject(new Error(`Encrypted image data ${ref.id} is missing .thumbnailIV`))
      }
      if (!stored?.thumbnailKeyRef) {
        reject(new Error(`Encrypted image data ${ref.id} is missing .thumbnailKeyRef`))
      }
      if (!stored?.fullIV) {
        reject(new Error(`Encrypted image data ${ref.id} is missing .fullIV`))
      }
      if (!stored?.fullKeyRef) {
        reject(new Error(`Encrypted image data ${ref.id} is missing .fullKeyRef`))
      }
      let decryptedThumb: ArrayBuffer | undefined
      try {
        decryptedThumb = await this.encryption.Decrypt({
          ciphertext: stored.thumbnail.toUint8Array(),
          iv: stored.thumbnailIV!.toUint8Array(),
          keyReference: stored.thumbnailKeyRef!,
        })
      } catch (e) {
        reject(new Error(`Error decrypting ${ref.id} encrypted thumbnail: ${e}`))
      }
      const ret = {
        thumbnail: new Blob([decryptedThumb!], {'type': stored.mimeType}),
        fullSize: () => {
          return new Promise((resolve, reject) => {
            fetch(stored.fullUrl)
              .then(res => res.blob())
              .then(enc => enc.arrayBuffer())
              .then(buf => this.encryption.Decrypt(
                {ciphertext: buf, iv: stored.fullIV!.toUint8Array(), keyReference: stored.fullKeyRef!}))
              .then(plain => resolve(new Blob([plain!], {'type': stored.mimeType})))
              .catch(e => reject(e));
          })
        },
        encryptionPresent: true,
        decrypted: true,
      } as ImageData
      // Image data is stored under image/data/thumb, so we need the id of the parent image.
      this.imageCache.set(ref.parent!.parent!.id, ret)
      resolve(ret)
    })
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

  SubscribeToImageData(imageId: string): ImageDataSubscription {
    const sub = new Subject<ImageData>()
    const ret = {
      imageData$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageDataSubscription
    const cached = this.imageData.get(imageId)
    if (cached) {
      sub.next(cached)
    }
    return ret
  }

  SubscribeToTag(tagRef: DocumentReference, last_n_images: number): ImageSubscription {
    const sub = new Subject<Image[]>()
    const ret = {
      images$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageSubscription
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

  SubscribeToLatestImages(last_n_images: number): ImageSubscription {
    const sub = new Subject<Image[]>()
    const ret = {
      images$: sub,
      unsubscribe: () => {sub.complete()}
    } as ImageSubscription
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

}
