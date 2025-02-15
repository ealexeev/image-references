import {Component, inject, Input, Signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {LiveImage, StorageService} from '../storage.service';
import JSZip from 'jszip';
import {first} from 'rxjs';

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
  @Input({required: true}) images!: Signal<LiveImage[]>

  private storage = inject(StorageService);

  async onClick() {
    const zipFile = new JSZip();
    const promises = [];
    for (const image of this.images()) {
      const imgData$ = this.storage.LoadImageData(image.reference.id)
      imgData$.pipe(first())
        .subscribe(
          (imageData) => {
            promises.push(
              imageData.fullUrl()
                .then(url => fetch(url))
                .then(res => res.blob())
                .then(blob => {
                  zipFile.file(`${image.reference.id}.${extFromMime(blob.type)}`, blob)
                })
                .catch(err => console.log(`Download promise error: ${err}`)))
          },
          (err) => console.log(`Download sub error: ${err}`)
        )
    }

  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
