import {Component, inject, OnInit} from '@angular/core';
import { EncryptionDialogComponent } from './encryption-dialog/encryption-dialog.component';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import {SetPreferencesComponent} from './set-preferences/set-preferences.component';
import {EncryptionService, State as EncryptionState} from './encryption.service';
import {StatusBarComponent} from './status-bar/status-bar.component';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {ImageService} from './image.service';
import {TagService} from './tag.service';
import { ImageTagService } from './image-tag.service';
import { MessageService } from './message.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
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
  readonly encryption = inject(EncryptionService);
  readonly tagService = inject(TagService);
  readonly imageService = inject(ImageService);
  readonly imageTagService = inject(ImageTagService);
  readonly router = inject(Router);
  readonly messageService = inject(MessageService);

  toggleEncryption() {
    if (this.encryption.state() === EncryptionState.Ready) {
      this.encryption.Disable();
    } else {
      const dialogRef = this.dialog.open(EncryptionDialogComponent);
      dialogRef.afterClosed().subscribe(passphrase => {
        if (passphrase) {
          this.encryption.Enable(passphrase);
        }
      });
    }
  }

  ngOnInit() {
    this.messageService.Info('App started')
  }

  doLogOut() {
    signOut(this.auth).catch(err => console.error(err));
    this.router.navigateByUrl('/login');
  }

  protected readonly EncryptionState = EncryptionState;
}
