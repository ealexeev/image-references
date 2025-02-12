import { Routes } from '@angular/router';
import { TagMainComponent } from './tag-main/tag-main.component';
import {TagSelectComponent} from './tag-select/tag-select.component';
import {LatestImagesComponent} from './latest-images/latest-images.component';

export const routes: Routes = [
	{ path: 'tags/:tagName', component: TagMainComponent },
  { path: 'tags', component: TagMainComponent },
  { path: 'select', component: TagSelectComponent },
  { path: 'latest', component: LatestImagesComponent },
];
