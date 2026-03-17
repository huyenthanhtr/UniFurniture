import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShippingFormComponent } from './components/shipping-form/shipping-form';
import { PaymentMethodComponent } from './components/payment-method/payment-method';
import { OrderSummaryComponent } from './components/order-summary/order-summary';
import { UiStateService } from '../../shared/ui-state.service';

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
  bankTransferConfirmed: boolean;
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
    RouterLink,
    ShippingFormComponent,
    PaymentMethodComponent,
    OrderSummaryComponent,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class CheckoutComponent implements OnInit {
  private readonly ui = inject(UiStateService);
  private readonly http = inject(HttpClient);

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
    bankTransferConfirmed: false,
  };

  isSubmitting = false;
  orderSuccess = false;
  showSuccessPopup = false;
  successOrderCode = '';
  submitError = '';

  get cartItems(): CheckoutCartItem[] {
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
        variant: variantParts.length ? variantParts.join(' / ') : 'Mặc định',
        quantity: item.quantity,
        originalPrice: Math.max(unitOriginalPrice, unitPrice),
        salePrice: unitPrice,
        maxStock: typeof item.maxStock === 'number' ? item.maxStock : undefined,
      };
    });
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  }

  get totalDiscount(): number {
    return this.cartItems.reduce((sum, item) => sum + (item.originalPrice - item.salePrice) * item.quantity, 0);
  }

  get couponAmount(): number {
    return this.form.couponDiscount;
  }

  get total(): number {
    return Math.max(0, this.subtotal - this.couponAmount);
  }

  get requireDeposit(): boolean {
    return this.total >= 10000000;
  }

  get depositAmount(): number {
    return Math.round(this.total * 0.1);
  }

  ngOnInit(): void {
    this.ensureDepositPaymentRule();
  }

  onFormChange(patch: Partial<CheckoutForm>): void {
    const next = { ...this.form, ...patch };
    if (patch.paymentMethod && patch.paymentMethod !== 'CHUYEN_KHOAN') {
      next.bankTransferConfirmed = false;
    }
    this.form = next;
    this.ensureDepositPaymentRule();
  }

  onCouponApplied(payload: { code: string; discount: number }): void {
    this.form = {
      ...this.form,
      couponCode: payload.code,
      couponDiscount: payload.discount,
    };
    this.ensureDepositPaymentRule();
  }

  onQuantityChange(payload: { cartKey: string; quantity: number }): void {
    this.ui.updateCartItemQuantity(payload.cartKey, payload.quantity);
    this.ensureDepositPaymentRule();
  }

  onRemoveItem(cartKey: string): void {
    this.ui.removeFromCart(cartKey);
    this.ensureDepositPaymentRule();
  }

  canSubmit(): boolean {
    const phone = this.form.phone.trim();
    const paymentReady = this.form.paymentMethod === 'CHUYEN_KHOAN'
      ? this.form.bankTransferConfirmed
      : !!this.form.paymentMethod;

    return (
      this.cartItems.length > 0 &&
      !!this.form.fullName.trim() &&
      !!phone &&
      /^[0-9+\s-]{9,15}$/.test(phone) &&
      !!this.form.province.trim() &&
      !!this.form.district.trim() &&
      !!this.form.address.trim() &&
      !!this.form.shippingMethod &&
      paymentReady
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

    const payload = {
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
        this.successOrderCode = String(res?.order_code || '').trim();
        this.showSuccessPopup = true;
        this.ui.removeSelectedItems();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError =
          String(err?.error?.error || err?.error?.message || '').trim() ||
          'Không thể tạo đơn hàng. Vui lòng thử lại.';
      },
    });
  }

  closeSuccessPopup(): void {
    this.showSuccessPopup = false;
    this.orderSuccess = true;
  }

  private ensureDepositPaymentRule(): void {
    if (this.requireDeposit && this.form.paymentMethod !== 'CHUYEN_KHOAN') {
      this.form = { ...this.form, paymentMethod: 'CHUYEN_KHOAN', bankTransferConfirmed: false };
    }
  }
}
