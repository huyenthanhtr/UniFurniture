import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminOrdersService } from '../../services/admin-orders';
import { AdminInvoiceService } from '../../services/admin-invoice';
import { AdminProductsService } from '../../services/admin-products';
import {
  ADMIN_ORDER_STATUSES,
  canSelectOrderStatus,
  getOrderStatusLabel,
  getOrderStatusRestrictionMessage,
  normalizeOrderStatus,
} from '../../utils/order-status-rules';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-order-detail.html',
  styleUrls: ['./admin-order-detail.css'],
})
export class AdminOrderDetail implements OnInit {
  private api = inject(AdminOrdersService);
  private invoice = inject(AdminInvoiceService);
  private productsApi = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  orderKey!: string;
  isLoading = false;

  order: any = null;
  customer: any = null;
  profile: any = null;
  items: any[] = [];
  payments: any[] = [];
  display: any = null;
  pricing: any = null;
  warranty: any = null;
  private productImagesMap = new Map<string, any[]>();

  editableStatus = 'pending';
  statusReasonDraft = '';
  warrantyError = '';

  showConfirm = false;
  showStatusReason = false;
  showStatusReasonForm = false;
  showWarrantyForm = false;
  showWarrantyDetail = false;
  confirmMessage = '';
  confirmMode: 'status' | 'warranty' | '' = '';
  confirmAction: null | (() => void) = null;
  selectedWarrantyRecord: any = null;
  warrantyRecordDraft = this.createEmptyWarrantyDraft();

  readonly statuses = [...ADMIN_ORDER_STATUSES];

