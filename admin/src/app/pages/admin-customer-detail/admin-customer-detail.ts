import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminCustomersService } from '../../services/admin-customers';

@Component({
  selector: 'app-admin-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-customer-detail.html',
  styleUrls: ['./admin-customer-detail.css'],
})
export class AdminCustomerDetail implements OnInit {
  private api = inject(AdminCustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  id!: string;
  isLoading = false;

  merged: any = null;
  customer: any = null;
  profile: any = null;
  addresses: any[] = [];
  orders: any[] = [];

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      if (id) {
        this.id = id;
        this.load();
      }
    });
  }

  load() {
    this.isLoading = true;

    this.api.getCustomerById(this.id).subscribe({
      next: (res: any) => {
        this.merged = res?.merged ?? null;
        this.customer = res?.customer ?? null;
        this.profile = res?.profile ?? null;
        this.addresses = res?.addresses ?? [];
        this.orders = res?.orders ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  back() {
    this.router.navigate(['/admin/customers'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  get visibleAddresses(): any[] {
    return Array.isArray(this.addresses) ? this.addresses : [];
  }

  viewAddress(address: any) {
    this.router.navigate(['/admin/customers', this.id, 'addresses', address._id], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  viewOrder(order: any): void {
    const orderKey = String(order?.order_code || order?._id || '').trim();
    if (!orderKey) return;

    this.router.navigate(['/admin/orders', orderKey], {
      queryParams: {
        ...this.route.snapshot.queryParams,
        source: 'customer',
        customerId: this.id,
        readonly: '1',
      },
    });
  }

  canViewAddressDetail(address: any): boolean {
    return !!String(address?._id || '').trim();
  }

  orderStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'pending') return 'Chờ xác nhận';
    if (key === 'confirmed') return 'Đã xác nhận';
    if (key === 'processing') return 'Đang xử lý';
    if (key === 'shipping') return 'Đang giao';
    if (key === 'delivered') return 'Đã giao';
    if (key === 'completed') return 'Hoàn tất';
    if (key === 'cancelled') return 'Đã huỷ';
    if (key === 'exchanged') return 'Đã đổi hàng';
    return '-';
  }

  orderStatusClass(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'pending') return 'status-pending';
    if (key === 'confirmed') return 'status-confirmed';
    if (key === 'processing') return 'status-processing';
    if (key === 'shipping') return 'status-shipping';
    if (key === 'delivered') return 'status-delivered';
    if (key === 'completed') return 'status-completed';
    if (key === 'cancelled') return 'status-cancelled';
    if (key === 'exchanged') return 'status-exchanged';
    return 'status-default';
  }

  paymentStateLabel(order: any): string {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paidTotal = Number(order?.payment_summary?.paid_total || 0);
    const depositAmount = Number(order?.payment_summary?.deposit_amount || order?.deposit_amount || 0);
    const depositPaidTotal = Number(order?.payment_summary?.deposit_paid_total || 0);
    const latestStatus = String(order?.payment_summary?.status || '').toLowerCase();
    const paymentCount = Number(order?.payment_summary?.count || 0);

    if (latestStatus === 'refunded') return 'Hoàn tiền';
    if (latestStatus === 'failed') return 'Thất bại';
    if (total > 0 && paidTotal >= total) return 'Tất toán';
    if (depositAmount > 0 && depositPaidTotal >= depositAmount) return 'Đã cọc';
    if (paymentCount > 0) return 'Đang chờ';
    return 'Chưa thanh toán';
  }

  paymentStateClass(order: any): string {
    const label = this.paymentStateLabel(order);
    if (label === 'Tất toán') return 'badge-active';
    if (label === 'Đã cọc' || label === 'Đang chờ') return 'badge-warn';
    if (label === 'Hoàn tiền' || label === 'Thất bại') return 'badge-inactive';
    return 'badge-muted';
  }

  customerTypeLabel(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'guest') return 'Kh\u00e1ch v\u00e3ng lai';
    if (key === 'member') return 'C\u00f3 t\u00e0i kho\u1ea3n';
    return '-';
  }

  customerStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return '\u0110ang ho\u1ea1t \u0111\u1ed9ng';
    if (key === 'inactive') return 'Ng\u1eebng ho\u1ea1t \u0111\u1ed9ng';
    return '-';
  }

  genderLabel(gender: any): string {
    const key = String(gender || '').toLowerCase();
    if (key === 'male') return 'Nam';
    if (key === 'female') return 'N\u1eef';
    if (key === 'other') return 'Kh\u00e1c';
    return '-';
  }

  addressStatusLabel(): string {
    return '\u0110ang s\u1eed d\u1ee5ng';
  }
}
