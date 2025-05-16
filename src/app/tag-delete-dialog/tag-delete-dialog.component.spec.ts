import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagDeleteDialogComponent } from './tag-delete-dialog.component';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

describe('TagDeleteDialogComponent', () => {
  let component: TagDeleteDialogComponent;
  let fixture: ComponentFixture<TagDeleteDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {tag: 'test', newName: 'test-2'}},
      ],
      imports: [TagDeleteDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagDeleteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
