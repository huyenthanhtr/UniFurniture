import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
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
  private resizeObserver?: ResizeObserver;

  @ViewChild('mainImageElement') mainImageElement?: ElementRef<HTMLImageElement>;
  thumbnailMaxHeight = 0;

  @Input()
  set images(value: string[]) {
    const validImages = (value || []).filter((image) => typeof image === 'string' && image.trim().length > 0);
    this.galleryImages = validImages.length > 0 ? validImages : [FALLBACK_IMAGE_URL];
    this.selectedIndex = 0;
    this.syncThumbnailHeight();
  }

  get images(): string[] {
    return this.galleryImages;
  }

  selectedIndex = 0;

  select(index: number): void {
    this.selectedIndex = index;
    this.syncThumbnailHeight();
  }

  ngAfterViewInit(): void {
    const element = this.mainImageElement?.nativeElement;
    if (element && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncThumbnailHeight());
      this.resizeObserver.observe(element);
    }
    this.syncThumbnailHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  onMainImageLoad(): void {
    this.syncThumbnailHeight();
  }

  private syncThumbnailHeight(): void {
    queueMicrotask(() => {
      const imageElement = this.mainImageElement?.nativeElement;
      if (!imageElement) {
        return;
      }
      const nextHeight = Math.round(imageElement.getBoundingClientRect().height);
      if (nextHeight > 0) {
        this.thumbnailMaxHeight = nextHeight;
      }
    });
  }
}
