import { Injectable } from '@angular/core';
import {BehaviorSubject, debounceTime, distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class PreferenceService {

  private readonly defaultImageCount: number = 10;
  private readonly localStoragePrefix: string = 'pa-puh-reference-';
  private readonly imageCountStorageKey: string = 'imageCount';
  showImageCount$: BehaviorSubject<number>;

  constructor() {

    const storedImageCount = localStorage.getItem(this.localStoragePrefix+this.imageCountStorageKey);
    if ( storedImageCount ) {
      this.showImageCount$ = new BehaviorSubject(JSON.parse(storedImageCount));
    } else {
      this.showImageCount$ = new BehaviorSubject(this.defaultImageCount);
    }

    this.showImageCount$.pipe(
      takeUntilDestroyed(),
      debounceTime(5000),
      distinctUntilChanged(),
    ).subscribe(
      (v: number) => {localStorage.setItem(this.localStoragePrefix+this.imageCountStorageKey, JSON.stringify(v));},
    )
  }
}
