import { Component, inject, OnDestroy, Signal, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth, authState, User, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';

// Don't show UI to users with a UID other than this.  Storage and Firebase APIs are also gated by this requirement.
const permittedUid = "***REDACTED UID***";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  private auth = inject(Auth);
  authState$ = authState(this.auth);
  authStateSubscription: Subscription;
  user: User|null = null;
  username = '';
  password = '';

  hide = signal(true);
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  constructor() {
    this.authStateSubscription = this.authState$.subscribe(( aUser: User | null) => {
      this.user = aUser;
    });
  }

  ngOnDestroy() {
    this.authStateSubscription.unsubscribe();
  }

  getUserInfo(): string {
    return JSON.stringify(this.user || {});
  }

  doLogin() {
    signInWithEmailAndPassword(this.auth, this.username, this.password);
  }

  doLogOut() {
    signOut(this.auth);
  }

  title = 'prestige-ape-references';
}
