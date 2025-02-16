import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSelectComponent } from './tag-select.component';
import {BehaviorSubject} from 'rxjs';
import {LiveTag, StorageService} from '../storage.service';
import {DocumentReference} from '@angular/fire/firestore';
import {provideAnimations} from '@angular/platform-browser/animations';

describe('TagSelectComponent', () => {
  let component: TagSelectComponent;
  let fixture: ComponentFixture<TagSelectComponent>;
  let FakeStorageService: any;

  beforeEach(async () => {
    FakeStorageService = new FakeStorage();
    await TestBed.configureTestingModule({
      imports: [TagSelectComponent],
      providers: [
        provideAnimations(),
        { provide: StorageService, useValue: FakeStorageService },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagSelectComponent);
    TestBed.inject(StorageService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

class FakeStorage {
  recentTags$: BehaviorSubject<LiveTag[]> = new BehaviorSubject([{name:"test-tag", reference: {id: "123"} as DocumentReference}]);
}
