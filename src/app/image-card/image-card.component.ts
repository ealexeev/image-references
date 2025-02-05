import {Component, EventEmitter, Input, Output, Renderer2, Signal, signal} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { LiveImage } from '../storage.service';
import {TagSelectComponent} from '../tag-select/tag-select.component';

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
  styleUrl: './image-card.component.scss'
})
export class ImageCardComponent {
  @Input() imageSource: LiveImage|null = null;
  @Output() imageDeleted = new EventEmitter<string>;
  @Output() imageTagsChanged = new EventEmitter<LiveImage>();

  constructor(private renderer: Renderer2){}
  
  showTagSelection = signal(false);

  getImageTags(): string[] {
    return this.imageSource?.tags.sort() || [];
  }

  getImageTagsText(): string {
    return this.getImageTags().join('\n');
  }

  onDelete() {
    this.imageDeleted.emit(this.imageSource?.id || "");
  }

  onDownload() {
    const link = this.renderer.createElement('a');
    link.setAttribute('target', '_blank');
    link.setAttribute('href', this.imageSource);
    link.setAttribute('download', new URL(this.imageSource?.url || "").pathname.slice(1));
    link.click();
    link.remove();
  }

  manageTags() {
    this.showTagSelection.set(!this.showTagSelection());
  }

  onSelectionChange(tags: string[]) {
    this.showTagSelection.set(false);
    this.imageSource!.tags = tags;
    this.imageTagsChanged.emit(this.imageSource!);
  }
}
