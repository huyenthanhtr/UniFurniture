import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { ProductDataService, ProductListItem } from '../../services/product-data.service';

interface FlashDeal {
  id: string;
  productSlug: string;
  title: string;
  category: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: number;
  sold: number;
  total: number;
}

interface CouponApi {
  _id?: string;
  code?: string;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
  max_discount_amount?: number | null;
  min_order_value?: number;
  used?: number;
  total_limit?: number;
  start_at?: string;
  end_at?: string;
  status?: string;
}

interface VoucherDeal {
  code: string;
  label: string;
  details: string[];
  color: string;
  isExpired: boolean;
}

interface PromoCollection {
  id: string;
  productSlug: string;
  title: string;
  subtitle: string;
  imageUrl: string;
}

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class PromotionsPageComponent implements OnInit, OnDestroy {
  private readonly productDataService = inject(ProductDataService);
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly countdown = signal({ hours: '00', minutes: '00', seconds: '00' });

  flashDeals: FlashDeal[] = [];
  vouchers: VoucherDeal[] = [];
  collections: PromoCollection[] = [];

  loading = true;
  errorMessage = '';
  copiedCode: string | null = null;

  private timerId: ReturnType<typeof setInterval> | null = null;
  private copiedCodeTimerId: ReturnType<typeof setTimeout> | null = null;
  private targetTime = Date.now() + 28 * 60 * 60 * 1000;

  ngOnInit(): void {
    this.updateCountdown();
    this.timerId = setInterval(() => {
      this.ngZone.run(() => {
        this.updateCountdown();
        this.cdr.detectChanges();
      });
    }, 1000);
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
    }
    if (this.copiedCodeTimerId !== null) {
      clearTimeout(this.copiedCodeTimerId);
    }
  }

  trackByDealId(index: number, deal: FlashDeal): string {
    return deal.id || String(index);
  }

  trackByVoucher(index: number, voucher: VoucherDeal): string {
    return voucher.code || String(index);
  }

  trackByCollection(index: number, collection: PromoCollection): string {
    return collection.id || String(index);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value) + '\u0111';
  }

  discountPercent(deal: FlashDeal): number {
    if (deal.originalPrice <= 0 || deal.salePrice >= deal.originalPrice) {
      return 0;
    }
    return Math.round(((deal.originalPrice - deal.salePrice) / deal.originalPrice) * 100);
  }

  soldPercent(deal: FlashDeal): number {
    if (deal.total <= 0) {
      return 0;
    }
    return Math.min(Math.round((deal.sold / deal.total) * 100), 100);
  }

  copyVoucherCode(voucher: VoucherDeal): void {
    if (!voucher || voucher.isExpired || !voucher.code) {
      return;
    }

    const normalizedCode = voucher.code.trim();
    if (!normalizedCode) {
      return;
    }

    const applyCopiedState = () => {
      this.copiedCode = normalizedCode;
      if (this.copiedCodeTimerId !== null) {
        clearTimeout(this.copiedCodeTimerId);
      }
      this.copiedCodeTimerId = setTimeout(() => {
        this.copiedCode = null;
      }, 1600);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(normalizedCode).then(applyCopiedState).catch(() => {
        this.copyWithFallback(normalizedCode, applyCopiedState);
      });
      return;
    }

    this.copyWithFallback(normalizedCode, applyCopiedState);
  }

  private loadData(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      products: this.productDataService.getProductList(80).pipe(catchError(() => of([] as ProductListItem[]))),
      coupons: this.fetchCoupons().pipe(catchError(() => of([] as CouponApi[]))),
    }).subscribe(({ products, coupons }) => {
      this.ngZone.run(() => {
        this.flashDeals = this.mapFlashDeals(products);
        this.vouchers = this.mapVouchers(coupons);
        this.collections = this.mapCollections(products);

        if (!this.flashDeals.length && !this.vouchers.length && !this.collections.length) {
          this.errorMessage =
            'Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u khuy\u1EBFn m\u00E3i t\u1EEB API.';
        }

        this.loading = false;
        this.cdr.detectChanges();
      });
    });
  }

  private fetchCoupons(): Observable<CouponApi[]> {
    return this.http
      .get<CouponApi[] | { items?: CouponApi[] }>(`${API_BASE_URL}/coupons`)
      .pipe(
        timeout(12000),
        map((response) => {
          if (Array.isArray(response)) {
            return response;
          }
          return response.items || [];
        }),
      );
  }

  private mapFlashDeals(products: ProductListItem[]): FlashDeal[] {
    return [...products]
      .filter((product) => typeof product.price === 'number' && product.price > 0)
      .sort((left, right) => right.soldCount - left.soldCount)
      .slice(0, 8)
      .map((product) => {
        const salePrice = product.price ?? 0;
        const computedOriginal = Math.round((salePrice * 1.18) / 1000) * 1000;
        const originalPrice = Math.max(product.originalPrice ?? computedOriginal, salePrice + 1000);
        const sold = Math.max(product.soldCount, 0);
        const total = Math.max(sold + 20, 30);

        return {
          id: product.id,
          productSlug: product.slug,
          title: product.name,
          category: this.inferCategoryFromName(product.name),
          imageUrl: product.imageUrl,
          originalPrice,
          salePrice,
          sold,
          total,
        };
      });
  }

  private mapVouchers(coupons: CouponApi[]): VoucherDeal[] {
    const now = Date.now();

    return coupons
      .filter((coupon) => Boolean(coupon.code))
      .sort((left, right) => {
        const leftActive = this.isCouponActive(left, now);
        const rightActive = this.isCouponActive(right, now);
        if (leftActive !== rightActive) {
          return leftActive ? -1 : 1;
        }
        return (right.discount_value || 0) - (left.discount_value || 0);
      })
      .slice(0, 9)
      .map((coupon) => {
        const code = coupon.code?.trim() || 'COUPON';
        const discountValue = coupon.discount_value || 0;
        const minOrder = coupon.min_order_value || 0;
        const used = coupon.used || 0;
        const totalLimit = coupon.total_limit || 0;
        const maxDiscount = coupon.max_discount_amount || 0;
        const isPercent = coupon.discount_type === 'percent';

        const label = isPercent
          ? `Giảm ${discountValue}%${maxDiscount > 0 ? ` tối đa ${this.formatPrice(maxDiscount)}` : ''}`
          : `Giảm ${this.formatPrice(discountValue)}`;

        const endDateText = coupon.end_at ? this.formatDate(coupon.end_at) : '';

        const details = [
          `Đơn tối thiểu ${this.formatPrice(minOrder)}`,
          totalLimit > 0
            ? `Đã dùng ${used}/${totalLimit}`
            : 'Không giới hạn lượt dùng',
          endDateText ? `HSD: ${endDateText}` : '',
        ]
          .filter((item): item is string => Boolean(item));

        const isActive = this.isCouponActive(coupon, now);
        return {
          code,
          label,
          details,
          color: this.getCouponColor(coupon, now),
          isExpired: !isActive,
        };
      });
  }

  private mapCollections(products: ProductListItem[]): PromoCollection[] {
    return [...products]
      .filter((product) => product.id && product.slug && product.imageUrl)
      .slice(0, 3)
      .map((product) => ({
        id: product.id,
        productSlug: product.slug,
        title: product.name,
        subtitle: `Ưu đãi ${product.discountBadge || '-18%'}`,
        imageUrl: product.imageUrl,
      }));
  }

  private inferCategoryFromName(name: string): string {
    const source = this.normalizeText(name);

    if (/sofa|ban tra|phong khach/.test(source)) {
      return 'Phòng khách';
    }
    if (/giuong|tu|phong ngu/.test(source)) {
      return 'Phòng ngủ';
    }
    if (/ban an|ghe an|phong an/.test(source)) {
      return 'Phòng ăn';
    }
    if (/ban lam viec|ke sach|van phong/.test(source)) {
      return 'Phòng làm việc';
    }
    return 'Nội thất';
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd');
  }

  private isCouponActive(coupon: CouponApi, now: number): boolean {
    const status = (coupon.status || '').toLowerCase();
    if (status === 'inactive' || status === 'expired') {
      return false;
    }

    const startAt = coupon.start_at ? new Date(coupon.start_at).getTime() : Number.MIN_SAFE_INTEGER;
    const endAt = coupon.end_at ? new Date(coupon.end_at).getTime() : Number.MAX_SAFE_INTEGER;

    return now >= startAt && now <= endAt;
  }

  private getCouponColor(coupon: CouponApi, now: number): string {
    const status = (coupon.status || '').toLowerCase();
    if (status === 'inactive') {
      return '#6b7280';
    }
    if (status === 'expired' || !this.isCouponActive(coupon, now)) {
      return '#9b2c2c';
    }
    if (coupon.discount_type === 'percent') {
      return '#2f855a';
    }
    return '#dd6b20';
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('vi-VN').format(date);
  }

  private updateCountdown(): void {
    const remaining = this.targetTime - Date.now();
    if (remaining <= 0) {
      this.targetTime = Date.now() + 28 * 60 * 60 * 1000;
      this.countdown.set({ hours: '28', minutes: '00', seconds: '00' });
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    this.countdown.set({
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    });
  }

  private copyWithFallback(text: string, onSuccess: () => void): void {
    if (typeof document === 'undefined') {
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
