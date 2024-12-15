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
export class CryptographyService {
  crypto: any = null;
  hmac_salt = new Uint8Array(saltValues);
  enc_salt = new Uint8Array(saltValues.reverse());
  wrap_key: CryptoKey | null = null;
  hmac_key: CryptoKey | null = null;
  hmac_ready = signal(false);
  encryption_ready = signal(false);

  constructor(private windowRef: WindowRef) {
    this.crypto = this.windowRef.nativeWindow?.crypto.subtle;
    if ( !this.crypto ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.crypto.importKey("raw", stringToArrayBuffer(localStorageHMACKey), { name: "PBKDF2" }, false, ["deriveKey"])
    .then((static_passphrase: CryptoKey) => this.crypto.deriveKey(pbkdf2Params, static_passphrase, hmacParams, true, ['sign']))
    .then((hmac_key: CryptoKey) => this.hmac_key = hmac_key)
    .then(() => this.hmac_ready.set(true));
  }

  async init_hmac() {
    // This key is available without user supplied passprahse to allow duplicate
    // detection whether the user entered a passhphrase or not.
    const pbkdf2_key = await this.crypto.importKey("raw", stringToArrayBuffer(localStorageHMACKey), { name: "PBKDF2" }, false, ["deriveKey"]);
    this.hmac_key = await this.crypto.deriveKey('PBKDF2', pbkdf2_key, hmacParams, false, ['sign']);
    this.hmac_ready.set(true);
  }

  debugme() {
    console.log('Debug me called');
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
