import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import {connectFirestoreEmulator, getFirestore, provideFirestore} from '@angular/fire/firestore';
import {connectStorageEmulator, getStorage, provideStorage} from '@angular/fire/storage';
import { provideAnimations } from '@angular/platform-browser/animations';

import { environment } from './environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideFirebaseApp(() => initializeApp(environment)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestoreOrEmulator(environment)),
    provideStorage(() => getStorageOrEmulator(environment)),
    provideAnimations(),
    ]
};

function getFirestoreOrEmulator(environment: any) {
  const firestore = getFirestore();
  if ( environment?.firestoreUseLocal ) {
    connectFirestoreEmulator(firestore, 'localhost', 8080, {})
  }
  return firestore;
}

function getStorageOrEmulator(environment: any) {
  const storage = getStorage();
  if ( environment?.firebaseStorageUseLocal ) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage
}
