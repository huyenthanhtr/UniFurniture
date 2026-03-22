import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TimelineStep, TrackingOrder } from '../models/order-tracking.models';

@Component({
  selector: 'app-tracking-order-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-order-summary.html',
  styleUrl: '../../order-tracking.css',
})
export class TrackingOrderSummaryComponent {
  @Input({ required: true }) order!: TrackingOrder;
  @Input() timelineSteps: TimelineStep[] = [];
  @Input() currentStepIndex = -1;
  @Input() isCancelledOrRefunded = false;
  @Input() canRequestCancel = false;
  @Input() showProductCard = true;
  @Input() shopZaloUrl = '';

  @Output() completeOrderClick = new EventEmitter<void>();
  @Output() toggleCancelClick = new EventEmitter<void>();

  paymentBadgeClass(): string {
    switch (this.order?.paymentState) {
      case 'settled':
        return 'status-pill--payment-settled';
      case 'deposit_paid':
        return 'status-pill--payment-deposit';
      default:
        return 'status-pill--payment-pending';
    }
  }

  isCodOrder(): boolean {
    const method = String(this.order?.paymentMethod || '').toLowerCase();
    return method.includes('cod');
  }

  canCompleteOrder(): boolean {
    return this.order?.backendStatus === 'delivered';
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
  }
}

