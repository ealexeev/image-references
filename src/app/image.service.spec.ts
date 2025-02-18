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
import { FirebaseStorage } from '@firebase/storage'
import {EmulatedFirestore, EmulatedStorage} from './test-providers';
import {EncryptionService, FakeEncryptionService} from './encryption.service';
import {deleteObject, provideStorage, ref} from '@angular/fire/storage';
import {FakeImageScaleService, ImageScaleService} from './image-scale.service';

describe('ImageService', () => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL=30000;
  let service: ImageService;
  let firestore: Firestore;
  let storage: FirebaseStorage;
  let encryption: FakeEncryptionService;

  beforeEach(() => {
    encryption = new FakeEncryptionService();

    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideFirestore(()=> EmulatedFirestore()),
        provideStorage(() => EmulatedStorage()),
        {provide: ImageScaleService, useClass: FakeImageScaleService},
        {provide: EncryptionService, useValue: encryption},
      ],
    });
    service = TestBed.inject(ImageService);

    firestore = service['firestore']
    //@ts-ignore
    storage = service['storage']
  });

  afterEach(async () => {
    // Delete everything in FireStore
    const snapshot = await getDocs(collection(firestore, 'images'))
    for (const image of snapshot.docs) {
          // @ts-ignore
          await deleteObject(ref(storage, `data/${image.id}`))
          await deleteDoc(doc(firestore, 'images', image.id, 'data', 'thumbnail'));
          await deleteDoc(image.ref)
    }
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
    await encryption.Enable('test')
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
    const data = imgDataSnap.data()!;
    expect(data).toBeTruthy();
    expect(data!.hasOwnProperty('mimeType')).toEqual(true);
    expect(data!['mimeType']).toEqual('image/png');
    expect(data!.hasOwnProperty('thumbnail')).toBeTrue();
    expect(data!.hasOwnProperty('fullUrl')).toBeTrue();
    expect(data!.hasOwnProperty('thumbnailIV')).toBeTrue();
    expect(data!['thumbnailIV']!.toUint8Array()).toEqual(encryption.iv);
    expect(data!.hasOwnProperty('thumbnailKeyRef')).toBeTrue();
    expect(data!['thumbnailKeyRef']).toEqual(encryption.keyRef)
    expect(data!.hasOwnProperty('fullIV')).toBeTrue();
    expect(data!['fullIV'].toUint8Array()).toEqual(encryption.iv);
    expect(data!.hasOwnProperty('fullKeyRef')).toBeTrue();
    expect(data!['fullKeyRef']).toEqual(encryption.keyRef);
    const resp = await fetch(data!['fullUrl']);
    expect(resp.ok).toBe(true);
    const cloudBlob = await resp.blob();
    expect(cloudBlob.size).toEqual(blob.size);
  })

  it('should add tags', async () => {
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const ref = doc(firestore, 'images',  await service['hmac'].getHmacHex(blob))
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags);
    await service.AddTags(ref, [{id: "3"} as DocumentReference])
    const snapshot = await getDoc(ref);
    expect(snapshot.exists()).toBeTrue();
    const image = service['imageFromFirestore'](snapshot, {})
    expect(image.tags.length).toEqual(3);
    expect(image.tags.map(t=>t.id)).toEqual(['1', '2', '3'])
  })

  it('should replace tags', async () => {
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const ref = doc(firestore, 'images',  await service['hmac'].getHmacHex(blob))
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags)
    await service.ReplaceTags(ref, [{id: "3"} as DocumentReference])
    const snapshot = await getDoc(ref)
    expect(snapshot.exists()).toBeTrue()
    const image = service['imageFromFirestore'](snapshot, {})
    expect(image.tags.length).toEqual(1)
    expect(image.tags.pop()!.id).toEqual('3')
  })

  it('should remove tags', async () => {
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const ref = doc(firestore, 'images',  await service['hmac'].getHmacHex(blob))
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags);
    await service.RemoveTags(ref, [{id: "1"} as DocumentReference])
    const snapshot = await getDoc(ref);
    const image = service['imageFromFirestore'](snapshot, {})
    expect(image.tags.length).toEqual(1)
    expect(image.tags.pop()!.id).toEqual('2')
  })

  it('should delete image', async () => {
    const blob = new Blob(['stuff'], {type: 'image/png'});
    const ref = doc(firestore, 'images',  await service['hmac'].getHmacHex(blob))
    const tags = [{id: "1"} as DocumentReference, {id: "2"} as DocumentReference]
    await service.StoreImage(blob, tags)
    await service.DeleteImage(ref)
    const snapshot = await getDoc(ref)
    expect(snapshot.exists()).toBeFalse()
    const dataSnap = await getDoc(doc(firestore, 'images',  ref.id, 'data', 'thumbnail'))
    expect(dataSnap.exists()).toBeFalse()
  })

});
