import { Auth, connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectFirestoreEmulator, Firestore, getFirestore, provideFirestore, DocumentReference } from '@angular/fire/firestore';
import { ValueProvider, WritableSignal, signal } from '@angular/core';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';
import { provideFirebaseApp, initializeApp, getApps } from '@angular/fire/app';
import { environment } from './environments/environment.prod';
import { FakeImageService, ImageService } from './image.service';
import { FakeTagService, TagService } from './tag.service';
import { MessageService } from './message.service';
import { FirestoreWrapperService } from './firestore-wrapper.service';
import { StorageWrapperService } from './storage-wrapper.service';
import { FakeEncryptionService, EncryptionService } from './encryption.service';
import { ImageConversionService } from './image-conversion.service';
import { DownloadService } from './download.service';
import { Router } from '@angular/router';
import { ImageTagService } from './image-tag.service';
import { Subject, of } from 'rxjs';
import { FakeImageScaleService, ImageScaleService } from './image-scale.service';

export class DefaultEnvironmentProviders {
  static connected: WritableSignal<boolean>;

  constructor(private connected: WritableSignal<boolean>) {
    DefaultEnvironmentProviders.connected = connected;
  }

  static FirebaseApp = provideFirebaseApp(() => {
    if (getApps().length === 0) {
      return initializeApp(environment);
    }
    return getApps()[0];
  });
  static FireStore = provideFirestore(() => EmulatedFirestore());
  static Storage = provideStorage(() => EmulatedStorage());
  static Auth = provideAuth(() => EmulatedAuth(DefaultEnvironmentProviders.connected));

  getProviders() {
    return [
      DefaultEnvironmentProviders.FirebaseApp,
      DefaultEnvironmentProviders.FireStore,
      DefaultEnvironmentProviders.Storage,
      DefaultEnvironmentProviders.Auth,
    ];
  }
}

export function EmulatedAuth(connected: WritableSignal<boolean>): Auth {
  const auth = getAuth()
  if (!connected()) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connected.set(true);
  }
  return auth;
}

export function EmulatedFirestore(): Firestore {
  const firestore = getFirestore()
  // Hack to get around "already started" errors from https://stackoverflow.com/questions/71574102/firebase-error-firestore-has-already-been-started-and-its-settings-can-no-lon
  // @ts-ignore
  if (!firestore._settingsFrozen) {
    connectFirestoreEmulator(firestore, 'localhost', 8080, {})
  }
  return firestore;
}

export function EmulatedStorage() {
  const storage = getStorage();
  if (storage) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage
}

export class DefaultProviders {
  EncryptionService = new FakeEncryptionService() as unknown as EncryptionService;
  ImageService = new FakeImageService() as unknown as ImageService;
  ImageConversionService = jasmine.createSpyObj<ImageConversionService>(
    'ImageConversionService',
    [
      'snapshotToImageData',
      'snapshotToImage',
      'imageConverter',
      'imageToFirestore',
    ]);

  TagService = new FakeTagService() as unknown as TagService;
  MessageService = jasmine.createSpyObj<MessageService>('MessageService', ['Info', 'Error']);
  FirestoreWrapperService = jasmine.createSpyObj<FirestoreWrapperService>(
    'FirestoreWrapperService',
    [
      'updateDoc',
      'arrayUnion',
      'arrayRemove',
      'doc',
      'getDoc',
      'collection',
      'onSnapshot',
      'onCollectionSnapshot',
      'orderBy',
      'query',
      'where',
      'limit',
      'writeBatch'
    ],
    ['instance']
  );

  StorageWrapperService = jasmine.createSpyObj<StorageWrapperService>(
    'StorageWrapperService',
    [
      'ref',
      'getMetadata'
    ],
    ['instance']
  );
  DownloadService = {
    download: jasmine.createSpy('download'),
    busy: signal(false),
    imageCount: signal(0),
    zipFileCount: signal(0),
  } as unknown as DownloadService;
  Router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
  ImageScaleService = new FakeImageScaleService() as unknown as ImageScaleService;
  ImageTagService = {
    performLastOperation: jasmine.createSpy('performLastOperation').and.returnValue(Promise.resolve()),
    recentOperations: signal([]),
    operationComplete$: of([]), // or new Subject()
    addToScope$: new Subject<DocumentReference>(),
    removeFromScope$: new Subject<DocumentReference>(),
    addTags: jasmine.createSpy('addTags').and.returnValue(Promise.resolve()),
    removeTags: jasmine.createSpy('removeTags').and.returnValue(Promise.resolve()),
    replaceTags: jasmine.createSpy('replaceTags').and.returnValue(Promise.resolve()),
    recentTagIds: signal([]),
  } as unknown as ImageTagService;

  getProviders({
    include,
    exclude,
  }: {
    include?: unknown[];
    exclude?: unknown[];
  } = {}): ValueProvider[] {
    return [
      {
        provide: EncryptionService,
        useValue: this.EncryptionService
      },
      {
        provide: StorageWrapperService,
        useValue: this.StorageWrapperService
      },
      {
        provide: ImageService,
        useValue: this.ImageService
      },
      {
        provide: TagService,
        useValue: this.TagService
      },
      {
        provide: MessageService,
        useValue: this.MessageService
      },
      {
        provide: FirestoreWrapperService,
        useValue: this.FirestoreWrapperService
      },
      {
        provide: ImageConversionService,
        useValue: this.ImageConversionService
      },
      {
        provide: DownloadService,
        useValue: this.DownloadService
      },
      {
        provide: Router,
        useValue: this.Router
      },
      {
        provide: ImageScaleService,
        useValue: this.ImageScaleService
      },
      {
        provide: ImageTagService,
        useValue: this.ImageTagService
      }
    ].filter((provider) => {
      if (include && !include.includes(provider.provide)) {
        return false;
      }
      if (exclude && exclude.includes(provider.provide)) {
        return false;
      }
      return true;
    });
  }
}

export function defaultProviders(): ValueProvider[] {
  return new DefaultProviders().getProviders();
}