import {
  Component,
  effect,
  Input,
  WritableSignal,
  signal,
  OnDestroy,
  OnInit,
  inject,
  ViewChild,
  ElementRef,
  computed,
  Signal,
} from '@angular/core';
import {Image, ImageData} from '../../lib/models/image.model';
import {ImageService} from '../image.service';
import {MatInputModule} from '@angular/material/input';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {map, Observable, of, startWith} from 'rxjs';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatIconModule} from '@angular/material/icon';
import {AsyncPipe, Location} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDividerModule} from '@angular/material/divider';
import {Tag, TagService} from '../tag.service';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {DownloadService} from '../download.service';

export interface ImageBundle {
  image: Image
  data: ImageData
}

@Component({
  selector: 'app-image-view',
  standalone: true,
  templateUrl: './image-view.component.html',
  imports: [
    ConfirmationDialogComponent,
    MatDividerModule,
    MatInputModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatIconModule,
    ReactiveFormsModule,
    AsyncPipe,
    MatButtonModule,
    MatTooltipModule
  ],
  styleUrl: './image-view.component.scss'
})
export class ImageViewComponent implements OnInit, OnDestroy {

  private location: Location = inject(Location);
  private imageService: ImageService = inject(ImageService);
  private tagService: TagService = inject(TagService);
  private download: DownloadService = inject(DownloadService);
  private dialog: MatDialog = inject(MatDialog);

  // This is set if we get to a page via a URL, it is static and not sensitive to changes.
  @Input() id?: string;
  // This is provided when used as a hover and this info has already been looked up.
  @Input()
  set imageBundle(b: ImageBundle) {
    this.bundle.set(b)
  }

  private bundle: WritableSignal<ImageBundle|null> = signal(null);
  protected imgURL: WritableSignal<string> = signal('');
  protected imgExtension: WritableSignal<string> = signal('');

  separatorKeysCodes: number[] = [ENTER, COMMA];
  itemCtrl = new FormControl('');
  itemCtrlValue = toSignal(this.itemCtrl.valueChanges);
  filteredItems: Signal<Array<string>> = computed(() => {
    const item = this.itemCtrlValue();
    return item ? this._filter(item) : this.items().slice()
  });
  items = computed(() => this.tagService.tags().map(t => t.name));
  selectedItems: WritableSignal<string[]> = signal([]);
  @ViewChild('itemInput') itemInput!: ElementRef;

  constructor() {
    effect( async () => {
      const newBundle = this.bundle();
      if ( !newBundle) {
        return;
      }
      const b = await newBundle.data.fullSize()
      this.imgURL.set(URL.createObjectURL(b));
      this.imgExtension.set(extFromMime(b.type));
    });

    effect(async ()=>{
      const tagsRefs = this.bundle()?.image.tags;
      if (!tagsRefs) {return}
      const tags = await Promise.all(tagsRefs.map(tRef=>
        this.tagService.LoadTagByReference(tRef)))
      this.selectedItems.set(tags.map(t=>t.name).sort())
    }, {allowSignalWrites: true})
  }

  async ngOnInit(): Promise<void> {
    if (this.id) {
      const sub = this.imageService.SubscribeToImage(this.imageService.GetImageReferenceFromId(this.id))
      sub.results$.subscribe({
        next: async (image: Image) => {
          try {
            const data = await this.imageService.LoadImageData(image.reference.id)
            this.bundle.set({image: image, data: data})
          } catch (e) {
            console.error(`ImageViewComponent OnInit: ${e}`)
          }
        },
        complete: () => {sub.unsubscribe();}
      })
    }
  }

  ngOnDestroy() {
    if (this.imgURL()) {
      URL.revokeObjectURL(this.imgURL());
    }
  }

  createTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (!value || this.addTagIfOnlyOneRemains()) {return}
    this.openCreateTagConfirmation(value);
    event.chipInput!.clear();
    this.itemCtrl.setValue(null);
  }

  openCreateTagConfirmation(tag_name: string) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Create Tag',
        message: `Do you want to create a new tag "${tag_name}"?`,
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedItems.update(items=> {items.push(tag_name); return items});
        this.tagService.StoreTag(tag_name)
          .then((tag: Tag)=>{
            this.imageService.AddTags(this.bundle()!.image.reference, [tag.reference])
              .catch(err => console.error(`AddTags(): ${err}`));
          })
          .catch(err => console.error(`StoreTag(${tag_name}): ${err}`));
      }
    });
  }

  removeTag(item: string): void {
    const index = this.selectedItems().indexOf(item);

    if (index >= 0) {
      this.selectedItems.update(items=>{ items.splice(index, 1); return items});
      this.removeTagFromImage(item);
    }
  }

  private async removeTagFromImage(tagName: string) {
    if (!this.bundle()) { return }
    const tag = await this.tagService.LoadTagByName(tagName);
    this.imageService.RemoveTags( this.bundle()!.image.reference, [tag.reference])
      .catch(e => console.error(`removeTagsFromImage(${tagName}): ${e}`));
  }

  selectTag(event: MatAutocompleteSelectedEvent): void {
    if (this.selectedItems().includes(event.option.viewValue)) {
      this.itemInput.nativeElement.value = '';
      this.itemCtrl.setValue(null);
      return;
    }
    this.selectedItems.update(items=> {items.push(event.option.viewValue); return items});
    this.addTagToImage(event.option.viewValue)
      .catch((err: unknown) => {console.error(`addTagToImage(${event.option.viewValue}): ${err}`)});
    this.itemInput.nativeElement.value = '';
    this.itemCtrl.setValue(null);
  }

  handleTabKey(event: Event): void {
    if (this.addTagIfOnlyOneRemains()) event.preventDefault();
  }

  private addTagIfOnlyOneRemains(): boolean {
    const currentFiltered = this.filteredItems();
    if (currentFiltered && currentFiltered.length === 1) {
      const itemToSelect = currentFiltered[0];
      if (!this.selectedItems().includes(itemToSelect)) {
        this.addTagToImage(itemToSelect)
          .catch((err: unknown) => { console.error(`addTagToImage(${itemToSelect}) on Tab: ${err}`); });

        if (this.itemInput && this.itemInput.nativeElement) {
          this.itemInput.nativeElement.value = '';
        }
        this.itemCtrl.setValue(null);
        return true;
      } 
    }
    return false;
  }

  private async addTagToImage(tagName: string): Promise<void> {
    const bundle = this.bundle();
    if (!bundle) {return}
    const tag = await this.tagService.LoadTagByName(tagName)
    await this.imageService.AddTags(bundle.image.reference, [tag.reference])
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.items().filter((item) =>
      item.toLowerCase().includes(filterValue)
    );
  }

  protected async onDelete() {
    const bundle = this.bundle()
    if (!bundle) {return}
    await this.imageService.DeleteImage(bundle.image.reference)
    this.location.back();
  }

  protected async onDownload() {
    const bundle = this.bundle();
    if (!bundle) {return}
    this.download.download({
      fileName: `${bundle.image.reference.id}.${this.imgExtension()}`,
      maxZipContentFiles: 1,
      strategy: {
       Fetch()  {
         return of([bundle.image]);
      }}
    })
  }

}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
