import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { TagListComponent } from '../tag-list/tag-list.component';
import { BehaviorSubject } from 'rxjs';

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
  styleUrl: './tag-main.component.scss'
})
export class TagMainComponent {
  selectedTag$: BehaviorSubject<string> = new BehaviorSubject('robot');

  onTagSelection(tagName: string) {
    this.selectedTag$.next(tagName);
  }
}
