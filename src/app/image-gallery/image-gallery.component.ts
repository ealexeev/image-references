import { Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {MatSliderModule} from '@angular/material/slider';


import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, LiveImage, LiveTag } from '../storage.service';
import {catchError, from, of, mergeMap, single} from 'rxjs';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [
    ImageAdderComponent,
    ImageCardComponent,
    MatSliderModule,
  ],
  templateUrl: './image-gallery.component.html',
  styleUrl: './image-gallery.component.scss'
})
export class ImageGalleryComponent implements OnChanges {
  @Input({required: true}) tag = '';

  images: LiveImage[] = [];
  imagesSizeLimit: number = -1;

  constructor(private storage: StorageService) {}

  ngOnChanges() {
    this.images = [];
    from(this.storage.LoadTag(this.tag)).pipe(
      single(),
      mergeMap((t: LiveTag | undefined) => {
        if ( !t ) {
          return of([])
        } else {
          return from(this.storage.LoadImagesWithTag(this.tag, -1))
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
      if ( i && !this.images.filter(img => img.id === i.id).length ) {
        this.images.unshift(i)
        if ( this.imagesSizeLimit > 0 && this.images.length > this.imagesSizeLimit ) {
          this.images.pop()
        }
      }
    });
  }

  async deleteImage(id: string) {
    this.images = this.images.filter((li) => li.id != id);
    return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
  }

  getSliderValue(value: Number): string {
    if ( value == 500 ) return "All";
    return String(value);
  }

  onMaxCountChanged(value: number) {
    if ( value <= this.images.length ) {
      this.imagesSizeLimit = value;
      this.images = this.images.slice(0, value);
      return;
    }
    if ( value == 500 ) {
      value = -1
      this.imagesSizeLimit = value;
    }
    this.storage.LoadImagesWithTag(this.tag, value).then(
      (images: LiveImage[]) => this.images = images,
      v=> console.log(`Error on LoadImagesWithTag(${this.tag}, ${value}):  ${v}`)
    )
  }
}
