import { inject, Injectable } from '@angular/core';
import { 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  DocumentReference, 
  Firestore,
  doc,
  getDoc,
  DocumentSnapshot,
  DocumentData
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirestoreWrapperService {
  readonly instance: Firestore = inject(Firestore);

  /**
   * Proxy for Firestore's doc
   */
  doc<T = DocumentData>(firestore: Firestore, path: string, ...pathSegments: string[]): DocumentReference<T> {
    return doc(firestore, path, ...pathSegments) as DocumentReference<T>;
  }

  /**
   * Proxy for Firestore's getDoc
   */
  getDoc<T = DocumentData>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
    return getDoc(ref);
  }
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

