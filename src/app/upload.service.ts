import {computed, inject, Injectable, OnDestroy, Signal, signal} from '@angular/core';
import {FileHandle} from './drag-drop.directive';
import {concatMap, from, Subscription} from 'rxjs';
import {MessageService} from './message.service';
import {DocumentReference} from '@angular/fire/firestore';
import {Tag, TagService} from './tag.service';
import {ImageService} from './image.service';
import {ImageState, IntegrityService} from './integrity.service';
import {HmacService} from './hmac.service';

interface Metadata {
  tags?: string[]
  added?: string
}

interface FilePair {
  image: FileHandle;
  metadata?: FileHandle;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService implements OnDestroy {
  private messageService = inject(MessageService);
  private tagService = inject(TagService);
  private imageService = inject(ImageService);
  private integrityService = inject(IntegrityService);
  private hmacService = inject(HmacService);

  sub: Subscription = new Subscription();

  toUploadCount = signal(0);
  uploadedCount = signal(0);
  duplicateUploadDetected = computed(()=> this.imageService.duplicateImageDetected());
  uploading = computed(()=> this.toUploadCount() > 0 && this.uploadedCount() < this.toUploadCount());
  uploadPercentage: Signal<string> = computed(()=> Math.floor(this.uploadedCount()/this.toUploadCount()*100).toString())

  constructor() {}

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private async processFile(file: File, tag?: string, metadata?: File): Promise<void> {
    const tagNames: Set<string> = new Set();
    if (tag) {
      tagNames.add(tag)
    }
    let added: Date|undefined = undefined;
    if (metadata) {
      const parsed = JSON.parse(await metadata.text()) as Metadata
      (parsed?.tags || []).forEach(t => tagNames.add(t))
      added = parsed.added ? new Date(parsed.added) : undefined;
    }
    const tags: DocumentReference[] = [];
    for (const name of tagNames) {
      let tag: Tag;
      try {
        tag = await this.tagService.LoadTagByName(name);
        tags.push(tag.reference)
      } catch (e: unknown) {
        if ((e as string).includes('not found')) {
          tag = await this.tagService.StoreTag(name);
          tags.push(tag.reference);
        }
      }
    }
    await this.imageService.StoreImage(file, tags, added)
    const id = await this.hmacService.getHmacHex(file)
    const report = await this.integrityService.getImageReport(id)
    if ( report.state !== ImageState.COMPLETE ) {
      console.error(report)
    }
  }

  /**
   * Upload specified files.  If provided, apply the specified tag name to the files.
   * */
  upload(files: FileHandle[], tag?: string) {
    const queueCount = 15;

    if (files.length > queueCount) {
      this.toUploadCount.set(files.length)
      this.uploadedCount.set(0);
    }

    const batches = this.makeBatches(files, queueCount).filter(b => !!b)
    this.toUploadCount.set(batches.reduce((a, b) => a + b.length, 0))

    for (const batch of batches) {
      this.sub.add(from(batch).pipe(
        concatMap((pair: FilePair) => {
          return from(this.processFile(pair.image.file, tag, pair.metadata?.file))
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

  private makeBatches(files: FileHandle[], count: number): FilePair[][] {
    const batches: FilePair[][] = [];
    const batchSize = Math.ceil(files.length / count);

    const metadata: Map<string, FileHandle> = new Map();

    for (const fh of files) {
      if (fh.file.name.endsWith('.json')) {
        metadata.set(fh.file.name.slice(0, -5), fh);
      }
    }

    const images = files.filter(fh => !fh.file.name.endsWith('.json'));

    for (let i = 0; i < count; i++) {
      const start = i*batchSize;
      const end = start+batchSize;
      batches.push(images.slice(start, end).map(fh=> (
        {
          image: fh,
          metadata: metadata.get(fh.file.name.slice(0, fh.file.name.lastIndexOf('.')))
        } as FilePair)));
    }
    return batches;
  }
}
