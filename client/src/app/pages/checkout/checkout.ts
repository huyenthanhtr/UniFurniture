import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoyaltyService } from '../../shared/loyalty.service';
import { UiStateService } from '../../shared/ui-state.service';
import { CouponPickerComponent } from './components/coupon-picker/coupon-picker';
import { OrderSummaryComponent } from './components/order-summary/order-summary';
import { ShippingFormComponent } from './components/shipping-form/shipping-form';

const API_BASE_URL = 'http://localhost:3000/api';

export interface CheckoutCartItem {
  cartKey: string;
  productId: string;
  variantId?: string;
  name: string;
  imageUrl: string;
  variant: string;
  quantity: number;
  originalPrice: number;
  salePrice: number;
  maxStock?: number;
}

export interface CheckoutForm {
  fullName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  address: string;
  note: string;
  shippingMethod: 'GIAO_VA_LAP' | 'GIAO_KHONG_LAP' | '';
  paymentMethod: 'COD' | 'CHUYEN_KHOAN' | '';
  couponCode: string;
  couponDiscount: number;
  // bankTransferConfirmed dã b? — xác nh?n CK nay n?m ? trang checkout-payment-qr
}

interface PlaceOrderResponse {
  message?: string;
  order_id?: string;
  order_code?: string;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    ShippingFormComponent,
    OrderSummaryComponent,
    CouponPickerComponent,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class CheckoutComponent implements OnInit {
  private readonly ui = inject(UiStateService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly loyaltyService = inject(LoyaltyService);

  private buyNowItem: CheckoutCartItem | null = null;
  estimatedPointsFromApi = 0;

  form: CheckoutForm = {
    fullName: '',
    phone: '',
    email: '',
    province: '',
    district: '',
    address: '',
    note: '',
    shippingMethod: '',
    paymentMethod: '',
    couponCode: '',
    couponDiscount: 0,
  };

  isSubmitting = false;
  submitError = '';

  get cartItems(): CheckoutCartItem[] {
    if (this.buyNowItem) return [this.buyNowItem];

    const selected = this.ui.selectedCartKeys();
    const source = this.ui.cartItems().filter((item) => selected.has(item.cartKey));

    return source.map((item) => {
      const unitPrice = typeof item.price === 'number' ? item.price : 0;
      const unitOriginalPrice = typeof item.originalPrice === 'number' ? item.originalPrice : unitPrice;
      const variantParts = [item.colorName, item.variantLabel].filter(Boolean);
      return {
        cartKey: item.cartKey,
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        imageUrl: item.imageUrl,
        variant: variantParts.length ? variantParts.join(' / ') : 'M?c d?nh',
        quantity: item.quantity,
        originalPrice: Math.max(unitOriginalPrice, unitPrice),
        salePrice: unitPrice,
        maxStock: typeof item.maxStock === 'number' ? item.maxStock : undefined,
      };
    });
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, i) => sum + i.salePrice * i.quantity, 0);
  }

  get totalDiscount(): number {
    return this.cartItems.reduce((sum, i) => sum + (i.originalPrice - i.salePrice) * i.quantity, 0);
  }

  get couponAmount(): number {
    return this.form.couponDiscount;
  }

  get total(): number {
    return Math.max(0, this.subtotal - this.couponAmount);
  }

  get estimatedLoyaltyPoints(): number {
    if (!this.isLoggedIn()) return 0;
    return Math.max(0, this.estimatedPointsFromApi);
  }

  get requireDeposit(): boolean {
    return this.total >= 10000000;
  }

  get depositAmount(): number {
    return Math.round(this.total * 0.1);
  }

  isLoggedIn(): boolean {
    const token = String(localStorage.getItem('access_token') || '').trim();
    const rawProfile = String(localStorage.getItem('user_profile') || '').trim();
    if (token) return true;
    if (!rawProfile) return false;
    try {
      const profile = JSON.parse(rawProfile);
      return !!String(profile?._id || profile?.id || profile?.phone || '').trim();
    } catch {
      return false;
    }
  }

  ngOnInit(): void {
    this.loadBuyNowState();
    this.ensureDepositPaymentRule();
    void this.refreshEstimatedPoints();
  }

  onFormChange(patch: Partial<CheckoutForm>): void {
    this.form = { ...this.form, ...patch };
    this.ensureDepositPaymentRule();
  }

  onCouponApplied(payload: { code: string; discount: number }): void {
    this.form = { ...this.form, couponCode: payload.code, couponDiscount: payload.discount };
    // Sau khi áp coupon, re-check ngu?ng deposit
    this.ensureDepositPaymentRule();
    void this.refreshEstimatedPoints();
  }

  onQuantityChange(payload: { cartKey: string; quantity: number }): void {
    if (this.buyNowItem && this.buyNowItem.cartKey === payload.cartKey) {
      const rawQty = Number.isFinite(payload.quantity) ? Math.floor(payload.quantity) : this.buyNowItem.quantity;
      const maxQty = typeof this.buyNowItem.maxStock === 'number'
        ? Math.max(1, this.buyNowItem.maxStock)
        : Number.POSITIVE_INFINITY;
      this.buyNowItem = { ...this.buyNowItem, quantity: Math.max(1, Math.min(rawQty, maxQty)) };
      this.ensureDepositPaymentRule();
      void this.refreshEstimatedPoints();
      return;
    }
    this.ui.updateCartItemQuantity(payload.cartKey, payload.quantity);
    this.ensureDepositPaymentRule();
    void this.refreshEstimatedPoints();
  }


