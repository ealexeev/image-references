import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZipDownloaderComponent } from './zip-downloader.component';
import {FakeImageService, ImageService} from '../image.service';

describe('ZipDownloaderComponent', () => {
  let component: ZipDownloaderComponent;
  let fixture: ComponentFixture<ZipDownloaderComponent>;
  let imageService: FakeImageService;


  beforeEach(async () => {
    imageService = new FakeImageService();
    await TestBed.configureTestingModule({
      imports: [ZipDownloaderComponent],
      providers: [
        { provide: ImageService, useValue: imageService}
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZipDownloaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
