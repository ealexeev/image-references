import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagListComponent } from './tag-list.component';
import {LiveTag, StorageService} from '../storage.service';
import {Subject} from 'rxjs';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FakeTagService, TagService} from '../tag.service';
import {DocumentReference} from '@angular/fire/firestore';

describe('TagListComponent', () => {
  let component: TagListComponent;
  let fixture: ComponentFixture<TagListComponent>;
  let tagService: FakeTagService

  beforeEach(async () => {
    tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
    ])

    await TestBed.configureTestingModule({
      imports: [TagListComponent],
      providers: [
        {provide: TagService, useValue: tagService},
        provideAnimations(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
