import {Injectable, OnDestroy, signal} from '@angular/core';
import { WindowRef } from './window-ref.service';
import {EmptyError, Subject} from 'rxjs';
import {LiveKey, StorageService, StoredKey} from './storage.service';
import {Bytes, DocumentSnapshot} from '@angular/fire/firestore';
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


@Injectable({
  providedIn: 'root'
})
export class EncryptionService implements OnDestroy {
  crypto: SubtleCrypto | null = null;
  wrap_key: CryptoKey | null = null;
  encryption_key: CryptoKey | null = null;
  latest_stored$: Subject<LiveKey> = new Subject<LiveKey>();
  ready = signal(false);
  unsubscribe: () => void = ()=> {return};

  constructor(private windowRef: WindowRef, private storage: StorageService) {
    if ( !this.windowRef.nativeWindow?.crypto.subtle ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.crypto = this.windowRef!.nativeWindow!.crypto.subtle;
    this.unsubscribe = this.storage.SubscribeToLatestKey(this.latest_stored$);
    this.latest_stored$.pipe(
      takeUntilDestroyed()
    ).subscribe(stored => {
      if ( stored.used < USAGE_LIMIT) {
        this.UnwrapKey(stored.key.toUint8Array()).then((k: CryptoKey) => {this.encryption_key = k});
        return;
      }
      this.generateNewDataEncryptionKey()
        .then(buffer => Bytes.fromUint8Array(new Uint8Array(buffer)))
        .then(bytes => this.storage.StoreNewKey(bytes))
    })
  }

  async initialize(passphrase: string) {
    await this.crypto!.importKey("raw", stringToArrayBuffer(passphrase), { name: "PBKDF2" }, false, ["deriveKey"])
    .then((static_passphrase: CryptoKey) => this.crypto!.deriveKey(pbkdf2Params, static_passphrase, aesGcmParams, true, ['wrapKey', 'unwrapKey']))
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
      this.crypto!.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      .then((aes_key: CryptoKey) => {
        this.encryption_key = aes_key as CryptoKey;
        r(this.crypto!.wrapKey('jwk', aes_key, this.wrap_key!, 'AES-KW'));
      })
    });
  }

  async UnwrapKey(storedKey: ArrayBuffer): Promise<CryptoKey> {
    if ( !this.ready() ) {
      return Promise.reject('Wrapping key not initialized!');
    }
    return this.crypto!.unwrapKey('jwk', storedKey, this.wrap_key!, "AES-KW", "AES-GCM", false, ['encrypt', 'decrypt'])
  }

  debugme() {
    console.log('Debug me called');
  }

  clear() {
    this.wrap_key = null;
    this.encryption_key = null;
  }
}
