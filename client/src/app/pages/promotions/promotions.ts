import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of, shareReplay, timeout } from 'rxjs';

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
  availability: 'active' | 'sold_out' | 'expired';
}

interface PromoCollection {
  id: string;
  productId: string;
  productSlug: string;
  title: string;
  subtitle: string;
  imageUrl: string;
}

interface CollectionApi {
  _id?: string;
  name?: string;
  slug?: string;
  status?: string;
}

interface ProductApi {
  _id?: string;
  slug?: string;
  name?: string;
  status?: string;
  thumbnail?: string;
  thumbnail_url?: string;
  min_price?: number;
  compare_at_price?: number;
  sold?: number;
  collection_id?: string;
}

interface ApiListResponse<T> {
  items?: T[];
}

interface PromoProductItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  soldCount: number;
  collectionId: string;
}

const API_BASE_URL = 'http://localhost:3000/api';
const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=900';

interface PromotionsCacheData {
  flashDeals: FlashDeal[];
  vouchers: VoucherDeal[];
  collections: PromoCollection[];
}

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class PromotionsPageComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private static readonly CACHE_TTL_MS = 3 * 60 * 1000;
  private static cache:
    | {
        data: PromotionsCacheData;
        cachedAt: number;
      }
    | null = null;
  private static inFlightData$?: Observable<PromotionsCacheData>;

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

  toProductDetailLink(collection: PromoCollection): string[] {
    const slug = String(collection?.productSlug || '').trim();
    if (slug) {
      return ['/products', slug];
    }

    return ['/products', String(collection?.productId || '').trim()];
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

  scrollToSection(sectionId: string): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }

    const topOffset = this.getTopStickyOffset() + 12;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - topOffset;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth',
    });
  }

  copyVoucherCode(voucher: VoucherDeal): void {
    if (!voucher || voucher.availability !== 'active' || !voucher.code) {
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
    const cache = PromotionsPageComponent.cache;
    if (cache && Date.now() - cache.cachedAt < PromotionsPageComponent.CACHE_TTL_MS) {
      this.flashDeals = cache.data.flashDeals;
      this.vouchers = cache.data.vouchers;
      this.collections = cache.data.collections;
      this.loading = false;
      this.errorMessage = '';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.getPromotionsData().subscribe((data) => {
      this.ngZone.run(() => {
        this.flashDeals = data.flashDeals;
        this.vouchers = data.vouchers;
        this.collections = data.collections;

        if (!this.flashDeals.length && !this.vouchers.length && !this.collections.length) {
          this.errorMessage =
            'Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u khuy\u1EBFn m\u00E3i t\u1EEB API.';
        }

        this.loading = false;
        this.cdr.detectChanges();
      });
    });
  }

  private getPromotionsData(): Observable<PromotionsCacheData> {
    if (!PromotionsPageComponent.inFlightData$) {
      PromotionsPageComponent.inFlightData$ = forkJoin({
        products: this.fetchActiveProducts().pipe(catchError(() => of([] as PromoProductItem[]))),
        collections: this.fetchCollections().pipe(catchError(() => of([] as CollectionApi[]))),
        coupons: this.fetchCoupons().pipe(catchError(() => of([] as CouponApi[]))),
      }).pipe(
        map(({ products, collections, coupons }) => {
          const data: PromotionsCacheData = {
            flashDeals: this.mapFlashDeals(products),
            vouchers: this.mapVouchers(coupons),
            collections: this.mapCollections(products, collections),
          };

          PromotionsPageComponent.cache = {
            data,
            cachedAt: Date.now(),
          };

          return data;
        }),
        finalize(() => {
          PromotionsPageComponent.inFlightData$ = undefined;
        }),
        shareReplay(1),
      );
    }

    return PromotionsPageComponent.inFlightData$;
  }

  private fetchActiveProducts(): Observable<PromoProductItem[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('limit', '120')
      .set('status', 'active')
      .set('sortBy', 'sold')
      .set('order', 'desc')
      .set(
        'fields',
        'name,slug,status,thumbnail,thumbnail_url,min_price,compare_at_price,sold,collection_id',
      );

    return this.http.get<ProductApi[] | ApiListResponse<ProductApi>>(`${API_BASE_URL}/products`, { params }).pipe(
      timeout(12000),
      map((response) => (Array.isArray(response) ? response : response.items || [])),
      map((items) =>
        items
          .filter((item) => String(item.status || '').trim().toLowerCase() === 'active')
          .map((item) => ({
            id: String(item._id || '').trim(),
            slug: String(item.slug || item._id || '').trim(),
            name: String(item.name || '').trim(),
            price: this.toNumber(item.min_price),
            originalPrice: this.toNumber(item.compare_at_price),
            imageUrl:
              String(item.thumbnail || '').trim() ||
              String(item.thumbnail_url || '').trim() ||
              FALLBACK_IMAGE_URL,
            soldCount: this.toNumber(item.sold),
            collectionId: String(item.collection_id || '').trim(),
          }))
          .filter((item) => Boolean(item.id) && Boolean(item.slug) && Boolean(item.name)),
      ),
    );
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

  private fetchCollections(): Observable<CollectionApi[]> {
    const params = new HttpParams().set('status', 'active').set('page', '1').set('limit', '200');
    return this.http
      .get<CollectionApi[] | { items?: CollectionApi[] }>(`${API_BASE_URL}/collections`, { params })
      .pipe(
        timeout(12000),
        map((response) => (Array.isArray(response) ? response : response.items || [])),
      );
  }

  private mapFlashDeals(products: PromoProductItem[]): FlashDeal[] {
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
      .filter((coupon) => !this.isCouponInactive(coupon))
      .sort((left, right) => {
        const leftState = this.getCouponAvailability(left, now);
        const rightState = this.getCouponAvailability(right, now);
        if (leftState !== rightState) {
          const rank: Record<'active' | 'sold_out' | 'expired', number> = {
            active: 0,
            sold_out: 1,
            expired: 2,
          };
          return rank[leftState] - rank[rightState];
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

        const availability = this.getCouponAvailability(coupon, now);
        return {
          code,
          label,
          details,
          color: this.getCouponColor(coupon, now),
          isExpired: availability !== 'active',
          availability,
        };
      });
  }

  private mapCollections(products: PromoProductItem[], collections: CollectionApi[]): PromoCollection[] {
    const activeCollections = collections.filter((item) => String(item.status || '').trim().toLowerCase() === 'active');
    const activeCollectionIds = new Set(
      activeCollections
        .map((item) => String(item._id || '').trim())
        .filter(Boolean),
    );

    const collectionNameMap = new Map<string, string>(
      activeCollections
        .map((item) => [String(item._id || '').trim(), String(item.name || '').trim()] as const)
        .filter(([id, name]) => Boolean(id) && Boolean(name)),
    );

    const featuredByCollection = new Map<string, PromoProductItem>();
    const sortedProducts = [...products].sort((left, right) => (right.soldCount || 0) - (left.soldCount || 0));

    for (const product of sortedProducts) {
      const collectionId = String(product.collectionId || '').trim();
      if (!collectionId || !activeCollectionIds.has(collectionId)) {
        continue;
      }

      if (!String(product.id || '').trim() || !String(product.imageUrl || '').trim()) {
        continue;
      }

      if (!featuredByCollection.has(collectionId)) {
        featuredByCollection.set(collectionId, product);
      }
    }

    return Array.from(featuredByCollection.entries())
      .slice(0, 3)
      .map(([collectionId, product]) => ({
        id: collectionId,
        productId: String(product.id || '').trim(),
        productSlug: String(product.slug || '').trim(),
        title: product.name,
        subtitle: collectionNameMap.get(collectionId) || 'Bộ sưu tập nổi bật',
        imageUrl: product.imageUrl,
      }));
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
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

  private isCouponInactive(coupon: CouponApi): boolean {
    return String(coupon.status || '').trim().toLowerCase() === 'inactive';
  }

  private isCouponOutOfQuota(coupon: CouponApi): boolean {
    const totalLimit = this.toNumber(coupon.total_limit);
    const used = this.toNumber(coupon.used);
    return totalLimit > 0 && used >= totalLimit;
  }

  private isCouponExpiredByDateOrStatus(coupon: CouponApi, now: number): boolean {
    const status = String(coupon.status || '').trim().toLowerCase();
    if (status === 'expired') {
      return true;
    }
    const startAt = coupon.start_at ? new Date(coupon.start_at).getTime() : Number.MIN_SAFE_INTEGER;
    const endAt = coupon.end_at ? new Date(coupon.end_at).getTime() : Number.MAX_SAFE_INTEGER;
    return now < startAt || now > endAt;
  }

  private getCouponAvailability(coupon: CouponApi, now: number): 'active' | 'sold_out' | 'expired' {
    if (this.isCouponExpiredByDateOrStatus(coupon, now)) {
      return 'expired';
    }
    if (this.isCouponOutOfQuota(coupon)) {
      return 'sold_out';
    }
    return 'active';
  }

  private isCouponActive(coupon: CouponApi, now: number): boolean {
    return this.getCouponAvailability(coupon, now) === 'active';
  }

  private getCouponColor(coupon: CouponApi, now: number): string {
    const status = (coupon.status || '').toLowerCase();
    if (status === 'inactive') {
      return '#6b7280';
    }
    const availability = this.getCouponAvailability(coupon, now);
    if (availability === 'expired') {
      return '#9b2c2c';
    }
    if (availability === 'sold_out') {
      return '#b45309';
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

  private getTopStickyOffset(): number {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return 0;
    }

    const header = document.querySelector('.moho-header') as HTMLElement | null;
    const navbar = document.querySelector('.moho-navbar') as HTMLElement | null;

    let offset = 0;
    if (header) {
      offset += header.getBoundingClientRect().height;
    }

    if (!navbar) {
      return offset;
    }

    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
    const isMobileSidebarClosed = isMobileViewport && !navbar.classList.contains('mobile-open');
    const isNavbarHidden = navbar.classList.contains('nav-hidden');
    const rect = navbar.getBoundingClientRect();
    const isVisible = rect.height > 0 && rect.width > 0;

    if (!isMobileSidebarClosed && !isNavbarHidden && isVisible) {
      offset += rect.height;
    }

    return offset;
  }
}
