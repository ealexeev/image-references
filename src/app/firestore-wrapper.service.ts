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
  DocumentData,
  collection,
  CollectionReference,
  onSnapshot,
  Query,
  QueryConstraint,
  orderBy,
  OrderByDirection,
  query,
  where,
  WhereFilterOp,
  limit,
  Unsubscribe,
  QuerySnapshot,
  writeBatch
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirestoreWrapperService {
  readonly instance: Firestore = inject(Firestore);

  /**
   * Proxy for Firestore's doc
   */
  doc<T = DocumentData>(path: string, ...pathSegments: string[]): DocumentReference<T> {
    return doc(this.instance, path, ...pathSegments) as DocumentReference<T>;
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

  /**
   * Proxy for Firestore's collection
   */
  collection<T = DocumentData>(path: string): CollectionReference<T> {
    return collection(this.instance, path) as CollectionReference<T>;
  }

  /**
   * Proxy for Firestore's onSnapshot
   */
  onSnapshot<T>(ref: DocumentReference<T>, observer: {
    next?: (snapshot: DocumentSnapshot<T>) => void;
    error?: (error: Error) => void;
    complete?: () => void;
  }): Unsubscribe {
    return onSnapshot(ref, observer);
  }

  onCollectionSnapshot<T>(ref: Query<T>, callback: (snapshot: QuerySnapshot<T>) => void): Unsubscribe {
    return onSnapshot(ref, callback);
  }

  /**
   * Proxy for Firestore's orderBy
   */
  orderBy(fieldPath: string, directionStr?: OrderByDirection): QueryConstraint {
    return orderBy(fieldPath, directionStr);
  }

  /**
   * Proxy for Firestore's query
   */
  query<T>(q: Query<T>, ...queryConstraints: QueryConstraint[]): Query<T> {
    return query(q, ...queryConstraints);
  }

  /**
   * Proxy for Firestore's where
   */
  where(fieldPath: string, opStr: WhereFilterOp, value: unknown): QueryConstraint {
    return where(fieldPath, opStr, value);
  }

  /**
   * Proxy for Firestore's limit
   */
  limit(n: number): QueryConstraint {
    return limit(n);
  }

  /**
   * Proxy for Firestore's writeBatch
   */
  writeBatch() {
    return writeBatch(this.instance) ;
  }
}

