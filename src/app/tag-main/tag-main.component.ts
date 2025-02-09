import { CommonModule, Location } from '@angular/common';

import {Component, Input, OnInit} from '@angular/core';
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
export class TagMainComponent implements OnInit {
  @Input() tagName: string = ''

  selectedTag$: BehaviorSubject<string> = new BehaviorSubject('');

  constructor(private _location: Location){ }

  ngOnInit(): void {
    if (this.tagName) { this.selectedTag$.next(this.tagName); }
  }

    onTagSelection(tagName: string) {
    this.selectedTag$.next(tagName);
    this._location.go('/tags/' +tagName);
  }
}
