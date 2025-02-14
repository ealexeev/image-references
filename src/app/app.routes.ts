import { Routes } from '@angular/router';
import { TagMainComponent } from './tag-main/tag-main.component';
import {TagSelectComponent} from './tag-select/tag-select.component';
import {ImageGalleryComponent} from './image-gallery/image-gallery.component';

export const routes: Routes = [
	{ path: 'tags/:tagName', component: TagMainComponent },
  { path: 'tags', component: TagMainComponent },
  { path: 'select', component: TagSelectComponent },
  { path: 'images/:mode', component: ImageGalleryComponent },
  { path: 'images/:mode/:tagName', component: ImageGalleryComponent },
];
