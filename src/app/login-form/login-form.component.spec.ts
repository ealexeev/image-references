import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginFormComponent } from './login-form.component';
import {connectAuthEmulator, getAuth, provideAuth} from '@angular/fire/auth';
import { EmulatedAuth} from '../test-providers';
import {signal} from '@angular/core';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from '../environments/environment.dev';

describe('LoginFormComponent', () => {
  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;
  const connected = signal(false);

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [LoginFormComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideAuth(()=>EmulatedAuth(connected))
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
