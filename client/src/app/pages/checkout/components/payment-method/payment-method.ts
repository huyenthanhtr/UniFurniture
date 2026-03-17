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

  copiedField = '';

  readonly bankInfo = {
    accountName: 'CONG TY TNHH NOI THAT U-HOME FURNI',
    accountNumber: '0011111222333',
    bankName: 'Vietcombank - CN TP.HCM',
    content: 'DAT COC DON HANG + SO DIEN THOAI',
    qrUrl: 'assets/images/qrcode-default.png',
  };

  get codDisabled(): boolean {
    return this.requireDeposit;
  }

  selectPayment(method: 'COD' | 'CHUYEN_KHOAN'): void {
    if (method === 'COD' && this.codDisabled) {
      return;
    }

    if (method === 'CHUYEN_KHOAN') {
      this.formChange.emit({ paymentMethod: method, bankTransferConfirmed: false });
      return;
    }

    this.formChange.emit({ paymentMethod: method, bankTransferConfirmed: false });
  }

  markTransferDone(event: Event): void {
    event.stopPropagation();
    this.formChange.emit({ bankTransferConfirmed: true });
  }

  async copyValue(value: string, field: 'account' | 'content', event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      setTimeout(() => {
        if (this.copiedField === field) this.copiedField = '';
      }, 1500);
    } catch {
      this.copiedField = '';
    }
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}\u20ab`;
  }
}


