import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZipDownloaderComponent } from './zip-downloader.component';

describe('ZipDownloaderComponent', () => {
  let component: ZipDownloaderComponent;
  let fixture: ComponentFixture<ZipDownloaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZipDownloaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZipDownloaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
