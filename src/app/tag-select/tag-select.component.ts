import {Component, EventEmitter, inject, OnInit, Output} from '@angular/core';
import {LiveTag, StorageService} from '../storage.service';
import {
  BehaviorSubject,
  combineLatestWith,
  debounceTime,
  distinctUntilChanged,
  first, map,
  Observable,
  startWith,
  tap
} from 'rxjs';
import {MatSelectModule} from '@angular/material/select';
import {AsyncPipe} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormControl} from '@angular/forms';

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [
    AsyncPipe,
    MatSelectModule,
  ],
  templateUrl: './tag-select.component.html',
  styleUrl: './tag-select.component.scss'
})
export class TagSelectComponent {
  @Output() selectionChange = new EventEmitter<string>();

  readonly searchText = new FormControl('')
  tags$: Observable<LiveTag[]>;
  enableCreateButton$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(private storage: StorageService) {
    this.storage.LoadAllTags();
    this.tags$ = this.storage.tagsShared$.pipe(
      takeUntilDestroyed(),
      distinctUntilChanged(),
    );
  }

  onSelectionChange(selection: string){
    this.selectionChange.emit(selection);
  }
}
