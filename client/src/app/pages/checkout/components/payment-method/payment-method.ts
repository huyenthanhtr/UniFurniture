import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CheckoutForm } from '../../checkout';

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-method.html',
  styleUrl: './payment-method.css',
})
export class PaymentMethodComponent {
  @Input() form!: CheckoutForm;
  @Input() total = 0;
  @Input() requireDeposit = false;
  @Input() depositAmount = 0;
  @Output() formChange = new EventEmitter<Partial<CheckoutForm>>();

  get codDisabled(): boolean {
    return this.requireDeposit;
  }

  selectPayment(method: 'COD' | 'CHUYEN_KHOAN'): void {
    if (method === 'COD' && this.codDisabled) return;
    this.formChange.emit({ paymentMethod: method });
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}\u20ab`;
  }
}