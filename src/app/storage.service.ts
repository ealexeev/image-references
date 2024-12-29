import { Injectable, inject } from '@angular/core';
import { addDoc, Bytes, collection, connectFirestoreEmulator, deleteDoc, doc, DocumentReference, DocumentSnapshot, Firestore, getDoc, getDocs, query, setDoc, where } from '@angular/fire/firestore';

import { HmacService } from './hmac.service';


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

export type StoredTag = {
  id: string,
  // If not encrypted the name of the tag
  name: string,
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
  async StoreTag(name: string): Promise<DocumentReference> {
    const tRef = await this.GetTagReference(name)
    const t = {
      id: await this.hmac.getHmacHex(new Blob([name], { type: 'text/plain' })),
      name: name,
    }
    this.tags[t.id] = t.name
    setDoc(tRef, t)
    return tRef
  }

  async LoadTag(tagRef: string | DocumentReference): Promise<StoredTag|undefined> {
    if ( typeof tagRef == "string" ) {
      tagRef = await this.GetTagReference(tagRef)
    }
    if ( tagRef.id in this.tags) {
      return { id: tagRef.id, name: this.tags[tagRef.id] };
    }
    const snapshot = await getDoc(tagRef);
    const st = snapshot.data() as StoredTag | StoredEncryptedTag | undefined;
    if (st) {
      this.tags[st.id] = st.name;
    }
    return st
  }

  async LoadAllTags(): Promise<StoredTag[]> {
    return new Promise((resolve, _) => {
      const ret: StoredTag[] = [];
      getDocs(this.tagsCollection).then((qs) => qs.forEach((doc) => { ret.push(doc.data() as StoredTag) }));
      resolve(ret);
    });
  }

  async DeleteTag(name: string): Promise<void> {
    const tagRef = await this.GetTagReference(name)
    return deleteDoc(tagRef)
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
      stored['tags'].map(async (tagRef: DocumentReference) => { imageTags.push(((await this.LoadTag(tagRef))?.name) || "") });
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

  async LoadImagesWithTag(tag: string | DocumentReference): Promise<LiveImage[]> {
    if ( typeof tag == "string") {
      tag = await this.GetTagReference(tag)  
    }
    const q = query(this.imagesCollection, where("tags", "array-contains", tag))

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
