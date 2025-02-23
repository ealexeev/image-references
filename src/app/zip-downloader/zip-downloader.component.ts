import {Component, inject, Input, Renderer2, Signal} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import JSZip from 'jszip';
import {ImageService} from '../image.service';
import {Image, ImageData} from '../../lib/models/image.model';

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

  private imageService = inject(ImageService);
  private renderer = inject(Renderer2);

  async onClick() {
    const images = this.images()
    const zipFile = new JSZip();
    const liveImageData = images.map(li=>this.imageService.LoadImageData(li.reference.id));
    Promise.all(liveImageData)
      .then((data) => Promise.all(data.map((img: ImageData) => img.fullSize())))
      .then(blobs => {
        blobs.forEach((blob: Blob, index: number) => {
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
