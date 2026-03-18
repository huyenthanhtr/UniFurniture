import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { getStockConstrainedQuantity } from '../../../../shared/cart-stock.util';
import { CheckoutCartItem } from '../../checkout';
import { CouponPickerComponent } from '../coupon-picker/coupon-picker';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  imports: [CommonModule, CouponPickerComponent],
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
})
export class OrderSummaryComponent {
  @Input() cartItems: CheckoutCartItem[] = [];
  @Input() subtotal = 0;
  @Input() totalDiscount = 0;
  @Input() couponAmount = 0;
  @Input() total = 0;
  @Input() requireDeposit = false;
  @Input() depositAmount = 0;
  @Input() isSubmitting = false;
  @Input() canSubmit = false;
  @Input() appliedCoupon = '';

  @Output() couponApplied = new EventEmitter<{ code: string; discount: number }>();
  @Output() quantityChange = new EventEmitter<{ cartKey: string; quantity: number }>();
  @Output() removeItem = new EventEmitter<string>();
  @Output() placeOrder = new EventEmitter<void>();

  stockErrorKeys = signal<Set<string>>(new Set());

  changeQty(item: CheckoutCartItem, delta: number): void {
    this.applyQuantity(item, item.quantity + delta);
  }

  onQuantityInput(event: Event, item: CheckoutCartItem): void {
    const input = event.target as HTMLInputElement;
    const nextQty = this.applyQuantity(item, Number.parseInt(input.value, 10));
    input.value = String(nextQty);
  }

  onQuantityBlur(event: Event, item: CheckoutCartItem): void {
    const input = event.target as HTMLInputElement;
    const nextQty = this.applyQuantity(item, Number.parseInt(input.value, 10));
    input.value = String(nextQty);
  }

  hasStockError(cartKey: string): boolean {
    return this.stockErrorKeys().has(cartKey);
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}₫`;
  }

  getLineTotal(item: CheckoutCartItem): number {
    return item.salePrice * item.quantity;
  }

  getSavedPerItem(item: CheckoutCartItem): number {
    return Math.max(0, item.originalPrice - item.salePrice);
  }

  private applyQuantity(item: CheckoutCartItem, rawValue: number): number {
    let nextQty = Number.isFinite(rawValue) ? Math.floor(rawValue) : item.quantity;
    if (nextQty < 1) nextQty = 1;

    const quantityState = getStockConstrainedQuantity(nextQty, item.maxStock, item.quantity);

    if (quantityState.exceededStock) {
      this.setStockError(item.cartKey);
    } else {
      this.clearStockError(item.cartKey);
    }

    nextQty = quantityState.allowedQuantity < 1 ? item.quantity : quantityState.allowedQuantity;

    if (nextQty !== item.quantity) {
      this.quantityChange.emit({ cartKey: item.cartKey, quantity: nextQty });
    }

    return nextQty;
  }

  private setStockError(cartKey: string): void {
    this.stockErrorKeys.update((set) => {
      const next = new Set(set);
      next.add(cartKey);
      return next;
    });
  }

  private clearStockError(cartKey: string): void {
    this.stockErrorKeys.update((set) => {
      const next = new Set(set);
      next.delete(cartKey);
      return next;
    });
  }
}
