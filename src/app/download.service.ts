import {computed, inject, Injectable, Renderer2, RendererFactory2, Signal, signal, WritableSignal} from '@angular/core';
import {firstValueFrom, forkJoin, from, mergeMap, Observable, of, queueScheduler, Subject} from 'rxjs';
import {Image, ImageData} from '../lib/models/image.model';
import JSZip from 'jszip';
import {ImageService} from './image.service';
import {QueryConstraint} from '@angular/fire/firestore';

export interface ImageFetchStrategy {
  Fetch(): Observable<Image[]>
}

export interface DownloadConfiguration {
  // Name of the .zip file that will be produced. If batched, it will have a counter like -1, etc.
  fileName: string;
  // Number of files allowed to be stored in a single archive.
  filesPerZip: number;
  // Strategy to use for obtaining the files.
  strategy: ImageFetchStrategy;
}

type ImageBlobPair = {
  image: Image;
  blob: Blob;
  err?: Error;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {

  private renderer: Renderer2;
  private imageService = inject(ImageService);

  // Next number to use as postfix for zip file.  Not used if set to zero.
  private fileCounter = 0;

  imageCount = signal(0);
  zipFileCount = signal(0);
  busy: Signal<boolean> = computed(()=> this.imageCount() > 0);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  // Perform a download operation.  Operations are queued and executed one at a time.
  download(config: DownloadConfiguration) {
    queueScheduler.schedule(async()=>{ await this._download(config)})
  }

  async _download(config: DownloadConfiguration) {
    this.fileCounter = 0 ;
    this.zipFileCount.set(0);
    let buffer: ImageBlobPair[] = [];
    const done = new Subject<void>;
    const makeAndDownload = ()=> {
      const zip = this.fillZip(config, [...buffer]);
      this.downloadZip(config, zip);
      this.zipFileCount.update(v=>v+=1);
      buffer = [];
    }
    const sub = this.getBlobs(config.strategy, config.filesPerZip).subscribe(
      {
        next: (pair: ImageBlobPair) => {
          this.imageCount.update(v=>v+=1);
          buffer.push(pair)
          if (buffer.length === config.filesPerZip) {
            this.fileCounter+=1;
            makeAndDownload();
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
  private getBlobs(strategy: ImageFetchStrategy, filesPerZip: number): Observable<ImageBlobPair> {
    const out: Subject<ImageBlobPair> = new Subject();
    const sub = strategy.Fetch().pipe(
      mergeMap((images: Image[])=> from(images)),
      mergeMap((image: Image) => forkJoin([of(image), from(this.imageService.LoadImageData(image.reference.id))])),
      mergeMap(([image, data]: [Image, ImageData]) => forkJoin([of(image), from(data.fullSize())])),
    ).subscribe({
      next: ([image, data]: [Image, Blob]) => {
        out.next({image: image, blob: data})
      },
      error: error => {throw error},
      complete: ()=> {sub.unsubscribe(); out.complete();},
    })
    return out;
  }

  // This is the place were we may add Image metadata to a .json side file.
  private fillZip(config: DownloadConfiguration, pairs: ImageBlobPair[]): JSZip {
    const zip = new JSZip();
    for (const pair of pairs) {
      zip.file(`${pair.image.reference.id}.${extFromMime(pair.blob.type)}`, pair.blob);
    }
    return zip;
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
