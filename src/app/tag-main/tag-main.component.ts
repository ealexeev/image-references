import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';

import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';

@Component({
  selector: 'app-tag-main',
  standalone: true,
  imports: [
    ImageGalleryComponent,
    MatSidenavModule,
  ],
  templateUrl: './tag-main.component.html',
  styleUrl: './tag-main.component.scss'
})
export class TagMainComponent {

}
