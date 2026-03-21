import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrackingOrder } from '../models/order-tracking.models';

@Component({
  selector: 'app-tracking-cancel-flow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-cancel.html',
  styleUrl: '../../order-tracking.css',
})
export class TrackingCancelFlowComponent {
  @Input({ required: true }) order!: TrackingOrder;
  @Input() cancelReasons: readonly string[] = [];

  @Output() toggleCancelClick = new EventEmitter<void>();
  @Output() submitCancelClick = new EventEmitter<void>();

  hasCancellationHistory(): boolean {
    const req = this.order?.cancellationRequest;
    if (!req) return false;

    return Boolean(
      String(req.reason || '').trim() ||
      String(req.phone || '').trim() ||
      String(req.note || '').trim() ||
      String(req.requestedAt || '').trim(),
    );
  }
}


