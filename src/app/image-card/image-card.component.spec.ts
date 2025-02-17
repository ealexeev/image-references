import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference} from '@angular/fire/firestore';
import {signal} from '@angular/core';
import {LiveImage, LiveImageData, StorageService} from '../storage.service';
import {Subject} from 'rxjs';
import {FakeTagService, TagService} from '../tag.service';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;
  let connected = signal(false)
  let storage: FakeStorage;
  let imageSource: LiveImage;
  let tagService: FakeTagService;

  beforeEach(async () => {
    imageSource = {
      reference: {id: "1"} as DocumentReference,
      tags: [] as DocumentReference[],
      mimeType: "image/jpeg",
    } as LiveImage;
    storage = new FakeStorage();
    tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
      ])
    await TestBed.configureTestingModule({
      imports: [ImageCardComponent],
      providers: [
        {provide: StorageService, useValue: storage},
        {provide: TagService, useValue: tagService},
      ]
    })
    .compileComponents();

    TestBed.inject(StorageService);
    fixture = TestBed.createComponent(ImageCardComponent);
    component = fixture.componentInstance;
    component.imageSource = imageSource
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

class FakeStorage {
  SubscribeToImageData(imageId: string, out$: Subject<LiveImageData>): () => void {
    return ()=>{}
  }
}
