import { ChangeDetectorRef, Component, NgZone, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductDataService, ProductListItem } from '../../services/product-data.service';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements OnInit {
  private readonly productDataService = inject(ProductDataService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  cheapProducts: ProductListItem[] = [];
  bestSellingProducts: ProductListItem[] = [];
  suggestedProducts: ProductListItem[] = [];
  bedroomProducts: ProductListItem[] = [];

  loading = true;
  error = '';

  ngOnInit(): void {
    this.loadAll();
  }

  trackByProductId(index: number, product: ProductListItem): string {
    return product.id || String(index);
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.cheapProducts = [];
    this.bestSellingProducts = [];
    this.suggestedProducts = [];
    this.bedroomProducts = [];

    this.productDataService.getProductList(80).subscribe({
      next: (items) => {
        this.ngZone.run(() => {
          const available = items.filter((item) => item.price !== null);

          this.cheapProducts = [...available]
            .sort((left, right) => (left.price ?? 0) - (right.price ?? 0))
            .slice(0, 8);

          this.bestSellingProducts = [...available]
            .sort((left, right) => right.soldCount - left.soldCount)
            .slice(0, 8);

          this.suggestedProducts = [...available].slice(0, 8);

        this.bedroomProducts = [...available]
          .filter((item) => /(giường|tủ|phòng ngủ|giuong|tu|phong ngu)/i.test(item.name))
          .slice(0, 8);

          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err: unknown) => {
        this.ngZone.run(() => {
          const message = err instanceof Error ? err.message : '';
        this.error = message || 'Không thể tải sản phẩm từ API.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  formatPrice(price: number | null): string {
    if (price === null || !Number.isFinite(price)) {
      return '';
    }
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  }
}
