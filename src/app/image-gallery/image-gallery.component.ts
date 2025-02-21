import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  WritableSignal
} from '@angular/core';
import {Subscription} from 'rxjs';
import {PreferenceService} from '../preference-service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ImageCardComponent} from '../image-card/image-card.component';
import {DragDropDirective, FileHandle} from '../drag-drop.directive';
import {MessageService} from '../message.service';
import {ZipDownloaderComponent} from '../zip-downloader/zip-downloader.component';
import {Tag, TagService} from '../tag.service';
import {Image, ImageService, ImagesSubscription} from '../image.service';
import {DocumentReference} from '@angular/fire/firestore';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [
    ImageCardComponent,
    DragDropDirective,
    ZipDownloaderComponent,
  ],
  templateUrl: './image-gallery.component.html',
  styleUrls: [
    './image-gallery.component.scss',
    '../../_variables.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGalleryComponent implements OnInit, OnDestroy {
  @Input({required: true}) mode: "tag" | "latest" | "inbox" = "latest";
  @Input()
  set tagName(value: string) {
    if  ( value === undefined ) {return}
    if ( value !== this.optTagName() ) {
      this.optTagName.set(value);
      this.tagService.LoadTagByName(value)
        .then(tag => {this.tag = tag})
        .catch(err => {this.messageService.Error(`LoadTagByName(${value}): ${err}`);})
      this.ngOnDestroy();
      this.ngOnInit();
    }
  }

  private messageService: MessageService = inject(MessageService);
  private preferences: PreferenceService = inject(PreferenceService);
  private imageService: ImageService = inject(ImageService);
  private tagService: TagService = inject(TagService);

  // Maybe this replaces optTagName?  Why are we getting a name, and not a Tag to begin with?
  private tag: Tag | undefined = undefined;
  title: WritableSignal<string> = signal('');
  optTagName: WritableSignal<string> = signal('');
  images: WritableSignal<Image[]> = signal([]);
  files: WritableSignal<FileHandle[]> = signal([]);

  dbUnsubscribe: () => void = () => {
    return
  };
  imagesSub: Subscription = new Subscription();

  constructor() {
    this.preferences.showImageCount$.pipe(
      takeUntilDestroyed(),
    ).subscribe(
      (v: number) => {
        this.onMaxCountChanged(v)
      }
    )
  }

  ngOnInit() {
    switch(this.mode) {
      case 'tag':
        this.title.set(this.optTagName())
        break
      case 'latest':
        this.title.set('Latest Images')
        break
      case 'inbox':
        this.title.set('Untagged Images')
        break
      default:
        this.title.set('PLACEHOLDER')
        break
    }
    this.startSubscriptions()
      .catch((err: unknown) => {this.messageService.Error(`<image-gallery> startSubscriptions(): ${err}`)})
  }

  ngOnDestroy() {
    this.imagesSub.unsubscribe()
    this.dbUnsubscribe();
  }

  async startSubscriptions() {
    let subscription: ImagesSubscription;
    switch(this.mode) {
      case 'latest':
        subscription = this.imageService.SubscribeToLatestImages(this.preferences.showImageCount$.value)
        break
      case 'tag':
        const tag = await this.tagService.LoadTagByName(this.optTagName())
        subscription = this.imageService.SubscribeToTag(tag.reference, this.preferences.showImageCount$.value)
        break;
      default:
        throw new Error(`Unsupported mode: ${this.mode}`);
    }
    this.imagesSub = subscription.images$.subscribe((images: Image[]) => this.images.set(images))
    this.dbUnsubscribe = subscription.unsubscribe;
  }

  async receiveImageURL(url: string): Promise<void> {
    const tags: DocumentReference[] = []
    if ( this.mode === 'tag' && this.optTagName() ) {
      tags.push(await this.tagService.LoadTagByName(this.optTagName()).then(t=>t.reference))
    }
    const blob = await fetch(url).then(res => res.blob()).then(blob => blob)
    return this.imageService.StoreImage(blob, tags)
  }

  async deleteImageOrTag(id: string) {
    let img = this.images().filter(li => li.reference.id == id).pop();
    if (!img) {
      throw new Error(`deleteImageOrTag(${id}): not found`);
    }
    switch (this.mode) {
      case 'tag':
        if (img.tags.length == 1) {
          return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id))
        }
        return this.imageService.RemoveTags(img.reference, [(await this.tagService.LoadTagByName(this.optTagName())).reference]);
      case 'latest':
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id))
      case 'inbox':
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id))
      default:
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id))
    }
  }

  onMaxCountChanged(value: number) {
    if (value > 0 && value <= this.images.length) {
      this.images.update(current => current.slice(0, value));
      return;
    }
    this.ngOnDestroy()
    this.startSubscriptions()
      .catch((err: unknown) => {this.messageService.Error(`<image-gallery> startSubscriptions(): ${err}`)})
  }

  filesDropped(files: FileHandle[]) {
    this.messageService.Info(`Received ${files.length} ${files.length > 1 ? 'files' : 'file'}`);
    this.files.set(files);
    for (const f of files) {
      this.receiveImageURL(f.url.toString())
        .catch((err: unknown) => {this.messageService.Error(`<image-gallery> receiveImageURL(): ${err}`)})
    }
    setTimeout(() => {this.files.set([])}, 1500);
  }

}

