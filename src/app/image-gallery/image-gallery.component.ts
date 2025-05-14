import {
  ChangeDetectionStrategy,
  Component, computed, effect,
  inject,
  Input,
  OnChanges, OnDestroy,
  OnInit, QueryList,
  signal, ViewChildren,
  WritableSignal
} from '@angular/core';
import {concatMap, from, Subject, Subscription} from 'rxjs';
import {PreferenceService} from '../preference-service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ImageCardComponent, SelectionStatus} from '../image-card/image-card.component';
import {DragDropDirective, FileHandle} from '../drag-drop.directive';
import {MessageService} from '../message.service';
import {Tag, TagService} from '../tag.service';
import {ImageService} from '../image.service';
import {Image, ImageSubscription} from '../../lib/models/image.model';
import {EncryptionService, State as EncryptionState} from '../encryption.service';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {DownloadService, BatchedStrategy} from '../download.service';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {ImageReport, IntegrityService} from '../integrity.service';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NgClass} from '@angular/common';
import {UploadService} from '../upload.service';
import {Router} from '@angular/router';
import {TagDeleteDialogComponent} from '../tag-delete-dialog/tag-delete-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import { where } from '@angular/fire/firestore';


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
export class ImageGalleryComponent implements OnInit, OnDestroy, OnChanges {
  @Input({required: true}) mode: "tag" | "latest" | "inbox" = "latest";
  @Input()
  set tagName(value: string) {
    if  ( value === undefined ) {return}
    if ( value !== this.optTagName() ) {
      this.optTagName.set(value);
    }
  }
  @ViewChildren(ImageCardComponent) imageCards!: QueryList<ImageCardComponent>;

  private messageService: MessageService = inject(MessageService);
  private encryptionService: EncryptionService = inject(EncryptionService);
  private preferences: PreferenceService = inject(PreferenceService);
  private imageService: ImageService = inject(ImageService);
  private tagService: TagService = inject(TagService);
  protected downloadService: DownloadService = inject(DownloadService);
  protected integrityService: IntegrityService = inject(IntegrityService);
  protected uploadService: UploadService = inject(UploadService);
  private router: Router = inject(Router)
  private dialog: MatDialog = inject(MatDialog);
  // How many image-cards are allowed to be loading their data in parallel
  readonly loadBudget: number = 25;

  // Maybe this replaces optTagName?  Why are we getting a name, and not a Tag to begin with?
  private tag: Tag | undefined = undefined;
  title: WritableSignal<string> = signal('');
  optTagName: WritableSignal<string> = signal('');
  images: WritableSignal<Image[]> = signal([]);
  totalImageCount: WritableSignal<number> = signal(0);
  selectedCount: WritableSignal<number> = signal(0);
  deselectAll$: Subject<void> = new Subject<void>();

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
    this.encryptionService.currentState$.pipe(
      takeUntilDestroyed(),
    ).subscribe(
      (v: EncryptionState) => {
        this.images.set([]);
        this.ngOnDestroy();
        this.ngOnInit();
      }
    )

    effect(()=> {
      const tagName = this.optTagName();
      if (tagName === '') {return};
      this.tagService.LoadTagByName(tagName)
        .then(tag => {
          this.tag = tag
        })
        .catch(err => {
          this.messageService.Error(`LoadTagByName(${tagName}): ${err}`);
          if (this.mode ==='tag') {
            this.router.navigateByUrl('/tags');
          }
        })
      this.ngOnChanges();
    }, {allowSignalWrites: true})
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

  ngOnChanges() {
    this.ngOnDestroy()
    this.ngOnInit();
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

  countLoading(): number {
    return this.imageCards.filter(c => c.loadImmediately && !(c.loaded())).length;
  }

  async startSubscriptions() {
    let subscription: ImageSubscription<Image[]>;
    switch(this.mode) {
      case 'latest':
        this.imageService.CountAllImages().then(cnt=>this.totalImageCount.set(cnt))
        subscription = this.imageService.SubscribeToLatestImages(this.preferences.showImageCount$.value)
        break
      case 'inbox':
        this.imageService.CountUntaggedImages().then(cnt=>this.totalImageCount.set(cnt))
        subscription = this.imageService.SubscribeToUntaggedImages(this.preferences.showImageCount$.value)
        break;
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

  onDelete() {
    const dialogRef = this.dialog.open(TagDeleteDialogComponent, {
      data: {tag: this.tag?.name, newName: ''}});

    dialogRef.afterClosed().subscribe(result => {
      switch (result) {
        case false:
          console.log('delete cancelled')
          break;
        case '':
          this.deleteTag().catch((err: unknown) => {console.error(err)})
          break;
        default:
          this.deleteTag(result).catch((err: unknown) => {console.error(err)})
      }
    })
  }

  private async deleteTag(rename?: string) {
    let newTag: Tag | undefined;
    if (rename) {
      newTag = await this.tagService.StoreTag(rename);
    }
    const strategy = new BatchedStrategy(this.imageService, where("tags", "array-contains", this.tag!.reference));
    strategy.Fetch().subscribe({
      next: (images: Image[]) => {
        for (const image of images) {
          const updated = image.tags
            .filter(t=>t != this.tag!.reference)
            .concat( newTag ? [newTag.reference] : []);
          this.imageService.ReplaceTags(image.reference, updated)
            .catch((err: unknown) => {console.error(`Replacing tags: ${err}`)})}
      },
      complete: () => {
        this.tagService.DeleteTag(this.tag!.reference);
        if (rename) {
          this.router.navigateByUrl(`/tags/${rename}`)
          return;
        }
        this.router.navigateByUrl(`/tags`);
      }
    })
  }

  onSelectedChange(value: SelectionStatus) {
    this.selectedCount.update(v=> v + (value.selected ? 1 : -1) < 0 ? 0 : v + (value.selected ? 1 : -1));
  }

}

