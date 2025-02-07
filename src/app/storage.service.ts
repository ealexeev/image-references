import { Injectable, inject } from '@angular/core';
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
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QuerySnapshot,
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
  UploadResult,
  getDownloadURL, deleteObject
} from '@angular/fire/storage';

import { HmacService } from './hmac.service';
import { BehaviorSubject, catchError, first, from, mergeMap, map, Observable, of, shareReplay, Subject, single, take, tap, firstValueFrom } from 'rxjs';
import { environment } from './environments/environment';


export type EncryptionMetadata = {
  // IV used during encryption.
  iv: Bytes
  // Key id or reference to a wrapped key stored in Firestore.  The key used for data encryption.
  key: string,
}

export type StoredImage = {
  added: Date,
  // URL to use for image retrieval if data is empty
  url: string,
  // If sufficiently small to store in Firestore, image bytes, possibly encrypted.
  data: Bytes
  // The mime type of the image.
  mimeType: string,
  // Collection of applicable tag IDs, references to firestore documents
  tags: DocumentReference[]
}

export type StoredEncryptedImage = StoredImage & EncryptionMetadata;

// AppImage is an image that has been fetched from storage, had its data and tags decrypted
// if necessary and is now being "served" from the local host.
export type LiveImage = {
  // The stored ID of this image in case changes have to be made
  id: string
  // The local URL of this image's Blob
  url: string
  // The names of tags applied to this image.
  tags: string[]
}

export type LiveTag = {
  // The ID of the stored tag.
  id: string,
  // The plain text name of the stored tag.  Decrypted if necessary.
  name: string,
}

// Tag document as stored in cloud firestore
export type StoredTag = {
  // Bytes because it may be encrypted.
  name: Bytes,
}

export type StoredEncryptedTag = StoredTag & EncryptionMetadata;

export type StoredKey = {
  // Unique ID (HMAC of key), base64 encoded
  id: string,
  // Wrapped encryption key, no IV needed.
  key: Bytes
}


// KeyMap retains a map of key ids (HMACs) to wrapped key bytes.
type KeyMap = Record<string, Bytes>
// TagMap retains a map of tag names to HMACs / tag ids for easy lookup.
type TagMap = Record<string, string>

const LOCAL_STORAGE_KEY_IMAGES = "prestige-ape-images";

