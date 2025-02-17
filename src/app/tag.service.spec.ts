import { TestBed } from '@angular/core/testing';

import {Tag, TagService} from './tag.service';
import {signal} from '@angular/core';
import {FirebaseApp, initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment.dev';
import {
  collection, deleteDoc,
  doc,
  Firestore, getDoc,
  getDocs,
  provideFirestore,
  query,
  setDoc,
  writeBatch
} from '@angular/fire/firestore';
import {EmulatedFirestore} from './test-providers';
import {EncryptionService} from './encryption.service';
import {firstValueFrom, Subject, takeUntil} from 'rxjs';

describe('TagService', () => {
  let service: TagService;
  const connected = signal(false);
  let firestore: Firestore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideFirestore(()=> EmulatedFirestore(connected)),
        {provide: EncryptionService},
      ]
    }).compileComponents()

    service = TestBed.inject(TagService);
    TestBed.inject(FirebaseApp)
    TestBed.inject(Firestore)
    firestore = service['firestore'];
  });

  afterEach(async () => {
    const q = query(collection(firestore, 'tags'))
    const docs = await getDocs(q);
    const batch = writeBatch(firestore)
    docs.forEach(doc => {batch.delete(doc.ref);});
    await batch.commit();
  })

  it('should be created', () => {
    expect(service).toBeTruthy();
  })

  it('should store a tag', async () => {
    const tagName = 'test-tag';
    const created = await service.StoreTag(tagName)
    expect(created).toBeTruthy();
    expect(created.name).toEqual(tagName);
  })

  it('should load a tag by name', async () => {
    const tagName = 'test-tag';
    const created = await service.StoreTag(tagName)
    const loaded = await service.LoadTagByName(tagName);
    expect(loaded).toBeTruthy();
    expect(loaded.name).toEqual(tagName);
    expect(loaded.reference.id).toEqual(created.reference.id);
  })

  it('should load a tag by reference', async () => {
    const tagName = 'test-tag';
    const created = await service.StoreTag(tagName)
    const loaded = await service.LoadTagByReference(created.reference);
    expect(loaded).toBeTruthy();
    expect(loaded.name).toEqual(tagName);
    expect(loaded.reference.id).toEqual(created.reference.id);
  })

  it('storing tags should increment count', async () => {
    let latest = 0;
    const done$ = new Subject<void>();
    service.tagsCount$.pipe(
      takeUntil(done$)
    ).subscribe(count => {latest = count})
    for (const tagName of ['a', 'b', 'c']) {
      await service.StoreTag(tagName)
    }
    done$.next()
    expect(latest).toBe(3);
  })

  it('storing tags should update tags$', async () => {
    let latest: Tag[] = [];
    const done$ = new Subject<void>();
    service.tags$.pipe(
      takeUntil(done$)
    ).subscribe(tags => {
      latest = tags;
    })
    await service.StoreTag('foobar')
    expect(latest.length).toBe(1)
    expect(latest.pop()!.name).toEqual('foobar')
  })

  it('stored tags are cached', async () => {
    const stored = []
    for (const tagName of ['a', 'b', 'c']) {
      expect(service.TagByName(tagName)).toBeUndefined()
      stored.push(await service.StoreTag(tagName))
    }
    for (const tag of stored) {
      expect(service.TagByName(tag.name)).toBeTruthy()
      expect(service.TagById(tag.reference.id)).toBeTruthy()
    }
  })

  it('recent tags are updated based on use', async () => {
    for (const tagName of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(service.TagByName(tagName)).toBeUndefined()
      await service.StoreTag(tagName)
    }
    const f = service.TagByName('f')
    const c = service.TagByName('c')
    expect(f).toBeTruthy()
    expect(c).toBeTruthy()
    service.appliedTags$.next([f!, c!])
    const recent = await firstValueFrom(service.recentTags$)
    expect(recent).toBeTruthy()
    expect(recent.map(t=>t.name)).toEqual(['f', 'c', 'a', 'b', 'd', 'e'])
  })

  it('deletes a tag and removes references to it', async () => {
    const t = await service.StoreTag('test-tag')
    const t2 = await service.StoreTag('test-tag2')
    const dRef1 = doc(firestore, 'images', 'image-1')
    const dRef2 = doc(firestore, 'images', 'image-2')
    await setDoc(dRef1, {'tags': [t.reference]})
    await setDoc(dRef2, {'tags': [t2.reference]})
    await service.DeleteTag(t.reference)
    const tagSnap = await getDoc(t.reference)
    expect(tagSnap.exists()).toBeFalse()
    const d1Snap = await getDoc(dRef1)
    expect(d1Snap.exists()).toBeTrue()
    const d2Snap = await getDoc(dRef2)
    expect(d1Snap.get('tags')).toEqual([]);
    expect(d2Snap.exists()).toBeTrue()
    expect(d2Snap.get('tags').pop()!.id).toEqual(t2.reference.id)
    await deleteDoc(dRef1)
    await deleteDoc(dRef2)
  })

});
