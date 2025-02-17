import {Auth, connectAuthEmulator, getAuth} from '@angular/fire/auth';
import {connectFirestoreEmulator, Firestore, getFirestore} from '@angular/fire/firestore';
import {WritableSignal} from '@angular/core';
import {connectStorageEmulator, getStorage} from '@angular/fire/storage';

export function EmulatedAuth(connected: WritableSignal<boolean>): Auth {
  const auth = getAuth()
  if (!connected()) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connected.set(true);
  }
  return auth;
}

export function EmulatedFirestore(): Firestore {
  const firestore = getFirestore()
  // Hack to get around "already started" errors from https://stackoverflow.com/questions/71574102/firebase-error-firestore-has-already-been-started-and-its-settings-can-no-lon
  // @ts-ignore
  if ( !firestore._settingsFrozen ) {
    connectFirestoreEmulator(firestore, 'localhost', 8080, {})
  }
  return firestore;
}

export function EmulatedStorage() {
  const storage = getStorage();
  if ( storage ) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage
}
