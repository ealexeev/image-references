import { CommonModule, Location } from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  signal,
  WritableSignal
} from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { TagListComponent } from '../tag-list/tag-list.component';

@Component({
  selector: 'app-tag-main',
  standalone: true,
  imports: [
    CommonModule,
    ImageGalleryComponent,
    MatSidenavModule,
    TagListComponent,
  ],
  templateUrl: './tag-main.component.html',
  styleUrl: './tag-main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagMainComponent {
  @Input()
  set tagName(value: string) {
    if ( value !== this.selectedTag() ) {
      this.selectedTag.set(value)
    }
  }

  private location = inject(Location);

  selectedTag: WritableSignal<string> = signal('');

  constructor(){ }

  onTagSelection(tagName: string) {
    this.selectedTag.set(tagName);
    this.location.go('/tags/' +tagName);
  }
}
