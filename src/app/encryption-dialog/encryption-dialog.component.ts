import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-encryption-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule
  ],
  templateUrl: './encryption-dialog.component.html',
  styleUrl: './encryption-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EncryptionDialogComponent {
  passphrase = '';

  constructor(public dialogRef: MatDialogRef<EncryptionDialogComponent>) {}
}
