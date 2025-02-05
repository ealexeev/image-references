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
          return from(this.storage.LoadImagesWithTag(this.tag, this.preferences.showImageCount$.value));
        }
      }),
      catchError( ( error: Error) => {
        console.log(`Error on LoadTag(${this.tag}): ${error}`)
        return of([])
      }),
    ).subscribe((images: LiveImage[]) => this.images = images);
  }

  async receiveImageURL(url: string): Promise<void> {
    const imageBlob = await fetch(url).then((response) => response.blob().then(b => b));
    const iRef = await this.storage.GetImageReferenceFromBlob(imageBlob);
    if ( await this.storage.ImageExists(iRef) ) {
      await this.storage.AddTags(iRef, [await this.storage.GetTagReference(this.tag)] );
    } else {
      await this.storage.StoreImage(imageBlob, url, [await this.storage.GetTagReference(this.tag)]);
    }

    this.storage.LoadImage(iRef).then((i) => {
      if ( i && !this.images.filter(img => img.id === i.id).length ) {
        this.images.unshift(i)
        const targetSz = this.preferences.showImageCount$.value
        if ( targetSz > 0 && this.images.length > targetSz ) {
          this.images.pop()
        }
      }
    });
  }

  async deleteImageOrTag(id: string) {
    let img = this.images.filter(li => li.id == id).pop();
    if ( !img ) {
      return;
    }
    this.images = this.images.filter((li) => li.id != id);

    if ( img.tags.length == 1 ) {
      return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
    }

    return this.storage.DeleteImageTag(img, this.tag);
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

  onImageTagsChanged(image: LiveImage) {
    this.storage.ReplaceImageTags(image);
    if ( !image.tags.includes(this.tag) ) {
      this.images = this.images.filter(li => li.id != image.id);
    }
  }
}
