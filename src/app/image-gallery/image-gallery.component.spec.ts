import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageGalleryComponent } from './image-gallery.component';
import {StorageService} from '../storage.service';
import {FakeTagService, TagService} from '../tag.service';
import {DocumentReference} from '@angular/fire/firestore';

describe('ImageGalleryComponent', () => {
  let component: ImageGalleryComponent;
  let fixture: ComponentFixture<ImageGalleryComponent>;
  let storageService: any;
  let tagService: FakeTagService;

  beforeEach(async () => {
    storageService = jasmine.createSpyObj('StorageService', ['SubscribeToLatestImages', 'SubscribeToTag']);
    tagService = tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
    ])

    await TestBed.configureTestingModule({
      imports: [ImageGalleryComponent],
      providers: [
        { provide: StorageService, useValue: storageService},
        { provide: TagService, useValue: tagService},
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
