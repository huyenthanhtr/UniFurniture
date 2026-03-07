import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=900';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.css',
})
export class ProductGalleryComponent {
  private galleryImages: string[] = [FALLBACK_IMAGE_URL];

  @Input()
  set images(value: string[]) {
    const validImages = (value || []).filter((image) => typeof image === 'string' && image.trim().length > 0);
    this.galleryImages = validImages.length > 0 ? validImages : [FALLBACK_IMAGE_URL];
    this.selectedIndex = 0;
  }

  get images(): string[] {
    return this.galleryImages;
  }

  selectedIndex = 0;

  select(index: number): void {
    this.selectedIndex = index;
  }
}
