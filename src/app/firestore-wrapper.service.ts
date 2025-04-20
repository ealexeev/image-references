import { Injectable } from '@angular/core';
import { updateDoc, arrayUnion, arrayRemove, DocumentReference } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirestoreWrapperService {
  /**
   * Proxy for Firestore's updateDoc
   */
  updateDoc<T = any>(ref: DocumentReference<T>, data: Partial<T>): Promise<void> {
    return updateDoc(ref, data);
  }

  /**
   * Proxy for Firestore's arrayUnion
   */
  arrayUnion(...elements: any[]): any {
    return arrayUnion(...elements);
  }

  /**
   * Proxy for Firestore's arrayRemove
   */
  arrayRemove(...elements: any[]): any {
    return arrayRemove(...elements);
  }
}

