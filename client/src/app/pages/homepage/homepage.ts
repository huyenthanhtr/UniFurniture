import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductDataService, ProductListItem } from '../../services/product-data.service';
import { ProductCardComponent } from '../../shared/product-card/product-card';

interface HomeSlide {
  title: string;
  description: string;
  imageUrl: string;
  ctaLabel: string;
  ctaLink: string;
}

const AUTO_SLIDE_MS = 5000;

const HOME_SLIDES: HomeSlide[] = [
  {
    title: 'Ngủ Ngon Hơn Với Bộ Phòng Ngủ Đồng Bộ',
    description: 'Kết hợp giường, tủ và bàn trang điểm theo cùng phong cách để tối ưu thẩm mỹ căn phòng.',
    imageUrl: 'assets/images/banner2.png',
    ctaLabel: 'Xem bộ sưu tập',
    ctaLink: '/products',
  },
  {
    title: 'Không Gian Sống Tối Giản, Tinh Tế',
    description: 'Nâng cấp phòng khách với bộ sưu tập nội thất hiện đại, tông màu ấm và đường nét gọn gàng.',
    imageUrl: 'assets/images/banner5.jpg',
    ctaLabel: 'Khám phá ngay',
    ctaLink: '/products',
  },
  {
    title: 'Góc Làm Việc Nhỏ, Hiệu Suất Lớn',
    description: 'Lựa chọn bàn ghế tối giản, dễ bố trí gọn gàng cho căn hộ và phòng làm việc tại nhà.',
    imageUrl: 'assets/images/banner6.jpg',
    ctaLabel: 'Mua ngay',
    ctaLink: '/products',
  },
];

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements OnInit, OnDestroy {
  private readonly productDataService = inject(ProductDataService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private autoSlideTimer?: ReturnType<typeof setInterval>;

  cheapProducts: ProductListItem[] = [];
  bestSellingProducts: ProductListItem[] = [];
  suggestedProducts: ProductListItem[] = [];
  bedroomProducts: ProductListItem[] = [];
  featuredReviews: any[] = [];

  readonly slides: HomeSlide[] = HOME_SLIDES;
  activeSlideIndex = 0;

  loading = true;
  error = '';

  ngOnInit(): void {
    this.startAutoSlide();
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  trackByProductId(index: number, product: ProductListItem): string {
    return product.id || String(index);
  }

  trackByReviewId(index: number, review: any): string {
    return review._id || String(index);
  }

  trackBySlideIndex(index: number): number {
    return index;
  }

  goToSlide(index: number): void {
    if (!this.slides.length) {
      return;
    }

    this.activeSlideIndex = (index + this.slides.length) % this.slides.length;
    this.restartAutoSlide();
  }

  nextSlide(): void {
    this.goToSlide(this.activeSlideIndex + 1);
  }

  prevSlide(): void {
    this.goToSlide(this.activeSlideIndex - 1);
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.cheapProducts = [];
    this.bestSellingProducts = [];
    this.suggestedProducts = [];
    this.bedroomProducts = [];
    this.featuredReviews = [];

    // Parallel aggregate or sequential - keeping it simple with product + review fetches
    this.productDataService.getFeaturedReviews().subscribe({
      next: (reviews) => {
        this.ngZone.run(() => {
          this.featuredReviews = reviews;
          this.cdr.detectChanges();
        });
      }
    });

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
            .filter((item) => /(giuong|tu|phong ngu|wardrobe|bedroom)/i.test(item.name))
            .slice(0, 8);

          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err: unknown) => {
        this.ngZone.run(() => {
          const message = err instanceof Error ? err.message : '';
          this.error = message || 'Khong the tai san pham tu API.';
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

    return new Intl.NumberFormat('vi-VN').format(price) + 'd';
  }

  private startAutoSlide(): void {
    if (this.autoSlideTimer || this.slides.length < 2) {
      return;
    }

    this.autoSlideTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.activeSlideIndex = (this.activeSlideIndex + 1) % this.slides.length;
      });
    }, AUTO_SLIDE_MS);
  }

  private stopAutoSlide(): void {
    if (!this.autoSlideTimer) {
      return;
    }

    clearInterval(this.autoSlideTimer);
    this.autoSlideTimer = undefined;
  }

  private restartAutoSlide(): void {
    this.stopAutoSlide();
    this.startAutoSlide();
  }
}
