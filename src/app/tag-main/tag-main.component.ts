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
  constructor(private _location: Location){ }

  @Input() tagName: string = '';

  ngOnInit(): void {
    if (this.tagName) { this.selectedTag$.next(this.tagName); }
  }

  selectedTag$: BehaviorSubject<string> = new BehaviorSubject('');

  onTagSelection(tagName: string) {
    this.selectedTag$.next(tagName);
    this._location.go('/tags/' +tagName);
  }
}
