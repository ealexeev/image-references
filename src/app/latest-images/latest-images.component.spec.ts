import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LatestImagesComponent } from './latest-images.component';

describe('LatestImagesComponent', () => {
  let component: LatestImagesComponent;
  let fixture: ComponentFixture<LatestImagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LatestImagesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LatestImagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
