import { TestBed } from '@angular/core/testing';

import { ImageScaleService } from './image-scale.service';

describe('ImageScaleService', () => {
  let service: ImageScaleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageScaleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
