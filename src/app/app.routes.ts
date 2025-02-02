import { Routes } from '@angular/router';
import { TagMainComponent } from './tag-main/tag-main.component';

export const routes: Routes = [
	{ path: 'tags/:tagName', component: TagMainComponent },
];
