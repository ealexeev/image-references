import { TestBed } from '@angular/core/testing';
import { ImageTagService } from './image-tag.service';
import { Tag } from './tag.service';
import { FirestoreWrapperService } from './firestore-wrapper.service';
import { MessageService } from './message.service';
import { DefaultProviders } from './test-providers';

fdescribe('ImageTagService', () => {
  let providers: DefaultProviders;
  let service: ImageTagService;
  let mockDocRef: any;
  let tag: Tag;
  let mockUpdateDoc: jasmine.Spy<() => Promise<void>>;
  let mockInfo: jasmine.Spy<(message: string) => void>;
  let mockError: jasmine.Spy<(message: string) => void>;

  beforeEach(() => {
    providers = new DefaultProviders();
    TestBed.configureTestingModule({
      providers: providers.getProviders({include: [FirestoreWrapperService, MessageService]}),
    }).compileComponents();
    service = TestBed.inject(ImageTagService);

    // Mock DocumentReference
    mockDocRef = { id: 'img1' };
    // Mock Tag
    tag = { name: 'tag1', reference: { id: 'tag1ref' } } as Tag;
    
    mockUpdateDoc = providers.FirestoreWrapperService.updateDoc;
    mockInfo = providers.MessageService.Info;
    mockError = providers.MessageService.Error;
  });

  afterEach(() => {
    mockUpdateDoc.calls.reset();
    mockInfo.calls.reset();
    mockError.calls.reset();
  });

  it('should add tags and log operation', async () => {
    await service.AddTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('Added 1 tag(s) to image img1');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Add', tags: [tag] }));
  });

  it('should handle add tags error', async () => {
    mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.AddTags(mockDocRef, [tag]);
    expect(mockError).toHaveBeenCalledWith('Error adding tags to image img1: fail');
  });

  it('should remove tags and log operation', async () => {
    await service.RemoveTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('Removed 1 tag(s) from image img1');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Remove', tags: [tag] }));
  });

  it('should handle remove tags error', async () => {
    mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.RemoveTags(mockDocRef, [tag]);
    expect(mockError).toHaveBeenCalledWith('Error removing tags from image img1: fail');
  });

  it('should replace tags and log operation', async () => {
    await service.ReplaceTags(mockDocRef, [tag]);
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('Replaced tags on image img1 (1 tag(s))');
    expect(service.recentOperations()[0]).toEqual(jasmine.objectContaining({ type: 'Replace', tags: [tag] }));
  });

  it('should handle replace tags error', async () => {
    mockUpdateDoc.and.callFake(() => Promise.reject('fail'));
    await service.ReplaceTags(mockDocRef, [tag]);
    expect(mockError).toHaveBeenCalledWith('Error replacing tags on image img1: fail');
  });

  it('should keep only the 5 most recent operations', async () => {
    for (let i = 0; i < 7; i++) {
      await service.AddTags(mockDocRef, [tag]);
    }
    expect(service.recentOperations().length).toBe(5);
  });
});
