import {Component, inject, Input, signal, WritableSignal} from '@angular/core';
import {LiveImage, StorageService} from '../storage.service';
import {Subscription} from 'rxjs';
import {PreferenceService} from '../preference-service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ImageCardComponent} from '../image-card/image-card.component';
import {DragDropDirective, FileHandle} from '../drag-drop.directive';
import {MessageService} from '../message.service';

@Component({
  selector: 'app-latest-images',
  standalone: true,
  imports: [
    ImageCardComponent,
    DragDropDirective
  ],
  templateUrl: './latest-images.component.html',
  styleUrl: './latest-images.component.scss'
})
export class LatestImagesComponent {
  @Input({required: true}) title!: string;

  private messageService: MessageService = inject(MessageService);

  images: WritableSignal<LiveImage[]> = signal([]);
  files: WritableSignal<FileHandle[]> = signal([]);

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
    this.startSubscriptions()
  }

  startSubscriptions() {
    const subscription = this.storage.SubscribeToLatestImages(this.preferences.showImageCount$.value)
    this.imagesSub = subscription.images$.subscribe((images: LiveImage[]) => this.images.set(images))
    this.dbUnsubscribe = subscription.unsubscribe;
  }

  async receiveImageURL(url: string): Promise<void> {
    return this.storage.StoreImageFromUrl(url, [])
  }

  async deleteImage(id: string) {
    let img = this.images().filter(li => li.reference.id == id).pop();
    if (!img) {
      throw new Error(`deleteImageOrTag(${id}): not found`);
    }

    return this.storage.DeleteImage(this.storage.GetImageReferenceFromId(id))
  }

  onMaxCountChanged(value: number) {
    if (value > 0 && value <= this.images.length) {
      this.images.update(current => current.slice(0, value));
      return;
    }
    this.startSubscriptions();
  }

  filesDropped(files: FileHandle[]) {
    this.messageService.Info(`Received ${files.length} ${files.length > 1 ? 'files' : 'file'}`);
    this.files.set(files);
    for (const f of files) {
      this.receiveImageURL(f.url.toString());
    }
    setTimeout(() => {this.files.set([])}, 1500);
  }
}

