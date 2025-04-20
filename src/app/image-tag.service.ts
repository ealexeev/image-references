import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Tag } from './tag.service';
import { arrayUnion, arrayRemove, updateDoc, DocumentReference, Firestore } from '@angular/fire/firestore';
import { MessageService } from './message.service';

export type ImageTagOperationType = 'Add' | 'Replace' | 'Remove';
export interface ImageTagOperation {
  type: ImageTagOperationType;
  tags: Tag[];
}

@Injectable({ providedIn: 'root' })
export class ImageTagService {
  private _recentOperations: WritableSignal<ImageTagOperation[]> = signal([]);
  public readonly recentOperations = this._recentOperations.asReadonly();

  private message = inject(MessageService);
  updateDoc = updateDoc;

  /**
   * Add tags to an image document.
   */
  async AddTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.updateDoc(imageRef, { tags: arrayUnion(...tags.map(t => t.reference)) });
    } catch (error) {
      this.message.Error(`Error adding tags to image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Added ${tags.length} tag(s) to image ${imageRef.id}`);
    this.logOperation('Add', tags);
  }

  /**
   * Remove tags from an image document.
   */
  async RemoveTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.updateDoc(imageRef, { tags: arrayRemove(...tags.map(t => t.reference)) });
    } catch (error) {
      this.message.Error(`Error removing tags from image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Removed ${tags.length} tag(s) from image ${imageRef.id}`);
    this.logOperation('Remove', tags);
  }

  /**
   * Replace all tags on an image document.
   */
  async ReplaceTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.updateDoc(imageRef, { tags: tags.map(t => t.reference) });
    } catch (error) {
      this.message.Error(`Error replacing tags on image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Replaced tags on image ${imageRef.id} (${tags.length} tag(s))`);
    this.logOperation('Replace', tags);
  }

  /**
   * Internal: logs an operation, maintaining a max of 5.
   */
  private logOperation(type: ImageTagOperationType, tags: Tag[]): void {
    const updated = [
      { type, tags },
      ...this._recentOperations(),
    ].slice(0, 5);
    this._recentOperations.set(updated);
  }
}
