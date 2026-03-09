import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminOrdersService } from '../../services/admin-orders';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-orders.html',
  styleUrls: ['./admin-orders.css'],
})
export class AdminOrders implements OnInit {
  private api = inject(AdminOrdersService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;

  orders: any[] = [];
  filtered: any[] = [];

  q = '';
  status = '';
  sortBy: 'ordered_at' | 'total_amount' = 'ordered_at';
  sortDir: 'asc' | 'desc' = 'desc';

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  ngOnInit(): void {
    this.loadOrders(1);
  }

  loadOrders(page: number) {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
      sortBy: this.sortBy,
      order: this.sortDir,
    };

    if (this.status) params.status = this.status;
    if (this.q.trim()) params.q = this.q.trim();

    this.api.getOrders(params).subscribe({
      next: (res: any) => {
        const items = res?.items ?? [];
        this.orders = items;
        this.filtered = items;
        this.total = Number(res?.total ?? items.length ?? 0);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applySearch() {
    this.page = 1;
    this.loadOrders(1);
  }

  onChangeFilters() {
    this.page = 1;
    this.loadOrders(1);
  }

  viewDetail(order: any) {
    this.router.navigate(['/admin/orders', order._id]);
  }

  goPrev() {
    if (this.page > 1) this.loadOrders(this.page - 1);
  }

  goNext() {
    if (this.page < this.totalPages) this.loadOrders(this.page + 1);
  }

  goPage(p: any) {
    const n = Number(p);
    if (!Number.isFinite(n)) return;
    if (n >= 1 && n <= this.totalPages) this.loadOrders(n);
  }

  pagesToShow(): (number | '...')[] {
    const total = this.totalPages;
    const cur = this.page;

    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const out: (number | '...')[] = [];
    out.push(1);

    const left = Math.max(2, cur - 1);
    const right = Math.min(total - 1, cur + 1);

    if (left > 2) out.push('...');

    for (let i = left; i <= right; i++) out.push(i);

    if (right < total - 1) out.push('...');

    out.push(total);
    return out;
  }

  getPaymentBadge(order: any): { text: string; cls: string } {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paidTotal = Number(order?.payment_summary?.paid_total || 0);
    const hasDepositPaid = !!order?.payment_summary?.has_deposit_paid;
    const hasFullPaid = !!order?.payment_summary?.has_full_paid;
    const latestStatus = String(order?.payment_summary?.status || '').toLowerCase();
    const paymentCount = Number(order?.payment_summary?.count || 0);

    if (hasFullPaid || (total > 0 && paidTotal >= total)) {
      return { text: 'Tất toán', cls: 'payment-paid' };
    }

    if (hasDepositPaid) {
      return { text: 'Đã cọc', cls: 'payment-deposit' };
    }

    if (latestStatus === 'failed') {
      return { text: 'Thanh toán lỗi', cls: 'payment-failed' };
    }

    if (latestStatus === 'refunded') {
      return { text: 'Đã hoàn tiền', cls: 'payment-refunded' };
    }

    if (paymentCount > 0) {
      return { text: 'Chờ thanh toán', cls: 'payment-pending' };
    }

    return { text: 'Chưa thanh toán', cls: 'payment-unpaid' };
  }

  getStatusClass(status: string): string {
    const s = String(status || '').toLowerCase();

    if (s === 'completed') return 'status-completed';
    if (s === 'cancelled') return 'status-cancelled';
    if (s === 'refunded') return 'status-refunded';
    if (s === 'delivered') return 'status-delivered';
    if (s === 'shipping') return 'status-shipping';
    if (s === 'processing') return 'status-processing';
    if (s === 'confirmed') return 'status-confirmed';
    return 'status-pending';
  }

  orderStatusLabel(status: string): string {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'Chờ xác nhận';
    if (s === 'confirmed') return 'Đã xác nhận';
    if (s === 'processing') return 'Đang xử lý';
    if (s === 'shipping') return 'Đang giao';
    if (s === 'delivered') return 'Đã giao';
    if (s === 'completed') return 'Hoàn tất';
    if (s === 'cancelled') return 'Đã hủy';
    if (s === 'refunded') return 'Đã hoàn tiền';
    return status || '-';
  }
}
