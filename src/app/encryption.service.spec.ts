import {EncryptionService} from './encryption.service';
import {connectFirestoreEmulator, Firestore, getFirestore, provideFirestore} from '@angular/fire/firestore';
import {WindowRef} from './window-ref.service';
import {FirebaseApp, initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {firstValueFrom, lastValueFrom} from 'rxjs';

describe('EncryptionService', () => {
  let service: EncryptionService;
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
  let connected = false;

  beforeEach(() => {
    const emulatedFirestore = () => {
      const firestore = getFirestore()
      if ( !connected ) {
        connectFirestoreEmulator(firestore, 'localhost', 8080, {})
        connected = true;
      }
      return firestore;
    }

    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideFirestore(()=> emulatedFirestore()),
        {provide: EncryptionService},
        {provide: WindowRef},
      ]
    }).compileComponents()

    service = TestBed.inject(EncryptionService)
    TestBed.inject(FirebaseApp)
    TestBed.inject(Firestore)
    TestBed.inject(WindowRef)
  })

  afterEach(async () => {
    return service.forTestOnlyClearAllKeys()
  })

  it('should be un-initialized', () => {
    expect(service.subtle).toBeTruthy();
    expect(service.crypto).toBeTruthy();
    expect(service.wrap_key).toBeNull();
    expect(service.ready()).toBeFalse();
  })

  it('should initialize wrap_key', async () => {
    await service.initialize('test');
    expect(service.ready()).toBeTrue();
    expect(service.wrap_key).toBeTruthy();
  })

  it('should clear keys', async () => {
    await service.initialize('test')
    service.clear();
    expect(service.ready()).toBeFalse();
    expect(service.wrap_key).toBeNull();
  })

  it('should generate and wrap encryption key', async () => {
    await service.initialize('test');
    expect(service.ready()).toBeTrue();
    expect( await service.GenerateEncryptionKey()
      .then(k=> service.WrapKey(k))
      .then(w => service.UnwrapKey(w))
    ).toBeTruthy()
  })

  it('should store and load keys', async () => {
    await service.initialize('test');
    const key = await service.GenerateEncryptionKey();
    const wrapped = await service.WrapKey(key)
    const ref = await service.StoreWrappedKey(wrapped);
    expect(ref).toBeTruthy()
    const live = await service.LoadKey(ref)
    expect(live.key).toBeTruthy()
    expect(live.used).toEqual(0)
    expect(live.reference.path).toEqual(ref.path)
    expect(live.key.algorithm).toEqual(key.algorithm);
    expect(live.key.type).toEqual(key.type);
  })

  it('should initialize encryption_key', async () => {
    await service.initialize('test');
    expect(service.ready()).toBeTrue();
    expect(service.encryption_key).toBeTruthy();
  })

  // We have issues if initialize is called with a different passphrase and there are wrapped keys in the db.
  it('should not unwrap with different phrase', async () => {
    await service.initialize('test')
    return service.initialize('test-123')
      .then(()=> expect(service.ready()).toBeFalse())
      .catch(r=> expect(r).toContain('OperationError')
    )
  })
})

