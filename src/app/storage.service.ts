import {Injectable, inject, OnDestroy} from '@angular/core';
import {
  addDoc, arrayRemove, arrayUnion,
  Bytes,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  DocumentSnapshot,
  Firestore, getCountFromServer,
  getDoc,
  limit, onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc, updateDoc,
  where, writeBatch
} from '@angular/fire/firestore';

import {
  ref,
  Storage,
  StorageReference,
  uploadBytes,
  getDownloadURL, deleteObject
} from '@angular/fire/storage';

import { HmacService } from './hmac.service';
import {
  BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, firstValueFrom, from, interval, map,
  Observable, shareReplay, startWith,
  Subject, tap, withLatestFrom,
} from 'rxjs';
import {
  SnapshotOptions
} from '@angular/fire/compat/firestore';
import {EncryptionService} from './encryption.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {LRUCache} from 'lru-cache';
import {MessageService} from './message.service';


export type StoredImage = {
  // Timestamp of creation.  Facilitates sorting by latest x images.
  added: Date,
  // The mime type of the image.
  mimeType: string,
  // Collection of applicable tag IDs, references to firestore documents
  tags: DocumentReference[]
}

export type StoredImageData = {
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

// AppImage is an image that has been fetched from storage, had its data and tags decrypted
// if necessary and is now being "served" from the local host.
export type LiveImage = {
  // MimeType that is re-attached to Blobs being served from both URLs above.
  mimeType: string,
  // References to tags that apply to this image.
  tags: DocumentReference[]
  // Firestore reference to this image.
  reference: DocumentReference
  // These can get out of sync since they are stored separately.
  // The url of the thumbnail.  The data comes from firestore via ImageData.
  thumbnailUrl?: string,
  // The url of the raw image data.  If not set, indicates need to fetch from cloud.
  fullUrl?: string,
}

export type LiveTag = Readonly<{
  // The plain text name of the stored tag.  Decrypted if necessary.
  name: string,
  // Firestore reference to this tag.
  reference: DocumentReference
}>

export type LiveImageData = Readonly<{
  mimeType: string,
  thumbnailUrl: string,
  fullUrl: ()=>Promise<Blob>,
}>


// Tag document as stored in cloud firestore
export type StoredTag = {
  // Bytes because it may be encrypted.
  name: Bytes,
  iv?: Bytes,
  keyReference?: DocumentReference,
}

export type ImageSubscription = {
  images$: Observable<LiveImage[]>,
  unsubscribe: () => void,
}

// TagMap retains a map of tag names to HMACs / tag ids for easy lookup.
type TagMap = Record<string, LiveTag>

const LOCAL_STORAGE_KEY_IMAGES = "prestige-ape-images";

const keysCollectionPath = 'keys'
const imagesCollectionPath = 'images'
const tagsCollectionPath = 'tags'
const cloudDataPath = 'data'

@Injectable({
  providedIn: 'root'
})
export class StorageService implements OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private hmac: HmacService = inject(HmacService);
  private encryption: EncryptionService = inject(EncryptionService);
  private messageService: MessageService = inject(MessageService);
  private storage = inject(Storage);

  private imagesCollection: any;
  private tagsCollection: any;
  private cloudStorage: any;
  private tagsByName: TagMap = {};
  private tagsById: TagMap = {};
  private unsubTagCollection: any;
  private unsubImageCount: any;
  private imageCache: LRUCache<string, LiveImageData> = new LRUCache({'max': 100})
  private imgCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0)
  private tagCount$: BehaviorSubject<number> = new BehaviorSubject<number>(0)

  // All tags known to the storage service.
  tags$ = new BehaviorSubject<LiveTag[]>([]);
  private appliedTags$ = new BehaviorSubject<LiveTag[]>([]);
  private lastRecentlyUsed$ = new BehaviorSubject<LiveTag[]>([]);
  // Tags used most recently.  Contains the entire tags$ output, but in order of use.
  recentTags$: Observable<LiveTag[]>;

  constructor() {
    this.imagesCollection = collection(this.firestore, imagesCollectionPath).withConverter(this.imageConverter())
    this.tagsCollection = collection(this.firestore, tagsCollectionPath)
    this.cloudStorage = ref(this.storage, cloudDataPath)
    this.recentTags$ = this.appliedTags$.pipe(
      takeUntilDestroyed(),
      withLatestFrom(this.lastRecentlyUsed$.pipe(startWith([])), this.tags$),
      map(([applied, lastEmission, stored]) => {
        const appliedIds = applied.map(t=>t.reference.id)
        let ret: LiveTag[];
        if ( stored.length > lastEmission.length ) {
          ret = stored.filter(t=> !appliedIds.includes(t.reference.id))
        } else {
          ret = lastEmission.filter(t=> !appliedIds.includes(t.reference.id))
        }
        ret.unshift(...applied)
        this.lastRecentlyUsed$.next(ret)
        return ret;
      }),
      distinctUntilChanged(),
      shareReplay(),
    )
    this.startSubscriptions()
  }

  private async startSubscriptions(){
    // Bootstrap listening for all tags
    const allTagsQuery = query(this.tagsCollection);
    this.unsubTagCollection = onSnapshot(allTagsQuery, (querySnapshot) => {
      const tags: Promise<LiveTag>[] = [];
      querySnapshot.forEach((doc) => {
        tags.push(this.LiveTagFromStorage(doc.data() as StoredTag, doc.ref as DocumentReference));
      })
      Promise.all(tags).then(liveTags => {
        this.tagsByName = Object.fromEntries(liveTags.map(t => [t.name, t]))
        this.tagsById = Object.fromEntries(liveTags.map(t => [t.reference.id, t]))
        this.tags$.next(liveTags.sort((a, b) => a.name.localeCompare(b.name)));
        this.tagCount$.next(liveTags.length);
      })
    })
    this.unsubImageCount = combineLatest([this.imgCount$, this.tagCount$]).subscribe(
      ([imgCnt, tagCnt]) => {
        this.messageService.stats$.next(`${imgCnt} images | ${tagCnt} tags`)
      }
    )
    getCountFromServer(this.imagesCollection)
      .then((snap)=> {this.imgCount$.next(snap.data().count)})
      .catch((err) => {this.messageService.Error(`Error fetching image count: ${err}`)})
  }

  ngOnDestroy() {
    this.unsubTagCollection();
    this.unsubImageCount();
  }

  // Obtain a subscription to supplied tag that will return the last n images that have
  // had the tag applied.  -1 Indicates all images.
  SubscribeToTag(tag: LiveTag, last_n_images: number): ImageSubscription {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }

    const q = query(
      this.imagesCollection,
      where("tags", "array-contains", tag.reference),
      ...constraints)

    const imagesObservable = new Subject<LiveImage[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
      const images: LiveImage[] = [];
      querySnapshot.forEach((doc) => {
        images.push(doc.data() as LiveImage)
      })
      imagesObservable.next(images)
      this.messageService.Info(`${tag.name} now has ${images.length} images`)
    })

    return {images$: imagesObservable, unsubscribe: unsub} as ImageSubscription;
  }

  // Used to fetch image data associated with an image.
  SubscribeToImageData(imageId: string, out$: Subject<LiveImageData>): () => void {
    if ( this.imageCache.has(imageId) ) {
      out$.next(this.imageCache.get(imageId)!);
      out$.complete();
      return ()=>{}
    }
    return onSnapshot(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'),
      doc => {
        if ( !doc.exists() ) {
          this.messageService.Error(`SubImageData(${imageId}): not found`)
          return;
        }
        const stored = doc.data() as StoredImageData;
        this.StoredImageDataToLive(stored, doc.ref)
          .then(imageData => {out$.next(imageData as LiveImageData)})
          .catch((err) => {this.messageService.Error(`SubImageData(${imageId}): ${err}`)})
      })
  }

  async LoadImageData(imageId: string): Promise<LiveImageData> {
    return new Promise(async(resolve, reject) => {
      const cached = this.imageCache.get(imageId);
      if ( cached ) {
        resolve(cached);
      }
      getDoc(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'))
        .then((doc) => {
          if ( !doc.exists() ) {
            this.messageService.Error(`LoadImageData(${imageId}): not found`)
            return;
          }
          const stored = doc.data() as StoredImageData;
          this.StoredImageDataToLive(stored, doc.ref)
            .then(imageData => {resolve(imageData as LiveImageData)})
            .catch((err: unknown) => {this.messageService.Error(`LoadImageData(${imageId}): ${err}`)})
        })
    })
  }

  SubscribeToLatestImages(last_n_images: number): ImageSubscription {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }
    const q = query(this.imagesCollection, ...constraints)

    const imagesObservable = new Subject<LiveImage[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
      const images: LiveImage[] = [];
      querySnapshot.forEach((doc) => {
        images.push(doc.data() as LiveImage)
      })
      imagesObservable.next(images);
      this.messageService.Info(`Fetched ${images.length} latest images`)
    })

    return {images$: imagesObservable, unsubscribe: unsub} as ImageSubscription;
  }

  TagRefByName(name: string): DocumentReference | undefined {
    return this.tagsByName[name]?.reference
  }

  TagByName(name: string): LiveTag | undefined {
    return this.tagsByName[name]
  }

  // Return cached copy of the tag by its id.  This can be a miss before the tag subscription has executed for the first time.
  TagById(id: string): LiveTag | undefined {
    return this.tagsById[id]
  }

  // GetTagReference returns a document reference to a tag based on the tag's name
  private async GetTagReference(name: string): Promise<DocumentReference> {
    const cached = this.TagByName(name)?.reference
    if ( cached !== undefined ) {
      return cached;
    }
    const id = await this.hmac.getHmacHex(new Blob([name], {type: 'text/plain'}))
    return doc(this.firestore,  this.tagsCollection.path, id);
  }

  private async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
    const hmac = await this.hmac.getHmacHex(image)
    return doc(this.firestore, imagesCollectionPath, hmac).withConverter(this.imageConverter())
  }

  GetImageReferenceFromId(imageId: string): DocumentReference {
    return doc(this.firestore, imagesCollectionPath, imageId)
  }

  GetStorageReferenceFromId(imageId: string): StorageReference {
    return ref(this.cloudStorage, imageId)
  }

  // Save a tag to firestore.
  async StoreTag(name: string): Promise<LiveTag>  {
    return new Promise(async (resolve, reject) => {
      const ref = await this.GetTagReference(name);
      const live = {name: name, reference: ref} as LiveTag;
      const tag = await this.LiveTagToStorage(live)
      return setDoc(ref, tag)
        .then(()=> {
          this.messageService.Info(`Created tag: ${name}`)
          resolve(live)
        })
        .catch((err: Error) => {this.messageService.Error(`Error storing tag ${tag.name}: ${err}`)});
    });
  }

  async LoadTagByReference(ref: DocumentReference): Promise<LiveTag> {
    const cached = this.TagById(ref.id)
    if ( cached ) {
      return cached as LiveTag;
    }
    return new Promise(async (resolve, reject) => {
      return getDoc(ref)
        .then((snapshot: DocumentSnapshot) => {
          if ( snapshot.exists() ) {
            resolve(this.LiveTagFromStorage(snapshot.data() as StoredTag, ref));
          } else {
            const msg = `LoadTagByReference(${ref.id}): not found`
            this.messageService.Error(msg)
            reject(msg);
          }
        })
        .catch((err: Error) => {
          this.messageService.Error(err)
        })
    })
  }

  // Load a tag from firestore.  If provided with a reference, it is assumed to have been made using
  // GetTagReference which makes use of a converter.
  async LoadTagByName(name: string): Promise<LiveTag> {
    const cached = this.TagByName(name);
    if ( cached !== undefined ) {
      this.messageService.Info(`Fetched (cached) tag: ${name}`)
      return cached
    }
    const tagRef = await this.GetTagReference(name)
    return this.LoadTagByReference(tagRef)
  }

  // Add specified tags to this image.
  async AddTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const updatedTags = tags.map(t=>this.tagsById[t.id])
    this.appliedTags$.next(updatedTags)
    updateDoc(iRef, {tags: arrayUnion(...tags)})
      .then(()=> this.messageService.Info(`Added ${tags.length} to image *${shortenId(iRef.id)}`))
      .catch((error: Error) => {this.messageService.Error(`Error adding tags ${tags} ${iRef.path}: ${error}`)});
  }

  // Store a new image received by URL.
  async StoreImageFromUrl(url: string, tagNames: string[]): Promise<void> {
    const imageBlob = await fetch(url).then((response) => response.blob().then(b => b));
    const iRef = await this.GetImageReferenceFromBlob(imageBlob);

    const newImage: LiveImage = {
      mimeType: imageBlob.type,
      tags: tagNames.map(name => this.TagRefByName(name)).filter(t => t !== undefined),
      reference: iRef,
    }

    const snapshot = await getDoc(newImage.reference)
    if (snapshot.exists()) {
      this.AddTags(newImage.reference, newImage.tags)
        .then(()=>{this.messageService.Info(`Added ${newImage.tags.length} to image ${shortenId(newImage.reference.id)})`)})
        .catch((err: Error) => {this.messageService.Error(`Error adding tags to image ${shortenId(newImage.reference.id)}: ${err}`)});
      return;
    }

    try {
      await setDoc(newImage.reference, newImage).then(()=> {this.imgCount$.next(this.imgCount$.value + 1)})
      const fullUrl = await this.StoreFullImage(iRef, imageBlob);
      await this.StoreImageData(iRef, imageBlob, fullUrl);
      this.messageService.Info(`Added new image ${shortenId(newImage.reference.id)}`)
    } catch (err: unknown) {
      this.messageService.Error(`Error adding image ${shortenId(newImage.reference.id)}: ${err}`)
    }
  }

  private async StoreImageData(ref: DocumentReference,  blob: Blob, fullUrl: string): Promise<void> {
    let scaledDown: Blob;
    try {
      scaledDown = await this.scaleImage(blob)
    } catch (err: unknown) {
      this.messageService.Error(`Error scaling down image ${ref.id}: ${err}`)
      return;
    }

    // There needs to be a better way of doing this.  There is probably some app-wide mode that indicates
    // whether encryption is wanted or not.
    if ( (await firstValueFrom(this.encryption.currentState$) == this.encryption.ReadyStateReady()) ){
      try {
        const encryptedThumb = await this.encryption.Encrypt(await scaledDown.arrayBuffer())
        const encryptedFull = await this.encryption.Encrypt(await blob.arrayBuffer())
        const fullUrl = await this.StoreFullImage(ref, new Blob([encryptedFull.ciphertext], {type: blob.type}))
        return setDoc(doc(ref, 'data', 'thumbnail'), {
          'mimeType': blob.type,
          'thumbnail': await this.BytesFromBlob(new Blob([encryptedThumb.ciphertext], { type: blob.type })),
          'thumbnailIV': Bytes.fromUint8Array(new Uint8Array(encryptedThumb.iv)),
          'thumbnailKeyRef': encryptedThumb.keyReference,
          'fullUrl': fullUrl,
          'fullIV': Bytes.fromUint8Array(new Uint8Array(encryptedFull.iv)),
          'fullKeyRef': encryptedFull.keyReference,
        } as StoredImageData)
      } catch (err: unknown) {
        this.messageService.Error(`Error encrypting ${shortenId(ref.id)} thumbnail: ${err}`)
        throw new Error(`Error encrypting ${ref.id} thumbnail: ${err}`)
      }
    }

    const data = {
      'mimeType': blob.type,
      'thumbnail': await this.BytesFromBlob(scaledDown),
      'fullUrl': fullUrl,
    } as StoredImageData

    setDoc(doc(ref, 'data', 'thumbnail'), data)
      .catch((err: unknown)=> {this.messageService.Error(`StoreImageData(${ref.id}): ${err}`)})
  }

  private async StoreFullImage(imageRef: DocumentReference, blob: Blob ): Promise<string> {
    const storageRef = ref(this.cloudStorage, imageRef.id);
    try {
      await uploadBytes(storageRef, blob)
      return getDownloadURL(storageRef);
    } catch (err: unknown) {
      this.messageService.Error(`Error uploading ${shortenId(imageRef.id)} to cloud: ${err}`)
      throw new Error(`Error uploading ${shortenId(imageRef.id)} to cloud: ${err}`)
    }
  }

  // Given StoredImageData convert to LiveIMagedata and ship via out.
  private async StoredImageDataToLive(stored: StoredImageData, ref: DocumentReference): Promise<LiveImageData> {
    return new Promise(async (resolve, reject) => {
      if (!(stored?.thumbnailIV || stored?.thumbnailKeyRef || stored?.fullIV || stored?.fullKeyRef)) {
        const thumb = new Blob([stored.thumbnail.toUint8Array()], {type: stored.mimeType})
        const ret = {
          mimeType: stored.mimeType,
          thumbnailUrl: URL.createObjectURL(thumb),
          fullUrl: () => Promise.resolve(fetch(stored.fullUrl).then(r=>r.blob())),
        } as LiveImageData
        // Image data is stored under image/data/thumb, so we need the id of the parent image.
        this.imageCache.set(ref.parent!.parent!.id, ret)
        resolve(ret);
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
        mimeType: stored.mimeType,
        thumbnailUrl: URL.createObjectURL(new Blob([decryptedThumb!], {'type': stored.mimeType})),
        fullUrl: () => {
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
      } as LiveImageData
      // Image data is stored under image/data/thumb, so we need the id of the parent image.
      this.imageCache.set(ref.parent!.parent!.id, ret)
      resolve(ret)
    })
  }

  // Remove the specified tag from the specified image.
  async DeleteImageTag(image: LiveImage, tag: string): Promise<void> {
    const imageRef = await this.GetImageReferenceFromId(image.reference.id);
    const tagRef = await this.GetTagReference(tag);
    updateDoc(imageRef, {tags: arrayRemove(tagRef)}).catch(
      (err: Error) => {this.messageService.Error(`Error deleting tag ${tag} from ${imageRef.path}: ${err}`)}
    )
  }

  async DeleteImage(imageRef: DocumentReference) {
    const batch = writeBatch(this.firestore)
    batch.delete(doc(this.firestore, this.imagesCollection.path, imageRef.id, 'data', 'thumbnail'));
    batch.delete(imageRef);
    try {
      await batch.commit()
      await deleteObject(this.GetStorageReferenceFromId(imageRef.id))
    } catch (err: unknown) {
      this.messageService.Error(`Error deleting image ${shortenId(imageRef.id)}: ${err}`)
      return Promise.reject(err)
    }
    return Promise.resolve()
  }

  // Replace image tags with those in the live image.  If the tag list is empty delete the image instead.
  async ReplaceImageTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const updatedTags = tags.map(t=>this.tagsById[t.id])
    this.appliedTags$.next(updatedTags)
    return updateDoc(iRef, {'tags': tags})
      .then(()=>this.messageService.Info(`Updated tags (${tags.length}) for image ${shortenId(iRef.id)}`))
      .catch( e => this.messageService.Error(`ReplaceImageTags error: ${e}`));
  }

  private async LiveTagToStorage(tag: LiveTag): Promise<StoredTag> {
    const encodedName = (new TextEncoder()).encode(tag.name);
    if ( !(await firstValueFrom(this.encryption.currentState$)) ) {
      return {'name': Bytes.fromUint8Array(encodedName) } as StoredTag;
    }
    const res = await this.encryption.Encrypt(encodedName);
    return {
      'name': Bytes.fromUint8Array(new Uint8Array(res.ciphertext)),
      'iv': Bytes.fromUint8Array(new Uint8Array(res.iv)),
      'keyReference': res.keyReference,
    } as StoredTag;
  }

  private async LiveTagFromStorage(tag: StoredTag, ref: DocumentReference): Promise<LiveTag> {
    if ( !( tag?.iv || tag?.keyReference ) ) {
      return {
        'name': tag.name.toString(),
        'reference': ref,
      } as LiveTag;
    }
    const name = await this.encryption.Decrypt(
      {'ciphertext': tag.name.toUint8Array(), 'iv': tag.iv!.toUint8Array(), keyReference: tag.keyReference!})
    return {
      'name': (new TextDecoder()).decode(name),
      reference: ref
    }
  }

  // Convert a blob to a firestore Bytes object.
  private async BytesFromBlob(b: Blob): Promise<Bytes> {
    return Bytes.fromUint8Array(new Uint8Array(await b.arrayBuffer()))
  }

  private imageToFirestore(liveImage: LiveImage) {
    // Need to store thumbnail.
    // Need to store raw image.
    return {
      added: serverTimestamp(),
      mimeType: liveImage.mimeType,
      tags: liveImage.tags,
    };
  }

  private imageFromFirestore(snapshot:DocumentSnapshot, options: SnapshotOptions): LiveImage {
    const data = snapshot.data(options) as StoredImage;
    if ( !snapshot.exists() ) {
      this.messageService.Error(`Error loading ${snapshot.id} from Firestore:  does not exist.`)
    }
    return {
      mimeType: data['mimeType'],
      tags: data['tags'],
      reference: snapshot.ref,
    } as LiveImage;
  }

  private imageConverter() {
    return {
      'toFirestore': this.imageToFirestore,
      'fromFirestore': this.imageFromFirestore,
    }
  }

  private scaleImage(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const height = 400;
      const width = 0;
      const img = new Image();
      img.onload = () => {
        const el = document.createElement('canvas');
        const dir = (width < img.width || height < img.height) ? 'min' : 'max';
        const stretch = width && height;
        const ratio = Math[dir](
          (width / img.width) || 1,
          (height / img.height) || 1
        );
        let w = el.width = stretch ? width : img.width * ratio;
        let h = el.height = stretch ? height : img.height * ratio;
        const ctx = el.getContext('2d');
        if (!ctx) {
          this.messageService.Error("scaleImage(): no context!");
        }
        // @ts-ignore
        ctx.drawImage(img, 0, 0, w, h);
        el.toBlob(scaled => {
          if ( scaled ) {
            resolve(scaled)
          }
          reject('Not a blob!')
        }, blob.type);
      }
      img.src = URL.createObjectURL(blob);
    })
  }
}

function shortenId(id: string): string {
  return `*${id.slice(-6)}`
}
