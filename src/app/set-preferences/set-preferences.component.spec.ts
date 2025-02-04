import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPreferencesComponent } from './set-preferences.component';

describe('SetPreferencesComponent', () => {
  let component: SetPreferencesComponent;
  let fixture: ComponentFixture<SetPreferencesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPreferencesComponent]
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
