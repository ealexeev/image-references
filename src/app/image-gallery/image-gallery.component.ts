import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, LiveImage, LiveTag } from '../storage.service';
import { from, of, mergeMap } from 'rxjs';

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
export class ImageGalleryComponent implements OnInit {
  tag = 'robot'
  images: LiveImage[] = [];


  constructor(private storage: StorageService) {}

  ngOnInit() {
    from(this.storage.LoadTag(this.tag)).pipe(
      mergeMap( (t: LiveTag | undefined) => {
        if ( !t ) {
          return this.storage.StoreTag(this.tag)
        } else {
          return of(t)
        }
      }),
      mergeMap((t: LiveTag | undefined) => {
        if ( !t ) {
          return of([]);
        } else {
          return from(this.storage.LoadImagesWithTag(this.tag))
        }
      })
    ).subscribe((images: LiveImage[]) => this.images = images);
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
    this.images = this.images.filter((li) => li.id != id);
    return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
  }
}
