import {Component, EventEmitter, OnInit, Input, Output, ChangeDetectionStrategy, inject, signal, computed} from '@angular/core';
import {MatSelectModule} from '@angular/material/select';
import {AsyncPipe} from '@angular/common';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {Tag, TagService} from '../tag.service';
import { ImageTagService } from '../image-tag.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [
    AsyncPipe,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './tag-select.component.html',
  styleUrl: './tag-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagSelectComponent implements OnInit{
  @Input() selectedTags: string[] = [];
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() opened: EventEmitter<void> = new EventEmitter();

  selected: FormControl<string[]> = new FormControl();
  tagService: TagService = inject(TagService);
  imageTagService = inject(ImageTagService);
  allTags = toSignal(this.tagService.tags$);
  recentTagsFirst = computed(() => {
    const ret: Array<Tag> = [];
    const recent = this.imageTagService.recentOperations().reverse();
    recent.forEach(op => {
      if (op.tags.length > 0) {
        for (const tag of op.tags) {
          if ( !ret.includes(tag) ) {
            ret.push(tag)
          }
        }
      }
    });
    ret.push(...this.allTags()!.filter(t=>!ret.includes(t)));
    return ret;
  });

  ngOnInit() {
    this.selected.setValue(this.selectedTags, {emitEvent:false});
  }

  onMouseLeave() {
    this.selectionChange.emit(this.selected.value);
  }

  onOpen() {
    this.opened.emit()
  }
}
