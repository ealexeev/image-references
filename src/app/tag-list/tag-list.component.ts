import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
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
  styleUrl: './tag-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagListComponent {

  @Output() tagSelectionEvent = new EventEmitter<string>()

  tags$: Observable<LiveTag[]>;
  tagsFilteredCount$: BehaviorSubject<number> = new BehaviorSubject(0);
  enableCreateButton$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  readonly searchText = new FormControl('')

  constructor(private storage: StorageService) {
    var search = this.searchText.valueChanges.pipe(
      startWith(''),
      takeUntilDestroyed(),
      debounceTime(500),
    );

    this.tags$ = this.storage.tags$.pipe(
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
        return matches.sort((a, b) => a.name.localeCompare(b.name));
      }),
    );
  }

  createTag() {
    if ( !this.searchText?.value?.length ) {
      return;
    }
    this.storage.StoreTag(this.searchText.value)
      .then((unused)=> {
        this.searchText.setValue(this.searchText.value)
      })
      .catch((err)=> { console.log(`app-tag-list:  error in StoreTag: ${err.message}`)})
  }

  onChipSelectionChange(event: any, tag: LiveTag) {
    this.tagSelectionEvent.emit(tag.name);
    setTimeout(()=>this.clearSearchText(), 1500);
  }

  clearSearchText(): void {
    this.searchText.setValue('');
  }
}
