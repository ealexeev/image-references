import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { MatButtonHarness } from '@angular/material/button/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HarnessLoader } from '@angular/cdk/testing';

import { ImageCardComponent } from './image-card.component';
import { DocumentReference } from '@angular/fire/firestore';
import { Image } from '../../lib/models/image.model';
import { DefaultProviders } from '../test-providers';

describe('ImageCardComponent', () => {
  let component: ImageCardComponent;
  let loader: HarnessLoader;
  let fixture: ComponentFixture<ImageCardComponent>;
  let imageSource: Image;
  let providers: DefaultProviders

  beforeEach(async () => {
    providers = new DefaultProviders();
    imageSource = {
      reference: { id: "1" } as DocumentReference,
      tags: [] as DocumentReference[],
    } as Image;

    await TestBed.configureTestingModule({
      imports: [ImageCardComponent, NoopAnimationsModule],
      providers: providers.getProviders(),
    })
      .compileComponents();

    fixture = TestBed.createComponent(ImageCardComponent);
    component = fixture.componentInstance;
    component.imageSource = imageSource;
    fixture.detectChanges();
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have imageSource assigned', () => {
    expect(component.imageSource).toEqual(imageSource);
  });

  it('should emit imageDeleted event with image id when delete button is clicked', async () => {
    spyOn(component.imageDeleted, 'emit');
    const deleteButton = await loader.getHarness(MatButtonHarness.with({ selector: '[mattooltip="Delete this image"]' }));
    await deleteButton.click();
    expect(component.imageDeleted.emit).toHaveBeenCalledWith(imageSource.reference.id);
  });

  it('should call DownloadService.download when download button is clicked', async () => {
    component.fullUrlAvailable.set(true);
    fixture.detectChanges();
    const downloadButton = await loader.getHarness(MatButtonHarness.with({ selector: '[mattooltip="Download this image"]' }));
    await downloadButton.click();
    expect(providers.DownloadService.download).toHaveBeenCalledWith({
      fileName: imageSource.reference.id,
      maxZipContentFiles: 1,
      strategy: jasmine.any(Object)
    });
  });

  it('should call ImageTagService.performLastOperation when "Add last operation" button is clicked', async () => {

    (providers.ImageTagService.recentOperations as unknown as WritableSignal<any[]>).set([{ type: 'add', tags: [{ name: 'testtag' }] }]);
    fixture.detectChanges();
    const addLastButton = await loader.getHarness(MatButtonHarness.with({ selector: 'button[mattooltipclass="multiline-tooltip"]' }));
    await addLastButton.click();

    expect(providers.ImageTagService.performLastOperation).toHaveBeenCalledWith(component.imageSource.reference);
  });

  it('should navigate to full image view when "Show full size" button is clicked', async () => {
    const fullSizeButton = await loader.getHarness(MatButtonHarness.with({ selector: '[mattooltip="Show full size"]' }));
    await fullSizeButton.click();
    expect(providers.Router.navigateByUrl).toHaveBeenCalledWith(`/image/${imageSource.reference.id}`);
  });

  it('should call ImageTagService.performLastOperation when "Add last operation" button is clicked', async () => {
    (providers.ImageTagService.recentOperations as WritableSignal<any[]>).set([{ type: 'add', tags: [{ name: 'testtag' }] }]);
    fixture.detectChanges();
    const addLastButton = await loader.getHarness(MatButtonHarness.with({ selector: 'button[mattooltipclass="multiline-tooltip"]' }));
    await addLastButton.click();

    expect(providers.ImageTagService.performLastOperation).toHaveBeenCalledWith(component.imageSource.reference);
  });

  describe('updateSelected', () => {
    it('should emit imageSelectedChange and call addToScope$ when selected is true', () => {
      spyOn(component.imageSelectedChange, 'emit');
      spyOn(providers.ImageTagService.addToScope$, 'next');

      component.updateSelected(true);

      expect(component.imageSelectedChange.emit).toHaveBeenCalledWith({ selected: true, reference: imageSource.reference.id });
      expect(providers.ImageTagService.addToScope$.next).toHaveBeenCalledWith(imageSource.reference);
    });

    it('should emit imageSelectedChange and call removeFromScope$ when selected is false', () => {
      spyOn(component.imageSelectedChange, 'emit');
      spyOn(providers.ImageTagService.removeFromScope$, 'next');

      component.updateSelected(false);

      expect(component.imageSelectedChange.emit).toHaveBeenCalledWith({ selected: false, reference: imageSource.reference.id });
      expect(providers.ImageTagService.removeFromScope$.next).toHaveBeenCalledWith(imageSource.reference);
    });
  });

  describe('onSelectionChange', () => {
    const mockTags = [{ id: 'tag1ref', name: 'tag1' }, { id: 'tag2ref', name: 'tag2' }];
    const mockTagNames = mockTags.map(t => t.name);

    beforeEach(() => {

      (providers.TagService.LoadTagByName as jasmine.Spy).calls.reset();
      (providers.ImageTagService.replaceTags as jasmine.Spy).calls.reset();
      (providers.MessageService.Error as jasmine.Spy).calls.reset();
      component.showTagSelection.set(true);

      mockTags.forEach(tag => {
        (providers.TagService.LoadTagByName as jasmine.Spy).withArgs(tag.name).and.returnValue(Promise.resolve(tag));
      });
      (providers.ImageTagService.replaceTags as jasmine.Spy).and.returnValue(Promise.resolve());
    });

    it('should set showTagSelection to false, load tags, and call replaceTags', async () => {
      await component.onSelectionChange(mockTagNames);

      expect(component.showTagSelection()).toBe(false);
      expect(providers.TagService.LoadTagByName).toHaveBeenCalledTimes(mockTagNames.length);
      mockTagNames.forEach(name => {
        expect(providers.TagService.LoadTagByName).toHaveBeenCalledWith(name);
      });
      expect(providers.ImageTagService.replaceTags).toHaveBeenCalledWith(imageSource.reference, jasmine.arrayContaining(mockTags.map(t => jasmine.objectContaining(t))));
      expect(providers.MessageService.Error).not.toHaveBeenCalled();
    });

    it('should call MessageService.Error if LoadTagByName fails', async () => {
      const error = new Error('Failed to load tag');
      (providers.TagService.LoadTagByName as jasmine.Spy).withArgs(mockTagNames[0]).and.returnValue(Promise.reject(error));

      await component.onSelectionChange(mockTagNames);

      expect(component.showTagSelection()).toBe(false);
      expect(providers.ImageTagService.replaceTags).not.toHaveBeenCalled();
      expect(providers.MessageService.Error).toHaveBeenCalledWith(jasmine.stringContaining(`Error updating tags on image ${imageSource.reference.id}: ${error}`));
    });

    it('should call MessageService.Error if replaceTags fails', async () => {
      const error = new Error('Failed to replace tags');
      (providers.ImageTagService.replaceTags as jasmine.Spy).and.returnValue(Promise.reject(error));

      await component.onSelectionChange(mockTagNames);

      expect(component.showTagSelection()).toBe(false);
      expect(providers.MessageService.Error).toHaveBeenCalledWith(jasmine.stringContaining(`Error updating tags on image ${imageSource.reference.id}: ${error}`));
    });
  });
});
