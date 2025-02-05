import { Component, EventEmitter, Input, Output, Renderer2 } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { LiveImage } from '../storage.service';
import {MatTooltipModule, TooltipPosition} from '@angular/material/tooltip';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    ],
  templateUrl: './image-card.component.html',
  styleUrl: './image-card.component.scss'
})
export class ImageCardComponent {
  @Input() imageSource: LiveImage|null = null;

  @Output() imageDeleted = new EventEmitter<string>;
  @Output() imageTagsChanged = new EventEmitter<Array<String>>();

  constructor(private renderer: Renderer2){}

  position: TooltipPosition = 'below';

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
}
