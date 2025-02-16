import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import { Auth, authState, User, signOut } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { Subscription } from 'rxjs';

import { LoginFormComponent } from './login-form/login-form.component';
import {SetPreferencesComponent} from './set-preferences/set-preferences.component';
import {EncryptionService, State as EncryptionState} from './encryption.service';
import {AsyncPipe} from '@angular/common';
import {StatusBarComponent} from './status-bar/status-bar.component';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

// Don't show UI to users with a UID other than this.  Storage and Firebase APIs are also gated by this requirement.
const permittedUid = "***REDACTED UID***";
const authRequired = false;

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
export class AppComponent implements OnInit, OnDestroy {
  private auth = inject(Auth);
  readonly dialog = inject(MatDialog);
  readonly encryption: EncryptionService = inject(EncryptionService);
  readonly router = inject(Router);
  authState$ = authState(this.auth);
  authStateSubscription: Subscription;
  user: User|null = null;
  username = '';
  password = '';
  passphrase = '';

  constructor() {
    this.authStateSubscription = this.authState$.subscribe(( aUser: User | null) => {
      this.user = aUser;
      if ( this.user == null && authRequired ) {
        this.dialog.open(LoginFormComponent, {disableClose: true});
      }
    });
  }

  ngOnInit() {
    this.encryption.Enable('***REDACTED***')
  }

  ngOnDestroy() {
    this.authStateSubscription.unsubscribe();
  }

  getUserInfo(): string {
    return JSON.stringify(this.user || {});
  }

  doLogOut() {
    signOut(this.auth);
  }

  title = 'prestige-ape-references';
  protected readonly EncryptionState = EncryptionState;
}
