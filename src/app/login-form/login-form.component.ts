import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from '@angular/core';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {ActivatedRoute, Router} from '@angular/router';
import {environment} from '../environments/environment.prod';
import {A11yModule} from '@angular/cdk/a11y';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    A11yModule
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent implements OnInit {
  private auth = inject(Auth);
  private router: Router = inject(Router);
  private route: ActivatedRoute = inject(ActivatedRoute);

  email = '';
  password = '';
  hide = signal(true);
  error_text = signal('');

  doLogin() {
    signInWithEmailAndPassword(this.auth, this.email, this.password)
      .then(()=> {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] ?? '/tags'
        this.router.navigateByUrl(returnUrl)
      })
      .catch((error) => {this.error_text.set(error.message)});
  }

  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  onKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.doLogin();
    }
  }

  ngOnInit() {
    this.auth.authStateReady()
      .then(() => {
        if (this.auth.currentUser || !environment.authRequired) {
          this.router.navigateByUrl(this.route.snapshot.queryParams['returnUrl'] ?? '/')
        }
      })
  }

}
