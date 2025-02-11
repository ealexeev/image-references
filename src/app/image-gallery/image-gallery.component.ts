import {ChangeDetectionStrategy, Component, Input, OnChanges, signal, WritableSignal} from '@angular/core';


import {ImageCardComponent} from '../image-card/image-card.component';
import {ImageAdderComponent} from '../image-adder/image-adder.component';
import {StorageService, LiveImage, LiveTag} from '../storage.service';
import {Subscription} from 'rxjs';
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
  styleUrl: './image-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageGalleryComponent implements OnChanges {
  @Input({required: true}) tag!: string;

  images: WritableSignal<LiveImage[]> = signal([]);
  dbUnsubscribe: () => void = () => {
    return
  };
  imagesSub: Subscription = new Subscription();

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

  async ngOnChanges() {
    if (!this.tag) {
      return;
    }
    this.dbUnsubscribe();
    this.imagesSub.unsubscribe();
    this.images.set([])
    const tag = await this.storage.LoadTagByName(this.tag)
    const subscription = this.storage.SubscribeToTag(tag, this.preferences.showImageCount$.value)
    this.imagesSub = subscription.images$.subscribe((images: LiveImage[]) => this.images.set(images))
    this.dbUnsubscribe = subscription.unsubscribe;
  }

  async receiveImageURL(url: string): Promise<void> {
    console.log(`Receive image URL: ${url}`);
    const imageBlob = await fetch(url).then((response) => response.blob().then(b => b));
    const iRef = await this.storage.GetImageReferenceFromBlob(imageBlob);

    const newImage: LiveImage = {
      mimeType: imageBlob.type,
      tags: [this.storage.TagRefByName(this.tag)].filter(t => t !== undefined),
      reference: iRef,
    }
    if ( !(await this.storage.StoreImage(newImage)) ) {
      const fullUrl = await this.storage.StoreFullImage(iRef, imageBlob);
      await this.storage.StoreImageData(iRef, imageBlob, fullUrl);
    }
  }

  async deleteImageOrTag(id: string) {
    let img = this.images().filter(li => li.reference.id == id).pop();
    if (!img) {
      throw new Error(`deleteImageOrTag(${id}): not found`);
    }

    if (img.tags.length == 1) {
      return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
    }

    return this.storage.DeleteImageTag(img, this.tag);
  }

  onMaxCountChanged(value: number) {
    if (value > 0 && value <= this.images.length) {
      this.images.update(current => current.slice(0, value));
      return;
    }
    this.ngOnChanges()
  }

  async FetchImageBlob(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const i = new Image();
      let b: Blob;
      i.onload = () => {
        const el = document.createElement('canvas');
        const ctx = el.getContext('2d');
        if (!ctx) {
          console.error("No context!");
        }
        ctx!.drawImage(i, 0, 0, i.width, i.height);
        el.toBlob(blob => {
          if ( blob ) {
            resolve(blob)
          }
          reject('Not a blob!')
        }, this.MimeTypeFromUrl(url));
      }
      i.src = url;
    })
  }

  MimeTypeFromUrl(url: string): string {
    if ( url.toLowerCase().includes('.jpeg') || url.toLowerCase().includes('.jpeg') ) { return 'image/jpeg' }
    if ( url.toLowerCase().includes('.png') ) { return 'image/png' }
    if ( url.toLowerCase().includes('.gif') ) { return 'image/gif' }
    if ( url.toLowerCase().includes('.webp') ) { return 'image/webp' }
    throw new Error(`Unknown mime type for ${url}`);
  }
}
