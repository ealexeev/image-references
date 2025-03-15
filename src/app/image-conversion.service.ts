import {inject, Injectable} from '@angular/core';
import {Bytes, DocumentReference, DocumentSnapshot, serverTimestamp, Timestamp} from '@angular/fire/firestore';
import {QueryDocumentSnapshot, SnapshotOptions} from '@angular/fire/compat/firestore';
import {Image, ImageData} from '../lib/models/image.model';
import {ImageDataCacheService} from './image-data-cache.service';
import {EncryptionService} from './encryption.service';


export type StoredImage = {
  added: unknown
  tags: DocumentReference[],
}

export type StoredImageData = {
  // Mime-type of the image.
  mimeType: string,
} & ThumbnailData & FullSizeData

export type ThumbnailData = {
  thumbnail: Bytes,
  thumbnailIV?: Bytes,
  thumbnailKeyRef?: DocumentReference,
}

export type FullSizeData = {
  // URL where the full-size image is stored.  May be encrypted
  fullUrl: string,
  fullIV?: Bytes,
  fullKeyRef?: DocumentReference,
}

// If we want to move the conversion logic to here to go from blob to stored data, then this is an intermediate
// result that will need to be merged into StoredImageData after the full blob is stored in the cloud.
export type FullSizeEncryptedData = {
  full: Blob,
  fullUrl: string,
  fullIV: Bytes,
  fullKeyRef: DocumentReference,
}

@Injectable({
  providedIn: 'root'
})
export class ImageConversionService {

  private encryption: EncryptionService = inject(EncryptionService);
  private imageCache: ImageDataCacheService = inject(ImageDataCacheService);

  constructor() { }

  /**
   * Converts a snapshot to ImageData
   */
  async snapshotToImageData(snapshot: DocumentSnapshot|QueryDocumentSnapshot<ImageData>): Promise<ImageData> {
    const stored = snapshot.data() as StoredImageData;
    const ref = snapshot.ref;
    //@ts-ignore -- firebase types are difficult to grok
    return this.storedImageDataToLive(stored, ref)
  }

  /*
  * Converts a snapshot to Image
  **/
  async snapshotToImage(snapshot: DocumentSnapshot|QueryDocumentSnapshot<any>): Promise<Image> {
    return new Promise<Image>((resolve, reject) => {
      try {
        resolve(this.imageFromFirestore(snapshot, {}))
      } catch (error) {
        reject(error);
      }
    })
  }

  /**
  * Returns a converter objects suitable for use with Firestore collections.
  * */
  imageConverter() {
    return {
      'toFirestore': this.imageToFirestore,
      'fromFirestore': this.imageFromFirestore,
    }
  }

  /**
   * Converts Image to StoredImage
   */
  imageToFirestore(img: Image): StoredImage {
    return {
      added: img.added ? Timestamp.fromDate(img.added) : serverTimestamp(),
      tags: img.tags,
    } as StoredImage;
  }

  private imageFromFirestore(snapshot:DocumentSnapshot|QueryDocumentSnapshot<any>, options: SnapshotOptions): Image {
    const data = snapshot.data(options) as StoredImage;
    if ( snapshot instanceof DocumentSnapshot && !snapshot.exists() ) {
      throw new Error(`${this.constructor.name}.imageFromFirestore(${snapshot.id}: not found`)
    }
    return {
      tags: data?.tags ?? [],
      reference: snapshot.ref,
      added: data?.added? (data.added as Timestamp).toDate() : new Date(0)
    } as Image;
  }

  private async storedImageDataToLive(stored: StoredImageData, ref: DocumentReference): Promise<ImageData> {
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
}
