import { Directive,EventEmitter, HostBinding, HostListener, Output } from '@angular/core';

const inactiveBG = '#222';
const activeBG = '#aaa';

export interface FileHandle {
  file: File;
  url: string;
}

@Directive({
  selector: '[appDragDrop]',
  standalone: true,
})
export class DragDropDirective {
  @Output() files: EventEmitter<FileHandle[]> = new EventEmitter();

  @HostBinding('style.background') private background = inactiveBG;

  @HostListener("dragover", ['$event']) public onMouseEnter(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.background = activeBG;
  }

  @HostListener("dragleave", ['$event']) public onMouseLeave(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.background = inactiveBG;
  }

  @HostListener('drop', ['$event']) public onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.background = inactiveBG;

    if (!event?.dataTransfer) {
      return;
    }

    let files: FileHandle[] = [];
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer?.files[i];
      const url = URL.createObjectURL(file);
      files.push({ file, url });
    }
    if (files.length > 0) {
      this.files.emit(files);
    }
  }
}