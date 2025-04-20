import { TestBed } from '@angular/core/testing';

import { ImageConversionService } from './image-conversion.service';
import { EncryptionService, FakeEncryptionService } from './encryption.service';
import { ImageDataCacheService } from './image-data-cache.service';
import { DocumentSnapshot } from '@angular/fire/firestore';
import { ImageData } from '../lib/models/image.model';

describe('ImageConversionService', () => {
  let service: ImageConversionService;
  let encryption: FakeEncryptionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {provide: EncryptionService, useClass: FakeEncryptionService},
        {provide: ImageDataCacheService}
      ],
    });
    service = TestBed.inject(ImageConversionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
