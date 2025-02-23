import { TestBed } from '@angular/core/testing';

import { ImageDataCacheService } from './image-data-cache.service';

describe('ImageDataCacheService', () => {
  let service: ImageDataCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageDataCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
