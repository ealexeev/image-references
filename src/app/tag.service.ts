import {inject, Injectable, OnDestroy, Query} from '@angular/core';
import {
  arrayRemove,
  Bytes,
  collection, doc,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  getDoc, getDocs,
  onSnapshot,
  query, setDoc, where, writeBatch
} from '@angular/fire/firestore';
import {EncryptionService} from './encryption.service';
import {MessageService} from './message.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable, ReplaySubject,
  shareReplay,
  startWith, takeUntil,
  withLatestFrom
} from 'rxjs';
import {HmacService} from './hmac.service';
import {runTransaction} from '@angular/fire/database';
import {QueryDocumentSnapshot} from '@angular/fire/compat/firestore';

export type Tag = {
  name: string,
  reference: DocumentReference,
}

type StoredTag = {
  name: Bytes;
  iv?: Bytes,
  keyReference?: DocumentReference,
}

export type TagUpdateCallback = (tag: DocumentReference[]) => Promise<void>;

type TagMap = Record<string, Tag>

@Injectable({
  providedIn: 'root'
})
export class TagService implements OnDestroy {
  private encryption = inject(EncryptionService)
  private firestore = inject(Firestore)
  private hmac = inject(HmacService)
  private messageService = inject(MessageService)

  private readonly encoder = new TextEncoder()
  private readonly decoder = new TextDecoder()
  private readonly tagsCollectionPath = 'tags'
  private tagsByName: TagMap = {}
  private tagsById: TagMap = {}

  // Tags used most recently.  Contains the entire tags$ output, but in order of use.
  recentTags$: Observable<Tag[]>
  // Complete set of tags known to TagService.  Eventually catches up to Firestore.
  tags$ = new ReplaySubject<Tag[]>()
  // Number of tags known to the TagService
  tagsCount$ = new BehaviorSubject<number>(0)
  // Tags applied during the last operation.  Supplied externally.  Ideally this is the only point of contact
  // between TagService and ImageService.
  appliedTags$ = new BehaviorSubject<Tag[]>([])
  // Previous emission of recentTags$, which allows continuous updates.
  private lastRecentlyUsed$ = new BehaviorSubject<Tag[]>([])
  private unsubTagCollection: any

  constructor() {
    this.recentTags$ = this.appliedTags$.pipe(
      takeUntilDestroyed(),
      withLatestFrom(this.lastRecentlyUsed$.pipe(startWith([])), this.tags$),
      map(([applied, lastEmission, stored]) => {
        const appliedIds = applied.map(t=>t.reference.id)
        let ret: Tag[];
        if ( stored.length > lastEmission.length ) {
          ret = stored.filter(t=> !appliedIds.includes(t.reference.id))
        } else {
          ret = lastEmission.filter(t=> !appliedIds.includes(t.reference.id))
        }
        ret.unshift(...applied)
        this.lastRecentlyUsed$.next(ret)
        return ret;
      }),
      distinctUntilChanged(),
      shareReplay(),
    )
    this.startSubscriptions()
  }

  private startSubscriptions(): void {
    const allTagsQuery = query(collection(this.firestore, this.tagsCollectionPath));
    this.unsubTagCollection = onSnapshot(allTagsQuery, (querySnapshot) => {
      const tags: Promise<Tag>[] = [];
      querySnapshot.forEach((doc) => {
        tags.push(this.TagFromStorage(doc.data() as StoredTag, doc.ref as DocumentReference));
      })
      Promise.all(tags).then(liveTags => {
        this.tagsByName = Object.fromEntries(liveTags.map(t => [t.name, t]))
        this.tagsById = Object.fromEntries(liveTags.map(t => [t.reference.id, t]))
        this.tags$.next(liveTags.sort((a, b) => a.name.localeCompare(b.name)));
        this.tagsCount$.next(liveTags.length);
      })
    })
  }

  ngOnDestroy() {
    this.unsubTagCollection();
  }

