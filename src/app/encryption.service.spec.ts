import { EncryptionService } from './encryption.service';
import { Firestore, provideFirestore } from '@angular/fire/firestore';
import { WindowRef } from './window-ref.service';
import { FirebaseApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from './environments/environment.dev';
import { TestBed } from '@angular/core/testing';
import { DefaultEnvironmentProviders, DefaultProviders, EmulatedFirestore } from './test-providers';
import { signal } from '@angular/core';
import { D } from '@angular/cdk/keycodes';

describe('EncryptionService', () => {
  let environmentProviders = new DefaultEnvironmentProviders(signal(false));
  let defaultProviders = new DefaultProviders();
  let service: EncryptionService;
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...environmentProviders.getProviders(),
        ...defaultProviders.getProviders({ exclude: [EncryptionService] }),
        EncryptionService,
        WindowRef,
      ]
    }).compileComponents()

    service = TestBed.inject(EncryptionService)
  })

  afterEach(async () => {
    return service.forTestOnlyClearAllKeys()
  })

  it('should be un-initialized', () => {
    expect(service.subtle).toBeTruthy();
    expect(service.crypto).toBeTruthy();
    expect(service.wrap_key).toBeNull();
    expect(service.enabled()).toBeFalse();
  })

  it('should initialize wrap_key', async () => {
    await service.Enable('test');
    expect(service.enabled()).toBeTrue();
    expect(service.wrap_key).toBeTruthy();
  })

  it('should clear keys', async () => {
    await service.Enable('test')
    service.Disable();
    expect(service.enabled()).toBeFalse();
    expect(service.wrap_key).toBeNull();
  })

  it('should generate and wrap encryption key', async () => {
    await service.Enable('test');
    expect(service.enabled()).toBeTrue();
    expect(await service.GenerateEncryptionKey()
      .then(k => service.WrapKey(k.key))
      .then(w => service.UnwrapKey(w))
    ).toBeTruthy()
  })

  it('should store and load keys', async () => {
    await service.Enable('test');
    const liveKey = await service.GenerateEncryptionKey();
    const wrapped = await service.WrapKey(liveKey.key)
    const ref = await service.StoreWrappedKey(wrapped);
    expect(ref).toBeTruthy()
    const live = await service.LoadKey(ref)
    expect(live.key).toBeTruthy()
    expect(live.used).toEqual(0)
    expect(live.reference.path).toEqual(ref.path)
    expect(live.key.algorithm).toEqual(liveKey.key.algorithm);
    expect(live.key.type).toEqual(liveKey.key.type);
  })

  it('should initialize encryption_key', async () => {
    await service.Enable('test');
    expect(service.enabled()).toBeTrue();
    expect(service.encryption_key).toBeTruthy();
  })

  // We have issues if initialize is called with a different passphrase and there are wrapped keys in the db.
  it('should not unwrap with different phrase', async () => {
    await service.Enable('test')
    return service.Enable('test-123')
      .then(() => expect(service.enabled()).toBeFalse())
      .catch(r => expect(r).toContain('OperationError')
      )
  })
})

