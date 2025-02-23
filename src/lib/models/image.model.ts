/*
* Library of types that represent image and image data that are used in the application.
*
* */

import {DocumentReference} from '@angular/fire/firestore';
import {Observable} from 'rxjs';

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

export type ImageSubscription<Type> = {
  results$: Observable<Type>,
  unsubscribe: () => void,
}
