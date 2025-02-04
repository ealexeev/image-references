import {Component, Input, OnChanges} from '@angular/core';


import { ImageCardComponent } from '../image-card/image-card.component';
import { ImageAdderComponent } from '../image-adder/image-adder.component';
import { StorageService, LiveImage, LiveTag } from '../storage.service';
import {catchError, from, of, mergeMap, single, map} from 'rxjs';
import {PreferenceService} from '../preference-service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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
export class ImageGalleryComponent implements OnChanges {
  @Input({required: true}) tag = '';

  images: LiveImage[] = [];

  constructor(private storage: StorageService,
              private preferences: PreferenceService) {
    this.preferences.showAllImages$.pipe(
      takeUntilDestroyed(),
    ).subscribe(
      (showAll: boolean) => { if (showAll) { this.preferences.showImageCount$.next(-1) }}
    )
    this.preferences.showImageCount$.pipe(
      takeUntilDestroyed(),
    ).subscribe(
        (v: number) => {
          this.onMaxCountChanged(v)
        }
    )
  }

  ngOnChanges() {
    this.images = [];
    from(this.storage.LoadTag(this.tag)).pipe(
      single(),
      mergeMap((t: LiveTag | undefined) => {
        if ( !t ) {
          return of([])
        } else {
          const count = this.preferences.showAllImages$.value? -1: this.preferences.showImageCount$.value
          return from(this.storage.LoadImagesWithTag(this.tag, count));
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
        if ( this.preferences.showImageCount$.value > 0 && this.images.length > this.preferences.showImageCount$.value ) {
          this.images.pop()
        }
      }
    });
  }

  async deleteImage(id: string) {
    this.images = this.images.filter((li) => li.id != id);
    return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
  }

  onMaxCountChanged(value: number) {
    if ( value > 0 && value <= this.images.length ) {
      this.images = this.images.slice(0, value);
      return;
    }
    this.storage.LoadImagesWithTag(this.tag, value).then(
      (images: LiveImage[]) => this.images = images,
      v=> console.log(`Error on LoadImagesWithTag(${this.tag}, ${value}):  ${v}`)
    )
  }
}
