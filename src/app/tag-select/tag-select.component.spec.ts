import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSelectComponent } from './tag-select.component';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import { DefaultProviders } from '../test-providers';

describe('TagSelectComponent', () => {
  let providers: DefaultProviders;
  let component: TagSelectComponent;
  let fixture: ComponentFixture<TagSelectComponent>;


  beforeEach(async () => {
    providers = new DefaultProviders();
    await TestBed.configureTestingModule({
      imports: [TagSelectComponent, NoopAnimationsModule],
      providers: providers.getProviders(),
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

