import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageViewComponent } from './image-view.component';
import {DefaultProviders} from '../test-providers';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

describe('ImageViewComponent', () => {
  let providers: DefaultProviders;
  let component: ImageViewComponent;
  let fixture: ComponentFixture<ImageViewComponent>;

  beforeEach(async () => {
    providers = new DefaultProviders();
    await TestBed.configureTestingModule({
      providers: providers.getProviders(),
      imports: [ImageViewComponent, NoopAnimationsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
