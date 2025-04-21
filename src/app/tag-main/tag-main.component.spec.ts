import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagMainComponent } from './tag-main.component';
import { DefaultProviders } from '../test-providers';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TagMainComponent', () => {
  let component: TagMainComponent;
  let fixture: ComponentFixture<TagMainComponent>;
  let providers: DefaultProviders;

  beforeEach(async () => {
    providers = new DefaultProviders();
    await TestBed.configureTestingModule({
      imports: [TagMainComponent, NoopAnimationsModule],
      providers: providers.getProviders(),
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
