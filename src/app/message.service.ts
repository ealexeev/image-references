import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {BehaviorSubject, mergeWith, Observable, scan, Subject} from 'rxjs';

export type Message = {
  type: "error" | "info"
  message: string;
  timestamp: Date;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private info$: Subject<Message> = new Subject<Message>();
  private error$: Subject<Message> = new Subject<Message>();
  messages$: Observable<Message>;
  stats$: BehaviorSubject<string> = new BehaviorSubject<string>('Nothing to report');
  messageLog$: BehaviorSubject<Message[]> = new BehaviorSubject<Message[]>([]);  
  private _messages: Message[] = [];
  

  constructor() {
    this.messages$ = this.info$.pipe(
      mergeWith(this.error$)
    )
    this.messages$.pipe(
      takeUntilDestroyed(),
      scan((acc, msg) => {
        if (acc.length && acc[acc.length - 1].type == msg.type && acc[acc.length - 1].message == msg.message) {
          acc[acc.length - 1].count+=1;
          return acc;
        }
        return [...acc, msg];
      }, [] as Message[])
    ).subscribe(messages => {
      this._messages = messages.slice(-100).reverse();
      this.messageLog$.next(this._messages);
    })
  }

  Error(err: Error|string): void {
    const msg = err instanceof Error ? `${(err as Error).name || 'Error class'}: ${(err as Error).message || 'Error message'}` : err
    this.error$.next({type: "error", message: msg as string, timestamp: new Date(), count: 1});
  }

  Info(msg :string): void {
    this.info$.next({type: "info", message: msg, timestamp: new Date(), count: 1});
  }

}
