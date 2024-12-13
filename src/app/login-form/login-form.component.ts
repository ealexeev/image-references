import { Component, inject, signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, connectAuthEmulator } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss'
})
export class LoginFormComponent {
  private auth = inject(Auth);

  // Remove eventually
  constructor() {
    connectAuthEmulator(this.auth, "http://127.0.0.1:9099");
  }

  readonly dialogRef = inject(MatDialogRef<LoginFormComponent>);
  email = '';
  password = '';
  hide = signal(true);
  error_text = signal('');

  doLogin() {
    signInWithEmailAndPassword(this.auth, this.email, this.password).then(
      (something) => {
        console.log(`signInWithEmailAndPassword returned: ${JSON.stringify(something)}`);
        this.dialogRef.close();
      },
      (error) => {this.error_text.set(error.message);});
  }
  
  clickEvent(event: MouseEvent) {
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  icon(): string {
    return this.hide() ? 'visibility': 'visibility_off';
  }
}
