import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSelectComponent } from './tag-select.component';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FakeTagService, Tag, TagService} from '../tag.service';
import {DocumentReference} from '@angular/fire/firestore';

describe('TagSelectComponent', () => {
  let component: TagSelectComponent;
  let fixture: ComponentFixture<TagSelectComponent>;
  let tagService: FakeTagService;
  const tags: Tag[] = [
    {name: 'tag-1', reference: {id: "1"} as DocumentReference},
    {name: 'tag-2', reference: {id: "2"} as DocumentReference},
  ]

  beforeEach(async () => {
    tagService = new FakeTagService(tags);
    await TestBed.configureTestingModule({
      imports: [TagSelectComponent],
      providers: [
        provideAnimations(),
        { provide: TagService, useValue: tagService },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagSelectComponent);
    TestBed.inject(TagService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  //WIP
  it('shows two tags', () => {
    const el = fixture.nativeElement
    const form = el.querySelector('mat-form-field')!
    expect(form).toBeTruthy();
    // /expect(form.textContent).toContain('something');
  })
});

