import {inject, Injectable, signal, WritableSignal} from '@angular/core';
import {ImageFetchStrategy} from './download.service';
import {bufferCount, concatMap, defer, filter, from, map, mergeMap, Observable, of, skip, Subject, toArray} from 'rxjs';
import {Image} from '../lib/models/image.model';
import {fromPromise} from 'rxjs/internal/observable/innerFrom';
import { FirestoreWrapperService } from './firestore-wrapper.service';
import { StorageWrapperService } from './storage-wrapper.service';

export enum ImageState {
  // No parts of the image exist in any storage system
  NO_EXIST,
  // All three records exist: Image, ImageData, and Cloud Storage blob
  COMPLETE,
  // Image exists but there are problems.
  INVALID
}

export enum FailureDetail {
  NO_FAILURE,
  // Image is an empty record.
  IMAGE_MISSING,
  // Some fields aren't set.  Not likely at present given added and tags.
  IMAGE_PARTIAL,
  // Some portions of ImageData are
  IMAGE_DATA_MISSING,
  // Some data is not set (e.g. thumbnail).
  IMAGE_DATA_PARTIAL,
  // ImageData references invalid keys
  IMAGE_DATA_INVALID_KEYS,
  // Full image is not present in cloud storage
  CLOUD_BLOB_MISSING,
  // Full image is in cloud storage, but there are no Image or ImageData records
  CLOUD_BLOB_DANGLING
}

export type ImageReport = {
  id: string,
  state: ImageState,
  failure?: FailureDetail,
}

@Injectable({
  providedIn: 'root'
})
export class IntegrityService {

  private firestoreWrapper = inject(FirestoreWrapperService);
  private storageWrapper = inject(StorageWrapperService);

  busy: WritableSignal<boolean> = signal(false);
  completed: WritableSignal<boolean> = signal(false);
  errorCount: WritableSignal<number> = signal(0);

  constructor() { }

  /**
  * Determine state of images based on a list of ids.  This is necessary to support checking all items in cloud storage.
  * */
  getImagesReportList(ids: string[], batchSize?: number, skipValid?: boolean): Observable<ImageReport[]> {
    return this.getImagesReportStrategy({Fetch: (): Observable<Image[]> => {
      return from(ids.map(id => { return {reference: {id: id}} as Image})).pipe(bufferCount(batchSize ?? 25))
      }}, skipValid);
  }

  /**
   * Determine state of images based on an image fetch strategy.
   */
  getImagesReportStrategy(strategy: ImageFetchStrategy, skipValid?: boolean): Observable<ImageReport[]> {
    return defer((): Observable<ImageReport[]> => {
      this.busy.set(true);
      this.errorCount.set(0);
      this.completed.set(false);
      const out = new Subject<ImageReport[]>
      const sub = strategy.Fetch().pipe(
        mergeMap((images: Image[]) => from(images)),
        concatMap((img: Image) => fromPromise(this.getImageReport(img.reference.id))),
        filter((report: ImageReport) => report.state != ImageState.COMPLETE || skipValid === false),
        toArray(),
      ).subscribe({
        next: (res: ImageReport[]) => {
          out.next(res)
          this.errorCount.set(res.filter(r=>r.state != ImageState.COMPLETE).length)
        },
        complete: () => {
          out.complete()
          sub.unsubscribe()
          this.busy.set(false)
          this.completed.set(true)
        }
      })
      return out
    })
  }

  /**
  * Determine the image state of a particular image by its id.
  */
  async getImageReport(imageId: string): Promise<ImageReport> {
    return new Promise((resolve) => {
      Promise.all([this.checkImageExists(imageId), this.checkImageDataExists(imageId), this.checkCloudBlobExists(imageId)])
        .then(([imgExist, imgDataExist, cloudExist]) => {
          if (!imgExist && !imgDataExist && !cloudExist) {
            resolve({id: imageId, state: ImageState.NO_EXIST})
          }
          if (cloudExist && !imgExist && !cloudExist) {
            resolve({id: imageId, state: ImageState.INVALID, failure: FailureDetail.CLOUD_BLOB_DANGLING})
          }
          if (!cloudExist) {
            resolve({id: imageId, state: ImageState.INVALID, failure: FailureDetail.CLOUD_BLOB_MISSING})
          }
          if (!imgExist) {
            resolve({id: imageId, state: ImageState.INVALID, failure: FailureDetail.IMAGE_MISSING})
          }
          if (!imgDataExist) {
            resolve({id: imageId, state: ImageState.INVALID, failure: FailureDetail.IMAGE_DATA_MISSING})
          }
          return Promise.all([this.checkImageValidity(imageId), this.checkImageDataValidity(imageId)])
        })
        .then(([imgDetail, imgDataDetail]) => {
          if (imgDetail == FailureDetail.NO_FAILURE && imgDataDetail == FailureDetail.NO_FAILURE) {
            resolve({id: imageId, state: ImageState.COMPLETE})
          }
          if (imgDetail != FailureDetail.NO_FAILURE) {
            resolve({id: imageId, state: ImageState.INVALID, failure: imgDetail})
          }
          resolve({id: imageId, state: ImageState.INVALID, failure: imgDataDetail})
        })
    })
  }

  async checkImageExists(imageId: string): Promise<boolean> {
    const snap = await this.firestoreWrapper.getDoc(this.firestoreWrapper.doc(this.firestoreWrapper.instance, 'images', imageId))
    return snap.exists();
  }

  async checkImageDataExists(imageId: string): Promise<boolean> {
    const snap = await this.firestoreWrapper.getDoc(this.firestoreWrapper.doc(this.firestoreWrapper.instance, 'images', imageId, 'data', 'thumbnail'))
    return snap.exists();
  }

  async checkCloudBlobExists(imageId: string): Promise<boolean> {
    try {
      const storageRef = this.storageWrapper.ref(this.storageWrapper.instance, `data/${imageId}`);
      const meta = await this.storageWrapper.getMetadata(storageRef);
      return true;
    } catch (err: unknown) {
      console.log(`getMetadata(data/${imageId}): ${err}`)
      return false;
    }
  }

  async checkImageValidity(imageId: string): Promise<FailureDetail> {
    // Check that tag refs are valid.
    return FailureDetail.NO_FAILURE;
  }

  async checkImageDataValidity(imageId: string): Promise<FailureDetail> {
    // Check that key refs are valid.
    // Check that full URL is set and matches cloud DL URL.
    return FailureDetail.NO_FAILURE;
  }
}
