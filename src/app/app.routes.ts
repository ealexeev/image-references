import { Routes } from '@angular/router';
import { TagMainComponent } from './tag-main/tag-main.component';
import {TagSelectComponent} from './tag-select/tag-select.component';
import {ImageGalleryComponent} from './image-gallery/image-gallery.component';
import {AuthenticatedGuard} from './authenticated.guard';
import {AuthorizedGuard} from './authorized.guard';
import {LoginFormComponent} from './login-form/login-form.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginFormComponent,
  },
	{
    path: 'tags/:tagName',
    component: TagMainComponent,
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'tags',
    component: TagMainComponent,
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'images/:mode',
    component: ImageGalleryComponent,
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'images/:mode/:tagName',
    component: ImageGalleryComponent,
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
];
