import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, StoredImage } from '../storage.service';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [
    ImageAdderComponent,
    ImageCardComponent,
  ],
  templateUrl: './image-gallery.component.html',
  styleUrl: './image-gallery.component.scss'
})
export class ImageGalleryComponent {
  tag = 'robot'
  images: StoredImage[] = [];
  storage: StorageService = inject(StorageService);

  constructor(){
    this.images = this.storage.getAllImagesWithTag(this.tag);
  }

  receiveImageURL(url: string) {
    console.log("Received URL: ", url)
    if (url) {
      const img = this.storage.storeImageFromURL(url, [this.tag]);
      img.then((i: StoredImage) => this.images.push(i));
    }
  }

  deleteImage(id: string) {
    console.log("Deleting: ", id)
    for (var i = 0; i < this.images.length; i++) {
      if (this.images[i].id === id) {
        this.images.splice(i, 1);
        break;
      }
    }
  }
}
