import {inject, Injectable} from '@angular/core';
import {DocumentReference, Firestore} from '@angular/fire/firestore';
import {MessageService} from './message.service';
import {Observable} from 'rxjs';
import {LiveImage} from './storage.service';
import {HmacService} from './hmac.service';
import {Storage} from '@angular/fire/storage';

export type Image = {
  // Tags that this image is associated with.
  tags: DocumentReference[]
  // Reference to this image.
  reference: DocumentReference
  // This is lazily loaded and cached.
  data?: ImageData
}

export type ImageData = {
  // The thumbnail blob.  Can be served up as a URL.
  thumbnail: Blob
  // A lazy loading function for fetching the full-sized image.
  fullSize: ()=>Promise<Blob>
  // Was the data encrypted in storage?
  encryptionPresent?: boolean
  // Was it successfully decrypted?
  decrypted?: boolean
}

// Maybe reconsider this interface.  The caller to subscribe can provide the observable.  And unsub can cancel and call complete.
export type ImageSubscription = {
  images$: Observable<Image[]>,
  unsubscribe: () => void,
}

const imagesCollectionPath = 'images'
const cloudDataPath = 'data'

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private hmac: HmacService = inject(HmacService);
  private firestore: Firestore = inject(Firestore);
  private message: MessageService = inject(MessageService);
  private storage = inject(Storage);

  constructor() { }
}
