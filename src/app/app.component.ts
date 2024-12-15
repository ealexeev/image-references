import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth, authState, User, signOut } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { Subscription } from 'rxjs';

import { LoginFormComponent } from './login-form/login-form.component';
import { CryptographyService } from './cryptography.service';

// Don't show UI to users with a UID other than this.  Storage and Firebase APIs are also gated by this requirement.
const permittedUid = "***REDACTED UID***";
const authRequired = false;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterOutlet,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  private auth = inject(Auth);
  readonly dialog = inject(MatDialog);
  readonly crypto = inject(CryptographyService);
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
}
