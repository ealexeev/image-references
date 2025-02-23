import { Injectable } from '@angular/core';
import {LRUCache} from 'lru-cache';
import {ImageData} from '../lib/models/image.model';

const size = 500;

@Injectable({
  providedIn: 'root'
})
export class ImageDataCacheService {

  private readonly cache: LRUCache<string, ImageData> = new LRUCache<string, ImageData>({max: size});

  constructor() {}

  has(imageId: string): boolean {
    return this.cache.has(imageId);
  }

  get(imageId: string): ImageData | undefined {
    return this.cache.get(imageId);
  }

  set(imageId: string, data: ImageData): void {
    this.cache.set(imageId, data);
  }
}
