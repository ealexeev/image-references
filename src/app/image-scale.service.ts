import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageScaleService {

  ScaleImage(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const height = 400;
      const width = 0;
      const img = new Image();
      img.onload = () => {
        const el = document.createElement('canvas');
        const dir = (width < img.width || height < img.height) ? 'min' : 'max';
        const stretch = width && height;
        const ratio = Math[dir](
          (width / img.width) || 1,
          (height / img.height) || 1
        );
        let w = el.width = stretch ? width : img.width * ratio;
        let h = el.height = stretch ? height : img.height * ratio;
        const ctx = el.getContext('2d');
        if (!ctx) {
          reject("scaleImage(): no context!")
        }
        // @ts-ignore
        ctx.drawImage(img, 0, 0, w, h);
        el.toBlob(scaled => {
          if ( scaled ) {
            URL.revokeObjectURL(img.src)
            resolve(scaled)
          }
          reject('Not a blob!')
        }, blob.type);
      }
      img.src = URL.createObjectURL(blob);
    })
  }
}

export class FakeImageScaleService {
  ScaleImage(blob: Blob): Promise<Blob> {
    return Promise.resolve(blob);
  }
}
