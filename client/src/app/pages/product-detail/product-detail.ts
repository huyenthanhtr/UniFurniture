import { Component, DestroyRef, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductGalleryComponent } from '../../shared/product-gallery/product-gallery';
import { ProductInfoComponent } from '../../shared/product-info/product-info';
import { ProductRecommendations } from '../../shared/product-recommendations/product-recommendations';
import { ProductDataService, ProductDetailData, ColorSwatch, ProductVariantDocument } from '../../services/product-data.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map } from 'rxjs';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, ProductGalleryComponent, ProductInfoComponent, ProductRecommendations],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productDataService = inject(ProductDataService);
  private readonly titleService = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;

  readonly activeTab = signal<'desc' | 'review' | 'policy'>('desc');
  readonly product = signal<ProductDetailData | null>(null);
  readonly selectedColor = signal<ColorSwatch | null>(null);
  readonly selectedVariant = signal<ProductVariantDocument | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly currentProductId = signal<string | null>(null);

  readonly displayImages = computed(() => {
    const current = this.product();
    if (!current) return [];

    const color = this.selectedColor();
    const variantId = this.selectedVariant()?._id;

    // Filter images by the selected variant if available, otherwise fallback to the selected color
    let filteredImages = [...current.images];
    if (variantId) {
      const matchVariantImages = filteredImages.filter(img => !img.variant_id || img.variant_id === variantId);
      if (matchVariantImages.length > 0) {
        filteredImages = matchVariantImages;
      }
    } else if (color && color.variants && color.variants.length > 0) {
      const validVariantIds = new Set(color.variants.map(v => v._id));
      const matchColorImages = filteredImages.filter(img => !img.variant_id || validVariantIds.has(img.variant_id));
      if (matchColorImages.length > 0) {
        filteredImages = matchColorImages;
      }
    }

    // Map to strings for the native gallery
    const imagesUrls = filteredImages.map(img => img.url);

    if (color?.imageUrl) {
      // If the selected color has a primary image, ensure it's at the front
      const colorImgIndex = imagesUrls.indexOf(color.imageUrl);
      if (colorImgIndex > -1) {
        imagesUrls.splice(colorImgIndex, 1);
        imagesUrls.unshift(color.imageUrl);
      } else {
        imagesUrls.unshift(color.imageUrl);
      }
    }
    return imagesUrls;
  });

  readonly descriptionHtml = computed(() => {
    const current = this.product();
    const rawDescription = current?.description || current?.shortDescription || 'Thong tin dang cap nhat.';
    return this.stripLinks(rawDescription);
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((productId) => {
        if (!productId) {
          this.errorMessage.set('Không tìm thấy mã sản phẩm.');
          this.isLoading.set(false);
          return;
        }
        this.currentProductId.set(productId);
        this.loadProduct(productId);
      });
  }

  setActiveTab(tab: 'desc' | 'review' | 'policy'): void {
    this.activeTab.set(tab);
  }

  onColorChanged(color: ColorSwatch): void {
    this.selectedColor.set(color);
  }

  onVariantChanged(variant: ProductVariantDocument): void {
    this.selectedVariant.set(variant);
  }

  retry(): void {
    const productId = this.currentProductId();
    if (productId) {
      this.loadProduct(productId);
    }
  }

  private loadProduct(productId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.product.set(null);
    this.clearLoadingGuard();
    this.loadingGuard = setTimeout(() => {
      this.isLoading.set(false);
      this.errorMessage.set('Tải chi tiết sản phẩm quá lâu. Vui lòng thử lại.');
    }, 12000);

    this.productDataService
      .getProductDetail(productId)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Không thể tải chi tiết sản phẩm.');
          return EMPTY;
        }),
        finalize(() => {
          this.clearLoadingGuard();
          this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((product) => {
        this.product.set(product);
      });
  }

  private clearLoadingGuard(): void {
    if (this.loadingGuard !== null) {
      clearTimeout(this.loadingGuard);
      this.loadingGuard = null;
    }
  }

  private stripLinks(html: string): string {
    if (!html) {
      return '';
    }
    return html.replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1');
  }
}