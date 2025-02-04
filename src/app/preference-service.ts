import { Injectable } from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PreferenceService {

  showAllImages$  = new BehaviorSubject(true);
  showImageCount$ = new BehaviorSubject(10);
}
