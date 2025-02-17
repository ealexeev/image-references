import { TestBed } from '@angular/core/testing';

import { ImageService } from './image.service';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment.dev';
import {provideFirestore} from '@angular/fire/firestore';
import {EmulatedFirestore} from './test-providers';
import {EncryptionService} from './encryption.service';
import {WindowRef} from './window-ref.service';

describe('ImageService', () => {
  let service: ImageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideFirestore(()=> EmulatedFirestore()),
        {provide: EncryptionService},
      ],
    });
    service = TestBed.inject(ImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
