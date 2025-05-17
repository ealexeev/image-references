import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCardPlaceholderComponent } from './image-card-placeholder.component';
import { DefaultProviders } from '../test-providers';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ImageCardPlaceholderComponent', () => {
  let component: ImageCardPlaceholderComponent;
  let fixture: ComponentFixture<ImageCardPlaceholderComponent>;
  let providers: DefaultProviders;

  beforeEach(async () => {
    providers = new DefaultProviders();
    await TestBed.configureTestingModule({
      providers: providers.getProviders(),
      imports: [ImageCardPlaceholderComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageCardPlaceholderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
