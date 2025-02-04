import { Injectable } from '@angular/core';
import {BehaviorSubject, debounceTime, distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class PreferenceService {
  private readonly defaultAllImages: boolean = true;
  private readonly defaultImageCount: number = 10;
  private readonly localStoragePrefix: string = 'pa-puh-reference-';
  private readonly showAllStorageKey: string = 'showAllImages'
  private readonly imageCountStorageKey: string = 'imageCount';
  showAllImages$: BehaviorSubject<boolean>;
  showImageCount$: BehaviorSubject<number>;

  constructor() {
    const storedShowAll = localStorage.getItem(this.localStoragePrefix+this.showAllStorageKey);
    if ( storedShowAll ) {
      this.showAllImages$ = new BehaviorSubject(JSON.parse(storedShowAll));
    } else {
      this.showAllImages$ = new BehaviorSubject(this.defaultAllImages);
    }

    const storedImageCount = localStorage.getItem(this.localStoragePrefix+this.imageCountStorageKey);
    if ( storedImageCount ) {
      this.showImageCount$ = new BehaviorSubject(JSON.parse(storedImageCount));
    } else {
      this.showImageCount$ = new BehaviorSubject(this.defaultImageCount);
    }

    this.showAllImages$.pipe(
      takeUntilDestroyed(),
      debounceTime(5000),
      distinctUntilChanged(),
    ).subscribe(
      (v: boolean) => {localStorage.setItem(this.localStoragePrefix+this.showAllStorageKey, JSON.stringify(v));},
    )
    this.showImageCount$.pipe(
      takeUntilDestroyed(),
      debounceTime(5000),
      distinctUntilChanged(),
    ).subscribe(
      (v: number) => {localStorage.setItem(this.localStoragePrefix+this.imageCountStorageKey, JSON.stringify(v));},
    )
  }
}
