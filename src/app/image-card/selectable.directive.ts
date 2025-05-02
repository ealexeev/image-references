import { computed, Directive, effect, EventEmitter, HostBinding, HostListener, inject, Input, Output, signal } from '@angular/core';
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
    return this.ready();
  }

  private imageTagService = inject(ImageTagService);
  private selected = signal(false);

  state = computed(()=> ({
    selected: this.selected(),
    done: signal(false),
    start: new Date(),
  }))

  ready = computed(() => this.state().selected && !this.state().done())

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.image-actions') === null) {
      this.selected.update((v)=>!v);
    }
  }

  constructor() {
    effect(() => this.selectedChange.emit(this.selected()));
    effect(() => {
      const recent = this.imageTagService.recentOperations();
      if (this.ready() && recent.length > 0 && recent[0].timestamp > this.state().start) {
        this.imageTagService.performOperation(this.imageSource.reference, recent[0]);
        this.state().done.set(true);
      }
    },  { allowSignalWrites: true })
  }
}
