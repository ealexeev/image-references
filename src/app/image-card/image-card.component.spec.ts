import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference} from '@angular/fire/firestore';
import {FakeTagService, TagService} from '../tag.service';
import {FakeImageService, ImageService} from '../image.service';
import {Image} from '../../lib/models/image.model';
import { getDefaultProviders } from '../test-providers';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;
  let imageSource: Image;

  beforeEach(async () => {
    imageSource = {
      reference: {id: "1"} as DocumentReference,
      tags: [] as DocumentReference[],
    } as Image;

    await TestBed.configureTestingModule({
      imports: [ImageCardComponent],
      providers: getDefaultProviders(),
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageCardComponent);
    component = fixture.componentInstance;
    component.imageSource = imageSource;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
