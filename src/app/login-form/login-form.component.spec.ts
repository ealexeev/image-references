import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginFormComponent } from './login-form.component';
import {connectAuthEmulator, getAuth, provideAuth} from '@angular/fire/auth';
import { EmulatedAuth} from '../test-providers';
import {signal} from '@angular/core';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from '../environments/environment.dev';
import {MatDialogRef} from '@angular/material/dialog';
import {provideAnimations} from '@angular/platform-browser/animations';

describe('LoginFormComponent', () => {
  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;
  const connected = signal(false);
  let matDialogRef: any;

  beforeEach(async () => {
    matDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [LoginFormComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideAuth(()=>EmulatedAuth(connected)),
        provideAnimations(),
        { provide: MatDialogRef, useValue: matDialogRef },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    TestBed.inject(MatDialogRef)
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
