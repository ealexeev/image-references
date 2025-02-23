import {Component, inject, OnInit} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import { Auth, User, signOut } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import {SetPreferencesComponent} from './set-preferences/set-preferences.component';
import {EncryptionService, State as EncryptionState} from './encryption.service';
import {AsyncPipe} from '@angular/common';
import {StatusBarComponent} from './status-bar/status-bar.component';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {ImageService} from './image.service';
import {TagService} from './tag.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AsyncPipe,
    SetPreferencesComponent,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    StatusBarComponent,
    MatTooltipModule,
    MatButtonToggleModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss', '../_variables.scss'],
})
export class AppComponent implements OnInit {
  readonly auth = inject(Auth);
  readonly dialog = inject(MatDialog);
  readonly encryption: EncryptionService = inject(EncryptionService);
  readonly tagService = inject(TagService);
  readonly imageService = inject(ImageService);
  readonly router = inject(Router);

  constructor() {
    this.imageService.RegisterTagUpdateCallback(this.tagService.RecordTagUsage)
  }

  ngOnInit() {
    this.encryption.Enable('***REDACTED***')
  }

  doLogOut() {
    signOut(this.auth).catch(err => console.error(err));
    this.router.navigateByUrl('/login');
  }

  protected readonly EncryptionState = EncryptionState;
}
