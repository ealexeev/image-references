import {Component, inject, Input, Renderer2, Signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import JSZip from 'jszip';
import {ImageService} from '../image.service';
import {Image} from '../../lib/models/image.model';
import {forkJoin, from, map, mergeMap, Observable, of, Subject, Subscription, tap} from 'rxjs';
import {QueryConstraint} from '@angular/fire/firestore';

export interface ImageFetchStrategy {
  Fetch(): Observable<Image[]>
}

@Component({
  selector: 'app-zip-downloader',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './zip-downloader.component.html',
  styleUrl: './zip-downloader.component.scss'
})
export class ZipDownloaderComponent {
  @Input({required: true}) images!: Signal<Image[]>
  @Input() fileName: string = 'images'

  private strategy: ImageFetchStrategy = new Default(this.images);
  private imageService = inject(ImageService);
  private renderer = inject(Renderer2);

  setStrategy(newStrategy: ImageFetchStrategy): void {
    this.strategy = newStrategy;
  }

  async onClick() {
    const subs = new Subscription();
    const zipFile = new JSZip();

    const ready = new Subject<void>();
    subs.add(ready.subscribe({
      next: () => {
        zipFile.generateAsync({type:"blob"})
          .then(blob=> {
            const url = URL.createObjectURL(blob);
            const link = this.renderer.createElement('a');
            link.setAttribute('target', '_blank');
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.fileName}.zip`);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          })},
      complete: () => {subs.unsubscribe()}
      })
    )

    subs.add(this.strategy.Fetch().pipe(
      mergeMap((images: Image[])=> from(images)),
      mergeMap(img => forkJoin([of(img.reference.id), from(this.imageService.LoadImageData(img.reference.id))])),
      mergeMap(([id, data]) => forkJoin([of(id), from(data.fullSize())])),
      map(([id, blob])=> { return {id: id, blob: blob} as IdBlob}),
      tap(idb=>console.log(`Processing: ${idb.id}`)),
    ).subscribe({
      next: (idb) => zipFile.file(`${idb.id}.${extFromMime(idb.blob.type)}`, idb.blob),
      error: (error: Error) => {console.log(`ZipDownloader Fetch(): ${error}`)},
      complete: ()=>{ready.next()},
    }))
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}

class Default implements ImageFetchStrategy {

  constructor(private images: Signal<Image[]>){}

  Fetch(): Observable<Image[]>{
    return of(this.images())
  }
}

type IdBlob = {
  id: string,
  blob: Blob,
}

export class BatchedStrategy implements ImageFetchStrategy {
  constructor(private imageService: ImageService, private constraint?: QueryConstraint) {}

  Fetch(): Observable<Image[]>{
    const ret = new Subject<Image[]>();

    const batchLoad = async ()=> {
      let res = await this.imageService.loadImagesBatched({batchSize: 25, constraint: this.constraint});
      while (res.images.length > 0){
        ret.next(res.images);
        res = await this.imageService.loadImagesBatched({batchSize: 25, constraint: this.constraint, lastSeen: res.last})
      }
      ret.complete();
    };

    batchLoad().catch((error: Error) => {console.log(`BatchedAllImages.Fetch(): ${error}`)});

    return ret;
  }
}
