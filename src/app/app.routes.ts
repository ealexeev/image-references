import { Routes } from '@angular/router';
import { TagMainComponent } from './tag-main/tag-main.component';
import {TagSelectComponent} from './tag-select/tag-select.component';
import {ImageGalleryComponent} from './image-gallery/image-gallery.component';
import {AuthenticatedGuard} from './authenticated.guard';
import {AuthorizedGuard} from './authorized.guard';
import { LoginFormComponent } from './login-form/login-form.component';
import { MessagesComponent } from './messages/messages.component';

export const routes: Routes = [
  {
    path: 'messages',
    component: MessagesComponent,
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'login',
    component: LoginFormComponent,
  },
	{
    path: 'tags/:tagName',
    loadComponent: ()=> import('./tag-main/tag-main.component').then(m=>m.TagMainComponent),
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'tags',
    loadComponent: ()=> import('./tag-main/tag-main.component').then(m=>m.TagMainComponent),
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'images/:mode',
    loadComponent: ()=> import('./image-gallery/image-gallery.component').then(m=>m.ImageGalleryComponent),
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'images/:mode/:tagName',
    loadComponent: ()=> import('./image-gallery/image-gallery.component').then(m=>m.ImageGalleryComponent),
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: 'image/:id',
    loadComponent: () => import('./image-view/image-view.component').then(m=>m.ImageViewComponent),
    canActivate: [AuthenticatedGuard, AuthorizedGuard],
  },
  {
    path: '**',
    redirectTo: 'login',
  }
];
