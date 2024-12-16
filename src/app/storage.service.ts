import { Injectable } from '@angular/core';
import { HmacService } from './hmac.service';

export interface StoredImage {
  // Unique ID
  id: string,
  // Time image was first added.
  added: Date,
  // IV used
  iv: string,
  // URL of the image
  url: string,
  // Collection of applicable tag IDs
  tags: string[]
}

const LOCAL_STORAGE_KEY_IMAGES = "prestige-ape-images";

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private allImages: StoredImage[] = [
    {
      id: "test-1",
      added: new Date(),
      iv: "an-iv",
      url: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/51506a75-0aeb-4f25-94a6-40117720b244/dh27kbi-89e73254-9a88-44e6-b617-5c62813866fa.jpg/v1/fit/w_828,h_622,q_70,strp/the_cybernetic_companion_by_queenwithnothrone_dh27kbi-414w-2x.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzUxNTA2YTc1LTBhZWItNGYyNS05NGE2LTQwMTE3NzIwYjI0NFwvZGgyN2tiaS04OWU3MzI1NC05YTg4LTQ0ZTYtYjYxNy01YzYyODEzODY2ZmEuanBnIiwiaGVpZ2h0IjoiPD05NjAiLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS53YXRlcm1hcmsiXSwid21rIjp7InBhdGgiOiJcL3dtXC81MTUwNmE3NS0wYWViLTRmMjUtOTRhNi00MDExNzcyMGIyNDRcL3F1ZWVud2l0aG5vdGhyb25lLTQucG5nIiwib3BhY2l0eSI6OTUsInByb3BvcnRpb25zIjowLjQ1LCJncmF2aXR5IjoiY2VudGVyIn19.Uw0UP0iKgRMzjUbYUq4Yi5A8jQMSmRy2duoynE8qVac",
      tags: ["robot"]
    },
    {
      id: "test-2",
      added: new Date(),
      iv: "an-iv",
      url: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/51506a75-0aeb-4f25-94a6-40117720b244/dhxuaoa-add4922b-fcf1-41ea-b7ad-f0128e70d8cb.jpg/v1/fit/w_828,h_622,q_70,strp/hot_coffee_by_queenwithnothrone_dhxuaoa-414w-2x.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzUxNTA2YTc1LTBhZWItNGYyNS05NGE2LTQwMTE3NzIwYjI0NFwvZGh4dWFvYS1hZGQ0OTIyYi1mY2YxLTQxZWEtYjdhZC1mMDEyOGU3MGQ4Y2IuanBnIiwiaGVpZ2h0IjoiPD05NjAiLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS53YXRlcm1hcmsiXSwid21rIjp7InBhdGgiOiJcL3dtXC81MTUwNmE3NS0wYWViLTRmMjUtOTRhNi00MDExNzcyMGIyNDRcL3F1ZWVud2l0aG5vdGhyb25lLTQucG5nIiwib3BhY2l0eSI6OTUsInByb3BvcnRpb25zIjowLjQ1LCJncmF2aXR5IjoiY2VudGVyIn19.YBs-gEz8pE1QhzqS4e7aLFbjyN3iw3s2TXiWPp-KdHs",
      tags: ["robot", "coffee"]
    }
  ];

  constructor(private hmac: HmacService) { }

  getAllImagesWithTag(tag: string): StoredImage[] {
    var ret: StoredImage[] = [];
    var local: StoredImage[] = [];
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_IMAGES) || "") as StoredImage[];  
    } catch (error) {
      console.log(error);
    }
    if ( local.length > 0 ) {
      console.log("Got results from local storage!");
      return local;
    }
    
    for (const stored of this.allImages) {
      for (const storedTag of stored.tags) {
        if ( storedTag === tag ) {
          ret.push(stored)
        }
      }
    }
    return ret;
  }

  // Will need to refactor handling local blob URLs since they are not stable.  
  // Uploaded files will need to be hosted somewhere.
  async storeImageFromURL(url: string, tags: string[]): Promise<StoredImage> {

    var tags: string[] = [];
    for (const tag of tags) {
      var hmac: string | ArrayBuffer | null;
      hmac = await this.hmac.getHmacBase64(new Blob([tag]));
      tags.push(hmac as string);
    }
    const img: StoredImage = {
      id: "",
      added: new Date(),
      iv: "an-iv",
      url: url,
      tags: tags,
    };

    this.allImages.push(img);
    localStorage.setItem(LOCAL_STORAGE_KEY_IMAGES, JSON.stringify(this.allImages));
    return new Promise((resolve) => {resolve(img)});
  }
}
