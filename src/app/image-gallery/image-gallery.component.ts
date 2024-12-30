import { Component, inject, Input, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, LiveImage, LiveTag } from '../storage.service';
import { catchError, from, of, mergeMap, single } from 'rxjs';

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
  @Input({required: true}) tag = '';

  images: LiveImage[] = [];

  constructor(private storage: StorageService) {}

  ngOnInit() {
    from(this.storage.LoadTag(this.tag)).pipe(
      single(),
      mergeMap((t: LiveTag | undefined) => {
        if ( !t ) {
          return of([])
        } else {
          return from(this.storage.LoadImagesWithTag(this.tag))
        }
      }),
      catchError( ( error: Error) => {
        console.log(`Error on LoadTag(${this.tag}): ${error}`)
        return of([])
      }),
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
