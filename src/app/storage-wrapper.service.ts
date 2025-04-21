import { inject, Injectable } from '@angular/core';
import { 
  Storage,
  ref,
  StorageReference,
  getMetadata,
  FullMetadata
} from '@angular/fire/storage';

@Injectable({ providedIn: 'root' })
export class StorageWrapperService {
  readonly instance: Storage = inject(Storage);

  /**
   * Proxy for Storage's ref
   */
  ref(storage: Storage, path: string): StorageReference {
    return ref(storage, path);
  }

  /**
   * Proxy for Storage's getMetadata
   */
  getMetadata(ref: StorageReference): Promise<FullMetadata> {
    return getMetadata(ref);
  }
}
