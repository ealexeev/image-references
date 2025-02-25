import {Component, EventEmitter, OnInit, Input, Output, ChangeDetectionStrategy, inject} from '@angular/core';
import {MatSelectModule} from '@angular/material/select';
import {AsyncPipe} from '@angular/common';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {TagService} from '../tag.service';

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
  tags: TagService = inject(TagService);

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
