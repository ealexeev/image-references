import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagMainComponent } from './tag-main.component';
import { getDefaultProviders } from '../test-providers';

describe('TagMainComponent', () => {
  let component: TagMainComponent;
  let fixture: ComponentFixture<TagMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagMainComponent],
      providers: getDefaultProviders(),
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
