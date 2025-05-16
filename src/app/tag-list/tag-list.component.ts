import {ChangeDetectionStrategy, Component, computed, EventEmitter, inject, Output, signal, Signal, WritableSignal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatestWith, debounceTime, distinctUntilChanged, map, of, startWith, tap, Observable, BehaviorSubject } from 'rxjs';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';

import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatChipsModule} from '@angular/material/chips';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatInputModule} from '@angular/material/input';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Tag, TagService} from '../tag.service';

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

  private tagService: TagService = inject(TagService);
  readonly searchText = new FormControl('');

  protected tags: Signal<Tag[]>;
  protected tagsFilteredCount = computed(() => this.tags().length);
  protected searchTextValue: Signal<string | null | undefined>;
  protected enabledCreateButton = computed(() => {
    const tags = this.tags();
    const searchText = this.searchTextValue() || ''
    if ( tags.length == 0 || (( searchText) || '').length > 0 && !tags.map(t => t.name.toLowerCase()).includes((searchText || '').toLowerCase())) {
      return true;
    }
    return false;
  });
  
  constructor() {
    let search = this.searchText.valueChanges.pipe(
      startWith(''),
      takeUntilDestroyed(),
      debounceTime(500),
    );

    this.searchTextValue = toSignal(search);

    this.tags = computed(() => {
      const allTags = this.tagService.tags();
      const searchTextValue = this.searchTextValue();
      const matches = allTags.filter(t => t.name.toLowerCase().includes((searchTextValue || '').toLowerCase()))
      return matches.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  createTag() {
    if ( !this.searchText?.value?.length ) {
      return;
    }
    this.tagService.StoreTag(this.searchText.value)
      .then((unused)=> {
        this.searchText.setValue(this.searchText.value)
      })
      .catch((err)=> { console.log(`app-tag-list:  error in StoreTag: ${err.message}`)})
  }

  onChipSelectionChange(event: any, tag: Tag) {
    this.tagSelectionEvent.emit(tag.name);
    setTimeout(()=>this.clearSearchText(), 1500);
  }

  clearSearchText(): void {
    this.searchText.setValue('');
  }
}
