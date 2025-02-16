import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference, provideFirestore} from '@angular/fire/firestore';
import {EmulatedFirestore} from '../test-providers';
import {signal} from '@angular/core';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from '../environments/environment.dev';
import {LiveImage, LiveImageData, LiveTag, StorageService} from '../storage.service';
import {Subject} from 'rxjs';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;
  let connected = signal(false)
  let storage: FakeStorage;
  let imageSource: LiveImage;

  beforeEach(async () => {
    imageSource = {
      reference: {id: "1"} as DocumentReference,
      tags: [] as DocumentReference[],
      mimeType: "image/jpeg",
    } as LiveImage;
    storage = new FakeStorage();
    await TestBed.configureTestingModule({
      imports: [ImageCardComponent],
      providers: [
        {provide: StorageService, useValue: storage},
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
