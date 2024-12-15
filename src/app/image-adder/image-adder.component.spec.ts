import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageAdderComponent } from './image-adder.component';

describe('ImageAdderComponent', () => {
  let component: ImageAdderComponent;
  let fixture: ComponentFixture<ImageAdderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageAdderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageAdderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
