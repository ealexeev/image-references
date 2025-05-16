import { Injectable, signal, WritableSignal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PreferenceService {

  private readonly defaultImageCount: number = 10;
  private readonly localStoragePrefix: string = 'pa-puh-reference-';
  private readonly imageCountStorageKey: string = 'imageCount';
  showImageCount: WritableSignal<number>;

  constructor() {
    const storedImageCount = localStorage.getItem(this.localStoragePrefix + this.imageCountStorageKey);
    const initialValue = storedImageCount ? JSON.parse(storedImageCount) : this.defaultImageCount;
    this.showImageCount = signal(initialValue);

    let timeout: any;
    effect(() => {
      const value = this.showImageCount();
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.setItem(this.localStoragePrefix + this.imageCountStorageKey, JSON.stringify(value));
      }, 500);
    });
  }
}
