import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference} from '@angular/fire/firestore';
import {FakeTagService, TagService} from '../tag.service';
import {FakeImageService, ImageService} from '../image.service';
import {Image} from '../../lib/models/image.model';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;
  let imageService: FakeImageService;
  let imageSource: Image;
  let tagService: FakeTagService;

  beforeEach(async () => {
    imageSource = {
      reference: {id: "1"} as DocumentReference,
      tags: [] as DocumentReference[],
    } as Image;
    tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
      ])
    imageService = new FakeImageService();

    await TestBed.configureTestingModule({
      imports: [ImageCardComponent],
      providers: [
        {provide: ImageService, useValue: imageService},
        {provide: TagService, useValue: tagService},
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageCardComponent);
    component = fixture.componentInstance;
    component.imageSource = imageSource
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