  private readonly paidStatuses = new Set(['paid']);
  private readonly pendingStatuses = new Set(['pending']);
  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const orderKey = pm.get('id');
      if (orderKey) {
        this.orderKey = orderKey;
        this.load();
      }
    });
  }

  load() {
    this.isLoading = true;
    this.api.getOrderById(this.orderKey).subscribe({
      next: (res: any) => {
        this.order = res?.order ?? null;
        this.customer = res?.customer ?? null;
        this.profile = res?.profile ?? null;
        this.items = res?.items ?? [];
        this.payments = res?.payments ?? [];
        this.display = res?.display ?? null;
        this.pricing = res?.pricing ?? null;
        this.warranty = res?.warranty ?? null;
        if (this.order) {
          this.order.status = normalizeOrderStatus(this.order?.status);
        }
        this.resetEditableStatus();
        this.statusReasonDraft = '';
        this.warrantyError = '';
        this.showWarrantyForm = false;
        this.showWarrantyDetail = false;
        this.selectedWarrantyRecord = null;
        this.resetWarrantyDraft();
        this.syncRouteWithOrderCode();
        this.loadProductImagesForItems();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private resetEditableStatus(): void {
    this.editableStatus = normalizeOrderStatus(this.order?.status || 'pending') || 'pending';
  }

  private syncRouteWithOrderCode(): void {
    const orderCode = String(this.order?.order_code || '').trim();
    if (!orderCode || orderCode === this.orderKey) return;

    this.orderKey = orderCode;
    this.router.navigate(['/admin/orders', orderCode], {
      queryParams: this.route.snapshot.queryParams,
      replaceUrl: true,
    });
  }

  private loadProductImagesForItems(): void {
    const productIds = Array.from(
      new Set(
        this.items
          .map((item) => String(item?.product_id || '').trim())
          .filter(Boolean)
      )
    );

    if (!productIds.length) {
      this.productImagesMap.clear();
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const requests = productIds.map((productId) =>
      this.productsApi.getImages({ product_id: productId, limit: 500 })
    );

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        this.productImagesMap.clear();
        responses.forEach((res, index) => {
          const productId = productIds[index];
          const images = this.sortImages(res?.items ?? res ?? []);
          this.productImagesMap.set(productId, images);
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.productImagesMap.clear();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private sortImages(arr: any[]): any[] {
    return [...arr].sort((a, b) => {
      if (!!a?.is_primary !== !!b?.is_primary) return a?.is_primary ? -1 : 1;
      const ao = Number(a?.sort_order || 0);
      const bo = Number(b?.sort_order || 0);
      if (ao !== bo) return ao - bo;
      const at = new Date(a?.createdAt || 0).getTime();
      const bt = new Date(b?.createdAt || 0).getTime();
      return at - bt;
    });
  }

  getItemDisplayImage(item: any): string {
    const directImage =
      String(item?.image_url || '').trim() ||
      String(item?.thumbnail || '').trim() ||
      String(item?.thumbnail_url || '').trim();
    if (directImage) return directImage;

    const productId = String(item?.product_id || '').trim();
    const variantId = String(item?.variant_id || '').trim();
    const images = this.productImagesMap.get(productId) || [];

    const variantImage = images.find((img) => String(img?.variant_id || '') === variantId)?.image_url;
    if (variantImage) return variantImage;

    const sharedImage = images.find((img) => !img?.variant_id)?.image_url;
    if (sharedImage) return sharedImage;

    return images[0]?.image_url || '';
  }

  back() {
    this.router.navigate(['/admin/orders'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  viewProductDetail(item: any): void {
    const productSlug = String(item?.product_slug || '').trim();
    const productId = String(item?.product_id || '').trim();
    if (!productSlug && !productId) return;
    this.router.navigate(['/admin/products', productSlug || productId]);
  }

  exportInvoice(): void {
    if (!this.order) return;
    this.invoice.downloadInvoice({
      order: this.order,
      customer: this.customer,
      profile: this.profile,
      items: this.items,
      payments: this.payments,
      display: this.display,
      pricing: this.pricing,
    });
  }

  onEditableStatusChange(nextStatus: string): void {
    this.editableStatus = String(nextStatus || '').toLowerCase();

    if (!this.order?._id || !this.editableStatus || this.editableStatus === this.order.status) {
      return;
    }

    const restrictionMessage = this.getOrderStatusRestrictionMessage(this.editableStatus);
    if (restrictionMessage) {
      this.resetEditableStatus();
      this.showConfirmMessage(restrictionMessage);
      return;
    }

    if (this.requiresStatusReason(this.editableStatus, this.order)) {
      this.statusReasonDraft = '';
      this.showStatusReasonForm = true;
      this.cdr.detectChanges();
    }
  }

  askSaveStatus() {
    if (!this.order?._id || !this.editableStatus || this.editableStatus === this.order.status) return;

    const restrictionMessage = this.getOrderStatusRestrictionMessage(this.editableStatus);
    if (restrictionMessage) {
      this.resetEditableStatus();
      this.showConfirmMessage(restrictionMessage);
      return;
    }

    if (this.requiresStatusReason(this.editableStatus, this.order)) {
      this.statusReasonDraft = '';
      this.showStatusReasonForm = true;
      this.cdr.detectChanges();
      return;
    }

    this.confirmMessage = `Bạn có muốn cập nhật trạng thái đơn hàng sang "${this.orderStatusLabel(this.editableStatus)}" không?`;
    this.confirmMode = 'status';
    this.confirmAction = () => this.saveStatus();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  saveStatus() {
    this.showConfirm = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(this.order._id), this.editableStatus).subscribe({
      next: (doc: any) => {
        this.order = { ...this.order, ...(doc || {}), status: normalizeOrderStatus(doc?.status || this.editableStatus) };
        this.resetEditableStatus();
        this.syncWarrantyFromOrder();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.resetEditableStatus();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveStatusWithReason(): void {
    const reason = this.statusReasonDraft.trim();
    if (!reason || !this.order?._id) return;

    this.showStatusReasonForm = false;
    this.isLoading = true;

    this.api.patchOrderStatus(String(this.order._id), this.editableStatus, reason).subscribe({
      next: (doc: any) => {
        this.order = { ...this.order, ...(doc || {}), status: normalizeOrderStatus(doc?.status || this.editableStatus) };
        this.resetEditableStatus();
        this.statusReasonDraft = '';
        this.syncWarrantyFromOrder();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.resetEditableStatus();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeConfirm() {
    this.showConfirm = false;
    this.showStatusReasonForm = false;
    this.confirmAction = null;
    if (this.confirmMode === 'warranty') {
      this.showWarrantyForm = true;
    }
    this.confirmMode = '';
    this.statusReasonDraft = '';
    this.resetEditableStatus();
    this.cdr.detectChanges();
  }

  runConfirm() {
    if (this.confirmAction) {
      this.confirmAction();
      return;
    }

    this.closeConfirm();
  }

  syncWarrantyFromOrder(): void {
    if (!this.order?.warranty) return;
    this.warranty = {
      activated_at: this.order?.warranty?.activated_at || this.warranty?.activated_at || null,
      expires_at: this.order?.warranty?.expires_at || this.warranty?.expires_at || null,
      history: Array.isArray(this.warranty?.history) ? this.warranty.history : [],
    };
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

  get hasWarrantyHistory(): boolean {
    return this.warrantyHistory.length > 0;
  }

  get warrantyHistory(): any[] {
    return Array.isArray(this.warranty?.history) ? this.warranty.history : [];
  }

  get hasWarrantyActivation(): boolean {
    return !!this.warranty?.activated_at && !!this.warranty?.expires_at;
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

  private isCurrentOrderPaymentSettled(): boolean {
    const total = this.toNumber(this.order?.total_amount);
    if (total <= 0) return false;
    return this.paidAmount >= total;
  }

  orderStatusLabel(status: any): string {
    return getOrderStatusLabel(status);
  }

  isCancelledOrder(): boolean {
    return String(this.order?.status || '').toLowerCase() === 'cancelled';
  }

  isExchangeOrder(): boolean {
    return String(this.order?.status || '').toLowerCase() === 'exchanged';
  }

  hasStatusReason(): boolean {
    if (this.isExchangeOrder()) return !!String(this.order?.exchange_request?.reason || '').trim();
    return this.isCancelledOrder() && !!String(this.order?.cancellation_request?.reason || '').trim();
  }

  getCancellationReasonLabel(): string {
    const cancelledBy = String(this.order?.cancellation_request?.cancelled_by || '').toLowerCase();
    if (cancelledBy === 'admin') return 'Lý do huỷ (shop)';
    if (cancelledBy === 'customer' || !!String(this.order?.cancellation_request?.reason || '').trim()) return 'Lý do huỷ (khách)';
    return 'Lý do huỷ';
  }

  getStatusReasonLabel(): string {
    return this.isExchangeOrder() ? 'Lý do đổi hàng' : this.getCancellationReasonLabel();
  }

  getStatusReasonValue(): string {
    if (this.isExchangeOrder()) return String(this.order?.exchange_request?.reason || '').trim();
    return String(this.order?.cancellation_request?.reason || '').trim();
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
    return String(status || '').toLowerCase() === 'exchanged' ? 'Lý do đổi hàng' : 'Lý do hủy đơn';
  }

  getStatusReasonDialogTitle(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged' ? 'Xác nhận chuyển sang đổi hàng' : 'Xác nhận hủy đơn hàng';
  }

  getStatusReasonPlaceholder(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged' ? 'Nhập lý do đổi hàng' : 'Nhập lý do hủy đơn';
  }

  getStatusReasonSubmitText(status: string): string {
    return String(status || '').toLowerCase() === 'exchanged' ? 'Xác nhận cập nhật' : 'Xác nhận hủy đơn';
  }

  isOrderStatusSelectable(status: string): boolean {
    return canSelectOrderStatus(this.order?.status, status);
  }

  getOrderStatusRestrictionMessage(nextStatus: string): string {
    const sharedMessage = getOrderStatusRestrictionMessage(this.order?.status, nextStatus);
    if (sharedMessage) return sharedMessage;

    if (String(nextStatus || '').toLowerCase() === 'completed' && !this.isCurrentOrderPaymentSettled()) {
      return 'Chỉ có thể chuyển đơn sang "Hoàn tất" khi trạng thái thanh toán đã là "Tất toán".';
    }

    return '';
  }

  private showConfirmMessage(message: string): void {
    this.confirmMessage = message;
    this.confirmMode = '';
    this.confirmAction = null;
    this.showConfirm = true;
    this.showStatusReasonForm = false;
    this.cdr.detectChanges();
  }

  createEmptyWarrantyDraft() {
    return {
      order_detail_id: '',
      serviced_at: '',
      cost: 0,
      description: '',
    };
  }

  resetWarrantyDraft(): void {
    this.warrantyRecordDraft = this.createEmptyWarrantyDraft();
  }

  openWarrantyForm(): void {
    this.warrantyError = '';
    this.resetWarrantyDraft();
    const firstItemId = String(this.items[0]?._id || '').trim();
    if (firstItemId) {
      this.warrantyRecordDraft.order_detail_id = firstItemId;
    }
    this.warrantyRecordDraft.serviced_at = this.toDateTimeLocal(new Date());
    this.showWarrantyForm = true;
    this.cdr.detectChanges();
  }

  closeWarrantyForm(): void {
    this.showWarrantyForm = false;
    this.warrantyError = '';
    this.resetWarrantyDraft();
    this.cdr.detectChanges();
  }

  openWarrantyDetail(record: any): void {
    this.selectedWarrantyRecord = record;
    this.showWarrantyDetail = true;
    this.cdr.detectChanges();
  }

  closeWarrantyDetail(): void {
    this.selectedWarrantyRecord = null;
    this.showWarrantyDetail = false;
    this.cdr.detectChanges();
  }

  askCreateWarrantyRecord(): void {
    if (!this.canSubmitWarrantyRecord) return;
    this.showWarrantyForm = false;
    this.confirmMessage = 'Xác nhận thêm đợt bảo hành/bảo trì này?';
    this.confirmMode = 'warranty';
    this.confirmAction = () => this.saveWarrantyRecord();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  saveWarrantyRecord(): void {
    if (!this.order?._id || !this.canSubmitWarrantyRecord) return;

    this.showConfirm = false;
    this.confirmMode = '';
    this.isLoading = true;
    this.warrantyError = '';

    this.api.addWarrantyRecord(String(this.order._id), {
      order_detail_id: String(this.warrantyRecordDraft.order_detail_id || '').trim(),
      serviced_at: this.toIsoDate(this.warrantyRecordDraft.serviced_at),
      cost: this.toNumber(this.warrantyRecordDraft.cost),
      description: String(this.warrantyRecordDraft.description || '').trim(),
    }).subscribe({
      next: (res: any) => {
        this.warranty = {
          activated_at: res?.activated_at || this.warranty?.activated_at || null,
          expires_at: res?.expires_at || this.warranty?.expires_at || null,
          history: Array.isArray(res?.history) ? res.history : [],
        };
        this.isLoading = false;
        this.closeWarrantyForm();
      },
      error: (err: any) => {
        this.warrantyError = String(err?.error?.error || 'Không thể lưu đợt bảo hành này.');
        this.showWarrantyForm = true;
        this.confirmMode = '';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get canSubmitWarrantyRecord(): boolean {
    return this.hasWarrantyActivation
      && !!String(this.warrantyRecordDraft.order_detail_id || '').trim()
      && !!String(this.warrantyRecordDraft.serviced_at || '').trim()
      && !!String(this.warrantyRecordDraft.description || '').trim();
  }

  getWarrantyTypeLabel(record: any): string {
    return String(record?.type || '').toLowerCase() === 'maintenance' ? 'Bảo trì' : 'Bảo hành';
  }

  getWarrantyTypeClass(record: any): string {
    return String(record?.type || '').toLowerCase() === 'maintenance' ? 'warranty-maintenance' : 'warranty-covered';
  }

  formatWarrantyCost(record: any): string {
    if (String(record?.type || '').toLowerCase() !== 'maintenance') return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN').format(this.toNumber(record?.cost));
  }

  getDraftWarrantyTypeLabel(): string {
    const servicedAt = new Date(this.warrantyRecordDraft.serviced_at || '');
    const activatedAt = new Date(this.warranty?.activated_at || '');
    const expiresAt = new Date(this.warranty?.expires_at || '');

    if (Number.isNaN(servicedAt.getTime())) return '-';
    if (
      !Number.isNaN(activatedAt.getTime())
      && !Number.isNaN(expiresAt.getTime())
      && servicedAt.getTime() >= activatedAt.getTime()
      && servicedAt.getTime() <= expiresAt.getTime()
    ) {
      return 'Bảo hành';
    }

    return 'Bảo trì';
  }

  getWarrantyActivationText(): string {
    return this.hasWarrantyActivation ? this.formatDateTime(this.warranty?.activated_at, 'dd/MM/yyyy') : 'Chưa kích hoạt';
  }

  getWarrantyExpiryText(): string {
    return this.hasWarrantyActivation ? this.formatDateTime(this.warranty?.expires_at, 'dd/MM/yyyy') : 'Chưa có';
  }

  getWarrantyRemainingText(): string {
    if (!this.hasWarrantyActivation) return 'Chưa bắt đầu';

    const expires = new Date(this.warranty?.expires_at || '');
    if (Number.isNaN(expires.getTime())) return 'Chưa xác định';

    const now = new Date();
    if (expires.getTime() < now.getTime()) return 'Đã hết hạn';

    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays - years * 365 - months * 30;
    const parts = [
      years > 0 ? `${years} năm` : '',
      months > 0 ? `${months} tháng` : '',
      days > 0 ? `${days} ngày` : '',
    ].filter(Boolean);

    return parts.length ? parts.join(' ') : 'Còn trong hạn';
  }

  getWarrantySelectedItem(): any | null {
    const orderDetailId = String(this.warrantyRecordDraft.order_detail_id || '').trim();
    return this.items.find((item) => String(item?._id || '') === orderDetailId) || null;
  }

  formatDateTime(value: any, pattern = 'dd/MM/yyyy HH:mm'): string {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';

    const pad = (num: number) => String(num).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());

    if (pattern === 'dd/MM/yyyy') return `${day}/${month}/${year}`;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  toDateTimeLocal(value: Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  toIsoDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
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
    if (key === 'blocked') return 'Đã khoá';
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
