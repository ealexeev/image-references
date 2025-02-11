import { CommonModule, Location } from '@angular/common';

import {Component, Input, OnChanges, OnInit, signal, WritableSignal} from '@angular/core';
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
  @Input()
  set tagName(value: string) {
    this.selectedTag.set(value)
  }

  selectedTag: WritableSignal<string> = signal('');

  constructor(private _location: Location){ }

  // I think this i the problem.  The location alo srive the tagName input.
  onTagSelection(tagName: string) {
    this.selectedTag.set(tagName);
    this._location.go('/tags/' +tagName);
  }
}
