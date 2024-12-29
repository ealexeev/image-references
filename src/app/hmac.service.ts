import { Injectable, signal } from '@angular/core';
import { WindowRef } from './window-ref.service';

// Leaving this static means that if there are multiple users, it is possible
// to tell if they have stored the same file since the HMACs aren't bound
// to the user's name or uid.  Change if multiple users are supported.
const HMAC_KEY_INFO = 'Prestige Ape HMC Key Info';

const saltValues = [1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7, 1, 3, 3, 7];
const hmacPassPhrase = "prestige-ape-hmac-key";

const hmacParams = {name: "HMAC", hash: {name: "SHA-256"}};

const pbkdf2Params = {
  name: 'PBKDF2',
  hash: 'SHA-512',
  salt: new Uint8Array(saltValues),
  iterations: 1000,
};

function stringToArrayBuffer(input: string): ArrayBuffer {
  const encoder = new TextEncoder()
  return encoder.encode(input);
}

const byteToHex: string[] = [];

for (let n = 0; n <= 0xff; ++n)
{
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}

function hex(arrayBuffer: ArrayBuffer): string {
    const buff = new Uint8Array(arrayBuffer);
    const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

    for (let i = 0; i < buff.length; ++i)
        hexOctets.push(byteToHex[buff[i]]);

    return hexOctets.join("");
}

@Injectable({
  providedIn: 'root'
})
export class HmacService {
  crypto: SubtleCrypto;
  key: CryptoKey | null = null;
  ready = signal(false);

  constructor(private windowRef: WindowRef) {
    if ( this.windowRef.nativeWindow?.crypto.subtle ) {
      this.crypto = this.windowRef!.nativeWindow!.crypto!.subtle;
    } else {
      throw new ReferenceError("Could not get crypto reference!");
    }
    this.initKey();
    console.log("HMAC Service constructor finished");
  }

  debugme() {
    console.log('Debug me called');
  }

  async initKey(): Promise<void> {
    return new Promise(async (resolve, _) => {
      const static_passphrase = await this.crypto.importKey("raw", stringToArrayBuffer(hmacPassPhrase), { name: "PBKDF2" }, false, ["deriveKey"])
      const hmak_key = await this.crypto!.deriveKey(pbkdf2Params, static_passphrase, hmacParams, true, ['sign'])
      this.key = hmak_key;
      this.ready.set(true);
      resolve();
    })

  }

  async getHmacHex(blob: Blob): Promise<string> {
    if ( !this.key ) {
      await this.initKey();
    }
    return blob.arrayBuffer()
      .then((data: ArrayBuffer) => { return this.crypto!.sign("HMAC",  this.key!, data);})
      .then((buffer: ArrayBuffer) => hex(buffer));
  }
}
