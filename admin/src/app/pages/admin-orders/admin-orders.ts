import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminOrdersService } from '../../services/admin-orders';

type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-orders.html',
  styleUrls: ['./admin-orders.css'],
})
export class AdminOrders implements OnInit, OnDestroy {
  private api = inject(AdminOrdersService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;

  orders: any[] = [];
  pendingStatusChange: { order: any; newStatus: string; oldStatus: string } | null = null;

  filter = {
    search: '',
    status: '',
    customerType: '',
    startDate: '',
    endDate: '',
  };

  sortConfig: { column: string; direction: SortDirection } = {
    column: '',
    direction: 'asc',
  };

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  showConfirmPopup = false;
  showResultPopup = false;
  showCancelInfoPopup = false;
  cancelInfoOrder: any = null;
  confirmMessage = '';
  resultMessage = { title: '', message: '', type: 'success' as 'success' | 'error' };

  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.bindRouteState();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }
  }

  loadOrders(page: number): void {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
    };

    const { sortBy, order } = this.getSortParams();
    if (sortBy) {
      params.sortBy = sortBy;
      params.order = order;
    }

    if (this.filter.status) params.status = this.filter.status;
    if (this.filter.customerType) params.customerType = this.filter.customerType;
    if (this.filter.startDate) params.startDate = this.filter.startDate;
    if (this.filter.endDate) params.endDate = this.filter.endDate;
    if (this.filter.search.trim()) params.q = this.filter.search.trim();

    this.api.getOrders(params).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        this.orders = items.map((order: any) => ({
          ...order,
          _selectedStatus: order.status,
        }));
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

  onSearchChange(): void {
    if (this.searchDebounceId) clearTimeout(this.searchDebounceId);
    this.searchDebounceId = setTimeout(() => {
      this.updateRouteState({ page: 1 });
    }, 300);
  }

  applyFilters(): void {
    this.updateRouteState({ page: 1 });
  }

  resetFilters(): void {
    this.filter = {
      search: '',
      status: '',
      customerType: '',
      startDate: '',
      endDate: '',
    };
    this.sortConfig = { column: '', direction: 'asc' };
    this.updateRouteState({
      search: null,
      status: null,
      customerType: null,
      startDate: null,
      endDate: null,
      sortBy: null,
      order: null,
      page: null,
    });
  }

  toggleSort(column: string): void {
    const direction: SortDirection =
      this.sortConfig.column === column && this.sortConfig.direction === 'asc' ? 'desc' : 'asc';

    this.updateRouteState({
      sortBy: column,
      order: direction,
      page: 1,
    });
  }

  askStatusChange(order: any, nextStatus: string): void {
    const oldStatus = String(order?.status || '');

    if (!order?._id || !nextStatus || nextStatus === oldStatus) {
      order._selectedStatus = oldStatus;
      return;
    }

    order._selectedStatus = nextStatus;
    this.pendingStatusChange = { order, newStatus: nextStatus, oldStatus };
    this.confirmMessage = `Đổi trạng thái đơn hàng sang ${this.orderStatusLabel(nextStatus)}?`;
    this.showConfirmPopup = true;
  }

  executeStatusChange(): void {
    if (!this.pendingStatusChange) return;

    const { order, newStatus } = this.pendingStatusChange;
    this.showConfirmPopup = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(order._id), newStatus).subscribe({
      next: (doc: any) => {
        order.status = doc?.status || newStatus;
        order._selectedStatus = order.status;
        this.pendingStatusChange = null;
        this.isLoading = false;
        this.showResult('Thành công', 'Đã cập nhật trạng thái đơn hàng.', 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        order._selectedStatus = order.status;
        this.pendingStatusChange = null;
        this.isLoading = false;
        this.showResult('Thất bại', err?.error?.error || 'Cập nhật trạng thái thất bại.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      const { order, oldStatus } = this.pendingStatusChange;
      order._selectedStatus = oldStatus;
    }
    this.pendingStatusChange = null;
    this.showConfirmPopup = false;
  }

  showResult(title: string, message: string, type: 'success' | 'error'): void {
    this.resultMessage = { title, message, type };
    this.showResultPopup = true;
  }

  viewDetail(order: any): void {
    this.router.navigate(['/admin/orders', order._id], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  openCancelInfo(order: any): void {
    if (!order?.cancellation_request) return;
    this.cancelInfoOrder = order;
    this.showCancelInfoPopup = true;
  }

  closeCancelInfo(): void {
    this.showCancelInfoPopup = false;
    this.cancelInfoOrder = null;
  }

  goPrev(): void {
    if (this.page > 1) this.updateRouteState({ page: this.page - 1 });
  }

  goNext(): void {
    if (this.page < this.totalPages) this.updateRouteState({ page: this.page + 1 });
  }

  goPage(p: any): void {
    const n = Number(p);
    if (!Number.isFinite(n)) return;
    if (n >= 1 && n <= this.totalPages) this.updateRouteState({ page: n });
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

  getSortIconClass(column: string): string {
    if (this.sortConfig.column !== column) return 'fa-sort';
    return this.sortConfig.direction === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  getPaymentBadge(order: any): { text: string; cls: string } {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paidTotal = Number(order?.payment_summary?.paid_total || 0);
    const depositAmount = Number(order?.payment_summary?.deposit_amount || order?.deposit_amount || 0);
    const depositPaidTotal = Number(order?.payment_summary?.deposit_paid_total || 0);
    const hasDepositPaid = depositAmount > 0 && depositPaidTotal >= depositAmount;
    const hasFullPaid = total > 0 && paidTotal >= total;
    const latestStatus = String(order?.payment_summary?.status || '').toLowerCase();
    const paymentCount = Number(order?.payment_summary?.count || 0);

    if (hasFullPaid) {
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

  orderStatusLabel(status: string): string {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'Chờ xác nhận';
    if (s === 'confirmed') return 'Đã xác nhận';
    if (s === 'cancel_pending') return 'Chờ xác nhận hủy';
    if (s === 'processing') return 'Đang xử lý';
    if (s === 'shipping') return 'Đang giao';
    if (s === 'delivered') return 'Đã giao';
    if (s === 'completed') return 'Hoàn tất';
    if (s === 'cancelled') return 'Đã hủy';
    if (s === 'refunded') return 'Đã hoàn tiền';
    return status || '-';
  }

  customerTypeLabel(type: string): string {
    const key = String(type || '').toLowerCase();
    if (key === 'member') return 'Thành viên';
    if (key === 'guest') return 'Khách vãng lai';
    return type || '-';
  }

  private getSortParams(): { sortBy?: string; order?: SortDirection } {
    const sortMap: Record<string, string> = {
      order_code: 'order_code',
      customer_type: 'customer_type',
      payment: 'payment',
      total_amount: 'total_amount',
      ordered_at: 'ordered_at',
      status: 'status',
    };

    const sortBy = sortMap[this.sortConfig.column];
    if (!sortBy) return {};

    return { sortBy, order: this.sortConfig.direction };
  }

  private bindRouteState(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.filter = {
        search: String(params.get('search') || ''),
        status: String(params.get('status') || ''),
        customerType: String(params.get('customerType') || ''),
        startDate: String(params.get('startDate') || ''),
        endDate: String(params.get('endDate') || ''),
      };

      const sortBy = String(params.get('sortBy') || '');
      const order = String(params.get('order') || '').toLowerCase() === 'desc' ? 'desc' : 'asc';
      this.sortConfig = sortBy ? { column: sortBy, direction: order } : { column: '', direction: 'asc' };

      const page = Number(params.get('page') || 1);
      this.page = Number.isFinite(page) && page > 0 ? page : 1;

      this.loadOrders(this.page);
    });
  }

  private updateRouteState(changes: {
    search?: string | null;
    status?: string | null;
    customerType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sortBy?: string | null;
    order?: SortDirection | null;
    page?: number | null;
  }): void {
    const queryParams: Record<string, string | number | null> = {
      search: changes.search !== undefined ? (changes.search ? changes.search : null) : this.filter.search.trim() || null,
      status: changes.status !== undefined ? (changes.status ? changes.status : null) : this.filter.status || null,
      customerType:
        changes.customerType !== undefined
          ? (changes.customerType ? changes.customerType : null)
          : this.filter.customerType || null,
      startDate:
        changes.startDate !== undefined
          ? (changes.startDate ? changes.startDate : null)
          : this.filter.startDate || null,
      endDate:
        changes.endDate !== undefined
          ? (changes.endDate ? changes.endDate : null)
          : this.filter.endDate || null,
      sortBy:
        changes.sortBy !== undefined
          ? (changes.sortBy ? changes.sortBy : null)
          : this.sortConfig.column || null,
      order:
        changes.order !== undefined
          ? (changes.order ? changes.order : null)
          : (this.sortConfig.column ? this.sortConfig.direction : null),
      page:
        changes.page !== undefined
          ? (changes.page && changes.page > 1 ? changes.page : null)
          : (this.page > 1 ? this.page : null),
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }
}
