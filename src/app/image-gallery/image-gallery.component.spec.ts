import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageGalleryComponent } from './image-gallery.component';
import {FakeTagService, TagService} from '../tag.service';
import {DocumentReference} from '@angular/fire/firestore';
import {FakeImageService, ImageService} from '../image.service';

describe('ImageGalleryComponent', () => {
  let component: ImageGalleryComponent;
  let fixture: ComponentFixture<ImageGalleryComponent>;
  let tagService: FakeTagService;
  let imageService: FakeImageService;

  beforeEach(async () => {
    imageService = new FakeImageService();

    tagService = tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
    ])

    await TestBed.configureTestingModule({
      imports: [ImageGalleryComponent],
      providers: [
        { provide: ImageService, useValue: imageService},
        { provide: TagService, useValue: tagService},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
