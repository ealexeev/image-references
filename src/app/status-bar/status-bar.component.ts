import {Component, computed, Signal, signal, WritableSignal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';

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
  messages: Array<string> = [
    'first message',
    'second message',
    'third message',
    'last message'
  ];

  msgCount: WritableSignal<number>
  msgIndex: WritableSignal<number>

  disableNext: Signal<boolean> = computed(()=> this.msgIndex() <= 0)
  disablePrevious: Signal<boolean> = computed(()=> this.msgIndex() + 1 >= this.msgCount());
  disableLatest: Signal<boolean> = computed(()=> this.msgIndex() == 0);

  constructor() {
    this.msgCount = signal(this.messages.length);
    this.msgIndex = signal(0);
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
