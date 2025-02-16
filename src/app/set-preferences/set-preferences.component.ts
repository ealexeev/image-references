import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
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
    MatSlideToggleModule,
    MatSliderModule,
    MatFormFieldModule,
    MatOptionModule,
    MatSelectModule,
  ],
  templateUrl: './set-preferences.component.html',
  styleUrl: './set-preferences.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPreferencesComponent {
  preferences: PreferenceService = inject(PreferenceService);
  options = ["All", 5, 10, 25, 50, 100, 500];

  onSelectionChange(change: MatSelectChange) {
    let v: number = Number(change.value);
    if ( !v ) {
      v = -1
    }
    this.preferences.showImageCount$.next(change.value);
  }

  getInitialSelection() {
    const current = this.preferences.showImageCount$.value;
    return current > 0 ? current : "All";
  }
}
