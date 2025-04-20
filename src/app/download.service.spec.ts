import { TestBed } from '@angular/core/testing';
import {ImageService,FakeImageService} from './image.service';
import {TagService, FakeTagService} from './tag.service';
import { getDefaultProviders } from './test-providers';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: getDefaultProviders(),
    });
    service = TestBed.inject(DownloadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
