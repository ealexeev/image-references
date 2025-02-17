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
    getDocs(collection(firestore, 'images'))
      .then(images=> images.forEach(image=>{
          // @ts-ignore
          deleteObject(ref(storage, `images/${image.id}`))
          deleteDoc(doc(firestore, 'images', image.id, 'data', 'thumbnail'));
          deleteDoc(image.ref)
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
    expect(imgDataSnap.get('encryptionPresent')).toBeFalse();
    expect(imgDataSnap.get('decrypted_foo')).toBeFalse();
    const storedBlob = imgDataSnap.get('thumbnail') as Blob
    expect(storedBlob.type).toEqual('image/png');
    expect(new Uint8Array(await storedBlob.arrayBuffer())).toEqual(new Uint8Array(await blob.arrayBuffer()));
    const cloudBlob = await imgDataSnap.get('fullSize')()
    expect(new Uint8Array(await cloudBlob.arrayBuffer())).toEqual(new Uint8Array(await blob.arrayBuffer()));
  })

});
