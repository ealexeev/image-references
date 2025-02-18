import { TestBed } from '@angular/core/testing';

import { ImageService } from './image.service';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment.dev';
import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  Firestore, getDoc,
  getDocs,
  provideFirestore
} from '@angular/fire/firestore';
import {EmulatedFirestore, EmulatedStorage} from './test-providers';
import {EncryptionService} from './encryption.service';
import {deleteObject, provideStorage, ref} from '@angular/fire/storage';
import {FakeImageScaleService, ImageScaleService} from './image-scale.service';

class FirebaseStorage {
}

describe('ImageService', () => {
  let service: ImageService;
  let firestore: Firestore;
  let storage: FirebaseStorage

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideFirestore(()=> EmulatedFirestore()),
        provideStorage(() => EmulatedStorage()),
        {provide: ImageScaleService, useClass: FakeImageScaleService},
        {provide: EncryptionService},
      ],
    });
    service = TestBed.inject(ImageService);

    firestore = service['firestore']
    storage = service['storage']
  });

  afterEach(async () => {
    // Delete everything in FireStore
    const snapshot = await getDocs(collection(firestore, 'images'))
      .then(images=> images.forEach( async (image)=>{
          // @ts-ignore
          await deleteObject(ref(storage, `images/${image.id}`))
          await deleteDoc(doc(firestore, 'images', image.id, 'data', 'thumbnail'));
          await deleteDoc(image.ref)
      })
    )
  })

  it('should be created', () => {
    expect(service).toBeTruthy();
  })

  it('should store an un-encrypted image', async () => {
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags);
    const snapshot = await getDocs(collection(firestore, 'images'))
    expect(snapshot.size).toEqual(1)
    const storedTags = snapshot.docs[0].get('tags')
    //@ts-ignore
    expect(storedTags.map(t=>t['id'])).toEqual(tags.map(t=>t.id));
    const imgDataSnap = await getDoc(doc(firestore, 'images', snapshot.docs[0].id, 'data', 'thumbnail'));
    expect(imgDataSnap.exists()).toEqual(true);
    const data = imgDataSnap.data();
    expect(data).toBeTruthy();
    expect(data!.hasOwnProperty('mimeType')).toEqual(true);
    expect(data!.hasOwnProperty('encryptionPresent')).toBeFalse();
    expect(data!.hasOwnProperty('decrypted')).toBeFalse();
    expect(data!.hasOwnProperty('thumbnail')).toBeTrue();
    expect(data!.hasOwnProperty('fullUrl')).toBeTrue();
    expect(data!.hasOwnProperty('thumbnailIV')).toBeFalse();
    expect(data!.hasOwnProperty('thumbnailKeyRef')).toBeFalse();
    expect(data!.hasOwnProperty('fullIV')).toBeFalse();
    expect(data!.hasOwnProperty('fullKeyRef')).toBeFalse();
    const resp = await fetch(data!['fullUrl']);
    expect(resp.ok).toBe(true);
    const cloudBlob = await resp.blob();
    expect(cloudBlob.size).toEqual(blob.size);
  })

  // This is broken, need to figure out why.
  it('should store an encrypted image', async () => {
    await service['encryption'].Enable('test')
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags);
    const snapshot = await getDocs(collection(firestore, 'images'))
    expect(snapshot.size).toEqual(1)
    const storedTags = snapshot.docs[0].get('tags')
    //@ts-ignore
    expect(storedTags.map(t=>t['id'])).toEqual(tags.map(t=>t.id));
    const imgDataSnap = await getDoc(doc(firestore, 'images', snapshot.docs[0].id, 'data', 'thumbnail'));
    expect(imgDataSnap.exists()).toEqual(true);
    const data = imgDataSnap.data();
    console.log(data)
    expect(data).toBeTruthy();
    expect(data!.hasOwnProperty('mimeType')).toEqual(true);
    expect(data!.hasOwnProperty('encryptionPresent')).toBeFalse();
    expect(data!.hasOwnProperty('decrypted')).toBeFalse();
    expect(data!.hasOwnProperty('thumbnail')).toBeTrue();
    expect(data!.hasOwnProperty('fullUrl')).toBeTrue();
    expect(data!.hasOwnProperty('thumbnailIV')).toBeFalse();
    expect(data!.hasOwnProperty('thumbnailKeyRef')).toBeFalse();
    expect(data!.hasOwnProperty('fullIV')).toBeFalse();
    expect(data!.hasOwnProperty('fullKeyRef')).toBeFalse();
    const resp = await fetch(data!['fullUrl']);
    expect(resp.ok).toBe(true);
    const cloudBlob = await resp.blob();
    expect(cloudBlob.size).toEqual(blob.size);
  })

});
