import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import {provideAuth} from '@angular/fire/auth';
import {EmulatedAuth} from './test-providers';
import {signal} from '@angular/core';
import {provideAnimations} from '@angular/platform-browser/animations';
import {FirebaseApp, initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {environment} from './environments/environment.dev';
import {EncryptionService} from './encryption.service';
import {Router, RouterModule} from '@angular/router';
import {FakeTagService, TagService} from './tag.service';
import {FakeImageService, ImageService} from './image.service';

describe('AppComponent', () => {
  const connected = signal(false);
  let encryptionService: any;
  let tagService: FakeTagService;
  let imageService: FakeImageService;

  beforeEach(async () => {
    encryptionService = jasmine.createSpyObj('EncryptionService', ['Enable']);
    tagService = new FakeTagService([]);
    imageService = new FakeImageService();

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
        {provide: ImageService, useValue: imageService},
        {provide: TagService, useValue: tagService},
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
