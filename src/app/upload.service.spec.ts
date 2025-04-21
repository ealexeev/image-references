import { TestBed } from '@angular/core/testing';

import { UploadService } from './upload.service';
import { DefaultProviders } from './test-providers';

describe('UploadService', () => {
  let providers: DefaultProviders
  let service: UploadService;

  beforeEach(() => {
    providers = new DefaultProviders();
    TestBed.configureTestingModule({
      providers: providers.getProviders(),
    });
    service = TestBed.inject(UploadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
