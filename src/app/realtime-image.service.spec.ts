import { TestBed } from '@angular/core/testing';
import { RealtimeImageService } from './realtime-image.service';
import { DefaultProviders } from './test-providers';
import { DocumentReference, CollectionReference } from '@angular/fire/firestore';

fdescribe('RealtimeImageService', () => {
  let providers: DefaultProviders;
  let service: RealtimeImageService;

  beforeEach(() => {
    providers = new DefaultProviders();
    providers.FirestoreWrapperService.collection.and.returnValue({path: 'images'} as CollectionReference);
    TestBed.configureTestingModule({
      providers: providers.getProviders(),
    });
    service = TestBed.inject(RealtimeImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('SubscribeToImageData', () => {
    it('should use FirestoreWrapperService for document operations', () => {
      // Arrange
      const imageId = 'test-image-id';
      providers.FirestoreWrapperService.doc.and.returnValue({} as DocumentReference);

      // Act
      service.SubscribeToImageData(imageId);

      // Assert
      expect(providers.FirestoreWrapperService.doc).toHaveBeenCalledWith(
        providers.FirestoreWrapperService.instance,
        'images',
        imageId,
        'data',
        'thumbnail'
      );
    });
  });
});