  private async TagFromStorage(tag: StoredTag, ref: DocumentReference): Promise<Tag> {
    if ( !( tag?.iv || tag?.keyReference ) ) {
      return {
        'name': this.decoder.decode(tag.name.toUint8Array()),
        'reference': ref,
      } as Tag;
    }
    if ( !this.encryption.enabled() ) {
      return Promise.reject(`Loading tag ${ref.id}: tag is encrypted, but EncryptionService is not enabled.`);
    }
    const name = await this.encryption.Decrypt(
      {'ciphertext': tag.name.toUint8Array(), 'iv': tag.iv!.toUint8Array(), keyReference: tag.keyReference!})
    return {
      'name': this.decoder.decode(name),
      reference: ref
    }
  }

  private async TagToStorage(tag: Tag): Promise<StoredTag> {
    const encodedName = this.encoder.encode(tag.name);
    if ( !this.encryption.enabled() ) {
      return {'name': Bytes.fromUint8Array(encodedName) } as StoredTag;
    }
    const res = await this.encryption.Encrypt(encodedName);
    return {
      'name': Bytes.fromUint8Array(new Uint8Array(res.ciphertext)),
      'iv': Bytes.fromUint8Array(new Uint8Array(res.iv)),
      'keyReference': res.keyReference,
    } as StoredTag;
  }

  /**
   * Calculates document reference based on HMAC of name.
   */
  private async GetTagReference(name: string): Promise<DocumentReference> {
    const cached = this.TagByName(name)?.reference
    if ( cached !== undefined ) {
      return cached;
    }
    const id = await this.hmac.getHmacHex(new Blob([name], {type: 'text/plain'}))
    return doc(this.firestore,  this.tagsCollectionPath, id);
  }

 /**
  * Return a cached tag reference based on a Tag's name.  May incur a miss if the tag subscription has not caught up.
  */
  TagRefByName(name: string): DocumentReference | undefined {
    return this.tagsByName[name]?.reference
  }

 /**
  * Return cached Tag based on its name.  May incur a miss if the tag subscription has not caught up.
  * */
  TagByName(name: string): Tag | undefined {
    return this.tagsByName[name]
  }

  /**
   * Return cached Tag based on its id.  May incur a miss if the tag subscription has not caught up.
   */
  TagById(id: string): Tag | undefined {
    return this.tagsById[id]
  }

 /**
  * Loads a Tag based on its document reference (HMAC'd name)
  */
  async LoadTagByReference(ref: DocumentReference): Promise<Tag> {
    const cached = this.TagById(ref.id)
    if ( cached ) {
      return cached as Tag;
    }
    return new Promise(async (resolve, reject) => {
      return getDoc(ref)
        .then((snapshot: DocumentSnapshot) => {
          if ( snapshot.exists() ) {
            resolve(this.TagFromStorage(snapshot.data() as StoredTag, ref));
          } else {
            const msg = `LoadTagByReference(${ref.id}): not found`
            this.messageService.Error(msg)
            reject(msg);
          }
        })
        .catch((err: Error) => {
          this.messageService.Error(err)
        })
    })
  }

  /**
   * Create a new Tag with the specified name.  Store it in firestore.
   */
  async StoreTag(name: string): Promise<Tag>  {
    return new Promise(async (resolve, reject) => {
      const ref = await this.GetTagReference(name);
      const tag = {name: name, reference: ref} as Tag;
      const toStorage = await this.TagToStorage(tag)
      return setDoc(ref, toStorage)
        .then(()=> {
          this.messageService.Info(`Created tag: ${name}`)
          this.RecordTagUsage([ref])
          resolve(tag)
        })
        .catch((err: Error) => {this.messageService.Error(`Error storing tag ${tag.name}: ${err}`)});
    });
  }

