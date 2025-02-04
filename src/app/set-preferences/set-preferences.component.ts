import {Component, inject} from '@angular/core';
import {PreferenceService} from '../preference-service';
import {AsyncPipe} from '@angular/common';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSliderModule} from '@angular/material/slider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatOptionModule} from '@angular/material/core';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';

@Component({
  selector: 'app-set-preferences',
  standalone: true,
  imports: [
    AsyncPipe,
    MatSlideToggleModule,
    MatSliderModule,
    MatFormFieldModule,
    MatOptionModule,
    MatSelectModule,
  ],
  templateUrl: './set-preferences.component.html',
  styleUrl: './set-preferences.component.scss'
})
export class SetPreferencesComponent {
  preferences: PreferenceService = inject(PreferenceService);
  counts: number[] = [5, 10, 25, 50, 100, 500];

  onShowAllToggleChange() {
    this.preferences.showAllImages$.next(!this.preferences.showAllImages$.value);
  }

  onSelectionChange(change: MatSelectChange) {
    this.preferences.showImageCount$.next(change.value);
  }
}
