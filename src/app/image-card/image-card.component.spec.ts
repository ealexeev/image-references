import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { MatButtonHarness } from '@angular/material/button/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HarnessLoader } from '@angular/cdk/testing';

import { ImageCardComponent } from './image-card.component';
import {DocumentReference} from '@angular/fire/firestore';
import {Image} from '../../lib/models/image.model';
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
      reference: {id: "1"} as DocumentReference,
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
    const deleteButton = await loader.getHarness(MatButtonHarness.with({selector: '[mattooltip="Delete this image"]'}));
    await deleteButton.click();
    expect(component.imageDeleted.emit).toHaveBeenCalledWith(imageSource.reference.id);
  });

  it('should call DownloadService.download when download button is clicked', async () => {
    component.fullUrlAvailable.set(true);
    fixture.detectChanges();
    const downloadButton = await loader.getHarness(MatButtonHarness.with({selector: '[mattooltip="Download this image"]'}));
    await downloadButton.click();
    expect(providers.DownloadService.download).toHaveBeenCalledWith({
      fileName: imageSource.reference.id,
      maxZipContentFiles: 1,
      strategy: jasmine.any(Object)
    });
  });

  it('should call ImageTagService.performLastOperation when "Add last operation" button is clicked', async () => {
    // Ensure the button is visible by mocking recentOperations
    (providers.ImageTagService.recentOperations as unknown as WritableSignal<any[]>).set([{ type: 'add', tags: [{ name: 'testtag' }] }]);
    fixture.detectChanges(); // To render the button

    const addLastButton = await loader.getHarness(MatButtonHarness.with({ selector: 'button[mattooltipclass="multiline-tooltip"]' })); // Select by class as tooltip is dynamic
    await addLastButton.click();

    expect(providers.ImageTagService.performLastOperation).toHaveBeenCalledWith(component.imageSource.reference);
  });

  it('should navigate to full image view when "Show full size" button is clicked', async () => {
    const fullSizeButton = await loader.getHarness(MatButtonHarness.with({selector: '[mattooltip="Show full size"]'}));
    await fullSizeButton.click();
    expect(providers.Router.navigateByUrl).toHaveBeenCalledWith(`/image/${imageSource.reference.id}`);
  });

});
