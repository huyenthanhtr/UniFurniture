import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminOrdersService } from '../../services/admin-orders';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-order-detail.html',
  styleUrls: ['./admin-order-detail.css'],
})
export class AdminOrderDetail implements OnInit {
  private api = inject(AdminOrdersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  id!: string;
  isLoading = false;

  order: any = null;
  customer: any = null;
  profile: any = null;
  items: any[] = [];
  payments: any[] = [];
  display: any = null;
  pricing: any = null;

  editableStatus = 'pending';
  cancelReasonDraft = '';

  showConfirm = false;
  showCancelForm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  readonly statuses = [
    'pending',
    'confirmed',
    'cancel_pending',
    'processing',
    'shipping',
    'delivered',
    'completed',
    'cancelled',
    'refunded',
  ];

  private readonly paidStatuses = new Set(['paid']);
  private readonly pendingStatuses = new Set(['pending']);

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
    this.api.getOrderById(this.id).subscribe({
      next: (res: any) => {
        this.order = res?.order ?? null;
        this.customer = res?.customer ?? null;
        this.profile = res?.profile ?? null;
        this.items = res?.items ?? [];
        this.payments = res?.payments ?? [];
        this.display = res?.display ?? null;
        this.pricing = res?.pricing ?? null;
        this.editableStatus = this.order?.status || 'pending';
        this.cancelReasonDraft = '';
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
    this.router.navigate(['/admin/orders'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  viewProductDetail(item: any): void {
    const productId = String(item?.product_id || '').trim();
    if (!productId) return;
    this.router.navigate(['/admin/products', productId]);
  }

  askSaveStatus() {
    if (!this.order?._id || !this.editableStatus || this.editableStatus === this.order.status) return;

    if (String(this.editableStatus).toLowerCase() === 'cancelled') {
      this.cancelReasonDraft = '';
      this.showCancelForm = true;
      this.cdr.detectChanges();
      return;
    }

    this.confirmMessage = `Đổi trạng thái đơn hàng sang ${this.orderStatusLabel(this.editableStatus)}?`;
    this.confirmAction = () => this.saveStatus();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  saveStatus() {
    this.showConfirm = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(this.order._id), this.editableStatus).subscribe({
      next: (doc: any) => {
        this.order = { ...this.order, ...(doc || {}), status: doc?.status || this.editableStatus };
        this.editableStatus = this.order.status;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveCancelledStatus(): void {
    const reason = this.cancelReasonDraft.trim();
    if (!reason || !this.order?._id) return;

    this.showCancelForm = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(this.order._id), this.editableStatus, reason).subscribe({
      next: (doc: any) => {
        this.order = { ...this.order, ...(doc || {}), status: doc?.status || this.editableStatus };
        this.editableStatus = this.order.status;
        this.cancelReasonDraft = '';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeConfirm() {
    this.showConfirm = false;
    this.showCancelForm = false;
    this.confirmAction = null;
    this.cancelReasonDraft = '';
    this.editableStatus = this.order?.status || this.editableStatus;
    this.cdr.detectChanges();
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }

  toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  isPaidPayment(payment: any): boolean {
    const status = String(payment?.status || '').toLowerCase();
    return this.paidStatuses.has(status);
  }

  isPendingPayment(payment: any): boolean {
    const status = String(payment?.status || '').toLowerCase();
    return this.pendingStatuses.has(status);
  }

  get paidAmount(): number {
    return this.payments.reduce((sum, p) => sum + (this.isPaidPayment(p) ? this.toNumber(p?.amount) : 0), 0);
  }

  get pendingAmount(): number {
    return this.payments.reduce((sum, p) => sum + (this.isPendingPayment(p) ? this.toNumber(p?.amount) : 0), 0);
  }

  get remainingAmount(): number {
    const total = this.toNumber(this.order?.total_amount);
    const remaining = total - this.paidAmount;
    return remaining > 0 ? remaining : 0;
  }

  get hasOrderItems(): boolean {
    return this.items.length > 0;
  }

  get discountAmount(): number {
    return this.toNumber(this.pricing?.discount_amount);
  }

  get grandTotal(): number {
    const total = this.toNumber(this.pricing?.grand_total);
    return total || this.toNumber(this.order?.total_amount);
  }

  get showDiscountRow(): boolean {
    return this.discountAmount > 0 || !!String(this.pricing?.coupon_code || '').trim();
  }

  get discountLabel(): string {
    const code = String(this.pricing?.coupon_code || '').trim();
    return code ? `Mã khuyến mãi: ${code}` : 'Khuyến mãi';
  }

  get hasApprovedReviews(): boolean {
    return this.items.some((item) => !!item?.approved_review);
  }

  get summaryColspan(): number {
    return this.hasApprovedReviews ? 9 : 7;
  }

  getPaymentTypeText(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'deposit') return 'Đặt cọc';
    if (key === 'remaining') return 'Thanh toán còn lại';
    if (key === 'full') return 'Thanh toán một lần';
    return '-';
  }

  getPaymentMethodText(method: any): string {
    const key = String(method || '').toLowerCase();
    if (key === 'cod') return 'COD';
    if (key === 'bank_transfer') return 'Chuyển khoản';
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

  getPaymentStatusClass(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'paid') return 'payment-paid';
    if (key === 'pending') return 'payment-pending';
    if (key === 'failed') return 'payment-failed';
    if (key === 'refunded') return 'payment-refunded';
    return 'payment-unknown';
  }

  orderStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'pending') return 'Chờ xác nhận';
    if (key === 'confirmed') return 'Đã xác nhận';
    if (key === 'cancel_pending') return 'Chờ xác nhận huỷ';
    if (key === 'processing') return 'Đang xử lý';
    if (key === 'shipping') return 'Đang giao';
    if (key === 'delivered') return 'Đã giao';
    if (key === 'completed') return 'Hoàn tất';
    if (key === 'cancelled') return 'Đã huỷ';
    if (key === 'refunded') return 'Đã hoàn tiền';
    return status || '-';
  }

  isCancelledOrder(): boolean {
    return ['cancelled', 'refunded'].includes(String(this.order?.status || '').toLowerCase());
  }

  hasCancellationReason(): boolean {
    return this.isCancelledOrder() && !!String(this.order?.cancellation_request?.reason || '').trim();
  }

  getCancellationReasonLabel(): string {
    const cancelledBy = String(this.order?.cancellation_request?.cancelled_by || '').toLowerCase();
    if (cancelledBy === 'admin') return 'Lý do huỷ (shop)';
    if (cancelledBy === 'customer' || this.hasCancellationReason()) return 'Lý do huỷ (khách)';
    return 'Lý do huỷ';
  }

  getItemReviewRating(item: any): string {
    const rating = Number(item?.approved_review?.rating || 0);
    return rating > 0 ? `${rating}/5` : '-';
  }

  getItemReviewContent(item: any): string {
    return String(item?.approved_review?.content || '').trim() || '-';
  }

  customerTypeLabel(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'guest') return 'Khách vãng lai';
    if (key === 'member') return 'Thành viên';
    return type || '-';
  }

  customerStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return 'Đang hoạt động';
    if (key === 'inactive') return 'Ngừng hoạt động';
    if (key === 'blocked') return 'Đã khóa';
    return status || '-';
  }

  normalizeImageUrl(value: any): string {
    const src = String(value || '').trim();
    if (!src) return 'https://cdn.hstatic.net/shared/noDefaultImage6_master.gif';
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `http://localhost:3000${src}`;
    return src;
  }

  canViewProduct(item: any): boolean {
    return !!String(item?.product_id || '').trim();
  }
}
