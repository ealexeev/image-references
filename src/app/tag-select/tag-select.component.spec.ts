import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSelectComponent } from './tag-select.component';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FakeTagService, TagService} from '../tag.service';

describe('TagSelectComponent', () => {
  let component: TagSelectComponent;
  let fixture: ComponentFixture<TagSelectComponent>;
  let tagService: FakeTagService;

  beforeEach(async () => {
    tagService = new FakeTagService([]);
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
});