  canSubmit(): boolean {
    const phone = this.form.phone.trim();
    const normalizedPhone = phone.replace(/[\s.-]/g, '');
    const email = this.form.email.trim();
    const isPhoneValid = /^(0\d{9}|\+84\d{9})$/.test(normalizedPhone);
    const isEmailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

    return (
      this.cartItems.length > 0 &&
      !!this.form.fullName.trim() &&
      !!phone &&
      isPhoneValid &&
      isEmailValid &&
      !!this.form.province.trim() &&
      !!this.form.district.trim() &&
      !!this.form.address.trim() &&
      !!this.form.shippingMethod &&
      !!this.form.paymentMethod
      // bankTransferConfirmed dã b? kh?i di?u ki?n
    );
  }

  openLoginModal(): void {
    this.ui.openAuth('login');
  }

  placeOrder(): void {
    this.ensureDepositPaymentRule();
    if (!this.canSubmit()) return;

    this.isSubmitting = true;
    this.submitError = '';

    let accountId = '';
    try {
      const rawProfile = localStorage.getItem('user_profile');
      const savedProfile = rawProfile ? JSON.parse(rawProfile) : null;
      accountId = String(savedProfile?._id || savedProfile?.id || '').trim();
    } catch {
      accountId = '';
    }

    const payload = {
      account_id: accountId,
      shipping_name: this.form.fullName,
      shipping_phone: this.form.phone,
      shipping_email: this.form.email,
      province: this.form.province,
      district: this.form.district,
      shipping_address: this.form.address,
      shipping_method: this.form.shippingMethod,
      payment_method: this.form.paymentMethod,
      coupon_code: this.form.couponCode,
      coupon_discount: this.form.couponDiscount,
      total_amount: this.total,
      deposit_amount: this.requireDeposit ? this.depositAmount : 0,
      note: this.form.note,
      items: this.cartItems.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId || '',
        product_name: item.name,
        variant_name: item.variant,
        quantity: item.quantity,
        unit_price: item.salePrice,
        original_price: item.originalPrice,
      })),
    };

    this.http.post<PlaceOrderResponse>(`${API_BASE_URL}/orders`, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const orderCode = String(res?.order_code || '').trim();
        const orderId = String(res?.order_id || '').trim();

        // Snapshot gia tri don truoc khi don gio hang
        const finalTotal = this.total;
        const finalRequireDeposit = finalTotal >= 10000000;
        const finalDepositAmount = finalRequireDeposit ? Math.round(finalTotal * 0.1) : 0;

        // D?n gi? hàng
        if (this.buyNowItem) {
          this.buyNowItem = null;
        } else {
          this.ui.removeSelectedItems();
        }

        if (this.form.paymentMethod === 'CHUYEN_KHOAN') {
          // -- Luu thông tin vào sessionStorage d? trang QR + order-tracking dùng --
          const qrState = {
            orderId,
            orderCode,
            total: finalTotal,
            requireDeposit: finalRequireDeposit,
            depositAmount: finalDepositAmount,
            phone: this.form.phone,
            createdAt: Date.now(), // timestamp d? tính d?ng h? 5 phút
          };
          sessionStorage.setItem('checkout_qr_state', JSON.stringify(qrState));

          // Navigate sang trang QR
          void this.router.navigate(['/checkout-payment'], {
            queryParams: { code: orderCode || null },
          });
        } else {
          // COD ? thành công luôn
          void this.router.navigate(['/checkout-success'], {
            queryParams: { code: orderCode || null },
          });
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError =
          String(err?.error?.error || err?.error?.message || '').trim() ||
          'Không th? t?o don hàng. Vui lòng th? l?i.';
      },
    });
  }

  // N?u don > 10tr ? b?t bu?c CK, khóa COD
  private ensureDepositPaymentRule(): void {
    if (this.requireDeposit && this.form.paymentMethod !== 'CHUYEN_KHOAN') {
      this.form = { ...this.form, paymentMethod: 'CHUYEN_KHOAN' };
    }
  }

  private loadBuyNowState(): void {
    const currentNavigation = this.router.getCurrentNavigation();
    const candidate =
      (currentNavigation?.extras?.state as any)?.buyNowItem ||
      (window.history.state as any)?.buyNowItem;

    if (!candidate || typeof candidate !== 'object') return;
    if (!candidate.cartKey || !candidate.productId || !candidate.name) return;

    const quantity = Math.max(1, Number(candidate.quantity) || 1);
    const salePrice = typeof candidate.salePrice === 'number' ? candidate.salePrice : 0;
    const originalPrice = typeof candidate.originalPrice === 'number'
      ? Math.max(candidate.originalPrice, salePrice)
      : salePrice;

    this.buyNowItem = {
      cartKey: String(candidate.cartKey),
      productId: String(candidate.productId),
      variantId: String(candidate.variantId || ''),
      name: String(candidate.name),
      imageUrl: String(candidate.imageUrl || ''),
      variant: String(candidate.variant || 'M?c d?nh'),
      quantity,
      originalPrice,
      salePrice,
      maxStock: typeof candidate.maxStock === 'number' ? candidate.maxStock : undefined,
    };
  }

  private async refreshEstimatedPoints(): Promise<void> {
    if (!this.isLoggedIn()) {
      this.estimatedPointsFromApi = 0;
      return;
    }
    this.estimatedPointsFromApi = await this.loyaltyService.estimatePoints(this.total);
  }
}


