import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSelectComponent } from './tag-select.component';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FakeTagService, Tag, TagService} from '../tag.service';
import { getDefaultProviders } from '../test-providers';

describe('TagSelectComponent', () => {
  let component: TagSelectComponent;
  let fixture: ComponentFixture<TagSelectComponent>;


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagSelectComponent],
      providers: getDefaultProviders(),
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagSelectComponent);
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

