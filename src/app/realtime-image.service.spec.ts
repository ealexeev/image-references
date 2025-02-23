import { TestBed } from '@angular/core/testing';

import { RealtimeImageService } from './realtime-image.service';

describe('RealtimeImageService', () => {
  let service: RealtimeImageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RealtimeImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
