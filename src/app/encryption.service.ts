import {Injectable, OnDestroy, Query, signal} from '@angular/core';
import { WindowRef } from './window-ref.service';
import {BehaviorSubject, first, firstValueFrom, Subject, takeUntil, tap} from 'rxjs';
import {
  addDoc,
  Bytes,
  collection, deleteDoc,
  DocumentReference, DocumentSnapshot,
  Firestore, getDoc, getDocs, increment, limit, onSnapshot,
  orderBy,
  query, serverTimestamp, updateDoc
} from '@angular/fire/firestore';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DocumentData, QueryDocumentSnapshot, QuerySnapshot} from '@angular/fire/compat/firestore';


const saltValues = [1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7];
const keyExportFormat = "raw"; // Have to use this in order to use AES-KW
const keysCollectionPath = 'keys'

const pbkdf2Params = {
  name: 'PBKDF2',
  hash: 'SHA-512',
  salt: new Uint8Array(saltValues),
  iterations: 1000,
};

const aesKWParams = {
  name: 'AES-KW',
  length: 256,
  iv: new Uint8Array(saltValues),
}

const USAGE_LIMIT = 10;

function stringToArrayBuffer(input: string): ArrayBuffer {
  const encoder = new TextEncoder()
  return encoder.encode(input);
}

export type EncryptionResult = Readonly<{
  // Result of encryption
  ciphertext: ArrayBuffer,
  // IV needed during decryption
  iv: ArrayBuffer,
  // Firestore reference for encryption key
  keyReference: DocumentReference,
}>

type StoredKey = {
  // Wrapped encryption key, no IV needed.
  key: Bytes
  // Added time, facilitates
  added: Date
  // How many times the key has been used.
  used: number
}

type LiveKey = {
  key: CryptoKey
  reference: DocumentReference
  used: number
}

@Injectable({
  providedIn: 'root'
})
export class EncryptionService implements OnDestroy {
  subtle: SubtleCrypto | null = null;
  crypto: Crypto | null = null;
  wrap_key: CryptoKey | null = null;
  encryption_key: LiveKey | null = null;
  ready = signal(false);

