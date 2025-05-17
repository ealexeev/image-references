import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideAuth } from '@angular/fire/auth';
import { defaultProviders, DefaultEnvironmentProviders } from './test-providers';
import { signal } from '@angular/core';
import { NoopAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { FirebaseApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from './environments/environment.dev';
import { EncryptionService } from './encryption.service';
import { Router, RouterModule } from '@angular/router';
import { FakeTagService, TagService } from './tag.service';
import { FakeImageService, ImageService } from './image.service';
import { DefaultProviders } from './test-providers';
import { FirestoreWrapperService } from './firestore-wrapper.service';

describe('AppComponent', () => {
  const connected = signal(false);
  let providers: DefaultProviders;
  let environmentProviders: DefaultEnvironmentProviders;
  let encryptionService: any;
  let tagService: FakeTagService;
  let imageService: FakeImageService;

  beforeEach(async () => {
    providers = new DefaultProviders();
    environmentProviders = new DefaultEnvironmentProviders(connected);
    encryptionService = jasmine.createSpyObj('EncryptionService', ['Enable']);
    tagService = new FakeTagService();
    imageService = new FakeImageService();

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        AppComponent,
        RouterModule.forRoot(
          // This needs fixing for sure.
          [{ path: '', component: AppComponent }]
        )
      ],
      providers: [
        ...environmentProviders.getProviders(),
        ...defaultProviders(),
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
