import { Injectable, inject } from '@angular/core';
import {
  addDoc,
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
  setDoc,
  where
} from '@angular/fire/firestore';

import { HmacService } from './hmac.service';
import { BehaviorSubject, catchError, first, from, mergeMap, map, Observable, of, shareReplay, Subject, single, take, tap, firstValueFrom } from 'rxjs';


export type EncryptionMetadata = {
  // IV used during encryption.
  iv: Bytes
  // Key id or refernce to a wrapped key stored in Firestore.  The key used for data encryption.
  key: string,
}

export type StoredImage = {
  added: Date,
  // URL to use for image retrieval if data is empty
  url: string,
  // If sufficiently small to store in Firestore, image bytes, possibly encrypted.
  data: Bytes
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

export type StoredTag = {
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

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private firestore: Firestore = inject(Firestore);
  private hmac: HmacService = inject(HmacService);
  private keysCollection: any;
  private imagesCollection: any;
  private tagsCollection: any;
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
    connectFirestoreEmulator(this.firestore, 'localhost', 8080, {})

  }

  async GetTagReference(name: string): Promise<DocumentReference> {
    return doc(this.firestore,  tagsCollectionPath, await this.hmac.getHmacHex(new Blob([name], { type: 'text/plain' })))
  }

  async GetImageReferenceFromBlob(image: Blob): Promise<DocumentReference> {
    return doc(this.firestore, imagesCollectionPath, await this.hmac.getHmacHex(image))
  }

  GetImageReferenceFromId(imageId: string): DocumentReference {
    return doc(this.firestore, imagesCollectionPath, imageId)
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
        if ( res instanceof DocumentReference ) {
          return from(getDoc(res)).pipe(
            map( (snapshot) => {
              const st = snapshot.data();
              if (!st || !st['name']) {
                return undefined;
              }
              this.tags[snapshot.id] = (st['name'] as Bytes).toString();
              return {id: snapshot.id, name: this.tags[snapshot.id]}
            })
          )
        } else {
          return of(res)
        }
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

  async StoreImage(image: Blob, url: string, tags: DocumentReference[]): Promise<DocumentReference> {
    const id = await this.hmac.getHmacHex(image)
    const i = {
      added: new Date(),
      url: url,
      data: Bytes.fromUint8Array(new Uint8Array(await image.arrayBuffer())),
      tags: tags,
    }
    const iRef = doc(this.firestore, imagesCollectionPath, id)
    setDoc(iRef, i);
    return iRef
  }

  async LiveImageFromSnapshot(snapshot: DocumentSnapshot ): Promise<LiveImage> {
    return new Promise((resolve, reject) => {
      const stored = snapshot.data()
      if ( !stored ) {
        reject("Empty snapshot.");
        return;
      }
      const imageTags: string[] = [];
      stored['tags'].map(async (tagRef: DocumentReference) => { imageTags.push(((await firstValueFrom(this.LoadTag(tagRef)))?.name) || "") });
      resolve({
        id: snapshot.id,
        url: stored['data'].toUint8Array().length > 0 ?  URL.createObjectURL(new Blob([stored['data'].toUint8Array()])) : stored['url'],
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

  async DeleteImage(imageRef: DocumentReference) {
    return deleteDoc(imageRef)
  }
}
