import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZipDownloaderComponent } from './zip-downloader.component';
import {StorageService} from '../storage.service';

describe('ZipDownloaderComponent', () => {
  let component: ZipDownloaderComponent;
  let fixture: ComponentFixture<ZipDownloaderComponent>;
  let storage: any;

  beforeEach(async () => {
    storage = MakeFakeStorage();
    await TestBed.configureTestingModule({
      imports: [ZipDownloaderComponent],
      providers: [
        { provide: StorageService, useValue: storage}
      ]
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

function MakeFakeStorage() {
  const storage = jasmine.createSpyObj('StorageService', ['LoadImageData']);
  // Definitely have to fix up
  // @ts-ignore
  // Object.getOwnPropertyDescriptor(storage, 'LoadImageData').get.and.returnValue(undefined);
  return storage
}
