import { Directive, effect, EventEmitter, HostBinding, HostListener, inject, Input, Output, signal } from '@angular/core';
import { ImageTagService, ImageTagOperation } from '../image-tag.service';
import { Image } from '../../lib/models/image.model';

@Directive({
  selector: '[appSelectable]',
  standalone: true,
})
export class SelectableDirective {
  @Input({required: true}) imageSource!: Image;
  @Output() selectedChange = new EventEmitter<boolean>();
  @HostBinding('class.selected') get isSelected() {
    return this.selected();
  }

  private imageTagService = inject(ImageTagService);
  private selected = signal(false);
  private lastOperation: ImageTagOperation | undefined = undefined;
  private selectedTime: Date | undefined = undefined;

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.image-actions') === null) {
      this.selected.update((v)=>!v);
    }
  }

  constructor() {
    effect(() => this.selectedChange.emit(this.selected()));
    effect(() => {
      if (this.selected()) {
        this.selectedTime = new Date();
      }
    })
    effect(() => {
      const recent = this.imageTagService.recentOperations();
      if ( recent.length === 0 ) {
        return;
      }
      if ( this.selected() && recent[0].timestamp > this.selectedTime! ) {
        this.imageTagService.performOperation(this.imageSource.reference, recent[0]);
        this.selected.set(false);
      }
    },  { allowSignalWrites: true })
  }
}
