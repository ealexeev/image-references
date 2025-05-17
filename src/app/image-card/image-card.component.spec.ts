import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference} from '@angular/fire/firestore';
import {Image} from '../../lib/models/image.model';
import { DefaultProviders } from '../test-providers';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let fixture: ComponentFixture<ImageCardComponent>;
  let imageSource: Image;
  let providers: DefaultProviders

  beforeEach(async () => {
    providers = new DefaultProviders();
    imageSource = {
      reference: {id: "1"} as DocumentReference,
      tags: [] as DocumentReference[],
    } as Image;

    await TestBed.configureTestingModule({
      imports: [ImageCardComponent],
      providers: providers.getProviders(),
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