const keysCollectionPath = 'keys'
const imagesCollectionPath = 'images'
const tagsCollectionPath = 'tags'
const cloudDataPath = 'data'

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private firestore: Firestore = inject(Firestore);
  private storage: FirebaseStorage;
  private hmac: HmacService = inject(HmacService);
  private keysCollection: any;
  private imagesCollection: any;
  private tagsCollection: any;
  private cloudStorage: any;
  private keys: KeyMap = {};
  private tags: TagMap = {};

  // All tags known to the storage service.
  tags$ = new BehaviorSubject<LiveTag[]>([]);
  tagsShared$ = this.tags$.pipe(shareReplay());
  errors$ = new Subject<Error>;


  constructor() {
    this.keysCollection = collection(this.firestore, keysCollectionPath)
    this.imagesCollection = collection(this.firestore, imagesCollectionPath)
    this.tagsCollection = collection(this.firestore, tagsCollectionPath)
    if ( environment.firestoreUseLocal ) {
      connectFirestoreEmulator(this.firestore, 'localhost', 8080, {})
    }
    this.storage = getStorage();
    if ( environment.firebaseStorageUseLocal ) {
      connectStorageEmulator(this.storage, "127.0.0.1", 9199);
    }
    this.cloudStorage = ref(this.storage, cloudDataPath)
  }

  // GetTagReference returns a document reference to a tag based on the tag's name
  async GetTagReference(name: string): Promise<DocumentReference> {
    if ( !(name in this.tags) ) {
      this.tags[name] = await this.hmac.getHmacHex(new Blob([name], {type: 'text/plain'}));
    }
    return doc(this.firestore,  tagsCollectionPath, this.tags[name]);
  }

  async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
    return doc(this.firestore, imagesCollectionPath, await this.hmac.getHmacHex(image))
  }

  GetImageReferenceFromId(imageId: string): DocumentReference {
    return doc(this.firestore, imagesCollectionPath, imageId)
  }

  GetStorageReferenceFromId(imageId: string): StorageReference {
    return ref(this.cloudStorage, imageId)
  }

  async ImageExists(ref: DocumentReference): Promise<boolean> {
    return new Promise((resolve, reject) => {
      getDoc(ref)
        .then((doc) => {
          if ( doc.exists() ) {
            resolve(true);
          } else {
            resolve(false);
          }
        })
      .catch((err) => {console.log(`Error getDoc(${ref.id}): ${err}`)})
    })
  }

  async StoreKey(key: Blob): Promise<DocumentReference> {
    const k = {
      id: await this.hmac.getHmacHex(key),
      key: Bytes.fromUint8Array(new Uint8Array(await key.arrayBuffer())),
    }
    this.keys[k.id] = k.key;
    return addDoc(this.keysCollection, <StoredKey> k)
  }

  async LoadKey(keyId: string): Promise<StoredKey|undefined> {
    if (keyId in this.keys) {
      return { id: keyId, key: this.keys[keyId] };
    }
    const ref = doc(this.keysCollection, keyId);
    const snapshot = await getDoc(ref);
    const sk = snapshot.data() as StoredKey | undefined;
    if (sk) {
      this.keys[keyId] = sk.key;
    }
    return sk
  }

  // Save a tag to firestore, encrypt with specified key
  StoreTag(name: string): Observable<LiveTag|undefined> {
    return from(this.GetTagReference(name)).pipe(
      first(),
      map((tRef) => {
        this.tags[tRef.id] = name;
        const lt = { id: tRef.id, name: name }
        return {ref: tRef, tag: lt}}),
      mergeMap( (res) => from(setDoc(res.ref, { name: name })).pipe(
          map(() => res.tag),
          map(( res: LiveTag | undefined ) => {
            this.tags$.pipe(take(1)).subscribe((tags: LiveTag[]) => {
              if ( res ) {
                tags.push(res)
                this.tags$.next(tags)
              }
            })
            return res
          }),
          catchError((error) => { this.errors$.next(error); return of(undefined); })
      )),
      );
  }

  LoadTag(tagRef: string | DocumentReference): Observable<LiveTag|undefined> {
    var docRef: Observable<DocumentReference>
    if ( typeof tagRef == "string" ) {
      docRef = from(this.GetTagReference(tagRef))
    } else {
      docRef = of(tagRef)
    }
    return docRef.pipe(
      map( ( docRef: DocumentReference ) => {
        if ( docRef.id in this.tags ) {
          return { id: docRef.id, name: this.tags[docRef.id] }
        } else {
          return docRef
        }
      }),
      mergeMap( ( res: LiveTag | DocumentReference ) => {
        if ( !( res instanceof DocumentReference) ) {
          return of(res);
        }
        return from(getDoc(res)).pipe(
          map((snapshot) => {
            if (!snapshot.exists()) {
              return undefined;
            }
            const name = snapshot.get('name')
            if (!name) {
              return undefined;
            }
            this.tags[snapshot.id] = name;
            return {id: snapshot.id, name: name};
          })
        )
      }),
      catchError( (error: Error) => {
        console.log(`Error during LoadTag(${tagRef}): ${error}`)
        this.errors$.next(error)
        return of()
      }),
    )
  }

  LoadAllTags(): Observable<LiveTag[]> {
    from(getDocs(this.tagsCollection)).pipe(
      first(),
      map( (qs) => {
        const ret: LiveTag[] = []
        qs.forEach( (doc) => {
          if ( doc.exists() ) {
            const data = doc.data() as StoredTag
            ret.push({id: doc.id, name: data.name.toString()});
          }
        });
        ret.sort((a: LiveTag, b: LiveTag) => a.name.localeCompare(b.name) );
        return ret;
      }),
      catchError((error) => {
        console.log(`Error LoadAllTags(): ${error}`)
        this.errors$.next(error)
        return of([])
      }),
    ).subscribe((tags: LiveTag[]) => this.tags$.next(tags));
    return this.tags$.asObservable();
  }

  DeleteTag(name: string) {
    from(this.GetTagReference(name)).pipe(
      map( (tRef: DocumentReference ) => { deleteDoc(tRef) }),
      catchError( (error: Error) => {
        console.log(`Error deleting tag: ${error}`);
        this.errors$.next(error);
        return of();
      }),
    );
  }

  async MakeImageRef(image: Blob): Promise<DocumentReference> {
    const id = await this.hmac.getHmacHex(image)
    return doc(this.firestore, imagesCollectionPath, id)
  }

  async MakeImageCloudRef(image: Blob): Promise<StorageReference> {
    const id = await this.hmac.getHmacHex(image)
    return ref(this.cloudStorage, id)
  }

  // Add specified tags to this image.
  async AddTags(iRef: DocumentReference, tags: DocumentReference[]) {
    const documentSnapshot = await getDoc(iRef);
    updateDoc(iRef, {tags: arrayUnion(...tags)})
      // Log issues when updating tags on an existing document.
      .catch((error: Error) => {console.log(`Error adding tags ${tags} ${iRef.path}: ${error}`)});
  }

  async StoreImage(image: Blob, url: string, tags: DocumentReference[]): Promise<DocumentReference> {
    const iRef = await this.MakeImageRef(image);
    const documentSnapshot = await getDoc(iRef);

    if ( documentSnapshot.exists() ) {
      await this.AddTags(iRef, tags);
      return iRef;
    }

    const imgBytes = new Uint8Array(await image.arrayBuffer())

    const i = {
      added: new Date(),
      url: url,
      data: imgBytes.length < 1048487 ? Bytes.fromUint8Array(imgBytes) : Bytes.fromBase64String(''),
      mimeType: image.type,
      tags: tags,
    }

    if ( imgBytes.length >= 1048487 ) {
      try {
        const uploadResult = await this.StoreImageCloud(image);
        console.log(`Uploaded ${uploadResult.metadata.name}, size: ${uploadResult.metadata.size}`);
        i.url = await getDownloadURL(await this.MakeImageCloudRef(image));
      } catch (e) {
        return Promise.reject(`Error uploading to cloud storage: ${e}`);
      }
    }

    try {
      await setDoc(iRef, i)
    } catch (e) {
      if ( imgBytes.length >= 1048487 ) {
        console.log('I need to delete cloud data!');
      }
      return Promise.reject(`Error creating document in firestore: ${e}`);
    }

    return iRef
  }

  async StoreImageCloud(image: Blob): Promise<UploadResult> {
    const iRef = await this.MakeImageCloudRef(image);
    return uploadBytes(iRef, image)
  }

  async LiveImageFromSnapshot(snapshot: DocumentSnapshot ): Promise<LiveImage> {
    return new Promise((resolve, reject) => {
      const stored = snapshot.data()
      if ( !snapshot.exists() ) {
        reject("Snapshot is of a non-existent file.");
        return;
      }
      const imageTags: string[] = [];
      const blob = new Blob([snapshot.get('data').toUint8Array()], { type: snapshot.get('mimeType') || '' });
      snapshot.get('tags').map(async (tagRef: DocumentReference) => { imageTags.push(((await firstValueFrom(this.LoadTag(tagRef)))?.name) || "") });
      resolve({
        id: snapshot.id,
        url: snapshot.get('data').toUint8Array().length > 0 ?  URL.createObjectURL(blob) : snapshot.get('url'),
        tags: imageTags,
      })
    })
  }

  async LoadImage(imageRef: DocumentReference): Promise<LiveImage | undefined> {
    return new Promise((resolve, reject) => {
      getDoc(imageRef).then((snapshot) => { resolve( this.LiveImageFromSnapshot(snapshot))})
    })
  }

  async LoadImagesWithTag(tag: string | DocumentReference, limitCount: number): Promise<LiveImage[]> {
    if ( typeof tag == "string") {
      tag = await this.GetTagReference(tag)
    }
    let q;
    if ( limitCount > 0 ) {
      q = query(this.imagesCollection, where("tags", "array-contains", tag), orderBy("added", "desc"), limit(limitCount))
    } else {
      q = query(this.imagesCollection, where("tags", "array-contains", tag), orderBy("added", "desc"))
    }

    const snapshot = await getDocs(q);
    const images: LiveImage[] = []
    for ( const imageSnapshot of snapshot.docs ) {
      // There is some hang-up around query doc snapshots not being compatible, but they seem to work.
      images.push(await this.LiveImageFromSnapshot(imageSnapshot as DocumentSnapshot));
    }
    return images;
  }

  // Remove the specified tag from the specified image.
  async DeleteImageTag(image: LiveImage, tag: string): Promise<void> {
    const imageRef = await this.GetImageReferenceFromId(image.id);
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
      const bytes: Bytes = snapshot.get('data');
      // If there is no data, there is a cloud storage object that needs to be cleaned up.
      if ( bytes.toUint8Array().length == 0 ) {
        deleteObject(this.GetStorageReferenceFromId(imageRef.id))
          .then(() => console.log('Cloud data deleted'))
          .finally(() => {deleteDoc(imageRef)});
      } else {
        deleteDoc(imageRef);
      }
    })
  }

  // Replace image tags with those in the live image.  If the tag list is empty delete the image instead.
  async ReplaceImageTags(image: LiveImage){
    const iRef = this.GetImageReferenceFromId(image.id);
    if ( !image.tags.length ) {
      this.DeleteImage(iRef);
      return
    }
    const tagRefs: DocumentReference[] = await Promise.all(image.tags.map(async (t: string) => await this.GetTagReference(t)))
    updateDoc(iRef, {'tags': tagRefs})
      .catch( e => console.log(`Error replacing tags: ${e}`));
  }
}
