import {Component, EventEmitter, OnInit, Input, Output, ChangeDetectionStrategy, inject, signal, computed} from '@angular/core';
import {MatSelectModule} from '@angular/material/select';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {Tag, TagService} from '../tag.service';
import { ImageTagService } from '../image-tag.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [
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
  allTagsSorted = computed(()=> this.allTags()!.sort((a, b)=>a.name.localeCompare(b.name)));

  recentTagsFirst = computed(() => {
    const byId: Map<string, Tag> = new Map(this.allTags()!.map(t=> [t.reference.id, t]));
    const byName: Map<string, Tag> = new Map(this.allTags()!.map(t=> [t.name, t]));
    
    const idsInOrderOfUse: Array<string> = [];

    this.selected.value.forEach(name => {
      idsInOrderOfUse.push(byName.get(name)!.reference.id);
    });

    idsInOrderOfUse.push(...this.imageTagService.recentTagIds().filter(id=>!idsInOrderOfUse.includes(id)));
    
    idsInOrderOfUse.push(...this.allTagsSorted()!.filter(t=>!idsInOrderOfUse.includes(t.reference.id)).map(t=>t.reference.id));
    return idsInOrderOfUse.map(id=>byId.get(id)!);
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
