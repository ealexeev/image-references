import { Component, EventEmitter, Output } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DragDropDirective, FileHandle } from '../drag-drop.directive';

@Component({
  selector: 'app-image-adder',
  standalone: true,
  imports: [
    DragDropDirective,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './image-adder.component.html',
  styleUrl: './image-adder.component.scss'
})
export class ImageAdderComponent {
  @Output() imageAdded = new EventEmitter<string>;

  files: FileHandle[] = [];

  onPaste(event: any) {
    event.preventDefault();
    navigator.clipboard.readText().then( (s: string) => this.imageAdded.emit(s));
  };

  filesDropped(files: FileHandle[]) {
    this.files = files;
    for (const f of this.files) {
      this.imageAdded.emit(f.url.toString());
    }
    setTimeout(() => {this.files = [];}, 1500);
  }

  uploadClicked() {
    for (const f of this.files) {
      this.imageAdded.emit(f.url.toString());
    }
    this.files = [];
  }
}
