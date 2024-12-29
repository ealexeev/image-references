import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, LiveImage } from '../storage.service';

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
  images: LiveImage[] = [];

  constructor(private storage: StorageService){
    this.storage.LoadTag(this.tag).then((stored) => {
      if ( !stored ) {
        this.storage.StoreTag(this.tag).then(() => {
          this.storage.LoadImagesWithTag(this.tag).then((si)=>this.images = si)      
        })
      } else {
        this.storage.LoadImagesWithTag(this.tag).then((si)=>this.images = si)
      }
    })
    ;
  }

  async receiveImageURL(url: string): Promise<void> {
    console.log("Received URL: ", url)
    const imageBlob = await fetch(url).then((response) => response.blob().then(b => b));
    const docRef = await this.storage.StoreImage(imageBlob, url, [await this.storage.GetTagReference(this.tag)]);
    this.storage.LoadImage(docRef).then((i) => {
      if (i) {
        this.images.push(i)
      }
    });
  }

  async deleteImage(id: string) {
    return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
  }
}
