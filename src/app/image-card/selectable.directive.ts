import { Directive, EventEmitter, HostBinding, HostListener, Input, Output } from '@angular/core';

@Directive({
  selector: '[appSelectable]',
  standalone: true,
})
export class SelectableDirective {
  @Input() selected = false;
  @Output() selectedChange = new EventEmitter<boolean>();

  @HostBinding('class.selected') get isSelected() {
    return this.selected;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.image-actions') === null) {
      this.selected = !this.selected;
      this.selectedChange.emit(this.selected);
    }
  }

  deselect() {
    this.selected = false;
    this.selectedChange.emit(this.selected);
  }
}
