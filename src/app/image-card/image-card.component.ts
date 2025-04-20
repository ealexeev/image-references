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
import {first, of, raceWith, Subject, take, takeUntil, timer} from 'rxjs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Router} from '@angular/router';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {DownloadService} from '../download.service';
import {SelectableDirective} from './selectable.directive';
import { ImageTagService } from '../image-tag.service';

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
  @Output() imageDeleted = new EventEmitter<string>;
  @Output() loadComplete: EventEmitter<void> = new EventEmitter();

  protected imageService = inject(ImageService);
  private tagService = inject(TagService);
  protected imageTagService = inject(ImageTagService);
  private download: DownloadService = inject(DownloadService);
  private messages = inject(MessageService);
  private router: Router = inject(Router);
  private imageSub: ImageSubscription<Image> | undefined = undefined;
  private dataSub: ImageSubscription<ImageData> | undefined = undefined;

  showTagSelection = signal(false);
  tagSelectionFired$: Subject<void> = new Subject();
  tagSelectionOpened$: Subject<void> = new Subject();
  imageTagNames: WritableSignal<string[]> = signal([]);
  thumbnailUrl: WritableSignal<string> = signal('');
  fullUrlAvailable: WritableSignal<Boolean> = signal(false);
  fetchFull: any; /// ()=>Promise<Blob>;
  lastOpText = signal('');
  loaded = signal(false);

  private unsubscribe: () => void = () => {return};
  private destroy$: Subject<void> = new Subject<void>();

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
  }

  ngOnInit(): void {
    if ( this.loadImmediately ) {
      this.startSubscriptions()
    }
    this.resolveTags();
  }

  ngOnDestroy(): void{
    this.unsubscribe()
    this.destroy$.next()
    this.destroy$.complete()
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
    this.showTagSelection.update(v => !v);
    if ( this.showTagSelection() ) {
      const unsub = timer(10000).pipe(
        raceWith(this.tagSelectionOpened$),
        first(),
      ).subscribe({
        next: (value) => {
          if (value === 0) {
            this.showTagSelection.set(false)
          }
          unsub.unsubscribe();
        }
      })
    }
  }

  onSelectionOpen() {
    this.tagSelectionOpened$.next()
  }

  onAddLast() {
    this.imageTagService.performLastOperation(this.imageSource.reference)
      .catch((err: unknown) => {this.messages.Error(`Error performing last operation: ${err}`)})
  }


  async onSelectionChange(tags: string[]) {
    this.showTagSelection.set(false);
    Promise.all(tags.map(name => this.tagService.LoadTagByName(name)))
      .then(tags => {this.imageTagService.replaceTags(this.imageSource.reference, tags)})
      .catch(e=>this.messages.Error(`Error updating tags on image ${this.imageSource.reference}: ${e}`))
  }

  onFullSize() {
    this.router.navigateByUrl(`/image/${this.imageSource.reference.id}`)
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
