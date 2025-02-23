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
    const zipFile = new JSZip();
    let batch = await this.imageService.LoadImagesBatched({batchSize: 25})
    let cnt = 1;
    while (batch.images.length > 0) {
      const liveImageData = batch.images.map(li=>this.imageService.LoadImageData(li.reference.id));
      const imageData = await Promise.all(liveImageData)
      const fullSize = await Promise.all(imageData.map((img: ImageData) => img.fullSize()))
      fullSize.forEach((blob: Blob, index: number) => {
        zipFile.file(`${batch.images[index].reference.id}.${extFromMime(blob.type)}`, blob)
      })
      console.log(`Finished batch ${cnt++}`)
      batch = await this.imageService.LoadImagesBatched({batchSize: 25, lastSeen: batch.last})
    }
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
      })
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
