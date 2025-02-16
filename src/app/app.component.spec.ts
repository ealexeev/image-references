import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import {provideAuth} from '@angular/fire/auth';
import {EmulatedAuth} from './test-providers';
import {signal} from '@angular/core';
import {provideAnimations} from '@angular/platform-browser/animations';

describe('AppComponent', () => {
  const connected = signal(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideAuth(()=> EmulatedAuth(connected)),
        provideAnimations(),
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
