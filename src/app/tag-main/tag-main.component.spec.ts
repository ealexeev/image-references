import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagMainComponent } from './tag-main.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import {LiveTag, StorageService} from '../storage.service';
import {Subject} from 'rxjs';

describe('TagMainComponent', () => {
  let component: TagMainComponent;
  let fixture: ComponentFixture<TagMainComponent>;
  let storage: any;
  const tags$ = new Subject<LiveTag>();

  beforeEach(async () => {
    storage = jasmine.createSpyObj('StorageService', ['StoreTag'], ['tags$'])
    //@ts-ignore
    Object.getOwnPropertyDescriptor(storage, "tags$").get.and.returnValue(tags$);

    await TestBed.configureTestingModule({
      imports: [TagMainComponent],
      providers: [
        provideAnimations(),
        { provide: StorageService, useValue: storage },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
