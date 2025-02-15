import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
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
import {QuerySnapshot} from '@angular/fire/compat/firestore';
import {Observable, Subject} from 'rxjs';
import {AsyncPipe} from '@angular/common';
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
  styleUrl: './image-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCardComponent implements OnInit, OnDestroy{
  @Input({required: true}) imageSource!: LiveImage;
  @Input() tagCountFrom: number = 2;
  @Output() imageDeleted = new EventEmitter<string>;

  showTagSelection = signal(false);
  imageData: Subject<LiveImageData> = new Subject();
  thumbnailUrl: WritableSignal<string> = signal('');
  fullUrl: WritableSignal<string> = signal('');
  private unsubscribe: () => void = () => {return};

  constructor(private renderer: Renderer2, private storage: StorageService){
    this.imageData.pipe(
      // TODO:  Should this be a take one? or first()  Subscribing here is probably a waste.
      takeUntilDestroyed()
    ).subscribe(
      imageData => {
        this.thumbnailUrl.set(imageData.thumbnailUrl);
        imageData.fullUrl().then(blob => {this.fullUrl.set(URL.createObjectURL(blob))});
      }
    )
  }

  ngOnInit(): void {
    this.unsubscribe = this.storage.SubscribeToImageData(this.imageSource.reference.id, this.imageData);
  }

  ngOnDestroy(): void{
    this.unsubscribe();
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

  onDownload() {
    const link = this.renderer.createElement('a');
    link.setAttribute('target', '_blank');
    link.setAttribute('href', this.fullUrl());
    link.setAttribute('download', new URL(this.fullUrl()).pathname.slice(1));
    link.click();
    link.remove();
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
