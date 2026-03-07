import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map } from 'rxjs';
import { ProductGalleryComponent } from '../../shared/product-gallery/product-gallery';
import { ProductInfoComponent } from '../../shared/product-info/product-info';
import { ProductDataService, ProductDetailData } from '../../services/product-data.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, ProductGalleryComponent, ProductInfoComponent],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productDataService = inject(ProductDataService);
  private readonly destroyRef = inject(DestroyRef);
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;

  readonly activeTab = signal<'desc' | 'review' | 'policy'>('desc');
  readonly product = signal<ProductDetailData | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly currentProductId = signal<string | null>(null);
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

    // Keep inner anchor text but remove clickable links in product description.
    return html.replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1');
  }
}
