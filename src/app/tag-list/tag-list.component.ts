import { Component, OnInit } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { LiveTag, StorageService } from '../storage.service';
import { Observable } from 'rxjs';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';


@Component({
  selector: 'app-tag-list',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
  ],
  templateUrl: './tag-list.component.html',
  styleUrl: './tag-list.component.scss'
})
export class TagListComponent implements OnInit{
  tags$: Observable<LiveTag[]>;

  constructor(private storage: StorageService) {
    this.tags$ = this.storage.tags$.asObservable();
  }

  ngOnInit() {
    this.storage.LoadAllTags();
  }
}
