import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageGalleryComponent } from './image-gallery.component';
import {StorageService} from '../storage.service';

describe('ImageGalleryComponent', () => {
  let component: ImageGalleryComponent;
  let fixture: ComponentFixture<ImageGalleryComponent>;
  let storageService: any;

  beforeEach(async () => {
    storageService = jasmine.createSpyObj('StorageService', ['SubscribeToLatestImages', 'SubscribeToTag']);

    await TestBed.configureTestingModule({
      imports: [ImageGalleryComponent],
      providers: [
        { provide: StorageService, useValue: storageService}
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageGalleryComponent);
    TestBed.inject(StorageService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
