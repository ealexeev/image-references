import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter, inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
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
import {first, interval, raceWith, Subject, takeUntil} from 'rxjs';

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

  private imageService = inject(ImageService);
  private tagService = inject(TagService);
  private renderer = inject(Renderer2);
  private messages = inject(MessageService);
  private imageSub: ImageSubscription<Image> | undefined = undefined;
  private dataSub: ImageSubscription<ImageData> | undefined = undefined;

  showTagSelection = signal(false);
  tagSelectionFired: Subject<void> = new Subject();
  imageTagNames: WritableSignal<string[]> = signal([]);
  thumbnailUrl: WritableSignal<string> = signal('');
  fullUrlAvailable: WritableSignal<Boolean> = signal(false);
  fetchFull: any; /// ()=>Promise<Blob>;

  private unsubscribe: () => void = () => {return};
  private destroy$: Subject<void> = new Subject<void>();

  constructor(){}

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
      first(),
    ).subscribe(
      (imageData: ImageData) => {
        this.thumbnailUrl.set(URL.createObjectURL(imageData.thumbnail));
        this.fetchFull = imageData.fullSize
        this.fullUrlAvailable.set(true)
        this.loadComplete.emit();
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

  async onDownload() {
    const link = this.renderer.createElement('a');
    let blob: Blob;
    try {
      blob = await this.fetchFull();
    } catch (err: unknown) {
     console.error(`Error fetching image blob: ${err}`);
     return;
    }
    const url = URL.createObjectURL(blob)
    link.setAttribute('target', '_blank');
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.imageSource.reference.id}.${extFromMime(blob.type)}`);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  manageTags() {
    this.showTagSelection.update(v => !v);
    this.tagSelectionFired.pipe(
      raceWith(interval(10000)),
      first(),
    ).subscribe(
      ()=> {
        if (this.showTagSelection()) {
          this.showTagSelection.set(false)
        }
      })
  };

  async onSelectionChange(tags: string[]) {
    this.tagSelectionFired.next();
    Promise.all(tags.map(name => this.tagService.LoadTagByName(name)))
      .then(tags => {this.imageService.ReplaceTags(this.imageSource.reference, tags.map(t=>t.reference))})
      .catch(e=>this.messages.Error(`Error updating tags on image ${this.imageSource.reference}: ${e}`))
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
