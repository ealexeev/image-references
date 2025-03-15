import {
  ChangeDetectionStrategy,
  Component, computed,
  inject,
  Input,
  OnDestroy,
  OnInit, QueryList, Signal,
  signal, ViewChildren,
  WritableSignal
} from '@angular/core';
import {concatMap, from, Subscription} from 'rxjs';
import {PreferenceService} from '../preference-service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ImageCardComponent} from '../image-card/image-card.component';
import {DragDropDirective, FileHandle} from '../drag-drop.directive';
import {MessageService} from '../message.service';
import {Tag, TagService} from '../tag.service';
import {ImageService} from '../image.service';
import {Image, ImageSubscription} from '../../lib/models/image.model';
import {DocumentReference, where} from '@angular/fire/firestore';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {DownloadService, BatchedStrategy} from '../download.service';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {ImageReport, IntegrityService} from '../integrity.service';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NgClass} from '@angular/common';
import {UploadService} from '../upload.service';


@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [
    ImageCardComponent,
    DragDropDirective,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NgClass,
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
  @ViewChildren(ImageCardComponent) imageCards!: QueryList<ImageCardComponent>;

  private messageService: MessageService = inject(MessageService);
  private preferences: PreferenceService = inject(PreferenceService);
  private imageService: ImageService = inject(ImageService);
  private tagService: TagService = inject(TagService);
  protected downloadService: DownloadService = inject(DownloadService);
  protected integrityService: IntegrityService = inject(IntegrityService);
  protected uploadService: UploadService = inject(UploadService);
  // How many image-cards are allowed to be loading their data in parallel
  readonly loadBudget: number = 25;

  // Maybe this replaces optTagName?  Why are we getting a name, and not a Tag to begin with?
  private tag: Tag | undefined = undefined;
  title: WritableSignal<string> = signal('');
  optTagName: WritableSignal<string> = signal('');
  images: WritableSignal<Image[]> = signal([]);
  totalImageCount: WritableSignal<number> = signal(0);

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

  onLoadComplete() {
    const notStarted = this.imageCards.filter(img=>!img.loadImmediately)
    if (notStarted.length > 0) {
      notStarted[0].startLoading()
    }
  }

  async startSubscriptions() {
    let subscription: ImageSubscription<Image[]>;
    switch(this.mode) {
      case 'latest':
        this.imageService.CountAllImages().then(cnt=>this.totalImageCount.set(cnt))
        subscription = this.imageService.SubscribeToLatestImages(this.preferences.showImageCount$.value)
        break
      case 'tag':
        const tag = await this.tagService.LoadTagByName(this.optTagName())
        this.imageService.CountTagImages(tag.reference)
          .then(cnt => this.totalImageCount.set(cnt))
          .catch(err => {this.messageService.Error(`<image-gallery> fetching tag image count: ${err}`)})
        subscription = this.imageService.SubscribeToTag(tag.reference, this.preferences.showImageCount$.value)
        break;
      default:
        throw new Error(`Unsupported mode: ${this.mode}`);
    }
    this.imagesSub = subscription.results$.subscribe((images: Image[]) => this.images.set(images))
    this.dbUnsubscribe = subscription.unsubscribe;
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
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id)).then(()=>this.totalImageCount.update(v=>v-1))
      case 'inbox':
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id)).then(()=>this.totalImageCount.update(v=>v-1))
      default:
        return this.imageService.DeleteImage(this.imageService.GetImageReferenceFromId(id)).then(()=>this.totalImageCount.update(v=>v-1))
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
    this.uploadService.upload(files, this.mode === 'tag' ? this.optTagName() : undefined)
  }

  onDownload() {
    this.downloadService.download({
      fileName: this.mode === 'latest' ? 'latest-images' : `${this.optTagName()}-images`,
      maxZipContentBytes: 500 * 1024 * 1024,
      strategy: this.mode === 'latest' ? new BatchedStrategy(this.imageService) : new BatchedStrategy(this.imageService, where("tags", "array-contains", this.tag?.reference)),
    })
  }

  onIntegrity() {
    const strategy = this.mode === 'latest' ? new BatchedStrategy(this.imageService) : new BatchedStrategy(this.imageService, where("tags", "array-contains", this.tag?.reference))
    const sub = this.integrityService.getImagesReportStrategy(strategy, true).subscribe({
      next: (res: ImageReport[]) => {res.map(r=> console.log(r))},
      complete: () => {sub.unsubscribe()},
    })
  }

}

