import {inject, Injectable} from '@angular/core';
import {Firestore} from '@angular/fire/firestore';
import {MessageService} from './message.service';

@Injectable({
  providedIn: 'root'
})
export class ImageService {

  private firestore: Firestore = inject(Firestore);
  private message: MessageService = inject(MessageService);

  constructor() { }
}
