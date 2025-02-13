import {Component, computed, inject, Input, Signal, signal, WritableSignal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {Message, MessageService} from '../message.service';
import {interval} from 'rxjs';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss'
})
export class StatusBarComponent {
  // Max number of messages to keep in memory.
  @Input() max: number = 500;

  messages: Array<string> = [];
  queue: Array<Message> = []

  private messageService: MessageService = inject(MessageService)

  msgCount: WritableSignal<number>
  msgIndex: WritableSignal<number>

  disableNext: Signal<boolean> = computed(()=> this.msgIndex() <= 0)
  disablePrevious: Signal<boolean> = computed(()=> this.msgIndex() + 1 >= this.msgCount());
  disableLatest: Signal<boolean> = computed(()=> this.msgIndex() == 0);

  constructor() {
    this.msgCount = signal(this.messages.length);
    this.msgIndex = signal(0);
    this.messageService.messages$.subscribe(
      (message: Message) => {
        if ( this.queue.length < this.max ) {
          this.queue.unshift(message);
        } else {
          console.error(`Status bar queue exceeds ${this.max}}`)
        }
      }
    )
    interval(1000).subscribe(() => {
        const next = this.queue.pop()
        if (next) {
          this.messages.unshift(next.message)
          this.msgCount.set(this.messages.length)
        }
    })
  }

  showLatestMessage() {
    this.msgIndex.set(0)
  }

  showNextMessage() {
    this.msgIndex.update(n=> n > 0 ? n-1: n);
  }

  showPreviousMessage() {
    this.msgIndex.update(n=> n+1 < this.messages.length ? n+1: n)
  }
}
