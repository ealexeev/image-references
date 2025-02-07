import {Component, EventEmitter, OnInit, Input, Output} from '@angular/core';
import {LiveTag, StorageService} from '../storage.service';
import {
  BehaviorSubject,
  combineLatestWith,
  debounceTime,
  distinctUntilChanged,
  first, map,
  Observable,
  startWith, take,
  tap
} from 'rxjs';
import {MatSelectModule} from '@angular/material/select';
import {AsyncPipe} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';

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
  styleUrl: './tag-select.component.scss'
})
export class TagSelectComponent implements OnInit{
  @Input() selectedTags: string[] = [];
  @Output() selectionChange = new EventEmitter<string[]>();

  readonly searchText = new FormControl('')
  tags$: Observable<LiveTag[]>;

  selected: FormControl<string[]> = new FormControl();

  enableCreateButton$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(private storage: StorageService) {
    this.tags$ = this.storage.tags$.pipe(
      takeUntilDestroyed(),
      distinctUntilChanged(),
    );
    this.selected.valueChanges.pipe(
      takeUntilDestroyed(),
      debounceTime(1500),
    ).subscribe((tags: string[]) => {
      this.selectionChange.emit(tags);
    })
  }

  ngOnInit() {
    this.selected.setValue(this.selectedTags, {emitEvent:false});
  }
}
