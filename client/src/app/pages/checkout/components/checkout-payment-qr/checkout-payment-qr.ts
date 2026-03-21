import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';
const QR_TTL_MS = 5 * 60 * 1000; // 5 phút

export type PaymentChoice = 'deposit' | 'full';

interface QrState {
  orderId: string;
  orderCode: string;
  total: number;
  requireDeposit: boolean;
  depositAmount: number;
  phone?: string;
  createdAt: number; // Date.now() lúc tạo đơn
}

@Component({
  selector: 'app-checkout-payment-qr',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './checkout-payment-qr.html',
  styleUrl: './checkout-payment-qr.css',
})
export class CheckoutPaymentQrComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  qrState: QrState | null = null;
  paymentChoice: PaymentChoice = 'deposit';
  expired = false;
  cancelling = false;
  cancelError = '';

  secondsLeft = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly bankInfo = {
    accountName: 'CONG TY TNHH NOI THAT U-HOME FURNI',
    accountNumber: '0011111222333',
    bankName: 'Vietcombank - CN TP.HCM',
    qrUrl: 'assets/images/qrcode-default.png',
  };

  copiedField = '';

  ngOnInit(): void {
    const raw = sessionStorage.getItem('checkout_qr_state');
    if (!raw) {
      void this.router.navigate(['/']);
      return;
    }

    try {
      this.qrState = JSON.parse(raw) as QrState;
    } catch {
      void this.router.navigate(['/']);
      return;
    }

    const elapsed = Date.now() - this.qrState.createdAt;
    const remaining = QR_TTL_MS - elapsed;

    if (remaining <= 0) {
      this.handleExpired();
      return;
    }

    this.secondsLeft = Math.ceil(remaining / 1000);
    this.paymentChoice = this.qrState.requireDeposit ? 'deposit' : 'full';
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get amountToPay(): number {
    if (!this.qrState) return 0;
    if (this.paymentChoice === 'deposit' && this.qrState.requireDeposit) {
      return this.qrState.depositAmount;
    }
    return this.qrState.total;
  }

  get timerDisplay(): string {
    const m = Math.floor(this.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  get timerUrgent(): boolean {
    return this.secondsLeft <= 60;
  }

  get transferContent(): string {
    return this.qrState ? `CK ${this.qrState.orderCode}` : '';
  }

  selectChoice(choice: PaymentChoice): void {
    this.paymentChoice = choice;
  }

  async copyValue(value: string, field: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      setTimeout(() => {
        if (this.copiedField === field) {
          this.copiedField = '';
          this.cdr.detectChanges();
        }
      }, 1500);
    } catch {
      this.copiedField = '';
    }
  }

  async cancelOrder(): Promise<void> {
    if (!this.qrState || this.cancelling) return;

    this.cancelling = true;
    this.cancelError = '';
    this.stopTimer();

    try {
      const phone = String(this.qrState.phone || '').trim();
      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/orders/${this.qrState.orderId}/cancel-request`, {
          reason: 'Khách hủy trong bước thanh toán chuyển khoản',
          note: `Hủy trước thời hạn QR cho đơn ${this.qrState.orderCode}`,
          phone,
        }),
      );

      sessionStorage.removeItem('checkout_qr_state');
      void this.router.navigate(['/'], { replaceUrl: true });
    } catch (error: any) {
      this.cancelError =
        String(error?.error?.error || '').trim() ||
        'Không thể hủy đơn lúc này. Vui lòng thử lại hoặc liên hệ shop.';
      this.cancelling = false;
      this.startTimer();
    }
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}\u20ab`;
  }

  private startTimer(): void {
    if (this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        this.handleExpired();
        return;
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private handleExpired(): void {
    this.stopTimer();
    this.expired = true;
    sessionStorage.removeItem('checkout_qr_state');

    const code = this.qrState?.orderCode || this.route.snapshot.queryParamMap.get('code') || '';
    void this.router.navigate(['/checkout-success'], {
      queryParams: { code: code || null },
      replaceUrl: true,
    });
  }
}
