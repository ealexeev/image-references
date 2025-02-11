import {ChangeDetectionStrategy, Component, EventEmitter, Output, Signal, signal, computed, WritableSignal} from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DragDropDirective, FileHandle } from '../drag-drop.directive';
import {BehaviorSubject} from 'rxjs';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'app-image-adder',
  standalone: true,
  imports: [
    AsyncPipe,
    DragDropDirective,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './image-adder.component.html',
  styleUrl: './image-adder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageAdderComponent {
  @Output() imageAdded = new EventEmitter<string>;

  files: WritableSignal<FileHandle[]> = signal([]);
  fileCount: Signal<number> = computed( ()=> this.files().length );

  onPaste(event: any) {
    event.preventDefault();
    console.log('Paste event!')
    navigator.clipboard.readText().then( (s: string) => this.imageAdded.emit(s));
  };

  filesDropped(files: FileHandle[]) {
    this.files.set(files);
    for (const f of files) {
      this.imageAdded.emit(f.url.toString());
    }
    setTimeout(() => {this.files.set([])}, 1500);
  }

  uploadClicked() {
    for (const f of this.files()) {
      this.imageAdded.emit(f.url.toString());
    }
    this.files.set([]);
  }
}
