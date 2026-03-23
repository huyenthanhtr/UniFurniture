import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminOrdersService } from '../../services/admin-orders';
import { AdminInvoiceService } from '../../services/admin-invoice';
import {
  ADMIN_ORDER_STATUSES,
  canSelectOrderStatus,
  getOrderStatusLabel,
  getOrderStatusRestrictionMessage,
  normalizeOrderStatus,
} from '../../utils/order-status-rules';

type SortDirection = 'asc' | 'desc';
type PaymentStateKey = 'unpaid' | 'pending' | 'deposit_paid' | 'settled' | 'refunded';
const PAYMENT_STATE_FLOW: PaymentStateKey[] = ['unpaid', 'pending', 'deposit_paid', 'settled', 'refunded'];

function getExpectedDepositAmount(totalAmount: any, depositAmount: any): number {
  const total = Math.max(Number(totalAmount || 0), 0);
  const explicitDeposit = Math.max(Number(depositAmount || 0), 0);
  if (explicitDeposit > 0) return explicitDeposit;
  return total >= 10000000 ? Math.round(total * 0.1) : 0;
}

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-orders.html',
  styleUrls: ['./admin-orders.css'],
})
export class AdminOrders implements OnInit, OnDestroy {
  private api = inject(AdminOrdersService);
  private invoice = inject(AdminInvoiceService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;

  orders: any[] = [];
  pendingStatusChange: { order: any; newStatus: string; oldStatus: string } | null = null;
  pendingPaymentChange: { order: any; newStatus: string; oldStatus: string } | null = null;
  statusReasonDraft = '';

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
  showStatusInfoPopup = false;
  showStatusReasonFormPopup = false;
  showPaymentFormPopup = false;
  statusInfoOrder: any = null;
  confirmMessage = '';
  confirmKind: 'status' | 'payment' | '' = '';
  resultMessage = { title: '', message: '', type: 'success' as 'success' | 'error' };
  paymentEditor: {
    order: any;
    payments: any[];
    paymentId: string;
    nextStatus: string;
  } | null = null;
  readonly paymentStates: PaymentStateKey[] = [...PAYMENT_STATE_FLOW];
  readonly statuses = [...ADMIN_ORDER_STATUSES];

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
          status: normalizeOrderStatus(order.status),
          _selectedStatus: normalizeOrderStatus(order.status),
          _selectedPaymentStatus: this.getPaymentStateKey(order),
        }));
        this.total = Number(res?.total ?? items.length ?? 0);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
        this.isLoading = false;
        this.confirmKind = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.confirmKind = '';
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

    const restrictionMessage = this.getOrderStatusRestrictionMessage(order, nextStatus);
    if (restrictionMessage) {
      order._selectedStatus = oldStatus;
      this.showResult('Không thể cập nhật trạng thái', restrictionMessage, 'error');
      return;
    }

    order._selectedStatus = nextStatus;
    this.pendingStatusChange = { order, newStatus: nextStatus, oldStatus };

    if (this.requiresStatusReason(nextStatus, order)) {
      this.statusReasonDraft = '';
      this.showStatusReasonFormPopup = true;
      return;
    }

    this.confirmMessage = `Bạn có muốn cập nhật trạng thái đơn hàng sang "${this.orderStatusLabel(nextStatus)}" không?`;
    this.confirmKind = 'status';
    this.showConfirmPopup = true;
  }

  askPaymentChange(order: any, nextStatus: string): void {
    const oldStatus = String(order?._selectedPaymentStatus || this.getPaymentStateKey(order)).toLowerCase() as PaymentStateKey;
    const normalizedNextStatus = String(nextStatus || '').toLowerCase() as PaymentStateKey;

    if (!order?._id || !normalizedNextStatus || normalizedNextStatus === oldStatus) {
      order._selectedPaymentStatus = oldStatus;
      return;
    }

    const restrictionMessage = this.getPaymentStateRestrictionMessage(order, oldStatus, normalizedNextStatus);
    if (restrictionMessage) {
      order._selectedPaymentStatus = oldStatus;
      this.showResult('Không hợp lệ', restrictionMessage, 'error');
      return;
    }

    order._selectedPaymentStatus = normalizedNextStatus;
    this.pendingPaymentChange = { order, newStatus: normalizedNextStatus, oldStatus };
    this.confirmMessage = `Đổi trạng thái thanh toán sang ${this.getPaymentStateText(normalizedNextStatus)}?`;
    this.confirmKind = 'payment';
    this.showConfirmPopup = true;
  }

  executeConfirm(): void {
    if (this.confirmKind === 'payment') {
      this.executePaymentStatusChange();
      return;
    }
    this.executeStatusChange();
  }

  executeStatusChange(): void {
    if (this.confirmKind === 'payment') {
      this.executePaymentStatusChange();
      return;
    }
    if (!this.pendingStatusChange) return;

    const { order, newStatus } = this.pendingStatusChange;
    this.showConfirmPopup = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(order._id), newStatus).subscribe({
      next: (doc: any) => {
        Object.assign(order, doc || {});
        order.status = normalizeOrderStatus(doc?.status || newStatus);
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

  executeStatusReasonChange(): void {
    if (!this.pendingStatusChange) return;

    const { order, newStatus } = this.pendingStatusChange;
    const reason = this.statusReasonDraft.trim();

    if (!reason) {
      this.showResult('Thiếu thông tin', `Vui lòng nhập ${this.getStatusReasonTitle(newStatus).toLowerCase()}.`, 'error');
      return;
    }

    this.showStatusReasonFormPopup = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(order._id), newStatus, reason).subscribe({
      next: (doc: any) => {
        Object.assign(order, doc || {});
        order.status = normalizeOrderStatus(doc?.status || newStatus);
        order._selectedStatus = order.status;
        this.pendingStatusChange = null;
        this.statusReasonDraft = '';
        this.isLoading = false;
        this.showResult('Thành công', this.getStatusReasonSuccessMessage(newStatus), 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        order._selectedStatus = order.status;
        this.pendingStatusChange = null;
        this.statusReasonDraft = '';
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
    if (this.pendingPaymentChange) {
      const { order, oldStatus } = this.pendingPaymentChange;
      order._selectedPaymentStatus = oldStatus;
    }
    this.pendingStatusChange = null;
    this.pendingPaymentChange = null;
    this.confirmKind = '';
    this.showConfirmPopup = false;
    this.showStatusReasonFormPopup = false;
    this.statusReasonDraft = '';
  }

  showResult(title: string, message: string, type: 'success' | 'error'): void {
    this.resultMessage = { title, message, type };
    this.showResultPopup = true;
  }

  closeResultPopup(): void {
    this.showResultPopup = false;
    this.orders = this.orders.map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status),
      _selectedStatus: normalizeOrderStatus(order.status),
      _selectedPaymentStatus: this.getPaymentStateKey(order),
    }));
    this.cdr.detectChanges();
  }

  viewDetail(order: any): void {
    const orderKey = String(order?.order_code || order?._id || '').trim();
    if (!orderKey) return;

    this.router.navigate(['/admin/orders', orderKey], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  exportInvoice(order: any): void {
    const id = String(order?._id || '').trim();
    if (!id) return;

    this.isLoading = true;
    this.api.getOrderById(id).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.invoice.downloadInvoice(res || {});
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.showResult('Thất bại', err?.error?.error || 'Xuất hóa đơn thất bại.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  openPaymentEditor(order: any): void {
    const id = String(order?._id || '').trim();
    if (!id) return;

    this.isLoading = true;
    this.api.getOrderById(id).subscribe({
      next: (res: any) => {
        const payments = Array.isArray(res?.payments) ? res.payments : [];
        if (!payments.length) {
          this.isLoading = false;
          this.showResult('Không có giao dịch', 'Đơn này chưa có giao dịch thanh toán để cập nhật.', 'error');
          this.cdr.detectChanges();
          return;
        }

        const firstPayment = payments[0];
        this.paymentEditor = {
          order,
          payments,
          paymentId: String(firstPayment?._id || ''),
          nextStatus: String(firstPayment?.status || 'pending').toLowerCase(),
        };
        this.showPaymentFormPopup = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.showResult('Thất bại', err?.error?.error || 'Không tải được thông tin thanh toán.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  closePaymentEditor(): void {
    this.showPaymentFormPopup = false;
    this.paymentEditor = null;
  }

  get selectedPaymentRecord(): any | null {
    if (!this.paymentEditor) return null;
    return this.paymentEditor.payments.find((payment) => String(payment?._id || '') === this.paymentEditor?.paymentId) || null;
  }

  onPaymentRecordChange(): void {
    const payment = this.selectedPaymentRecord;
    if (!this.paymentEditor) return;
    this.paymentEditor.nextStatus = String(payment?.status || 'pending').toLowerCase();
  }

  askPaymentStatusChange(): void {
    const payment = this.selectedPaymentRecord;
    const nextStatus = String(this.paymentEditor?.nextStatus || '').toLowerCase();
    const currentStatus = String(payment?.status || '').toLowerCase();
    if (!payment?._id || !nextStatus || nextStatus === currentStatus) return;

    this.confirmMessage = `Đổi trạng thái thanh toán sang ${this.getPaymentStatusText(nextStatus)}?`;
    this.confirmKind = 'payment';
    this.showConfirmPopup = true;
  }

  executePaymentStatusChange(): void {
    if (this.pendingPaymentChange) {
      this.runPaymentStateChange();
      return;
    }

    const payment = this.selectedPaymentRecord;
    const nextStatus = String(this.paymentEditor?.nextStatus || '').toLowerCase();
    if (!payment?._id || !nextStatus) return;

    this.showConfirmPopup = false;
    this.isLoading = true;

    const payload: any = { status: nextStatus };
    if ((nextStatus === 'paid' || nextStatus === 'refunded') && !payment?.paid_at) {
      payload.paid_at = new Date().toISOString();
    }

    this.api.patchPayment(String(payment._id), payload).subscribe({
      next: () => {
        this.closePaymentEditor();
        this.confirmKind = '';
        this.loadOrders(this.page);
        this.showResult('Thành công', 'Đã cập nhật trạng thái thanh toán.', 'success');
      },
      error: (err: any) => {
        this.isLoading = false;
        this.confirmKind = '';
        this.showResult('Thất bại', err?.error?.message || 'Không thể cập nhật trạng thái thanh toán.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  isCancelledOrder(order: any): boolean {
    return String(order?.status || '').toLowerCase() === 'cancelled';
  }

  isExchangeOrder(order: any): boolean {
    return String(order?.status || '').toLowerCase() === 'exchanged';
  }

  canShowStatusReason(order: any): boolean {
    return !!this.getStatusReasonValue(order);
  }

  openStatusReason(order: any): void {
    if (!this.canShowStatusReason(order)) return;
    this.statusInfoOrder = order;
    this.showStatusInfoPopup = true;
  }

  closeStatusInfo(): void {
    this.showStatusInfoPopup = false;
    this.statusInfoOrder = null;
  }

  getCancellationReasonLabel(order: any): string {
    const cancelledBy = String(order?.cancellation_request?.cancelled_by || '').toLowerCase();
    if (cancelledBy === 'admin') return 'Lý do hủy (shop)';
    if (cancelledBy === 'customer' || String(order?.cancellation_request?.reason || '').trim()) {
      return 'Lý do hủy (khách)';
    }
    return 'Lý do hủy';
  }

  getStatusReasonLabel(order: any): string {
    return this.isExchangeOrder(order) ? 'Lý do đổi hàng' : this.getCancellationReasonLabel(order);
  }

  getStatusReasonValue(order: any): string {
    if (this.isExchangeOrder(order)) {
      return String(order?.exchange_request?.reason || '').trim();
    }
    if (this.isCancelledOrder(order)) {
      return String(order?.cancellation_request?.reason || '').trim();
    }
    return '';
  }

  getStatusReasonButtonText(order: any): string {
    return this.isExchangeOrder(order) ? 'Lý do đổi' : 'Lý do hủy';
  }

  getStatusReasonIcon(order: any): string {
    return this.isExchangeOrder(order) ? 'bi bi-arrow-left-right' : 'bi bi-ban';
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

  private async runPaymentStateChange(): Promise<void> {
    if (!this.pendingPaymentChange) return;

    const { order, newStatus, oldStatus } = this.pendingPaymentChange;
    this.showConfirmPopup = false;
    this.isLoading = true;

    try {
      const orderDetail = await firstValueFrom(this.api.getOrderById(String(order._id)));
      await this.applyPaymentStateChange(orderDetail, newStatus as PaymentStateKey);
      this.pendingPaymentChange = null;
      this.confirmKind = '';
      this.loadOrders(this.page);
      this.showResult('Thành công', 'Đã cập nhật trạng thái thanh toán.', 'success');
    } catch (err: any) {
      order._selectedPaymentStatus = oldStatus;
      this.pendingPaymentChange = null;
      this.isLoading = false;
      this.confirmKind = '';
      this.showResult('Thất bại', err?.error?.message || err?.message || 'Không thể cập nhật trạng thái thanh toán.', 'error');
      this.cdr.detectChanges();
    }
  }

  private async applyPaymentStateChange(orderDetail: any, nextState: PaymentStateKey): Promise<void> {
    const rootOrder = orderDetail?.order || orderDetail;
    const orderId = String(rootOrder?._id || '').trim();
    if (!orderId) {
      throw new Error('Không xác định được đơn hàng cần cập nhật.');
    }

    const payments = Array.isArray(orderDetail?.payments) ? [...orderDetail.payments] : [];
    const depositAmount = getExpectedDepositAmount(rootOrder?.total_amount, rootOrder?.deposit_amount);
    const totalAmount = Math.max(Number(rootOrder?.total_amount || 0), 0);
    const defaultMethod = String(payments[0]?.method || 'bank_transfer');

    const patchPayment = async (payment: any, payload: any) => {
      await firstValueFrom(this.api.patchPayment(String(payment._id), payload));
    };

    const createPayment = async (payload: any) => {
      return await firstValueFrom(this.api.createPayment(payload));
    };

    const setAllPayments = async (status: 'pending' | 'refunded') => {
      await Promise.all(
        payments.map((payment) =>
          patchPayment(
            payment,
            status === 'refunded' && !payment?.paid_at
              ? { status, paid_at: new Date().toISOString() }
              : { status }
          )
        )
      );
    };

    const upsertPayment = async (
      type: 'deposit' | 'remaining' | 'full',
      amount: number,
      status: 'pending' | 'paid' | 'failed' | 'refunded',
      method = defaultMethod
    ) => {
      const existing = payments.find((payment) => String(payment?.type || '').toLowerCase() === type);
      const payload = {
        type,
        method,
        amount,
        status,
        ...((status === 'paid' || status === 'refunded') && !existing?.paid_at
          ? { paid_at: new Date().toISOString() }
          : {}),
      };

      if (existing?._id) {
        await patchPayment(existing, payload);
        return;
      }

      await createPayment({
        order_id: orderId,
        ...payload,
      });
    };

    switch (nextState) {
      case 'pending':
      case 'unpaid': {
        if (!payments.length) {
          await createPayment({
            order_id: orderId,
            type: depositAmount > 0 ? 'deposit' : 'full',
            method: defaultMethod,
            amount: depositAmount > 0 ? depositAmount : totalAmount,
            status: 'pending',
            paid_at: null,
          });
          return;
        }
        await setAllPayments('pending');
        return;
      }
      case 'refunded': {
        if (!payments.length) {
          throw new Error('Đơn này chưa có giao dịch thanh toán để hoàn tiền.');
        }
        await setAllPayments('refunded');
        return;
      }
      case 'deposit_paid': {
        if (depositAmount <= 0) {
          throw new Error('Đơn này không có khoản đặt cọc để cập nhật.');
        }
        await setAllPayments('pending');
        await upsertPayment('deposit', depositAmount, 'paid');
        return;
      }
      case 'settled': {
        await setAllPayments('pending');

        if (depositAmount > 0) {
          await upsertPayment('deposit', depositAmount, 'paid');
          const remainingAmount = Math.max(totalAmount - depositAmount, 0);
          if (remainingAmount > 0) {
            await upsertPayment('remaining', remainingAmount, 'paid');
          }
          return;
        }

        await upsertPayment('full', totalAmount, 'paid');
        return;
      }
    }
  }

  getPaymentBadge(order: any): { text: string; cls: string } {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paidTotal = Number(order?.payment_summary?.paid_total || 0);
    const depositAmount = getExpectedDepositAmount(
      order?.payment_summary?.total_amount || order?.total_amount || 0,
      order?.payment_summary?.deposit_amount || order?.deposit_amount || 0
    );
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

    if (latestStatus === 'refunded') {
      return { text: 'Đã hoàn tiền', cls: 'payment-refunded' };
    }

    if (paymentCount > 0) {
      return { text: 'Chờ thanh toán', cls: 'payment-pending' };
    }

    return { text: 'Chưa thanh toán', cls: 'payment-unpaid' };
  }

  getPaymentTypeText(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'deposit') return 'Đặt cọc';
    if (key === 'remaining') return 'Thanh toán còn lại';
    if (key === 'full') return 'Thanh toán một lần';
    return '-';
  }

  getPaymentStatusText(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'paid') return 'Đã thanh toán';
    if (key === 'pending') return 'Đang chờ';
    if (key === 'failed') return 'Thất bại';
    if (key === 'refunded') return 'Hoàn tiền';
    return '-';
  }

  getPaymentStateKey(order: any): PaymentStateKey {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paidTotal = Number(order?.payment_summary?.paid_total || 0);
    const depositAmount = getExpectedDepositAmount(
      order?.payment_summary?.total_amount || order?.total_amount || 0,
      order?.payment_summary?.deposit_amount || order?.deposit_amount || 0
    );
    const depositPaidTotal = Number(order?.payment_summary?.deposit_paid_total || 0);
    const latestStatus = String(order?.payment_summary?.status || '').toLowerCase();
    const paymentCount = Number(order?.payment_summary?.count || 0);

    if (latestStatus === 'refunded') return 'refunded';
    if (total > 0 && paidTotal >= total) return 'settled';
    if (depositAmount > 0 && depositPaidTotal >= depositAmount) return 'deposit_paid';
    if (paymentCount > 0) return 'pending';
    return 'unpaid';
  }

  getPaymentStateText(state: any): string {
    const key = String(state || '').toLowerCase();
    if (key === 'settled') return 'Tất toán';
    if (key === 'deposit_paid') return 'Đã cọc';
    if (key === 'pending') return 'Đang chờ thanh toán';
    if (key === 'unpaid') return 'Chưa thanh toán';
    if (key === 'refunded') return 'Đã hoàn tiền';
    return 'Chưa rõ';
  }

  getPaymentStateOptions(order: any): PaymentStateKey[] {
    const currentState = this.getPaymentStateKey(order);
    const depositAmount = getExpectedDepositAmount(
      order?.payment_summary?.total_amount || order?.total_amount || 0,
      order?.payment_summary?.deposit_amount || order?.deposit_amount || 0
    );
    const allowedFlow = PAYMENT_STATE_FLOW.filter((state) => state !== 'deposit_paid' || depositAmount > 0);
    const currentIndex = Math.max(allowedFlow.indexOf(currentState), 0);
    return allowedFlow.slice(currentIndex);
  }

  private isOrderPaymentSettled(order: any): boolean {
    return this.getPaymentStateKey(order) === 'settled';
  }

  private getPaymentStateRestrictionMessage(order: any, currentState: PaymentStateKey, nextState: PaymentStateKey): string {
    const depositAmount = getExpectedDepositAmount(
      order?.payment_summary?.total_amount || order?.total_amount || 0,
      order?.payment_summary?.deposit_amount || order?.deposit_amount || 0
    );
    const allowedFlow = PAYMENT_STATE_FLOW.filter((state) => state !== 'deposit_paid' || depositAmount > 0);
    const currentIndex = allowedFlow.indexOf(currentState);
    const nextIndex = allowedFlow.indexOf(nextState);

    if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex) {
      return 'Trạng thái thanh toán chỉ được cập nhật theo chiều tăng dần từ trên xuống, không thể chuyển ngược lên trạng thái trước đó.';
    }

    return '';
  }

  orderStatusLabel(status: string): string {
    return getOrderStatusLabel(status);
  }

  isOrderStatusSelectable(order: any, status: string): boolean {
    return canSelectOrderStatus(order?.status, status);
  }

  getOrderStatusRestrictionMessage(order: any, nextStatus: string): string {
    const sharedMessage = getOrderStatusRestrictionMessage(order?.status, nextStatus);
    if (sharedMessage) return sharedMessage;

    if (String(nextStatus || '').toLowerCase() === 'completed' && !this.isOrderPaymentSettled(order)) {
      return 'Chỉ có thể chuyển đơn sang "Hoàn tất" khi trạng thái thanh toán đã là "Tất toán".';
    }

    return '';
  }
  
  customerTypeLabel(type: string): string {
    const key = String(type || '').toLowerCase();
    if (key === 'member') return 'Thành viên';
    if (key === 'guest') return 'Khách vãng lai';
    return type || '-';
  }

  requiresStatusReason(status: string, order?: any): boolean {
    const key = String(status || '').toLowerCase();
    if (key === 'exchanged') return true;

    if (key === 'cancelled') {
      const cancelledBy = String(order?.cancellation_request?.cancelled_by || '').toLowerCase();
      const existedReason = String(order?.cancellation_request?.reason || '').trim();
      if (cancelledBy === 'customer' && existedReason) {
        return false;
      }
      return true;
    }

    return false;
  }

  getStatusReasonTitle(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged'
      ? 'Lý do đổi hàng'
      : 'Lý do hủy đơn';
  }

  getStatusReasonDialogTitle(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged'
      ? 'Xác nhận chuyển sang đổi hàng'
      : 'Xác nhận hủy đơn hàng';
  }

  getStatusReasonPlaceholder(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged'
      ? 'Nhập lý do đổi hàng...'
      : 'Nhập lý do hủy đơn...';
  }

  getStatusReasonSubmitText(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged'
      ? 'Xác nhận cập nhật'
      : 'Xác nhận hủy đơn';
  }

  getStatusReasonSuccessMessage(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged'
      ? 'Đơn hàng đã được cập nhật sang trạng thái "Đã đổi hàng" và lý do đã được lưu.'
      : 'Đơn hàng đã được hủy và lý do hủy đã được lưu.';
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
          : this.sortConfig.column ? this.sortConfig.direction : null,
      page:
        changes.page !== undefined
          ? changes.page && changes.page > 1
            ? changes.page
            : null
          : this.page > 1
            ? this.page
            : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
    });
  }
}
