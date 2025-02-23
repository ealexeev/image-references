import {inject, Injectable} from '@angular/core';
import {Image, ImageData, ImageSubscription} from '../lib/models/image.model';
import {of, Subject} from 'rxjs';
import {
  collection,
  doc,
  DocumentReference, Firestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  where
} from '@angular/fire/firestore';
import {shortenId} from './common';
import {ImageDataCacheService} from './image-data-cache.service';
import {MessageService} from './message.service';
import {ImageConversionService} from './image-conversion.service';

@Injectable({
  providedIn: 'root'
})
export class RealtimeImageService {

  private firestore: Firestore = inject(Firestore);
  private imageCache: ImageDataCacheService = inject(ImageDataCacheService);
  private message: MessageService = inject(MessageService);
  private convert: ImageConversionService = inject(ImageConversionService);

  private readonly imagesCollection: any; // Firestore types suck.

  constructor() {
    this.imagesCollection = collection(this.firestore, 'images');
  }

  /**
   * Subscribe to updates about image data.  In practice there is only one update expected.
   */
  SubscribeToImageData(imageId: string): ImageSubscription<ImageData> {
    if ( this.imageCache.has(imageId) ) {
      return {results$: of(this.imageCache.get(imageId)), unsubscribe: ()=> {}} as ImageSubscription<ImageData>
    }

    const imageData$ = new Subject<ImageData>();
    const unsub = onSnapshot(doc(this.firestore, this.imagesCollection.path, imageId, 'data', 'thumbnail'),
      doc => {
        if (!doc.exists()) {
          return;  // This happens right after creation, it is not an error.
        }
        this.convert.snapshotToImageData(doc)
          .then(imageData => {imageData$.next(imageData)})
          .catch((err) => {
            this.message.Error(`SubImageData(${imageId}): ${err}`)
          })
      })

    return {results$: imageData$, unsubscribe: () => {imageData$.complete(); unsub()} } as ImageSubscription<ImageData>
  }

  /**
   * Subscribe to images that contain a particular tag.  Limit results to last N images based on creation time.
   */
  SubscribeToTag(tagRef: DocumentReference, last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }

    const q = query(
      this.imagesCollection,
      where("tags", "array-contains", tagRef),
      ...constraints)

    const imagesObservable = new Subject<Image[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
      const images: Image[] = [];
      querySnapshot.forEach((doc) => {
        images.push(doc.data() as Image)
      })
      imagesObservable.next(images)
      this.message.Info(`Tag ${shortenId(tagRef.id)} now has ${images.length} images`)
    })

    return {results$: imagesObservable, unsubscribe: () => { unsub(); imagesObservable.complete()}} as ImageSubscription<Image[]>;
  }

  /**
   * Subscribe to the latest images added to storage up to last N images based on creation time.
   */
  SubscribeToLatestImages(last_n_images: number): ImageSubscription<Image[]> {
    const constraints: QueryConstraint[] = [orderBy("added", "desc")]
    if ( last_n_images > 0 ) {
      constraints.push(limit(last_n_images));
    }
    const q = query(this.imagesCollection, ...constraints)

    const out$ = new Subject<Image[]>();

    const unsub = onSnapshot(q, (querySnapshot) => {
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
  SubscribeToImage(imageRef: DocumentReference): ImageSubscription<Image> {
    const out = new Subject<Image>();
    const unsub = onSnapshot(imageRef, (snapshot) => {
      this.convert.snapshotToImage(snapshot)
        .then(img=>out.next(img))
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