  constructor(private windowRef: WindowRef, private firestore: Firestore) {
    if ( !this.windowRef.nativeWindow?.crypto.subtle ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.subtle = this.windowRef!.nativeWindow!.crypto.subtle;
    this.crypto = this.windowRef!.nativeWindow!.crypto;
  }

  async initialize(passphrase: string) {
    await this.subtle!.importKey("raw", stringToArrayBuffer(passphrase), {name: "PBKDF2"}, false, ["deriveKey"])
      .then((static_passphrase: CryptoKey) => this.subtle!.deriveKey(pbkdf2Params, static_passphrase, aesKWParams, true, ['wrapKey', 'unwrapKey']))
      .then((wrap_key: CryptoKey) => this.wrap_key = wrap_key)
    const latest = await this.LoadLatestKey()
    if ( latest ) {
      this.encryption_key = latest
      this.ready.set(true);
      return;
    }
    const key = await this.GenerateEncryptionKey()
    const ref = await this.WrapKey(key).then(w=>this.StoreWrappedKey(w))
    this.encryption_key = {
      key: key,
      reference: ref,
      used: 0,
    } as LiveKey
    this.ready.set(true);
  }

  ngOnDestroy() {
    this.clear()
  }

  // Ideally we make a wrapped copy right now and store it.
  // We should also set this.encryption.key
  async GenerateEncryptionKey(): Promise<CryptoKey> {
    if ( !this.wrap_key ) {
      return Promise.reject('Error generating key: wrapping key not initialized!');
    }
    return this.subtle!.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  }

  async WrapKey(key: CryptoKey): Promise<ArrayBuffer> {
    if ( !this.wrap_key ) {
      return Promise.reject('Error wrapping key: wrapping key not initialized!');
    }
    return this.subtle!.wrapKey(keyExportFormat, key, this.wrap_key!, 'AES-KW')
  }

  async UnwrapKey(storedKey: ArrayBuffer): Promise<CryptoKey> {
    if ( !this.wrap_key ) {
      return Promise.reject('Error unwrapping key:  wrapping key not initialized!');
    }
    return this.subtle!.unwrapKey(keyExportFormat, storedKey, this.wrap_key!, "AES-KW", "AES-GCM", false, ['encrypt', 'decrypt'])
  }

  async StoreWrappedKey(key: ArrayBuffer): Promise<DocumentReference> {
    return addDoc(collection(this.firestore, keysCollectionPath), {
      key: Bytes.fromUint8Array(new Uint8Array(key)),
      added: serverTimestamp(),
      used: 0,
    })
  }

  async LoadKey(ref: DocumentReference): Promise<LiveKey> {
    const snapshot = await getDoc(ref)
    if ( !snapshot.exists ) {
      Promise.reject(`Key id ${ref.id}: not found: ${ref.id}`);
    }
    const stored = snapshot.data() as StoredKey;
    return this.LiveKeyFromDbData(stored, snapshot.ref)
  }

  async LoadLatestKey(): Promise<LiveKey|null> {
    const q = query(collection(this.firestore, keysCollectionPath), orderBy('added', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    if ( snapshot.empty ) {
      return null
    }
    const docSnapshot = snapshot.docs.pop()
    return this.LiveKeyFromDbData(docSnapshot!.data() as StoredKey, docSnapshot!.ref)
  }

  async LiveKeyFromDbData(stored: StoredKey, ref: DocumentReference): Promise<LiveKey> {
    try {
      const key = await this.UnwrapKey(stored.key.toUint8Array())
      return {
        reference: ref,
        key: key,
        used: stored.used,
      } as LiveKey
    }
    catch (e) {
      return Promise.reject(`Error unwrapping key ${ref.id}: ${e}`)
    }
  }

  // Encrypt using the latest unwrapped key.
  async Encrypt(data: ArrayBuffer): Promise<EncryptionResult> {
    if ( !this.encryption_key ) {
      return Promise.reject('Encrypt() called:  encryption key not found')
    }

    const iv = new Uint8Array(96)
    const gcmOpts = {
      name: "AES-GCM",
      iv: this.crypto!.getRandomValues(iv)
    }
    const ciphertext = await this.subtle!.encrypt(gcmOpts, this.encryption_key.key, data)
    // This cannot be production code - updates on every use.  Needs to be done in batches.
    updateDoc(this.encryption_key.reference, {'used': increment(1)}).
    catch((err: Error) => {console.error(`Error incrementing key use: ${err}`)})
    return {
      ciphertext: ciphertext,
      iv: iv,
      keyReference: this.encryption_key.reference,
    } as EncryptionResult
  }

  // Decrypt using the specified key. If not ready() will fail to unwrap key.
  async Decrypt(input: EncryptionResult) {
    if ( !this.encryption_key ) {
      return Promise.reject('Decrypt() called:  encryption key not found')
    }
    let key = this.encryption_key!.key
    if ( this.encryption_key!.reference.id != input.keyReference.id ) {
      const stored = await getDoc(input.keyReference);
      if ( !stored.exists() ) {
        console.error(`LoadKey(${input.keyReference.id}): not found`);
        return;
      }
      const storedKey = stored.data() as StoredKey
      key = await this.UnwrapKey(storedKey.key.toUint8Array());
    }
    const gcmOpts = {
      name: "AES-GCM",
      iv: input.iv,
    }
    return this.subtle!.decrypt(gcmOpts, key, input.ciphertext)
  }

  // Delete in production.
  debugme() {
    console.log('Debug me called');
  }

  // Used to undo "initialize" and make encryption/decryption impossible.
  clear() {
    this.wrap_key = null;
    this.ready.set(false);
  }

  async forTestOnlyClearAllKeys() {
    return getDocs(collection(this.firestore, keysCollectionPath))
      .then(snapshot=> snapshot.forEach(
        (doc=> deleteDoc(doc.ref))))
  }
}
