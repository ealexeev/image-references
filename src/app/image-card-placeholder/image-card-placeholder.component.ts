import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCard, MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EncryptionService, State } from '../encryption.service';

@Component({
  selector: 'app-image-card-placeholder',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './image-card-placeholder.component.html',
  styleUrl: './image-card-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCardPlaceholderComponent {
  protected encryptionService = inject(EncryptionService);
  protected encryptionState = State;
}
