import {inject, Injectable} from '@angular/core';
import {Image, ImageData, ImageSubscription} from '../lib/models/image.model';
import {of, Subject} from 'rxjs';
import {DocumentReference, QueryConstraint, DocumentSnapshot, QuerySnapshot, CollectionReference} from '@angular/fire/firestore';
import { FirestoreWrapperService } from './firestore-wrapper.service';
import {shortenId} from './common';
import {ImageDataCacheService} from './image-data-cache.service';
import {MessageService} from './message.service';
import {ImageConversionService} from './image-conversion.service';

@Injectable({
  providedIn: 'root'
})
export class RealtimeImageService {

  private firestoreWrapper = inject(FirestoreWrapperService);
  private imageCache: ImageDataCacheService = inject(ImageDataCacheService);
  private message: MessageService = inject(MessageService);
  private convert: ImageConversionService = inject(ImageConversionService);

  private readonly imagesCollection: CollectionReference<Image>;

  constructor() {
    this.imagesCollection = this.firestoreWrapper.collection<Image>(this.firestoreWrapper.instance, 'images');
  }

  /**
   * Subscribe to updates about image data.  In practice there is only one update expected.
   */
  SubscribeToImageData(imageId: string): ImageSubscription<ImageData> {
    const docRef = this.firestoreWrapper.doc<ImageData>(this.firestoreWrapper.instance, this.imagesCollection.path, imageId, 'data', 'thumbnail');
    if ( this.imageCache.has(imageId) ) {
      return {results$: of(this.imageCache.get(imageId)), unsubscribe: ()=> {}} as ImageSubscription<ImageData>
    }

    const imageData$ = new Subject<ImageData>();
    const unsub = this.firestoreWrapper.onSnapshot(
      docRef,
      {
        next: (doc: DocumentSnapshot<ImageData>) => {
          if (!doc.exists()) {
            return;  // This happens right after creation, it is not an error.
          }
          this.convert.snapshotToImageData(doc)
            .then(imageData => {imageData$.next(imageData)})
            .catch((err) => {
              this.message.Error(`SubImageData(${imageId}): ${err}`)
            })
        }
      })

    return {results$: imageData$, unsubscribe: () => {imageData$.complete(); unsub()} } as ImageSubscription<ImageData>
  }

  /**
   * Subscribe to images that contain a particular tag.  Limit results to last N images based on creation time.
   */
  SubscribeToTag(tagRef: DocumentReference<Image>, last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [this.firestoreWrapper.orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(this.firestoreWrapper.limit(last_n_images));
    }

    const q = this.firestoreWrapper.query(this.imagesCollection, ...constraints);
    constraints.push(this.firestoreWrapper.where("tags", "array-contains", tagRef))

    const images$ = new Subject<Image[]>();
    const unsub = this.firestoreWrapper.onCollectionSnapshot(q,
      (querySnapshot: QuerySnapshot<Image>) => {
        Promise.all(querySnapshot.docs.map(doc => this.convert.snapshotToImage(doc)))
          .then(images => images$.next(images))
          .catch((err) => {
            this.message.Error(`SubTag(${shortenId(tagRef.id)}): ${err}`)
          })
      })

    return {results$: images$, unsubscribe: () => { unsub(); images$.complete()}} as ImageSubscription<Image[]>;
  }

  /**
   * Subscribe to the latest images added to storage up to last N images based on creation time.
   */
  SubscribeToLatestImages(last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [this.firestoreWrapper.orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(this.firestoreWrapper.limit(last_n_images));
    }
    const q = this.firestoreWrapper.query(this.imagesCollection, ...constraints)

    const out$ = new Subject<Image[]>();

    const unsub = this.firestoreWrapper.onCollectionSnapshot(q, 
      (querySnapshot: QuerySnapshot<Image>) => {
        const images: Image[] = [];
        querySnapshot.forEach((doc) => {
          images.push(doc.data() as Image)
        })
        out$.next(images);
        this.message.Info(`Fetched ${images.length} latest images`)
      })

    return {results$: out$, unsubscribe: ()=>{unsub(); out$.complete()}} as ImageSubscription<Image[]>;
  }

  /**
   * Subscribe to updates for a particular image.
   */
  SubscribeToImage(imageRef: DocumentReference<Image>): ImageSubscription<Image> {
    const out = new Subject<Image>();
    const unsub = this.firestoreWrapper.onSnapshot(imageRef, {
      next: (snapshot: DocumentSnapshot<Image>) => {
        this.convert.snapshotToImage(snapshot)
          .then(img=>out.next(img))
      }
    });
    return {
      results$: out,
      unsubscribe: ()=>{
        unsub()
        out.complete()
      }
    } as ImageSubscription<Image>;
  }
}
