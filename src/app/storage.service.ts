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
  where
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
  BehaviorSubject, debounceTime, distinctUntilChanged, firstValueFrom, from, interval, map,
  Observable, shareReplay,
  Subject, tap, withLatestFrom,
} from 'rxjs';
import {
  SnapshotOptions
} from '@angular/fire/compat/firestore';
import {EncryptionService} from './encryption.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {LRUCache} from 'lru-cache';
import {MessageService} from './message.service';


export type EncryptionMetadata = {
  // IV used during encryption.
  iv: Bytes
  // Key id or reference to a wrapped key stored in Firestore.  The key used for data encryption.
  keyReference: DocumentReference,
}

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

export type StoredEncryptedImage = StoredImage & EncryptionMetadata;

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
  fullUrl: ()=>Promise<string>,
}>


// Tag document as stored in cloud firestore
export type StoredTag = {
  // Bytes because it may be encrypted.
  name: Bytes,
}

export type StoredEncryptedTag = StoredTag & EncryptionMetadata;

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
  private imgCount: number = 0;
  private tagCount: number = 0;

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
      withLatestFrom(this.lastRecentlyUsed$, this.tags$),
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

  async startSubscriptions(){
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
        this.tagCount = liveTags.length;
      })
    })
    this.unsubImageCount = interval(1000).subscribe(()=>{this.messageService.stats$.next(`${this.imgCount} images | ${this.tagCount} tags`)})
    getCountFromServer(this.imagesCollection)
      .then((snap)=> {this.imgCount = snap.data().count})
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
        this.StoredImageDataToLive(stored, doc.ref, out$);
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
  async GetTagReference(name: string): Promise<DocumentReference> {
    const cached = this.TagByName(name)?.reference
    if ( cached !== undefined ) {
      return cached;
    }
    const id = await this.hmac.getHmacHex(new Blob([name], {type: 'text/plain'}))
    return doc(this.firestore,  this.tagsCollection.path, id);
  }

  async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
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

  // Load a tag from firestore.  If provided with a reference, it is assumed to have been made using
  // GetTagReference which makes use of a converter.
  async LoadTagByName(name: string): Promise<LiveTag> {
    const cached = this.TagByName(name);
    if ( cached !== undefined ) {
      this.messageService.Info(`Fetched (cached) tag: ${name}`)
      return cached
    }

    return new Promise(async (resolve, reject) => {
      const tagRef = await this.GetTagReference(name)
     return  getDoc(tagRef)
        .then((snapshot: DocumentSnapshot) => {
          if ( snapshot.exists() ) {
            this.messageService.Info(`Fetched (stored) tag: ${name}`)
            resolve(this.LiveTagFromStorage(snapshot.data() as StoredTag, snapshot.ref));
          } else {
            this.messageService.Error(`LoadTagByName(${name}): not found`)
            reject(`LoadTagByName(${name}): not found`);
          }
        })
        .catch((err: Error) => {
          this.messageService.Error(`Error loading tag by reference ${(tagRef as DocumentReference).id}: ${err.message}`)
        })
    })
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
    const existing  = await this.StoreImage(newImage);
    if (existing) {
      this.messageService.Info(`Received existing image *${shortenId(newImage.reference.id)}`);
      return;
    }
    const fullUrl = await this.StoreFullImage(iRef, imageBlob);
    this.messageService.Info(`Stored full-size image *${shortenId(newImage.reference.id)}`)
    await this.StoreImageData(iRef, imageBlob, fullUrl);
    this.messageService.Info(`Stored thumbnail for ${shortenId(newImage.reference.id)}`)
  }

  // Store a new image received by the application.  If it exists, update its list of tags.
  async StoreImage(img: LiveImage): Promise<Boolean> {
    const snapshot =  await getDoc(img.reference)
    if ( snapshot.exists() ) {
      this.AddTags(img.reference, img.tags)
      this.messageService.Info(`Added ${img.tags.length} to image ${shortenId(img.reference.id)})`)
      return true
    }
    setDoc(img.reference, img)
    return false
  }

  async StoreImageData(ref: DocumentReference,  blob: Blob, fullUrl: string): Promise<void> {
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

    return setDoc(doc(ref, 'data', 'thumbnail'), {
      'mimeType': blob.type,
      'thumbnail': await this.BytesFromBlob(scaledDown),
      'fullUrl': fullUrl,
    } as StoredImageData).then(()=> {this.imgCount+=1})
  }

  async StoreFullImage(imageRef: DocumentReference, blob: Blob ): Promise<string> {
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
  async StoredImageDataToLive(stored: StoredImageData, ref: DocumentReference, out$: Subject<LiveImageData>) {
    if ( !(stored?.thumbnailIV || stored?.thumbnailKeyRef || stored?.fullIV || stored?.fullKeyRef) ) {
      const thumb = new Blob([stored.thumbnail.toUint8Array()], {type: stored.mimeType})
      const ret = {
        mimeType: stored.mimeType,
        thumbnailUrl: URL.createObjectURL(thumb),
        fullUrl: ()=>Promise.resolve(stored.fullUrl),
      } as LiveImageData
      // Image data is stored under image/data/thumb, so we need the id of the parent image.
      this.imageCache.set(ref.parent!.parent!.id, ret)
      out$.next(ret)
      out$.complete();
      return;
    }
    if ( !stored?.thumbnailIV ) { throw new Error(`Encrypted image data ${ref.id} is missing .thumbnailIV`)}
    if ( !stored?.thumbnailKeyRef ) { throw new Error(`Encrypted image data ${ref.id} is missing .thumbnailKeyRef`)}
    if ( !stored?.fullIV ) { throw new Error(`Encrypted image data ${ref.id} is missing .fullIV`)}
    if ( !stored?.fullKeyRef ) { throw new Error(`Encrypted image data ${ref.id} is missing .fullKeyRef`)}
    let decryptedThumb: ArrayBuffer | undefined
    try {
      decryptedThumb = await this.encryption.Decrypt({
        ciphertext: stored.thumbnail.toUint8Array(),
        iv: stored.thumbnailIV.toUint8Array(),
        keyReference: stored.thumbnailKeyRef,
      })
    } catch (e){
      throw new Error(`Error decrypting ${ref.id} encrypted thumbnail: ${e}`);
    }
    const ret = {
      mimeType: stored.mimeType,
      thumbnailUrl: URL.createObjectURL(new Blob([decryptedThumb!], {'type': stored.mimeType})),
      fullUrl: ()=> {
        return new Promise((resolve, reject) => {
          fetch(stored.fullUrl)
            .then(res => res.blob())
            .then(enc => enc.arrayBuffer())
            .then(buf => this.encryption.Decrypt(
              {ciphertext: buf, iv: stored.fullIV!.toUint8Array(), keyReference: stored.fullKeyRef!}))
            .then(plain => resolve(URL.createObjectURL(new Blob([plain!], {'type': stored.mimeType}))))
            .catch(e => reject(e));
        })
      },
    } as LiveImageData
    // Image data is stored under image/data/thumb, so we need the id of the parent image.
    this.imageCache.set(ref.parent!.parent!.id, ret)
    out$.next(ret)
    out$.complete()
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
    getDoc(imageRef).then((snapshot) => {
      if ( !snapshot.exists() ) {
        return;
      }
      deleteObject(this.GetStorageReferenceFromId(imageRef.id))
        .finally(() => {
          deleteDoc(imageRef)
            .then(()=>{this.imgCount-=1})
            .catch((err: unknown) => {this.messageService.Error(`Error deleting image ${shortenId(imageRef.id)}: ${err}`)})
        });
    })
  }

  // Replace image tags with those in the live image.  If the tag list is empty delete the image instead.
  async ReplaceImageTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const updatedTags = tags.map(t=>this.tagsById[t.id])
    this.appliedTags$.next(updatedTags)
    return updateDoc(iRef, {'tags': tags})
      .then(()=>this.messageService.Info(`Updated tags (${tags.length}) for image ${shortenId(iRef.id)}`))
      .catch( e => this.messageService.Error(`ReplaceImageTags error: ${e}`));
  }

  async LiveTagToStorage(tag: LiveTag): Promise<StoredTag|StoredEncryptedTag> {
    const encodedName = (new TextEncoder()).encode(tag.name);
    if ( !(await firstValueFrom(this.encryption.currentState$)) ) {
      return {'name': Bytes.fromUint8Array(encodedName) } as StoredTag;
    }
    const res = await this.encryption.Encrypt(encodedName);
    return {
      'name': Bytes.fromUint8Array(new Uint8Array(res.ciphertext)),
      'iv': Bytes.fromUint8Array(new Uint8Array(res.iv)),
      'keyReference': res.keyReference,
    } as StoredEncryptedTag;
  }

  async LiveTagFromStorage(tag: StoredTag|StoredEncryptedTag, ref: DocumentReference): Promise<LiveTag> {
    if ( !( tag.hasOwnProperty('iv') || tag.hasOwnProperty('key') ) ) {
      return {
        'name': tag.name.toString(),
        'reference': ref,
      } as LiveTag;
    }
    const encrypted = tag as StoredEncryptedTag;
    const name = await this.encryption.Decrypt(
      {'ciphertext': encrypted.name.toUint8Array(), 'iv': encrypted.iv.toUint8Array(), keyReference: encrypted.keyReference})
    return {
      'name': (new TextDecoder()).decode(name),
      reference: ref
    }
  }

  // Convert a blob to a firestore Bytes object.
  async BytesFromBlob(b: Blob): Promise<Bytes> {
    return Bytes.fromUint8Array(new Uint8Array(await b.arrayBuffer()))
  }

  imageToFirestore(liveImage: LiveImage) {
    // Need to store thumbnail.
    // Need to store raw image.
    return {
      added: serverTimestamp(),
      mimeType: liveImage.mimeType,
      tags: liveImage.tags,
    };
  }

  imageFromFirestore(snapshot:DocumentSnapshot, options: SnapshotOptions): LiveImage {
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

  imageConverter() {
    return {
      'toFirestore': this.imageToFirestore,
      'fromFirestore': this.imageFromFirestore,
    }
  }

  scaleImage(blob: Blob): Promise<Blob> {
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
