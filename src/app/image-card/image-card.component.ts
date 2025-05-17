import {
  ChangeDetectionStrategy,
  Component, effect,
  EventEmitter, inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal, WritableSignal
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { TagSelectComponent } from '../tag-select/tag-select.component';
import {TagService} from '../tag.service';
import {MessageService} from '../message.service';
import {ImageService} from '../image.service';
import {Image, ImageData, ImageSubscription} from '../../lib/models/image.model';
import {Observable, of, Subject, take, takeUntil} from 'rxjs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Router} from '@angular/router';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {DownloadService} from '../download.service';
import {SelectableDirective} from './selectable.directive';
import { ImageTagService } from '../image-tag.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    TagSelectComponent,
    MatTooltipModule,
    SelectableDirective,
  ],
  templateUrl: './image-card.component.html',
  styleUrls: [
    './image-card.component.scss',
    '../../_variables.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCardComponent implements OnInit, OnDestroy{
  @Input({required: true}) imageSource!: Image;
  @Input() tagCountFrom: number = 2;
  @Input() loadImmediately: boolean = true;
  @Input() deselect$: Subject<void> = new Subject<void>();
  @Output() imageDeleted = new EventEmitter<string>;
  @Output() loadComplete: EventEmitter<void> = new EventEmitter();
  @Output() imageSelectedChange = new EventEmitter<SelectionStatus>();

  protected imageService = inject(ImageService);
  private tagService = inject(TagService);
  protected imageTagService = inject(ImageTagService);
  private download: DownloadService = inject(DownloadService);
  private messages = inject(MessageService);
  private router: Router = inject(Router);
  private imageSub: ImageSubscription<Image> | undefined = undefined;
  private dataSub: ImageSubscription<ImageData> | undefined = undefined;

  showTagSelection = signal(false);
  imageTagNames: WritableSignal<string[]> = signal([]);
  thumbnailUrl: WritableSignal<string> = signal('');
  fullUrlAvailable: WritableSignal<Boolean> = signal(false);
  fetchFull: any; /// ()=>Promise<Blob>;
  lastOpText = signal('');
  loaded = signal(false);
  operationComplete = signal(false);
  encryptionPresent = signal(false);
  encryptionDecrypted = signal(false);

  private unsubscribe: () => void = () => {return};
  private destroy$: Subject<void> = new Subject<void>();
  private tagSelectionTimeoutId: any = null;

  constructor() {
    effect(async () => {
        const recentOps = this.imageTagService.recentOperations();
        if (recentOps.length < 1) {
          return;
        }
        const lastOp = recentOps[0];
        this.lastOpText.set(lastOp.type + '\n' + lastOp.tags.map(t => `- ${t.name}`).join('\n'));

    }, { allowSignalWrites: true})
    effect(()=>{
        if (this.loaded()) {
          this.loadComplete.emit()
        }
    })
    effect(()=>{
      if (this.showTagSelection()) {
        this.tagSelectionTimeoutId = setTimeout(() => {
          this.showTagSelection.set(false);
          this.tagSelectionTimeoutId = null;
        }, 5000);
      }
    }, {allowSignalWrites: true})
  }

  ngOnInit(): void {
    if ( this.loadImmediately ) {
      this.startSubscriptions()
    }
    this.resolveTags();
    this.imageTagService.operationComplete$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(scope=>{
      if (scope.filter(ref=>ref.id==this.imageSource.reference.id).length>0) {
          this.deselect$.next()
          this.operationComplete.set(true);
          setTimeout(()=>this.operationComplete.set(false), 3000);
      }
    })
  }

  ngOnDestroy(): void{
    this.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.tagSelectionTimeoutId) {
      clearTimeout(this.tagSelectionTimeoutId);
    }
  }

  startSubscriptions() {
    this.dataSub = this.imageService.SubscribeToImageData(this.imageSource.reference.id);
    this.dataSub.results$.pipe(
      take(1),
    ).subscribe(
      (imageData: ImageData) => {
        this.thumbnailUrl.set(URL.createObjectURL(imageData.thumbnail));
        this.fetchFull = imageData.fullSize
        this.fullUrlAvailable.set(true)
        this.loaded.set(true);
        this.dataSub!.unsubscribe();  // Unsub after getting image data.
        this.dataSub = undefined;
        this.encryptionPresent.set(!!imageData.encryptionPresent);
        this.encryptionDecrypted.set(!!imageData.decrypted);
      }
    )
    this.imageSub = this.imageService.SubscribeToImage(this.imageSource.reference);
    this.imageSub.results$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(
      (img: Image) => {
        this.imageSource = img;
        this.resolveTags();
      }
    )
  }

  startLoading() {
    this.loadImmediately = true;
    this.ngOnInit();
  }

  onDelete() {
    this.imageDeleted.emit(this.imageSource?.reference.id || "");
  }

  resolveTags() {
    Promise.all(this.imageSource.tags.map(ref => this.tagService.LoadTagByReference(ref)))
      .then(tags => {this.imageTagNames.set(tags.map(t=>t.name))})
      .catch((err: unknown) => this.messages.Error(`Error resolving tag names: ${err}`))
  }

  onDownload() {
    const img = this.imageSource
    this.download.download({
      fileName: this.imageSource.reference.id,
      maxZipContentFiles: 1,
      strategy: {
        Fetch() {return of([img]);}
      }})
  }

  manageTags() {
    this.clearTimer();
    this.showTagSelection.update(v => !v);
  }

  private clearTimer() {
    if (this.tagSelectionTimeoutId) {
      clearTimeout(this.tagSelectionTimeoutId);
      this.tagSelectionTimeoutId = null;
    }
  }

  onAddLast() {
    this.imageTagService.performLastOperation(this.imageSource.reference)
      .catch((err: unknown) => {this.messages.Error(`Error performing last operation: ${err}`)})
  }

  async onSelectionChange(tags: string[]) {
    this.showTagSelection.set(false);
    Promise.all(tags.map(name => this.tagService.LoadTagByName(name)))
      .then(tags => this.imageTagService.replaceTags(this.imageSource.reference, tags))
      .catch(e=>this.messages.Error(`Error updating tags on image ${this.imageSource.reference}: ${e}`))
  }

  onFullSize() {
    this.router.navigateByUrl(`/image/${this.imageSource.reference.id}`)
  }

  updateSelected(selected: boolean) {
    this.imageSelectedChange.emit({selected, reference: this.imageSource.reference.id});
    if (selected) {
      this.imageTagService.addToScope$.next(this.imageSource.reference);
    } else {
      this.imageTagService.removeFromScope$.next(this.imageSource.reference);
    }
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}

export interface SelectionStatus {
  selected: boolean;
  reference: string;
}