  /**
   * Loads a Tag based on its name.
   */
  async LoadTagByName(name: string): Promise<Tag> {
    const cached = this.TagByName(name);
    if ( cached !== undefined ) {
      this.messageService.Info(`Fetched (cached) tag: ${name}`)
      return cached
    }
    const tagRef = await this.GetTagReference(name)
    return this.LoadTagByReference(tagRef)
  }

  /**
   * Remove this tag from all images that reference it and delete the tag document.
   */
  async DeleteTag(ref: DocumentReference): Promise<void> {
    const q = query(collection(this.firestore, 'images'), where("tags", "array-contains", ref))
    const images = await getDocs(q);
    const batch = writeBatch(this.firestore)
    images.forEach(image => {
        batch.update(image.ref, {'tags': arrayRemove(ref)})
      })
    batch.delete(ref);
    return batch.commit()
  }

  /**
   * Record that tags have been used to affect this.recentTags$
   */
  RecordTagUsage = async (tags: DocumentReference[]): Promise<void> => {
    return Promise.all(tags.map(tag => this.LoadTagByReference(tag)))
      .then(resolved=>this.appliedTags$.next(resolved))
      .catch((err: Error) => {this.messageService.Error(`Error updating tag use: ${err}`)})
  }
}


export class FakeTagService {

  // Tags used most recently.  Contains the entire tags$ output, but in order of use.
  recentTags$: Observable<Tag[]>
  // Complete set of tags known to TagService.  Eventually catches up to Firestore.
  tags$ = new BehaviorSubject<Tag[]>([])
  // Number of tags known to the TagService
  tagsCount$ = new BehaviorSubject<number>(0)
  // Tags applied during the last operation.  Supplied externally.
  appliedTags$ = new BehaviorSubject<Tag[]>([])
  // Previous emission of recentTags$, which allows continuous updates.
  private lastRecentlyUsed$ = new BehaviorSubject<Tag[]>([])

  // Fake tags on which all operations will be carried out.
  private tags: Tag[] = [
    {name: 'tag-1', reference: {id: '1', path: 'tags/1'}} as Tag,
    {name: 'tag-2', reference: {id: '2', path: 'tags/2'}} as Tag,
    {name: 'tag-3', reference: {id: '3', path: 'tags/3'}} as Tag,
  ]
  constructor() {
    this.recentTags$ = this.appliedTags$.pipe(
      withLatestFrom(this.lastRecentlyUsed$.pipe(startWith([])), this.tags$),
      map(([applied, lastEmission, stored]) => {
        const appliedIds = applied.map(t=>t.reference.id)
        let ret: Tag[];
        if ( stored.length > lastEmission.length ) {
          ret = stored.filter(t=> !appliedIds.includes(t.reference.id))
        } else {
          ret = lastEmission.filter(t=> !appliedIds.includes(t.reference.id))
        }
        ret.unshift(...applied)
        this.lastRecentlyUsed$.next(ret)
        return ret;
      }),
      distinctUntilChanged(),
      shareReplay(),
    )
  }

  async StoreTag(name: string): Promise<Tag> {
    const tag = this.tags.filter(t=>t.name === name).pop()
    if ( !tag) {
      this.tags.push({name: name, reference: {id: name, path: `tags/${name}`} as DocumentReference})
    }
    return Promise.reject(`Exists`);
  }

  async LoadTagByReference(ref: DocumentReference): Promise<Tag> {
    const tag = this.tags.filter(t=>t.reference.id === ref.id).pop()
    if ( !tag) {
      return Promise.reject('Not found')
    }
    return tag as Tag;
  }

  async LoadTagByName(name: string): Promise<Tag> {
    const tag = this.tags.filter(t=>t.name === name).pop()
    if ( !tag) {
      return Promise.reject('Not found')
    }
    return tag as Tag;
  }

  async DeleteTag(ref: DocumentReference): Promise<void> {
    this.tags = this.tags.filter(t=> t.reference.id !== ref.id)
  }

}
