import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
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
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] ?? 'tags'
        this.router.navigate([returnUrl])
      })
      .catch((error) => {this.error_text.set(error.message)});
  }

  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }
  
}
