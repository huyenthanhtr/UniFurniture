import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';

interface CouponApi {
  _id?: string;
  code?: string;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number | string;
  max_discount_amount?: number | string | null;
  min_order_value?: number | string;
  used?: number | string;
  total_limit?: number | string;
  start_at?: string;
  end_at?: string;
  status?: string;
}

export interface Coupon {
  code: string;
  label: string;
  description: string;
  expiry: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrder: number;
  discountAmount: number;
  isBest: boolean;
}

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-coupon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coupon-picker.html',
  styleUrl: './coupon-picker.css',
})
export class CouponPickerComponent implements OnInit, OnChanges, OnDestroy {
  private readonly http = inject(HttpClient);

  @Input() subtotal = 0;
  @Input() appliedCode = '';
  @Output() couponApplied = new EventEmitter<{ code: string; discount: number }>();

  showModal = false;
  manualCode = '';
  manualError = '';
  selectedCode = '';
  tempSelected = '';
  loadingCoupons = false;

  private couponsFromApi: CouponApi[] = [];

  ngOnInit(): void {
    this.selectedCode = String(this.appliedCode || '').trim().toUpperCase();
    this.fetchCoupons();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appliedCode']) {
      this.selectedCode = String(this.appliedCode || '').trim().toUpperCase();
    }
  }

  ngOnDestroy(): void {
    this.unlockPageScroll();
  }

  get availableCoupons(): Coupon[] {
    const mapped = this.couponsFromApi
      .filter((coupon) => this.isCouponEligible(coupon))
      .map((coupon) => this.mapCoupon(coupon));

    if (!mapped.length) return [];

    const maxDiscount = Math.max(...mapped.map((item) => item.discountAmount));

    return mapped
      .map((item) => ({
        ...item,
        isBest: item.discountAmount === maxDiscount && maxDiscount > 0,
      }))
      .sort((a, b) => {
        if (a.isBest !== b.isBest) return a.isBest ? -1 : 1;
        if (a.discountAmount !== b.discountAmount) return b.discountAmount - a.discountAmount;
        return a.code.localeCompare(b.code, 'vi', { sensitivity: 'base' });
      });
  }

  get selectedCoupon(): Coupon | null {
    const code = this.selectedCode || String(this.appliedCode || '').trim().toUpperCase();
    if (!code) return null;
    return this.availableCoupons.find((coupon) => coupon.code === code) || null;
  }

  openModal(): void {
    this.tempSelected = this.selectedCode || String(this.appliedCode || '').trim().toUpperCase();
    this.manualError = '';
    this.showModal = true;
    this.lockPageScroll();
  }

  closeModal(): void {
    this.showModal = false;
    this.unlockPageScroll();
  }

  selectTemp(code: string): void {
    this.tempSelected = this.tempSelected === code ? '' : code;
  }

  confirm(): void {
    const coupon = this.availableCoupons.find((item) => item.code === this.tempSelected);
    if (!coupon) {
      this.selectedCode = '';
      this.manualCode = '';
      this.couponApplied.emit({ code: '', discount: 0 });
      this.closeModal();
      return;
    }

    this.selectedCode = coupon.code;
    this.manualCode = coupon.code;
    this.couponApplied.emit({ code: coupon.code, discount: coupon.discountAmount });
    this.closeModal();
  }

  applyManual(): void {
    const code = this.manualCode.trim().toUpperCase();
    if (!code) {
      this.manualError = 'Vui lòng nhập mã khuyến mãi.';
      return;
    }

    const found = this.couponsFromApi.find((item) => String(item.code || '').trim().toUpperCase() === code);
    if (!found) {
      this.manualError = 'Mã không hợp lệ hoặc không tồn tại.';
      return;
    }

    if (!this.isCouponEligible(found)) {
      this.manualError = 'Mã này chưa đủ điều kiện áp dụng cho đơn hàng hiện tại.';
      return;
    }

    const mapped = this.mapCoupon(found);
    this.manualError = '';
    this.selectedCode = mapped.code;
    this.tempSelected = mapped.code;
    this.manualCode = mapped.code;
    this.couponApplied.emit({ code: mapped.code, discount: mapped.discountAmount });
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}₫`;
  }

  private fetchCoupons(): void {
    this.loadingCoupons = true;

    this.http
      .get<CouponApi[] | { items?: CouponApi[]; coupons?: CouponApi[]; data?: CouponApi[] }>(`${API_BASE_URL}/coupons`)
      .pipe(
        map((response) => {
          if (Array.isArray(response)) return response;
          return response.items || response.coupons || response.data || [];
        }),
        catchError(() => of([] as CouponApi[])),
      )
      .subscribe((items) => {
        this.couponsFromApi = items;
        this.loadingCoupons = false;
      });
  }

  private isCouponEligible(coupon: CouponApi): boolean {
    const code = String(coupon.code || '').trim();
    if (!code) return false;

    const minOrder = this.toNumber(coupon.min_order_value);
    if (this.subtotal < minOrder) return false;

    const totalLimit = this.toNumber(coupon.total_limit);
    const used = this.toNumber(coupon.used);
    if (totalLimit > 0 && used >= totalLimit) return false;

    const status = String(coupon.status || '').trim().toLowerCase();
    if (status === 'inactive') return false;

    const now = Date.now();
    const startAt = this.toTimestamp(coupon.start_at);
    const endAt = this.toTimestamp(coupon.end_at);
    if (startAt && now < startAt) return false;
    if (endAt && now > endAt) return false;

    return true;
  }

  private mapCoupon(coupon: CouponApi): Coupon {
    const code = String(coupon.code || '').trim().toUpperCase();
    const discountType = coupon.discount_type === 'percent' ? 'PERCENT' : 'FIXED';
    const discountValue = this.toNumber(coupon.discount_value);
    const minOrder = this.toNumber(coupon.min_order_value);
    const maxDiscountRaw = coupon.max_discount_amount;
    const maxDiscountAmount = maxDiscountRaw == null ? null : this.toNumber(maxDiscountRaw);

    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = Math.round((this.subtotal * discountValue) / 100);
      if (typeof maxDiscountAmount === 'number' && maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, maxDiscountAmount);
      }
    } else {
      discountAmount = discountValue;
    }

    discountAmount = Math.max(0, Math.min(discountAmount, this.subtotal));

    const label = discountType === 'PERCENT'
      ? `Giảm ${discountValue}%`
      : `Giảm ${this.formatCurrency(discountValue)}`;

    const description = discountType === 'PERCENT'
      ? 'Áp dụng giảm theo phần trăm trên giá trị đơn hàng.'
      : 'Áp dụng giảm trực tiếp theo số tiền cố định.';

    return {
      code,
      label,
      description,
      expiry: this.formatDate(coupon.end_at),
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrder,
      discountAmount,
      isBest: false,
    };
  }

  private formatDate(value?: string): string {
    if (!value) return 'Không giới hạn';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Không giới hạn';
    return date.toLocaleString('vi-VN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value ?? '')
      .replace(/[₫đ,\s]/gi, '')
      .replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private toTimestamp(value?: string): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private lockPageScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
  }
}



