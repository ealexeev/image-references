import {Component, computed, inject, Input, Signal, signal, WritableSignal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {Message, MessageService} from '../message.service';
import {interval} from 'rxjs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AsyncPipe} from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './status-bar.component.html',
  styleUrls: [
    './status-bar.component.scss',
    '../../_variables.scss'
  ],
})
export class StatusBarComponent {
  private router = inject(Router);

  // Max number of messages to keep in memory.
  @Input() max: number = 500;

  messages: Array<Message> = [];
  queue: Array<Message> = []

  messageService: MessageService = inject(MessageService)

  msgCount: WritableSignal<number>
  msgIndex: WritableSignal<number>

  disableNext: Signal<boolean> = computed(()=> this.msgIndex() <= 0)
  disablePrevious: Signal<boolean> = computed(()=> this.msgIndex() + 1 >= this.msgCount());
  disableLatest: Signal<boolean> = computed(()=> this.msgIndex() == 0);

  constructor() {
    this.msgCount = signal(this.messages.length);
    this.msgIndex = signal(0);
    this.messageService.messages$.pipe(
      takeUntilDestroyed()
    ).subscribe(
      (message: Message) => {
        this.queue.push(message);
        this.queue = this.queue.slice(-this.max).reverse();
      }
    )
    interval(500).subscribe(() => {
        const next = this.queue.pop()
        if (next) {
          this.messages.unshift(next)
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

  statusOk(): boolean {
    return this.messages.every((message) => message.type != 'error')
  }

  clearMessages() {
    this.queue = [];
    this.messages = [];
    this.msgCount.set(0);
    this.msgIndex.set(0);
  }

  messageLog() {
    this.router.navigateByUrl('/messages')
  }
}
