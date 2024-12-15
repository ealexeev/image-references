import { Injectable, signal } from '@angular/core';
import { WindowRef } from './window-ref.service';
import { EmptyError } from 'rxjs';

const HMAC_ITERATIONS = 100;
const HMAC_KEY_INFO = 'Prestige Ape HMC Key Info';

function _makeHmacInfo(): DataView {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(HMAC_KEY_INFO);
  return new DataView(encoded.buffer);
}

const saltValues = [1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7];
const keyExportFormat = "jwk";
const localStorageHMACKey = "prestige-ape-hmac-key";
const localStroageAESKey = "presetige-ape-aes-key";
const hmacParams = {name: "HMAC", hash: {name: "SHA-256"}};


const pbkdf2Params = {
  name: 'PBKDF2',
  hash: 'SHA-512',
  salt: new Uint8Array(saltValues),
  iterations: 1000,
};

const hkdfParams = {
  name: 'HKDF',
  hash: 'SHA-512',
  salt: new Uint8Array(saltValues.reverse()),
  info: _makeHmacInfo(),
}


@Injectable({
  providedIn: 'root'
})
export class CryptographyService {
  crypto: any = null;
  hmac_salt = new Uint8Array(saltValues);
  enc_salt = new Uint8Array(saltValues.reverse());
  wrap_key: CryptoKey | null = null;
  hmac_key: CryptoKey | null = null;
  ready = signal(false);

  constructor(private windowRef: WindowRef) {
    this.crypto = this.windowRef.nativeWindow?.crypto.subtle;
    if ( !this.crypto ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
  }

  async initialize(passphrase: string): Promise<boolean> {
    return new Promise( (resolve, reject) => {
      this.crypto.deriveKey(pbkdf2Params, passphrase, pbkdf2Params, false, ['deriveKey', 'wrapKey', 'unwrapKey'])
      .then((k: CryptoKey) => { this.wrap_key = k; })
      .then(() => {this.crypto.deriveKey(hkdfParams, this.wrap_key, hkdfParams, true, ['sign']);})
      .then((k: CryptoKey) => { this.hmac_key = k; })
      .then(() => {
        this.ready.set(true);
        resolve(true);
      })
      .catch((err: Error) => reject(err));
    });
  }

  clear() {
    this.wrap_key = null;
    this.hmac_key = null;
  }

  GetHMAC(blob: Blob, key: any): Promise<ArrayBuffer|null> {
    return blob.arrayBuffer().then((data: ArrayBuffer) => { return this.crypto.sign("HMAC",  key, data);});
  }

  async ArrayBufferToB64(array: ArrayBuffer): Promise<string> {
    return new Promise((resolve) => {
      const blob = new Blob([array]);
      const reader = new FileReader();
      
      reader.onload = (event: any) => {
        const dataUrl = event?.target?.result;
        if ( !dataUrl ) {
          console.log("Reader got no target.result!");
          return resolve("ERROR!!!");
        }
        const [_, base64] = dataUrl.split(',');
        resolve(base64);
      };
      
      reader.readAsDataURL(blob);
    });
  }
}
