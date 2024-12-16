import { Injectable, signal } from '@angular/core';
import { WindowRef } from './window-ref.service';
import { EmptyError } from 'rxjs';


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

function stringToArrayBuffer(input: string): ArrayBuffer {
  const encoder = new TextEncoder()
  return encoder.encode(input);
}


@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  crypto: SubtleCrypto | null = null;
  wrap_key: CryptoKey | null = null;
  encryption_key: CryptoKey | null = null;
  ready = signal(false);

  constructor(private windowRef: WindowRef) {
    if ( !this.windowRef.nativeWindow?.crypto.subtle ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.crypto = this.windowRef!.nativeWindow!.crypto.subtle;
  }

  initialize(passphrase: string) {
    this.crypto!.importKey("raw", stringToArrayBuffer(passphrase), { name: "PBKDF2" }, false, ["deriveKey"])
    .then((static_passphrase: CryptoKey) => this.crypto!.deriveKey(pbkdf2Params, static_passphrase, aesGcmParams, true, ['wrapKey', 'unwrapKey']))
    .then((wrap_key: CryptoKey) => this.wrap_key = wrap_key)
    .then(() => this.ready.set(true));
  }

  // Ideally we make a wrapped copy right now and store it.  
  // We should also set this.encryption.key
  async generateNewDataEncryptionKey(): Promise<ArrayBuffer> {
    if ( !this.ready() ) {
      return new Promise((_, reject) => reject(TypeError('Wrapping key not initialized!')));
    }
    return new Promise(r => {
      this.crypto!.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      .then((aes_key: CryptoKey) => { 
        this.encryption_key = aes_key as CryptoKey;
        return this.crypto!.wrapKey('jwk', aes_key, this.wrap_key!, 'AES-KW');
      })
    });
  }

  debugme() {
    console.log('Debug me called');
  }

  clear() {
    this.wrap_key = null;
    this.encryption_key = null;
  }
}
