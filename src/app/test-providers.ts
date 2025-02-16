import {Auth, connectAuthEmulator, getAuth} from '@angular/fire/auth';
import {connectFirestoreEmulator, Firestore, getFirestore} from '@angular/fire/firestore';
import {WritableSignal} from '@angular/core';

export function EmulatedAuth(connected: WritableSignal<boolean>): Auth {
  const auth = getAuth()
  if (!connected()) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connected.set(true);
  }
  return auth;
}

export function EmulatedFirestore(connected: WritableSignal<boolean>): Firestore {
  const firestore = getFirestore()
  if (!connected()) {
    connectFirestoreEmulator(firestore, 'localhost', 8080, {})
    connected.set(true);
  }
  return firestore;
}
