import { TestBed } from '@angular/core/testing';
import { ImageTagService } from './image-tag.service';
import { Tag } from './tag.service';
import { MessageService } from './message.service';
import { MockMessageService } from './test-providers';
import { getDefaultProviders } from './test-providers';

fdescribe('ImageTagService', () => {
  let service: ImageTagService;
  let message: MockMessageService;
  let mockDocRef: any;
  let tag: Tag;
  let mockUpdateDoc: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: getDefaultProviders(),
    }).compileComponents();
    service = TestBed.inject(ImageTagService);
    message = TestBed.inject(MessageService) as any;

    // Mock DocumentReference
    mockDocRef = { id: 'img1' };
    // Mock Tag
    tag = { name: 'tag1', reference: { id: 'tag1ref' } } as Tag;
    mockUpdateDoc = spyOn(service, 'updateDoc');
  });

  afterEach(() => {
    mockUpdateDoc.calls.reset();
    message.Info.calls.reset();
    message.Error.calls.reset();
  });

  it('should add tags and log operation', async () => {
    await service.AddTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(message.Info).toHaveBeenCalledWith('Added 1 tag(s) to image img1');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Add', tags: [tag] }));
  });

  it('should handle add tags error', async () => {
    mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.AddTags(mockDocRef, [tag]);
    expect(message.Error).toHaveBeenCalledWith('Error adding tags to image img1: fail');
  });

  it('should remove tags and log operation', async () => {
    await service.RemoveTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(message.Info).toHaveBeenCalledWith('Removed 1 tag(s) from image img1');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Remove', tags: [tag] }));
  });

  it('should handle remove tags error', async () => {
      mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.RemoveTags(mockDocRef, [tag]);
    expect(message.Error).toHaveBeenCalledWith('Error removing tags from image img1: fail');
  });

  it('should replace tags and log operation', async () => {
    await service.ReplaceTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(message.Info).toHaveBeenCalledWith('Replaced tags on image img1 (1 tag(s))');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Replace', tags: [tag] }));
  });

  it('should handle replace tags error', async () => {
    mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.ReplaceTags(mockDocRef, [tag]);
    expect(message.Error).toHaveBeenCalledWith('Error replacing tags on image img1: fail');
  });

  it('should keep only the 5 most recent operations', async () => {
    for (let i = 0; i < 7; i++) {
      await service.AddTags(mockDocRef, [tag]);
    }
    expect(service.recentOperations().length).toBe(5);
  });
});
