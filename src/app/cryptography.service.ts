import { Injectable } from '@angular/core';
import { WindowRef } from './window-ref.service';
import { EmptyError } from 'rxjs';

const HMAC_ITERATIONS = 100;
const saltValues = [1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7];
const keyExportFormat = "jwk";
const localStorageHMACKey = "prestige-ape-hmac-key";
const localStroageAESKey = "presetige-ape-aes-key";
const hmacParams = {name: "HMAC", hash: {name: "SHA-256"}};

@Injectable({
  providedIn: 'root'
})
export class CryptographyService {
  crypto: any = null;
  hmac_salt = new Uint8Array(saltValues);
  enc_salt = new Uint8Array(saltValues.reverse());
  hmac_key: any = null;

  constructor(private windowRef: WindowRef) {
    this.crypto = this.windowRef.nativeWindow?.crypto.subtle;
    if ( !this.crypto ) {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.hmac_key = localStorage.getItem(localStorageHMACKey);
    if ( this.hmac_key === null ){
      this.crypto.generateKey(hmacParams, true, ["sign", "verify"]).then(
        (k: any) => {
          this.hmac_key = k;
          const exported = this.crypto.exportKey(keyExportFormat, k);
          localStorage.setItem(localStorageHMACKey, JSON.stringify(exported));
        }
      );      
    } else {
      this.hmac_key = this.crypto.importKey(keyExportFormat, this.hmac_key, hmacParams, true, ["sign", "verify"]);
    }

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
