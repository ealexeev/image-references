import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagListComponent } from './tag-list.component';
import {LiveTag, StorageService} from '../storage.service';
import {Subject} from 'rxjs';
import {provideAnimations} from '@angular/platform-browser/animations';

describe('TagListComponent', () => {
  let component: TagListComponent;
  let fixture: ComponentFixture<TagListComponent>;
  let storage: any;
  const tags$ = new Subject<LiveTag>();

  beforeEach(async () => {
    storage = jasmine.createSpyObj('StorageService', ['StoreTag'], ['tags$'])
    //@ts-ignore
    Object.getOwnPropertyDescriptor(storage, "tags$").get.and.returnValue(tags$);

    await TestBed.configureTestingModule({
      imports: [TagListComponent],
      providers: [
        {provide: StorageService, useValue: storage},
        provideAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagListComponent);
    TestBed.inject(StorageService)
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
