import {Component, effect, Input, WritableSignal, signal, OnDestroy, OnInit, inject} from '@angular/core';
import {Image, ImageData} from '../../lib/models/image.model';
import {ImageService} from '../image.service';

export interface ImageBundle {
  image: Image
  data: ImageData
}

@Component({
  selector: 'app-image-view',
  standalone: true,
  templateUrl: './image-view.component.html',
  styleUrl: './image-view.component.scss'
})
export class ImageViewComponent implements OnInit, OnDestroy {

  private imageService: ImageService = inject(ImageService);

  // This is set if we get to a page via a URL, it is static and not sensitive to changes.
  @Input() id?: string;
  // This is provided when used as a hover and this info has already been looked up.
  @Input()
  set imageBundle(b: ImageBundle) {
    this.bundle.set(b)
  }

  private bundle: WritableSignal<ImageBundle|null> = signal(null);
  protected imgURL: WritableSignal<string> = signal('');

  constructor() {
    effect( async () => {
      const newBundle = this.bundle();
      if ( !newBundle) {
        return;
      }
      const b = await newBundle.data.fullSize()
      this.imgURL.set(URL.createObjectURL(b));
    })
  }

  async ngOnInit(): Promise<void> {
    if (this.id) {
      const sub = this.imageService.SubscribeToImage(this.imageService.GetImageReferenceFromId(this.id))
      sub.results$.subscribe({
        next: async (image: Image) => {
          try {
            const data = await this.imageService.LoadImageData(image.reference.id)
            this.bundle.set({image: image, data: data})
          } catch (e) {
            console.error(`ImageViewComponent OnInit: ${e}`)
          }
        },
        complete: () => {sub.unsubscribe();}
      })
    }
  }

  ngOnDestroy() {
    if (this.imgURL()) {
      URL.revokeObjectURL(this.imgURL());
    }
  }

}
