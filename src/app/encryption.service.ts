import {inject, Injectable, OnDestroy, Query, signal, WritableSignal} from '@angular/core';
import { WindowRef } from './window-ref.service';
import {BehaviorSubject, first, firstValueFrom, Observable, ReplaySubject, shareReplay, Subject, takeUntil, tap, timeout} from 'rxjs';
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
import { MessageService } from './message.service';


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

export enum State {
  NotReady = 0,
  Ready,
  Initializing,
  Error,
}

const ReadyStateDelay = 5000;

@Injectable({
  providedIn: 'root'
})
export class EncryptionService implements OnDestroy {
  windowRef = inject(WindowRef);
  firestore = inject(Firestore);
  messageService = inject(MessageService);

  // Whether encryption is desired.  Only if the service is enabled should its states be considered.
  enabled: WritableSignal<boolean> = signal(false);
  subtle: SubtleCrypto | null = null;
  crypto: Crypto | null = null;
  wrap_key: CryptoKey | null = null;
  encryption_key: LiveKey | null = null;
  readyStateChanged$: Subject<State> = new Subject<State>();
  currentState$ = new ReplaySubject<State>(State.NotReady);

  constructor() {
    if ( !this.windowRef.nativeWindow?.crypto.subtle ) {
      this.messageService.Error("Encryption service init error: Could not get crypto reference!");
      this.readyStateChanged$.next(State.Error);
      return;
    }
    this.subtle = this.windowRef!.nativeWindow!.crypto.subtle;
    this.crypto = this.windowRef!.nativeWindow!.crypto;
    this.readyStateChanged$.pipe(
      takeUntilDestroyed(),
    ).subscribe(
      state => {
        this.messageService.Info(`EncryptionService state changed: ${state}`);
        this.currentState$.next(state);
      }
    )
  }

  async Enable(passphrase: string): Promise<State> {
    this.readyStateChanged$.next(State.Initializing)
    this.enabled.set(true)

    try {
      const passKey = await this.subtle!.importKey("raw", stringToArrayBuffer(passphrase), {name: "PBKDF2"}, false, ["deriveKey"]);
      this.wrap_key = await this.subtle!.deriveKey(pbkdf2Params, passKey, aesKWParams, true, ['wrapKey', 'unwrapKey']);
    } catch (err: unknown) {
      this.messageService.Error(err as Error)
      this.readyStateChanged$.next(State.Error)
      this.enabled.set(false)
      return State.Error;
    }

    try {
      const latest = await this.LoadLatestKey()
      if ( latest ) {
        this.encryption_key = latest
        this.readyStateChanged$.next(State.Ready);
        return State.Ready;
      }
    } catch (err: unknown) {
      this.messageService.Error(err as Error)
      this.readyStateChanged$.next(State.Error)
      this.enabled.set(false)
      return State.Error;
    }

    try {
      this.encryption_key = await this.GenerateEncryptionKey();
      this.readyStateChanged$.next(State.Ready);
      return State.Ready;
    } catch (err: unknown) {
      this.messageService.Error(err as Error)
      this.readyStateChanged$.next(State.Error)
      this.enabled.set(false)
      return State.Error;
    }
  }

  // Used to undo "initialize" and make encryption/decryption impossible.
  Disable() {
    this.wrap_key = null;
    this.encryption_key = null;
    this.readyStateChanged$.next(State.NotReady);
    this.enabled.set(false)
  }

  ngOnDestroy() {
    this.Disable()
  }

  /**
   * Generate a new encryption key and store it.  Errors out if wrap_key is not initialized.
   * 
   * @returns The new encryption key as LiveKey.
   */
  async GenerateEncryptionKey(): Promise<LiveKey> {
    if ( !this.wrap_key ) {
      return Promise.reject('Error generating key: wrapping key not initialized!');
    }
    const key = await this.subtle!.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    let ref: DocumentReference;
    try {
      const wrapped = await this.WrapKey(key)
      ref = await this.StoreWrappedKey(wrapped)
    } catch (err: unknown) {
      return Promise.reject(err)
    }
    return {
      key: key,
      reference: ref,
      used: 0,
    } as LiveKey
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
    try {
      await this.BlockUntilReady(ReadyStateDelay)
    } catch (err: unknown) {
      throw new Error(`Encrypt() timeout waiting for ready: ${(err as Error).message}`)
    }
    const iv = new Uint8Array(96)
    const gcmOpts = {
      name: "AES-GCM",
      iv: this.crypto!.getRandomValues(iv)
    }
    const ciphertext = await this.subtle!.encrypt(gcmOpts, this.encryption_key!.key, data)
    // This cannot be production code - updates on every use.  Needs to be done in batches.
    updateDoc(this.encryption_key!.reference, {'used': increment(1)}).
    catch((err: Error) => {console.error(`Error incrementing key use: ${err}`)})
    return {
      ciphertext: ciphertext,
      iv: iv,
      keyReference: this.encryption_key!.reference,
    } as EncryptionResult
  }

  // Decrypt using the specified key. If not ready() will fail to unwrap key.
  async Decrypt(input: EncryptionResult) {
    try {
      await this.BlockUntilReady(ReadyStateDelay)
    } catch (err: unknown) {
      throw new Error(`Decrypt() timeout waiting for ready: ${(err as Error).message}`)
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

  async BlockUntilReady(timeoutMs: number): Promise<void> {
    let state = await firstValueFrom(this.currentState$);
    if ( state !== State.Ready ) {
      try {
        state = await firstValueFrom(this.readyStateChanged$.pipe(timeout(timeoutMs)))
      } catch (e) {
        return Promise.reject(`EncryptionService not ready after ${timeoutMs}`);
      }
    }
  }

  async forTestOnlyClearAllKeys() {
    return getDocs(collection(this.firestore, keysCollectionPath))
      .then(snapshot=> snapshot.forEach(
        (doc=> deleteDoc(doc.ref))))
  }
}

export class FakeEncryptionService {

  iv: Uint8Array = new Uint8Array(16)
  keyRef = {id: "123", path: "keys/123"} as DocumentReference
  enabled: WritableSignal<boolean> = signal(false);

  async Disable(){
    this.enabled.set(false);
  }

  async Enable(passphrase: string) {
    this.enabled.set(true);
  }

  async Encrypt(data: ArrayBuffer): Promise<EncryptionResult> {
    if ( !this.enabled() ) {
      return Promise.reject('Encrypt() called while not enabled.')
    }
    return Promise.resolve({
      ciphertext: data,
      iv: this.iv,
      keyReference: this.keyRef,
    })
  }

  async Decrypt(input: EncryptionResult): Promise<ArrayBuffer|undefined> {
    if ( !this.enabled() ) {
      return Promise.reject('Decrypt() called while not enabled.')
    }
    return Promise.resolve(input.ciphertext)
  }

}
