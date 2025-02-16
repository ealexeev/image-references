import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPreferencesComponent } from './set-preferences.component';
import { provideAnimations } from '@angular/platform-browser/animations';

describe('SetPreferencesComponent', () => {
  let component: SetPreferencesComponent;
  let fixture: ComponentFixture<SetPreferencesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPreferencesComponent],
      providers: [
        provideAnimations(),
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
