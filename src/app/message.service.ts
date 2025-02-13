import { Injectable } from '@angular/core';
import {mergeWith, Observable, Subject} from 'rxjs';

export type Message = {
  type: "error" | "info"
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private info$: Subject<Message> = new Subject<Message>();
  private error$: Subject<Message> = new Subject<Message>();
  messages$: Observable<Message>;

  constructor() {
    this.messages$ = this.info$.pipe(
      mergeWith(this.error$)
    )
  }

  Error(err: Error|string): void {
    const msg = err instanceof Error ? `${(err as Error).name || 'Error class'}: ${(err as Error).message || 'Error message'}` : err
    this.error$.next({type: "error", message: msg as string});
  }

  Info(msg :string): void {
    this.info$.next({type: "info", message: msg});
  }
}
