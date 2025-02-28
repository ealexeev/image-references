import { TestBed } from '@angular/core/testing';

import { IntegrityService } from './integrity.service';

describe('IntegrityService', () => {
  let service: IntegrityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntegrityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
