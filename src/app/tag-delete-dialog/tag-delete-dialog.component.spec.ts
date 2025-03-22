import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagDeleteDialogComponent } from './tag-delete-dialog.component';

describe('TagDeleteDialogComponent', () => {
  let component: TagDeleteDialogComponent;
  let fixture: ComponentFixture<TagDeleteDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
