import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import {provideAuth} from '@angular/fire/auth';
import {EmulatedAuth} from './test-providers';
import {signal} from '@angular/core';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FirebaseApp, initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment.dev';
import {EncryptionService} from './encryption.service';
import {ActivatedRoute, RouterModule} from '@angular/router';

describe('AppComponent', () => {
  const connected = signal(false);
  let encryptionService: any;

  beforeEach(async () => {
    encryptionService = jasmine.createSpyObj('EncryptionService', ['Enable']);

    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterModule.forRoot(
          // This needs fixing for sure.
          [{path: '', component: AppComponent}]
        )
      ],
      providers: [
        provideFirebaseApp(() => initializeApp(environment)),
        provideAuth(()=> EmulatedAuth(connected)),
        provideAnimations(),
        {provide: FirebaseApp, useValue: {name: "Foo"}},
        {provide: EncryptionService, useValue: encryptionService},
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
