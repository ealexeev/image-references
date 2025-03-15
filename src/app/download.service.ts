import {computed, inject, Injectable, Renderer2, RendererFactory2, Signal, signal, WritableSignal} from '@angular/core';
import {concatMap, firstValueFrom, forkJoin, from, mergeMap, Observable, of, queueScheduler, Subject} from 'rxjs';
import {Image, ImageData} from '../lib/models/image.model';
import JSZip from 'jszip';
import {ImageService} from './image.service';
import {QueryConstraint} from '@angular/fire/firestore';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TagService} from './tag.service';

export interface ImageFetchStrategy {
  Fetch(): Observable<Image[]>
}

export interface DownloadConfiguration {
  // Name of the .zip file that will be produced. If batched, it will have a counter like -1, etc.
  fileName: string;
  // Number of files allowed to be stored in a single archive.
  maxZipContentFiles?: number;
  // Max size in bytes that can be added to a zip.
  maxZipContentBytes?: number;
  // Strategy to use for obtaining the files.
  strategy: ImageFetchStrategy;
}

interface Stopper {
  // Check if stop condition has been met.
  stop(blob: Blob): boolean;
  // Rest the internal state to just after init.
  reset(): void;
}

interface ImageBlobBundle {
  image: Image
  blob: Blob
  meta: Blob
  err?: Error
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  private renderer: Renderer2;
  private imageService = inject(ImageService);
  private tagService = inject(TagService);

  // Next number to use as postfix for zip file.  Not used if set to zero.
  private fileCounter = 0;

  // Download tasks that complete one at a time.
  private downloadTasks = new Subject<DownloadConfiguration>();

  imageCount = signal(0);
  zipFileCount = signal(0);
  busy: Signal<boolean> = computed(()=> this.imageCount() > 0);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.downloadTasks.pipe(
      takeUntilDestroyed(),
      concatMap(config => this._download(config))
    ).subscribe({
      error: error => console.error(error),
    })
  }

  // Perform a download operation.  Operations are queued and executed one at a time.
  download(config: DownloadConfiguration) {
    this.downloadTasks.next(config);
  }

  async _download(config: DownloadConfiguration) {
    this.fileCounter = 0 ;
    this.zipFileCount.set(0);
    let buffer: ImageBlobBundle[] = [];
    const done = new Subject<void>;
    const makeAndDownload = ()=> {
      const zip = this.fillZip(config, [...buffer]);
      this.downloadZip(config, zip);
      this.zipFileCount.update(v=>v+=1);
      buffer = [];
    }
    const stopper = pickStopper(config);
    const sub = this.getBlobs(config.strategy).subscribe(
      {
        next: (pair: ImageBlobBundle) => {
          this.imageCount.update(v=>v+=1);
          buffer.push(pair)
          if (stopper.stop(pair.blob)) {
            this.fileCounter+=1;
            makeAndDownload();
            stopper.reset();
          }
        },
        complete: ()=> {
          if (buffer.length > 0) {
            if (this.fileCounter > 0) {
              this.fileCounter+=1;
            }
            makeAndDownload();
          }
          sub.unsubscribe();
          done.next();
        },
      }
    )
    await firstValueFrom(done);
    this.imageCount.set(0);
    this.zipFileCount.set(0);
  }

  // Returns an observable (or should this be a signal?) that emits batches of IdBlobPairs.
  // Observable completes when all the images have been received.
  private getBlobs(strategy: ImageFetchStrategy): Observable<ImageBlobBundle> {
    const out: Subject<ImageBlobBundle> = new Subject();
    const sub = strategy.Fetch().pipe(
      mergeMap((images: Image[])=> from(images)),
      mergeMap((image: Image) => forkJoin([of(image), from(this.imageService.LoadImageData(image.reference.id))])),
      mergeMap(([image, data]: [Image, ImageData]) => forkJoin([of(image), from(data.fullSize()), from(this.makeMetadata(image))])),
    ).subscribe({
      next: ([image, data, meta]: [Image, Blob, Blob]) => {
        out.next({image: image, blob: data, meta: meta});
      },
      error: error => {throw error},
      complete: ()=> {sub.unsubscribe(); out.complete();},
    })
    return out;
  }

  // This is the place were we may add Image metadata to a .json side file.
  private fillZip(config: DownloadConfiguration, pairs: ImageBlobBundle[]): JSZip {
    const zip = new JSZip();
    for (const pair of pairs) {
      zip.file(`${pair.image.reference.id}.${extFromMime(pair.blob.type)}`, pair.blob);
      zip.file(`${pair.image.reference.id}.json`, pair.meta);
    }
    return zip;
  }

  private async makeMetadata(image: Image): Promise<Blob> {
    const tagNames = await Promise.all(image.tags.map(t=> this.tagService.LoadTagByReference(t)))
    const metadata = {
      tags: tagNames.map(t=>t.name).sort(),
      added: image.added,
    }
    return new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  }

  private downloadZip(config: DownloadConfiguration, zip: JSZip): void {
    const counter = this.fileCounter > 0 ? `-${this.fileCounter.toString().padStart(3, "0")}` : "";
    const fileName =`${config.fileName}${counter}.zip`
    zip.generateAsync({type:"blob"})
      .then(blob=> {
        const url = URL.createObjectURL(blob);
        const link = this.renderer.createElement('a');
        link.setAttribute('target', '_blank');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
  }

}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}

export class BatchedStrategy implements ImageFetchStrategy {
  constructor(private imageService: ImageService,
              private constraint?: QueryConstraint,
              private batchSize?: number) {}

  Fetch(): Observable<Image[]>{
    const ret = new Subject<Image[]>();

    const batchLoad = async ()=> {
      let res = await this.imageService.loadImagesBatched({
        batchSize: this.batchSize ?? 25,
        constraint: this.constraint});
      while (res.images.length > 0){
        ret.next(res.images);
        res = await this.imageService.loadImagesBatched({
          batchSize: this.batchSize ?? 25,
          constraint: this.constraint,
          lastSeen: res.last})
      }
      ret.complete();
    };

    batchLoad().catch((error: Error) => {console.log(`BatchedAllImages.Fetch(): ${error}`)});

    return ret;
  }
}

function pickStopper(config: DownloadConfiguration): Stopper {
  let stopper: Stopper;
  if (config.maxZipContentFiles) {
    return new CountStopper(config.maxZipContentFiles)
  }
  return new SizeStopper(config.maxZipContentBytes!)
}

class CountStopper implements Stopper {
  private count = 0;
  constructor(private limit: number){}

  stop(blob:Blob): boolean {
    this.count++;
    return this.count >= this.limit
  }

  reset(): void {this.count = 0;}
}

class SizeStopper implements Stopper {
  private size = 0;
  constructor(private limit: number) {}

  stop(blob: Blob): boolean {
    this.size += blob.size;
    return this.size >= this.limit;
  }

  reset(): void {this.size = 0;}
}
