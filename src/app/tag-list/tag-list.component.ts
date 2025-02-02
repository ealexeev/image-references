import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveTag, StorageService } from '../storage.service';
import { catchError, combineLatestWith, debounceTime, distinctUntilChanged, map, of, startWith, tap, Observable, BehaviorSubject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {MatButtonModule} from '@angular/material/button';
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
    MatButtonModule,
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

  @Output() tagSelectionEvent = new EventEmitter<string>()

  tags$: Observable<LiveTag[]>;
  tagsSharedLenght$: BehaviorSubject<number> = new BehaviorSubject(0);
  tagsFilteredCount$: BehaviorSubject<number> = new BehaviorSubject(0);
  enableCreateButton$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  readonly searchText = new FormControl('')

  constructor(private storage: StorageService) {
    var search = this.searchText.valueChanges.pipe(
      startWith(''),
      takeUntilDestroyed(),
      debounceTime(250),
    );

    this.tags$ = this.storage.tagsShared$.pipe(
      distinctUntilChanged(),
      combineLatestWith(search),
      map( ([tags, searchText]) => {
        const matches = tags.filter(t => t.name.toLowerCase().includes((searchText || '').toLowerCase()))
        this.tagsFilteredCount$.next(matches.length);
        if ( matches.length == 0 || (( searchText || '').length > 0 && !matches.map(t => t.name.toLowerCase())
                                         .includes((searchText || '').toLowerCase())) ) {
          this.enableCreateButton$.next(true);
        } else {
          this.enableCreateButton$.next(false);
        }
        return matches;
      }),
    );

    this.storage.tagsShared$.pipe(
      takeUntilDestroyed(),
    ).subscribe((tags) => this.tagsSharedLenght$.next(tags.length || 0));
  }

  ngOnInit() {
    this.storage.LoadAllTags();
  }

  createTag() {
    const newTag = this.searchText.value ?? ''
    if ( newTag.length == 0 ) {
      return;
    }
    this.storage.StoreTag(newTag).pipe(
      catchError( (error: Error) => {
        console.log(`Error createTag(): ${this.searchText.value}: ${error}`);
        return of();
      }),
    ).subscribe( (r)=> {
      console.log(`Create tag: ${r?.name} with id ${r?.id}`)
      this.searchText.setValue(this.searchText.value)
      // How do we click/select the new tag?
    })
  }

  onChipSelectionChange(event: any, tag: LiveTag) {
    this.tagSelectionEvent.emit(tag.name);
  }

  clearSearchText(): void {
    this.searchText.setValue('');
  }
}
