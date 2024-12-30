import { Component, OnInit } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { LiveTag, StorageService } from '../storage.service';
import { combineLatestWith, debounceTime, defaultIfEmpty, distinctUntilChanged, map, startWith, tap, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {MatDividerModule} from '@angular/material/divider';
import {MatChipsModule} from '@angular/material/chips';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatInputModule} from '@angular/material/input';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-tag-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    ReactiveFormsModule,
  ],
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss'
})
export class TagListComponent implements OnInit{
  tags$: Observable<LiveTag[]>;

  readonly searchText = new FormControl('')

  constructor(private storage: StorageService) {
    var search = this.searchText.valueChanges.pipe(
      startWith(''),
      takeUntilDestroyed(),
      debounceTime(250),
    );
    this.tags$ = this.storage.tags$.pipe(
      // distinctUntilChanged(),
      combineLatestWith(search),
      tap( ([tags, searchText]) => {
        console.log(`Search: ${searchText}, tags: ${tags}`)
      }),
      map( ([tags, searchText]) => {
        return tags.filter(t => t.name.toLowerCase().includes((searchText || '').toLowerCase()))
      }),
    );
  }

  ngOnInit() {
    this.storage.LoadAllTags();
  }
}
