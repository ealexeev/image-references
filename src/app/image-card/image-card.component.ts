import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter, inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  Signal,
  signal, WritableSignal
} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { LiveImage, LiveImageData, StorageService } from '../storage.service';
import { TagSelectComponent } from '../tag-select/tag-select.component';
import { Subject } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [
    AsyncPipe,
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
  @Input({required: true}) imageSource!: LiveImage;
  @Input() tagCountFrom: number = 2;
  @Output() imageDeleted = new EventEmitter<string>;

  private storage = inject(StorageService);
  private renderer = inject(Renderer2);

  showTagSelection = signal(false);
  imageData: Subject<LiveImageData> = new Subject();
  thumbnailUrl: WritableSignal<string> = signal('');
  fullUrlAvailable: WritableSignal<Boolean> = signal(false);
  fetchFull: any; /// ()=>Promise<Blob>;

  private unsubscribe: () => void = () => {return};

  constructor(){
    this.imageData.pipe(
      // TODO:  Should this be a take one? or first()  Subscribing here is probably a waste.
      takeUntilDestroyed()
    ).subscribe(
      imageData => {
        this.thumbnailUrl.set(imageData.thumbnailUrl)
        this.fetchFull = imageData.fullUrl
        this.fullUrlAvailable.set(true)
      }
    )
  }

  ngOnInit(): void {
    this.unsubscribe = this.storage.SubscribeToImageData(this.imageSource.reference.id, this.imageData);
  }

  ngOnDestroy(): void{
    this.unsubscribe()
  }

  getImageTags(): string[] {
    return this.imageSource.tags
      .map(t=> this.storage.TagById(t.id)?.name)
      .filter(n => n !== undefined)
      .sort()
  }

  onDelete() {
    this.imageDeleted.emit(this.imageSource?.reference.id || "");
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
  }

  onSelectionChange(tags: string[]) {
    this.manageTags();
    this.storage.ReplaceImageTags(
      this.imageSource.reference,
      tags.map(t => this.storage.TagByName(t)?.reference)
        .filter(t => t !== undefined))
  }
}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
