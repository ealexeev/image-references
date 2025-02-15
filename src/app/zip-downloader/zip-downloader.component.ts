import {Component, inject, Input, Renderer2, Signal} from '@angular/core';
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
  @Input() fileName: string = 'images'

  private storage = inject(StorageService);
  private renderer = inject(Renderer2);

  async onClick() {
    const images = this.images()
    const zipFile = new JSZip();
    const liveImageData = images.map(li=>this.storage.LoadImageData(li.reference.id));
    Promise.all(liveImageData)
      .then((data) => Promise.all(data.map(img => img.fullUrl())))
      .then(blobs => {
        blobs.forEach((blob, index) => {
          zipFile.file(`${images[index].reference.id}.${extFromMime(blob.type)}`, blob)
        })})
      .then(()=> zipFile.generateAsync({type:"blob"}))
      .then(blob=> {
        const url = URL.createObjectURL(blob);
        const link = this.renderer.createElement('a');
        link.setAttribute('target', '_blank');
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.fileName}.zip`);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
