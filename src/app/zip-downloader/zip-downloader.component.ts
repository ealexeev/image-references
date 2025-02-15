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
    const liveImageData = [this.images().map(li=>this.storage.LoadImageData(li.reference.id))];
    Promise.all(liveImageData)
      .then((data) => {
        // Want access to the blob here, not a URL.

      })

  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
