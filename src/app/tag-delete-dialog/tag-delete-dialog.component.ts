import {Component, inject, Inject, model, ModelSignal, signal} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatInputModule} from '@angular/material/input';
import {FormsModule} from '@angular/forms';

export interface DialogData {
  tag: string;
  newName: string;
}

@Component({
  selector: 'app-tag-delete-dialog',
  standalone: true,
  imports: [
    MatDialogActions,
    MatDialogTitle,
    MatDialogClose,
    MatButtonModule,
    MatDialogContent,
    MatSlideToggleModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './tag-delete-dialog.component.html',
  styleUrl: './tag-delete-dialog.component.scss'
})
export class TagDeleteDialogComponent {
  protected rename = signal(false);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  readonly newName = model(this.data.newName);

  toggle() {
    this.rename.update(v=> !v);
  }
}
