import {Injectable, OnDestroy, signal} from '@angular/core';
import { WindowRef } from './window-ref.service';
import {EmptyError, Subject} from 'rxjs';
import {LiveKey, StorageService, StoredKey} from './storage.service';
import {Bytes, DocumentReference, DocumentSnapshot} from '@angular/fire/firestore';
import {QueryDocumentSnapshot, QuerySnapshot} from '@angular/fire/compat/firestore';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';


const saltValues = [1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7];
const keyExportFormat = "jwk";

const pbkdf2Params = {
  name: 'PBKDF2',
  hash: 'SHA-512',
  salt: new Uint8Array(saltValues),
  iterations: 1000,
};

const aesGcmParams = {
  name: 'AES-GCM',
  length: 128,
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


@Injectable({
  providedIn: 'root'
})
export class EncryptionService implements OnDestroy {
  subtle: SubtleCrypto | null = null;
  crypto: Crypto | null = null;
  wrap_key: CryptoKey | null = null;
  encryption_key: CryptoKey | null = null;
  encryption_key_ref: DocumentReference | null = null;
  latest_stored$: Subject<LiveKey> = new Subject<LiveKey>();
  ready = signal(false);
  unsubscribe: () => void = ()=> {return};

  constructor(private windowRef: WindowRef, private storage: StorageService) {
    if ( !this.windowRef.nativeWindow?.crypto.subtle ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.subtle = this.windowRef!.nativeWindow!.crypto.subtle;
    this.crypto = this.windowRef!.nativeWindow!.crypto;
    this.unsubscribe = this.storage.SubscribeToLatestKey(this.latest_stored$);
    this.latest_stored$.pipe(
      takeUntilDestroyed()
    ).subscribe(stored => {
      if ( stored.used < USAGE_LIMIT) {
        this.UnwrapKey(stored.key.toUint8Array()).then((k: CryptoKey) => {
          this.encryption_key = k
          this.encryption_key_ref = stored.reference
        });
        return;
      }
      this.generateNewDataEncryptionKey()
        .then(buffer => Bytes.fromUint8Array(new Uint8Array(buffer)))
        .then(bytes => this.storage.StoreNewKey(bytes))
    })
  }

  async initialize(passphrase: string) {
    await this.subtle!.importKey("raw", stringToArrayBuffer(passphrase), { name: "PBKDF2" }, false, ["deriveKey"])
    .then((static_passphrase: CryptoKey) => this.subtle!.deriveKey(pbkdf2Params, static_passphrase, aesGcmParams, true, ['wrapKey', 'unwrapKey']))
    .then((wrap_key: CryptoKey) => this.wrap_key = wrap_key)
    this.ready.set(true);
  }

  ngOnDestroy() {
    this.unsubscribe()
  }

  // Ideally we make a wrapped copy right now and store it.
  // We should also set this.encryption.key
  async generateNewDataEncryptionKey(): Promise<ArrayBuffer> {
    if ( !this.ready() ) {
      return Promise.reject('Wrapping key not initialized!');
    }
    return new Promise(r => {
      this.subtle!.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      .then((aes_key: CryptoKey) => {
        this.encryption_key = aes_key as CryptoKey;
        r(this.subtle!.wrapKey('jwk', aes_key, this.wrap_key!, 'AES-KW'));
      })
    });
  }

  async UnwrapKey(storedKey: ArrayBuffer): Promise<CryptoKey> {
    if ( !this.ready() ) {
      return Promise.reject('Wrapping key not initialized!');
    }
    return this.subtle!.unwrapKey('jwk', storedKey, this.wrap_key!, "AES-KW", "AES-GCM", false, ['encrypt', 'decrypt'])
  }

  // Need to return current encryption key reference, iv, and encrypted bytes.
  async Encrypt(data: ArrayBuffer, id: string): Promise<EncryptionResult> {
    if ( !this.encryption_key ) {
      return Promise.reject('Encryption key: not found');
    }
    const iv = new Uint8Array(96)
    const gcmOpts = {
      name: "AES-GCM",
      iv: this.crypto!.getRandomValues(iv)
    }
    const ciphertext = await this.subtle!.encrypt(gcmOpts, this.encryption_key!, data)
    return {
      ciphertext: ciphertext,
      iv: iv,
      keyReference: this.encryption_key_ref!,
    }
  }

  async Decrypt(data: ArrayBuffer, keyRef: DocumentReference, iv: ArrayBuffer) {
    const stored = await this.storage.LoadKey(keyRef);
    if ( stored.exists() ) {
      console.error(`LoadKey(${keyRef.id}: not found`);
      return;
    }
    const key = await this.UnwrapKey(stored.get('key'))
    const gcmOpts = {
      name: "AES-GCM",
      iv: iv,
    }
    return this.subtle!.decrypt(gcmOpts, key, data)
  }

  debugme() {
    console.log('Debug me called');
  }

  clear() {
    this.wrap_key = null;
    this.encryption_key = null;
  }
}
