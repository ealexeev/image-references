import { Component, EventEmitter, Input, Output, Renderer2 } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { StoredImage } from '../storage.service';

@Component({
  selector: 'app-image-card',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    ],
  templateUrl: './image-card.component.html',
  styleUrl: './image-card.component.scss'
})
export class ImageCardComponent {
  @Input() imageSource: StoredImage|null = null;
  
  @Output() imageDeleted = new EventEmitter<string>;
  
  constructor(private renderer: Renderer2){}

  getImageTags(): string[] {
    return this.imageSource?.tags || [];
  }

  onDelete() {
    console.log("Got delete click!");
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
