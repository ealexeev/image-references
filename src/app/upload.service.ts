import {computed, effect, inject, Injectable, OnDestroy, Signal, signal} from '@angular/core';
import {FileHandle} from './drag-drop.directive';
import {concatMap, from, Subscription} from 'rxjs';
import {MessageService} from './message.service';
import {DocumentReference} from '@angular/fire/firestore';
import {TagService} from './tag.service';
import {ImageService} from './image.service';

interface Metadata {
  tags: string[]
}

@Injectable({
  providedIn: 'root'
})
export class UploadService implements OnDestroy {
  private messageService = inject(MessageService);
  private tagService = inject(TagService);
  private imageService = inject(ImageService);

  sub: Subscription = new Subscription();

  toUploadCount = signal(0);
  uploadedCount = signal(0);
  uploading = computed(()=> this.toUploadCount() > 0 && this.uploadedCount() < this.toUploadCount());
  uploadPercentage: Signal<string> = computed(()=> Math.floor(this.uploadedCount()/this.toUploadCount()*100).toString())

  constructor() {}

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private async receiveImageURL(url: string, tag?: string, metadata?: unknown): Promise<void> {
    const tagNames: Set<string> = new Set();
    if (tag) {
      tagNames.add(tag)
    }
    if (metadata) {
      (metadata as Metadata).tags.forEach(t => tagNames.add(t))
    }
    const tags = await Promise.all([...tagNames].map(t=> this.tagService.LoadTagByName(t)))
    const tagRefs = tags.map(t=>t.reference)
    const blob = await fetch(url).then(res => res.blob()).then(blob => blob)
    await this.imageService.StoreImage(blob, tagRefs)
    this.uploadedCount.update(v=>v+1)
  }

  /**
   * Upload specified files.  If provided, apply the specified tag name to the files.
   * */
  upload(files: FileHandle[], tag?: string) {
    this.messageService.Info(`Received ${files.length} ${files.length > 1 ? 'files' : 'file'}`);
    const queueCount = 10;

    if (files.length > queueCount) {
      this.toUploadCount.set(files.length)
      this.uploadedCount.set(0);
    }

    for (const batch of this.makeBatches(files, queueCount).filter(b => !!b)) {
      this.sub.add(from(batch).pipe(
        concatMap((file: FileHandle) => {
          return from(this.receiveImageURL(file.url, tag))
        }),
      ).subscribe({
        next: ()=> this.uploadedCount.update(v=>v+1),
        error: (err: unknown)=> {
          this.uploadedCount.update(v => v + 1)
          this.messageService.Error(`Error uploading image: ${err}`)
        },
      }))
    }
  }

  private makeBatches(files: FileHandle[], count: number): FileHandle[][] {
    const batches: FileHandle[][] = [];
    const batchSize = Math.ceil(files.length / count);
    for (let i = 0; i < count; i++) {
      const start = i*batchSize;
      const end = start+batchSize;
      batches.push(files.slice(start, end));
    }
    return batches;
  }
}
