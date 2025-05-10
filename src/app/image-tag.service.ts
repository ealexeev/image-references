import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Tag } from './tag.service';
import { DocumentReference } from '@angular/fire/firestore';
import { FirestoreWrapperService } from './firestore-wrapper.service';
import { MessageService } from './message.service';
import { shortenId } from './common';

export type ImageTagOperationType = 'Add' | 'Replace' | 'Remove';
export interface ImageTagOperation {
  type: ImageTagOperationType;
  tags: Tag[];
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class ImageTagService {
  private _recentOperations: WritableSignal<ImageTagOperation[]> = signal([]);
  public readonly recentOperations = this._recentOperations.asReadonly();

  private _recentTagIds: WritableSignal<string[]> = signal([]);
  public readonly recentTagIds = this._recentTagIds.asReadonly();

  private message = inject(MessageService);
  private firestore = inject(FirestoreWrapperService);

  /**
   * Add tags to an image document.
   */
  async addTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.firestore.updateDoc(imageRef, { tags: this.firestore.arrayUnion(...tags.map(t => t.reference)) });
    } catch (error) {
      this.message.Error(`Error adding tags to image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Added ${tags.length} tag(s) to image ${  shortenId(imageRef.id)}`);
    this.logOperation('Add', tags);
  }

  /**
   * Remove tags from an image document.
   */
  async removeTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.firestore.updateDoc(imageRef, { tags: this.firestore.arrayRemove(...tags.map(t => t.reference)) });
    } catch (error) {
      this.message.Error(`Error removing tags from image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Removed ${tags.length} tag(s) from image ${shortenId(imageRef.id)}`);
    this.logOperation('Remove', tags);
  }

  /**
   * Replace all tags on an image document.
   */
  async replaceTags(imageRef: DocumentReference, tags: Tag[]): Promise<void> {
    try {
      await this.firestore.updateDoc(imageRef, { tags: tags.map(t => t.reference) });
    } catch (error) {
      this.message.Error(`Error replacing tags on image ${imageRef.id}: ${error}`);
      return;
    }
    this.message.Info(`Replaced ${tags.length} tag(s) on image ${shortenId(imageRef.id)}`);
    this.logOperation('Replace', tags);
  }

  /**
   * Perform an image tag operation on specified image.
  */
  async performOperation(imageRef: DocumentReference, op: ImageTagOperation): Promise<void> {
  switch (op.type) {
    case 'Add':
      return this.addTags(imageRef, op.tags);
    case 'Remove':
      return this.removeTags(imageRef, op.tags);
    case 'Replace':
      return this.replaceTags(imageRef, op.tags);
    default:
      throw new Error('Unknown operation type: ' + op.type);
    }
  }

  /**
   * Perform the last operation on specified image.
  */
  async performLastOperation(imageRef: DocumentReference): Promise<void> {
    const lastOp = this._recentOperations()[0];
    if (lastOp) {
      return this.performOperation(imageRef, lastOp);
    }
  }

  /**
   * Internal: logs an operation, maintaining a max of 5.
  */
  private logOperation(type: ImageTagOperationType, tags: Tag[]): void {
    const operation: ImageTagOperation = {
      type,
      tags,
      timestamp: new Date(),
    };
    this._recentOperations.update(ops => [operation, ...ops]);
    
    // Update recentTagIds - move used tags to front, maintain uniqueness
    this._recentTagIds.update(ids => {
      const newIds = tags.map(t => t.reference.id);
      const remainingIds = ids.filter(id => !newIds.includes(id));
      return [...newIds, ...remainingIds];
    });
  }
}
