import { TestBed } from '@angular/core/testing';
import { DefaultProviders } from './test-providers';
import { IntegrityService } from './integrity.service';

describe('IntegrityService', () => {
  let providers: DefaultProviders;
  let service: IntegrityService;

  beforeEach(() => {
    providers = new DefaultProviders();
    TestBed.configureTestingModule({
      providers: providers.getProviders(),
    });
    service = TestBed.inject(IntegrityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
