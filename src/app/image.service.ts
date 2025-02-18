import {inject, Injectable} from '@angular/core';
import {
  arrayRemove,
  arrayUnion, Bytes,
  collection,
  doc,
  DocumentReference,
  DocumentSnapshot,
  Firestore, getDoc,
  serverTimestamp, setDoc, updateDoc, writeBatch
} from '@angular/fire/firestore';
import {MessageService} from './message.service';
import {BehaviorSubject, Observable} from 'rxjs';
import {HmacService} from './hmac.service';
import {deleteObject, getDownloadURL, ref, Storage, StorageReference, uploadBytes} from '@angular/fire/storage';
import {LRUCache} from 'lru-cache';
import {EncryptionService} from './encryption.service';
import {SnapshotOptions} from '@angular/fire/compat/firestore';
import {shortenId} from './common';
import {LiveImage, StoredImageData} from './storage.service';
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

type StoredImage = {
  added: unknown
  tags: DocumentReference[],
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
  private imagesCollection: any;
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

    const newImage: LiveImage = {
      mimeType: blob.type,
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

