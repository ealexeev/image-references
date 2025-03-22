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
  ElementRef, Renderer2
} from '@angular/core';
import {Image, ImageData} from '../../lib/models/image.model';
import {ImageService} from '../image.service';
import {MatInputModule} from '@angular/material/input';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {map, Observable, startWith} from 'rxjs';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatIconModule} from '@angular/material/icon';
import {AsyncPipe, Location} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDividerModule} from '@angular/material/divider';

export interface ImageBundle {
  image: Image
  data: ImageData
}

@Component({
  selector: 'app-image-view',
  standalone: true,
  templateUrl: './image-view.component.html',
  imports: [
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

  private renderer: Renderer2 = inject(Renderer2);
  private location: Location = inject(Location);
  private imageService: ImageService = inject(ImageService);

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
  filteredItems: Observable<string[]>;
  items: string[] = ['Apple', 'Banana', 'Orange', 'Grapes'];
  selectedItems: string[] = ['Apple'];
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

    this.filteredItems = this.itemCtrl.valueChanges.pipe(
      startWith(null),
      map((item: string | null) =>
        item ? this._filter(item) : this.items.slice()
      )
    );
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

  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      this.selectedItems.push(value);
    }

    event.chipInput!.clear();
    this.itemCtrl.setValue(null);
  }

  removeTag(item: string): void {
    const index = this.selectedItems.indexOf(item);

    if (index >= 0) {
      this.selectedItems.splice(index, 1);
    }
  }

  select(event: MatAutocompleteSelectedEvent): void {
    this.selectedItems.push(event.option.viewValue);
    this.itemInput.nativeElement.value = '';
    this.itemCtrl.setValue(null);
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.items.filter((item) =>
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
    const link = this.renderer.createElement('a');
    link.setAttribute('target', '_blank');
    link.setAttribute('href', this.imgURL());
    link.setAttribute('download', `${bundle.image.reference.id}.${this.imgExtension()}`);
    link.click();
    link.remove();
  }

}

function extFromMime(mimeType: string): string {
  return mimeType.slice('image/'.length)
}
