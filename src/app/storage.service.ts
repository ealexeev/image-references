import {Injectable, inject, OnDestroy} from '@angular/core';
import {
  addDoc, arrayRemove, arrayUnion,
  Bytes,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  getDoc, increment,
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
  getStorage,
  FirebaseStorage,
  connectStorageEmulator,
  StorageReference,
  uploadBytes,
  getDownloadURL, deleteObject
} from '@angular/fire/storage';

import { HmacService } from './hmac.service';
import {
  BehaviorSubject, firstValueFrom,
  Observable,
  Subject,
} from 'rxjs';
import { environment } from './environments/environment';
import {
  SnapshotOptions
} from '@angular/fire/compat/firestore';
import {EncryptionService} from './encryption.service';


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
  // URL where the full-size image is stored.  May be encrypted
  fullUrl: string,
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
  fullUrl: string,
}>


// Tag document as stored in cloud firestore
export type StoredTag = {
  // Bytes because it may be encrypted.
  name: Bytes,
}

export type StoredEncryptedTag = StoredTag & EncryptionMetadata;

export type TagSubscription = {
  images$: Observable<LiveImage[]>,
  unsubscribe: () => void,
}

// KeyMap retains a map of key ids (HMACs) to wrapped key bytes.
type KeyMap = Record<string, Bytes>
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

  private storage: FirebaseStorage;
  private keysCollection: any;
  private imagesCollection: any;
  private tagsCollection: any;
  private cloudStorage: any;
  private keys: KeyMap = {};
  private tagsByName: TagMap = {};
  private tagsById: TagMap = {};
  private unsubTagCollection: any;

  // All tags known to the storage service.
  tags$ = new BehaviorSubject<LiveTag[]>([]);

  // This will eventually get replaced by butter-bar service to which messages are sent.
  errors$ = new Subject<String>;


  constructor() {
    this.keysCollection = collection(this.firestore, keysCollectionPath)
    this.imagesCollection = collection(this.firestore, imagesCollectionPath).withConverter(this.imageConverter())
    this.tagsCollection = collection(this.firestore, tagsCollectionPath)
    if (environment.firestoreUseLocal) {
      connectFirestoreEmulator(this.firestore, 'localhost', 8080, {})
    }
    this.storage = getStorage();
    if (environment.firebaseStorageUseLocal) {
      connectStorageEmulator(this.storage, "127.0.0.1", 9199);
    }
    this.cloudStorage = ref(this.storage, cloudDataPath)
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
        this.tags$.next(liveTags);
      })
    })
  }

  ngOnDestroy() {
    this.unsubTagCollection();
  }

  // Obtain a subscription to supplied tag that will return the last n images that have
  // had the tag applied.  -1 Indicates all images.
  SubscribeToTag(tag: LiveTag, last_n_images: number): TagSubscription {
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
      imagesObservable.next(images);
    })

    return {images$: imagesObservable, unsubscribe: unsub} as TagSubscription;
  }

  // Used to fetch image data associated with an image.
  SubscribeToImageData(imageId: string, out: Subject<LiveImageData>): () => void {
    return onSnapshot(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'),
      doc => {
        if ( !doc.exists() ) {
          console.error(`SubImageData(${imageId}): not found`);
          return;
        }
        const stored = doc.data() as StoredImageData;
        const thumb = new Blob([stored.thumbnail.toUint8Array()], {type: stored.mimeType})
        // Decryption needs to be added here.  Likely both are first fetched, decrypted, and then get a
        // local URL.
        out.next({
          mimeType: stored.mimeType,
          thumbnailUrl: URL.createObjectURL(thumb),
          fullUrl: stored.fullUrl,
        } as LiveImageData);
      })
  }

  IncrementKeyUsage(ref: DocumentReference) {
    return updateDoc(ref, {'used': increment(1)})
  }

  TagRefByName(name: string): DocumentReference | undefined {
    const ret = this.tagsByName[name]?.reference
    if ( !ret ) {
      this.errors$.next(`StorageService:TagRefByName(${name}): not found`)
    }
    return ret
  }

  TagRefById(id: string): DocumentReference | undefined {
    const ret =  this.tagsById[id]?.reference
    if ( !ret ) {
      this.errors$.next(`StorageService:TagRefById(${id}): not found`)
    }
    return ret;
  }

  TagByName(name: string): LiveTag | undefined {
    const ret = this.tagsByName[name]
    if ( !ret ) {
      this.errors$.next(`StorageService:TagByName(${name}): not found`)
    }
    return ret;
  }

  TagById(id: string): LiveTag | undefined {
    const ret = this.tagsById[id]
    if ( !ret ) {
      this.errors$.next(`StorageService:TagById(${id}): not found`)
    }
    return ret
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
    return doc(this.firestore, imagesCollectionPath, await this.hmac.getHmacHex(image)).withConverter(this.imageConverter())
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
      setDoc(ref, tag)
        .then(()=>resolve(live))
        .catch((err: Error) => {this.errors$.next(`Error storing tag ${tag.name}: ${err}`)});
    });
  }

  // Load a tag from firestore.  If provided with a reference, it is assumed to have been made using
  // GetTagReference which makes use of a converter.
  async LoadTagByName(name: string): Promise<LiveTag> {
    const cached = this.TagByName(name);
    if ( cached !== undefined ) {
      return cached
    }

    return new Promise(async (resolve, reject) => {
      const tagRef = await this.GetTagReference(name)
      getDoc(tagRef)
        .then((snapshot: DocumentSnapshot) => {
          if ( snapshot.exists() ) {
            resolve(this.LiveTagFromStorage(snapshot.data() as StoredTag, snapshot.ref));
          } else {
            reject(`LoadTagByName(${name}): not found`);
          }
        })
        .catch((err: Error) => {
          this.errors$.next(`Error loading tag by reference ${(tagRef as DocumentReference).id}: ${err.message}`)
        })
    })
  }

  async MakeImageCloudRef(image: Blob): Promise<StorageReference> {
    const id = await this.hmac.getHmacHex(image)
    return ref(this.cloudStorage, id)
  }

  // Add specified tags to this image.
  async AddTags(iRef: DocumentReference, tags: DocumentReference[]) {
    updateDoc(iRef, {tags: arrayUnion(...tags)})
      // Log issues when updating tags on an existing document.
      .catch((error: Error) => {this.errors$.next(`Error adding tags ${tags} ${iRef.path}: ${error}`)});
  }

  // Store a new image received by the application.  If it exists, update its list of tags.
  async StoreImage(img: LiveImage) {
    const snapshot =  await getDoc(img.reference)
    if ( snapshot.exists() ) {
      return this.AddTags(img.reference, img.tags)
    }
    return setDoc(img.reference, img)
  }

  async StoreImageData(ref: DocumentReference,  blob: Blob, fullUrl: string): Promise<void> {

    let scaledDown: Blob = await new Promise((resolve, reject) => {
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
        console.log(`Resizing to ${w}w x ${h}h`);
        const ctx = el.getContext('2d');
        if (!ctx) {
          console.error("No context!");
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

    return setDoc(doc(ref, 'data', 'thumbnail'), {
      'mimeType': blob.type,
      'thumbnail': scaledDown ? await this.BytesFromBlob(scaledDown) : Bytes.fromBase64String(''),
      'fullUrl': fullUrl,
    } as StoredImageData)
  }

  async StoreFullImage(imageRef: DocumentReference, blob: Blob ): Promise<string> {
    const storageRef = ref(this.cloudStorage, imageRef.id);
    await uploadBytes(storageRef, blob)
    return getDownloadURL(storageRef);
  }

  // Remove the specified tag from the specified image.
  async DeleteImageTag(image: LiveImage, tag: string): Promise<void> {
    const imageRef = await this.GetImageReferenceFromId(image.reference.id);
    const tagRef = await this.GetTagReference(tag);
    updateDoc(imageRef, {tags: arrayRemove(tagRef)}).catch(
      (err: Error) => {console.log(`Error deleting tag ${tag} from ${imageRef.path}: ${err}`)}
    )
  }

  async DeleteImage(imageRef: DocumentReference) {
    getDoc(imageRef).then((snapshot) => {
      if ( !snapshot.exists() ) {
        return;
      }
      deleteObject(this.GetStorageReferenceFromId(imageRef.id))
        .then(() => console.log('Cloud data deleted'))
        .finally(() => {
          deleteDoc(imageRef)
        });
    })
  }

  // Replace image tags with those in the live image.  If the tag list is empty delete the image instead.
  async ReplaceImageTags(iRef: DocumentReference, tags: DocumentReference[]) {
    return updateDoc(iRef, {'tags': tags})
      .catch( e => console.log(`Error replacing tags: ${e}`));
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

  // The firestore converter cannot cope with async construction.
  // This should be run after the LiveImage is created...not sure how to feed it through the subscription model yet.
  async AddDataUrls(image: LiveImage): Promise<LiveImage> {
    return new Promise(async (resolve, reject) => {
      const thumbDoc = await getDoc(
        doc(this.firestore, this.imagesCollection, image.reference.id, 'data', 'thumbnail'))
      if ( !thumbDoc.exists() ) {
        this.errors$.next(`Error loading thumbnail of ${image.reference.id} from Firestore:  does not exist.`)
        reject(`Error loading thumbnail of ${image.reference.id} from Firestore:  does not exist.`)
      }
      const thumbBytes = (thumbDoc.data() as StoredImageData).thumbnail.toUint8Array()
      const thumb = new Blob([thumbBytes], {type: image.mimeType})

      const ret: LiveImage = {
        ...image,
        thumbnailUrl: URL.createObjectURL(thumb),
        fullUrl: await getDownloadURL(ref(this.cloudStorage, image.reference.id)),
      }
      resolve(ret)
    })
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
      this.errors$.next(`Error loading ${snapshot.id} from Firestore:  does not exist.`)
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
}
