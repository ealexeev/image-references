import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagMainComponent } from './tag-main.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import {FakeTagService, TagService} from '../tag.service';
import {DocumentReference} from '@angular/fire/firestore';

describe('TagMainComponent', () => {
  let component: TagMainComponent;
  let fixture: ComponentFixture<TagMainComponent>;
  let tagService: FakeTagService

  beforeEach(async () => {
    tagService = new FakeTagService([
      {name: 'tag-1', reference: {id: "1"} as DocumentReference},
      {name: 'tag-2', reference: {id: "2"} as DocumentReference},
    ])

    await TestBed.configureTestingModule({
      imports: [TagMainComponent],
      providers: [
        provideAnimations(),
        { provide: TagService, useValue: tagService },
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
