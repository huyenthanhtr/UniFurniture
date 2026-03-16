import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiStateService } from '../../shared/ui-state.service';

type BackendStatus = 'pending' | 'confirmed' | 'cancel_pending' | 'processing' | 'shipping' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

interface ProductReview {
  rating: number;
  comment: string;
  imageFiles: File[];
  videoFiles: File[];
  imagePreviews: string[];
  videoPreviews: string[];
}

interface TrackingProduct {
  id: string;
  orderDetailId: string;
  productId: string;
  variantId: string;
  imageUrl: string;
  name: string;
  classification: string;
  quantity: number;
  unitPrice: number;
  review: ProductReview;
  submittedReview: SubmittedReviewData | null;
}

interface TrackingOrder {
  id: string;
  orderCode: string;
  orderedAt: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
  paymentMethod: string;
  promotionCode: string | null;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  backendStatus: BackendStatus;
  statusLabel: string;
  products: TrackingProduct[];
  reviewSubmitted: boolean;
  confirmedAt: string;
  cancellationRequest: CancellationRequestData | null;
  cancelForm: CancelFormModel;
}

interface TimelineStep {
  label: string;
}


interface CancellationRequestData {
  reason: string;
  note: string;
  phone: string;
  requestedAt: string;
  previousStatus: BackendStatus | '';
  over10mWithDeposit: boolean;
}

interface CancelFormModel {
  open: boolean;
  reason: string;
  note: string;
  phone: string;
  submitting: boolean;
}

interface SubmittedReviewData {
  rating: number;
  content: string;
  images: string[];
  videos: string[];
  status: string;
  createdAt: string;
}

const API_BASE_URL = 'http://localhost:3000/api';
const TRACKING_STATE_KEY = 'unifurniture_tracking_state_v1';
const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_VIDEOS = 5;
const CANCEL_REASONS = [
  'Đổi ý không muốn mua nữa',
  'Muốn đổi địa chỉ hoặc thời gian nhận',
  'Tìm được sản phẩm phù hợp hơn',
  'Đặt nhầm sản phẩm/số lượng',
  'Lý do khác',
];

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.css',
})
export class OrderTrackingComponent implements OnInit {
  searchCode = '';
  loading = false;
  errorMessage = '';
  infoMessage = '';
  orders: TrackingOrder[] = [];
  reviewSubmittingOrderId: string | null = null;
  private pendingRestoreScrollY: number | null = null;
  readonly cancelReasons = CANCEL_REASONS;
  readonly timelineSteps: TimelineStep[] = [
    { label: 'Đã đặt hàng' },
    { label: 'Đã xác nhận' },
    { label: 'Đang xử lý' },
    { label: 'Đang giao hàng' },
    { label: 'Đã giao hàng' },
    { label: 'Hoàn tất' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly ui: UiStateService,
  ) {}

  ngOnInit(): void {
    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (codeFromQuery) {
      this.searchCode = codeFromQuery;
      void this.searchOrder();
      return;
    }

    const savedState = this.readTrackingState();
    if (!savedState?.searchCode) {
      return;
    }

    this.searchCode = savedState.searchCode;
    this.pendingRestoreScrollY = savedState.scrollY;
    void this.searchOrder();
  }

  async searchOrder(): Promise<void> {
    const codes = this.parseCodes(this.searchCode);

    if (!codes.length) {
      this.errorMessage = 'Vui lòng nhập ít nhất 1 mã vận đơn.';
      this.infoMessage = '';
      this.orders = [];
      this.cdr.detectChanges();
      this.pendingRestoreScrollY = null;
      this.scrollToAnchor('tracking-feedback');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.orders = [];

    try {
      const results = await Promise.all(codes.map((code) => this.fetchOrderByCode(code)));
      const foundOrders = results.filter((item): item is TrackingOrder => item !== null);
      const foundSet = new Set(foundOrders.map((order) => order.orderCode));
      const missingCodes = codes.filter((code) => !foundSet.has(code));

      this.orders = foundOrders;

      if (!foundOrders.length) {
        this.errorMessage = 'Không tìm thấy đơn hàng nào. Vui lòng kiểm tra lại mã vận đơn.';
        this.cdr.detectChanges();
        this.pendingRestoreScrollY = null;
        this.scrollToAnchor('tracking-feedback');
        return;
      }

      if (missingCodes.length) {
        this.infoMessage = `Không tìm thấy ${missingCodes.length} mã: ${missingCodes.join(', ')}`;
      }

      this.persistTrackingState(window.scrollY);
      this.cdr.detectChanges();
      this.restoreOrScrollToResults();
    } catch {
      this.errorMessage = 'Không thể tra cứu đơn hàng lúc này. Vui lòng thử lại sau.';
      this.orders = [];
      this.cdr.detectChanges();
      this.pendingRestoreScrollY = null;
      this.scrollToAnchor('tracking-feedback');
    } finally {
      this.loading = false;
    }
  }

  isCancelledOrRefunded(order: TrackingOrder): boolean {
    return order.backendStatus === 'cancelled' || order.backendStatus === 'refunded';
  }

  currentStepIndex(order: TrackingOrder): number {
    const map: Record<BackendStatus, number> = {
      pending: 0,
      confirmed: 1,
      cancel_pending: 1,
      processing: 2,
      shipping: 3,
      delivered: 4,
      completed: 5,
      cancelled: -1,
      refunded: -1,
    };
    return map[order.backendStatus] ?? -1;
  }

  showReviewSection(order: TrackingOrder): boolean {
    if (order.backendStatus !== 'completed') return false;
    return order.products.some((item) => !!item.orderDetailId && !item.submittedReview);
  }

  hasSubmittedReviews(order: TrackingOrder): boolean {
    return order.products.some((item) => !!item.submittedReview);
  }

  reviewModerationLabel(status: string): string {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') return 'Đã duyệt';
    if (key === 'rejected') return 'Đã từ chối';
    return 'Đang chờ duyệt';
  }

  isCancelPending(order: TrackingOrder): boolean {
    return order.backendStatus === 'cancel_pending';
  }

  canRequestCancel(order: TrackingOrder): boolean {
    if (order.backendStatus === 'pending') return true;
    if (order.backendStatus !== 'confirmed') return false;

    const confirmedAt = order.confirmedAt ? new Date(order.confirmedAt) : null;
    if (!confirmedAt || Number.isNaN(confirmedAt.getTime())) return false;

    const elapsed = Date.now() - confirmedAt.getTime();
    return elapsed <= 24 * 60 * 60 * 1000;
  }

  toggleCancelForm(order: TrackingOrder): void {
    order.cancelForm.open = !order.cancelForm.open;
    this.cdr.detectChanges();
  }

  async submitCancelRequest(order: TrackingOrder): Promise<void> {
    const reason = String(order.cancelForm.reason || '').trim();
    const phone = String(order.cancelForm.phone || '').trim();

    if (!reason) {
      this.errorMessage = `Vui lòng chọn lý do hủy cho đơn ${order.orderCode}.`;
      return;
    }

    if (!phone) {
      this.errorMessage = `Vui lòng nhập số điện thoại xác nhận cho đơn ${order.orderCode}.`;
      return;
    }

    order.cancelForm.submitting = true;
    this.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.http.post<{ order?: any; warning?: string }>(`${API_BASE_URL}/orders/${order.id}/cancel-request`, {
          reason,
          note: String(order.cancelForm.note || '').trim(),
          phone,
        }),
      );

      const previousStatus = String(response?.order?.cancellation_request?.previous_status || order.backendStatus || '') as BackendStatus | '';

      order.backendStatus = 'cancel_pending';
      order.statusLabel = 'Chờ xác nhận hủy';
      order.cancelForm.open = false;
      order.cancellationRequest = {
        reason,
        note: String(order.cancelForm.note || '').trim(),
        phone,
        requestedAt: new Date().toISOString(),
        previousStatus,
        over10mWithDeposit: Boolean(response?.order?.cancellation_request?.over_10m_with_deposit),
      };

      const warning = String(response?.warning || '').trim();
      this.infoMessage = warning || `Đã gửi yêu cầu hủy đơn ${order.orderCode}. Vui lòng chờ admin xác nhận.`;
      this.cdr.detectChanges();
      this.scrollToAnchor(`cancel-pending-${order.id}`);
    } catch (error: any) {
      this.errorMessage = error?.error?.error || `Không thể gửi yêu cầu hủy cho đơn ${order.orderCode}.`;
      this.cdr.detectChanges();
    } finally {
      order.cancelForm.submitting = false;
      this.cdr.detectChanges();
    }
  }

  async completeOrder(order: TrackingOrder): Promise<void> {
    if (order.backendStatus !== 'delivered') {
      return;
    }

    try {
      await firstValueFrom(this.http.patch(`${API_BASE_URL}/orders/${order.id}/status`, { status: 'completed' }));
      order.backendStatus = 'completed';
      order.statusLabel = 'Hoàn tất';
    } catch {
      this.errorMessage = 'Không thể cập nhật trạng thái hoàn tất lúc này.';
    }
  }


  viewProductFromHistory(product: TrackingProduct, target: 'top' | 'review' = 'top'): void {
    const productId = String(product.productId || '').trim();
    if (!productId) {
      this.infoMessage = 'Không tìm thấy liên kết sản phẩm để mở lại.';
      return;
    }

    this.persistTrackingState(window.scrollY);

    if (target === 'review') {
      void this.router.navigate(['/products', productId], {
        queryParams: { tab: 'review' },
        fragment: 'product-review-summary',
      });
      return;
    }

    void this.router.navigate(['/products', productId], {
      fragment: 'product-top',
    });
  }

  buyAgain(product: TrackingProduct): void {
    const productId = String(product.productId || '').trim();
    if (!productId) {
      this.infoMessage = 'Không thể mua lại vì thiếu thông tin sản phẩm.';
      return;
    }

    this.ui.addToCart(
      {
        productId,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.unitPrice,
      },
      1,
    );
    this.ui.openCart();
    this.infoMessage = `Đã thêm ${product.name} vào giỏ hàng.`;
  }

  setRating(product: TrackingProduct, value: number): void {
    product.review.rating = value;
  }

  onImageSelected(event: Event, product: TrackingProduct): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const remaining = MAX_REVIEW_IMAGES - product.review.imageFiles.length;

    if (remaining <= 0) {
      this.infoMessage = `Mỗi sản phẩm chỉ tải tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
      input.value = '';
      return;
    }

    const acceptedFiles = files.slice(0, remaining);
    acceptedFiles.forEach((file) => {
      product.review.imageFiles.push(file);
      product.review.imagePreviews.push(URL.createObjectURL(file));
    });

    if (acceptedFiles.length < files.length) {
      this.infoMessage = `Mỗi sản phẩm chỉ tải tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
    }

    input.value = '';
  }

  onVideoSelected(event: Event, product: TrackingProduct): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const remaining = MAX_REVIEW_VIDEOS - product.review.videoFiles.length;

    if (remaining <= 0) {
      this.infoMessage = `Mỗi sản phẩm chỉ tải tối đa ${MAX_REVIEW_VIDEOS} video.`;
      input.value = '';
      return;
    }

    const acceptedFiles = files.slice(0, remaining);
    acceptedFiles.forEach((file) => {
      product.review.videoFiles.push(file);
      product.review.videoPreviews.push(URL.createObjectURL(file));
    });

    if (acceptedFiles.length < files.length) {
      this.infoMessage = `Mỗi sản phẩm chỉ tải tối đa ${MAX_REVIEW_VIDEOS} video.`;
    }

    input.value = '';
  }

  removeImageAt(product: TrackingProduct, index: number): void {
    if (index < 0 || index >= product.review.imagePreviews.length) {
      return;
    }

    const previewUrl = product.review.imagePreviews[index];
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    product.review.imagePreviews.splice(index, 1);
    product.review.imageFiles.splice(index, 1);
  }

  removeVideoAt(product: TrackingProduct, index: number): void {
    if (index < 0 || index >= product.review.videoPreviews.length) {
      return;
    }

    const previewUrl = product.review.videoPreviews[index];
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    product.review.videoPreviews.splice(index, 1);
    product.review.videoFiles.splice(index, 1);
  }

  imageCountLabel(product: TrackingProduct): string {
    return `${product.review.imageFiles.length}/${MAX_REVIEW_IMAGES} ảnh`;
  }

  videoCountLabel(product: TrackingProduct): string {
    return `${product.review.videoFiles.length}/${MAX_REVIEW_VIDEOS} video`;
  }

  isImageLimitReached(product: TrackingProduct): boolean {
    return product.review.imageFiles.length >= MAX_REVIEW_IMAGES;
  }

  isVideoLimitReached(product: TrackingProduct): boolean {
    return product.review.videoFiles.length >= MAX_REVIEW_VIDEOS;
  }

  async submitReview(order: TrackingOrder): Promise<void> {
    const reviewProducts = order.products.filter((item) => !!item.orderDetailId && !item.submittedReview);

    if (!reviewProducts.length) {
      order.reviewSubmitted = true;
      this.infoMessage = `Đơn ${order.orderCode} đã được đánh giá đầy đủ trước đó.`;
      this.cdr.detectChanges();
      this.scrollToAnchor(`review-success-${order.id}`);
      return;
    }

    const missing = reviewProducts.some((item) => item.review.rating < 1);
    if (missing) {
      this.errorMessage = `Vui lòng chọn số sao cho các sản phẩm chưa đánh giá của đơn ${order.orderCode}.`;
      return;
    }

    this.errorMessage = '';
    this.infoMessage = '';
    this.reviewSubmittingOrderId = order.id;

    try {
      const payloadReviews: Array<{
        order_detail_id: string;
        rating: number;
        content: string;
        images: string[];
        videos: string[];
      }> = [];

      for (const item of reviewProducts) {
        const [uploadedImages, uploadedVideos] = await Promise.all([
          this.uploadReviewMedia(item.review.imageFiles),
          this.uploadReviewMedia(item.review.videoFiles),
        ]);

        payloadReviews.push({
          order_detail_id: item.orderDetailId,
          rating: item.review.rating,
          content: String(item.review.comment || '').trim(),
          images: uploadedImages.images.map((url) => this.normalizeReviewMediaUrl(url)),
          videos: uploadedVideos.videos.map((url) => this.normalizeReviewMediaUrl(url)),
        });
      }

      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/reviews`, {
          orderId: order.id,
          reviews: payloadReviews,
        }),
      );

      const submittedAt = new Date().toISOString();
      const submittedMap = new Map(payloadReviews.map((item) => [item.order_detail_id, item]));
      order.products.forEach((product) => {
        const submitted = submittedMap.get(product.orderDetailId);
        if (!submitted) return;
        product.submittedReview = {
          rating: submitted.rating,
          content: submitted.content,
          images: submitted.images,
          videos: submitted.videos,
          status: 'pending',
          createdAt: submittedAt,
        };
      });

      const allReviewedNow = order.products.filter((item) => !!item.orderDetailId).every((item) => !!item.submittedReview);
      order.reviewSubmitted = allReviewedNow;
      this.infoMessage = `Cảm ơn bạn đã gửi đánh giá cho đơn ${order.orderCode}. Admin sẽ duyệt trong thời gian sớm nhất.`;
      this.cdr.detectChanges();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scrollToAnchor(`review-success-${order.id}`));
      });
    } catch (error: any) {
      if (error?.status === 409) {
        await this.applyExistingReviews(order);
        order.reviewSubmitted = true;
        this.errorMessage = '';
        this.infoMessage = error?.error?.message || 'Đơn hàng này đã được đánh giá trước đó, không thể sửa.';
        this.cdr.detectChanges();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.scrollToAnchor(`review-success-${order.id}`));
        });
      } else {
        this.errorMessage = `Không thể gửi đánh giá cho đơn ${order.orderCode}. Vui lòng thử lại.`;
        this.cdr.detectChanges();
      }
    } finally {
      this.reviewSubmittingOrderId = null;
      this.cdr.detectChanges();
    }
  }

  private async uploadReviewMedia(files: File[]): Promise<{ images: string[]; videos: string[] }> {
    if (!files.length) {
      return { images: [], videos: [] };
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await firstValueFrom(
      this.http.post<{ images?: string[]; videos?: string[] }>(`${API_BASE_URL}/reviews/media`, formData),
    );

    return {
      images: Array.isArray(response?.images) ? response.images : [],
      videos: Array.isArray(response?.videos) ? response.videos : [],
    };
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
  }

  private parseCodes(raw: string): string[] {
    const normalized = raw
      .split(/[\s,;]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  private statusLabel(status: BackendStatus): string {
    const map: Record<BackendStatus, string> = {
      pending: 'Đã đặt hàng',
      confirmed: 'Đã xác nhận',
      cancel_pending: 'Chờ xác nhận hủy',
      processing: 'Đang xử lý',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao hàng',
      completed: 'Hoàn tất',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
    };
    return map[status] || status;
  }


  private async applyExistingReviews(order: TrackingOrder): Promise<void> {
    const reviewStatus = await firstValueFrom(
      this.http.get<{ items?: Array<any> }>(`${API_BASE_URL}/reviews/order/${order.id}/status`),
    ).catch(() => ({ items: [] }));

    const submittedMap = new Map<string, SubmittedReviewData>();
    (reviewStatus.items || []).forEach((item: any) => {
      const detailId = String(item?.order_detail_id || '').trim();
      if (!detailId) return;
      submittedMap.set(detailId, {
        rating: Number(item?.rating || 0),
        content: String(item?.content || ''),
        images: Array.isArray(item?.images) ? item.images.map((x: any) => this.normalizeReviewMediaUrl(x)).filter(Boolean) : [],
        videos: Array.isArray(item?.videos) ? item.videos.map((x: any) => this.normalizeReviewMediaUrl(x)).filter(Boolean) : [],
        status: String(item?.status || 'pending'),
        createdAt: item?.createdAt ? String(item.createdAt) : '',
      });
    });

    order.products.forEach((product) => {
      product.submittedReview = submittedMap.get(product.orderDetailId) || null;
    });
  }

  private normalizeReviewMediaUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `http://localhost:3000${raw}`;
    return raw;
  }

  private normalizePayment(method: string | undefined): string {
    const value = String(method || '').toLowerCase();
    if (value === 'bank_transfer') return 'Chuyển khoản ngân hàng';
    if (value === 'cod') return 'COD (Thanh toán khi nhận hàng)';
    return method || 'Không xác định';
  }

  private async fetchOrderByCode(code: string): Promise<TrackingOrder | null> {
    const listResponse = await firstValueFrom(
      this.http.get<{ items?: any[] }>(`${API_BASE_URL}/orders`, { params: { q: code, limit: '100' } }),
    );

    const matched = (listResponse.items || []).find(
      (item) => String(item?.order_code || '').toUpperCase() === code,
    );

    if (!matched?._id) {
      return null;
    }

    const detail = await firstValueFrom(this.http.get<any>(`${API_BASE_URL}/orders/${matched._id}`));
    const order = detail?.order || {};
    const display = detail?.display || {};
    const items = Array.isArray(detail?.items) ? detail.items : [];
    const payments = Array.isArray(detail?.payments) ? detail.payments : [];
    const pricing = detail?.pricing || {};

    const subtotal = Number(pricing.items_subtotal ?? order.total_amount ?? 0);
    const discountAmount = Number(pricing.discount_amount ?? 0);
    const discountPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0;

    const products: TrackingProduct[] = items.map((item: any, index: number) => ({
      id: String(item?._id || item?.variant_id || `item-${index}`),
      orderDetailId: String(item?._id || ''),
      productId: String(item?.product_id || ''),
      variantId: String(item?.variant_id || ''),
      imageUrl: String(item?.image_url || 'assets/images/banner5.jpg'),
      name: String(item?.product_name || '-'),
      classification: String(item?.variant_name || item?.sku || '-'),
      quantity: Number(item?.quantity || 0),
      unitPrice: Number(item?.unit_price || 0),
      review: {
        rating: 0,
        comment: '',
        imageFiles: [],
        videoFiles: [],
        imagePreviews: [],
        videoPreviews: [],
      },
      submittedReview: null,
    }));

    const latestPayment = payments[0] || null;
    const backendStatus = String(order?.status || 'pending').toLowerCase() as BackendStatus;

    const reviewStatus = await firstValueFrom(
      this.http.get<{ reviewedDetailIds?: string[]; items?: Array<any> }>(`${API_BASE_URL}/reviews/order/${String(order?._id || matched._id)}/status`),
    ).catch(() => ({ reviewedDetailIds: [], items: [] }));

    const reviewedSet = new Set((reviewStatus.reviewedDetailIds || []).map((item) => String(item)));
    const submittedMap = new Map<string, SubmittedReviewData>();
    (reviewStatus.items || []).forEach((item: any) => {
      const detailId = String(item?.order_detail_id || '').trim();
      if (!detailId) return;
      submittedMap.set(detailId, {
        rating: Number(item?.rating || 0),
        content: String(item?.content || ''),
        images: Array.isArray(item?.images) ? item.images.map((x: any) => this.normalizeReviewMediaUrl(x)).filter(Boolean) : [],
        videos: Array.isArray(item?.videos) ? item.videos.map((x: any) => this.normalizeReviewMediaUrl(x)).filter(Boolean) : [],
        status: String(item?.status || 'pending'),
        createdAt: item?.createdAt ? String(item.createdAt) : '',
      });
    });

    products.forEach((product) => {
      product.submittedReview = submittedMap.get(product.orderDetailId) || null;
    });

    const reviewableProducts = products.filter((item) => !!item.orderDetailId);
    const reviewSubmitted = reviewableProducts.length > 0 && reviewableProducts.every((item) => reviewedSet.has(item.orderDetailId));

    return {
      id: String(order?._id || matched._id),
      orderCode: String(order?.order_code || code),
      orderedAt: order?.ordered_at ? new Date(order.ordered_at).toLocaleString('vi-VN') : '-',
      customerName: String(display?.receiver_name || order?.shipping_name || '-'),
      phone: String(display?.phone || order?.shipping_phone || '-'),
      shippingAddress: String(display?.address || order?.shipping_address || '-'),
      paymentMethod: this.normalizePayment(latestPayment?.method),
      promotionCode: pricing?.coupon_code ? String(pricing.coupon_code) : null,
      discountPercent,
      subtotal,
      discountAmount,
      total: Number(pricing.grand_total ?? order.total_amount ?? 0),
      backendStatus,
      statusLabel: this.statusLabel(backendStatus),
      products,
      reviewSubmitted,
      confirmedAt: order?.confirmed_at ? String(order.confirmed_at) : '',
      cancellationRequest: order?.cancellation_request
        ? {
            reason: String(order.cancellation_request.reason || ''),
            note: String(order.cancellation_request.note || ''),
            phone: String(order.cancellation_request.phone || ''),
            requestedAt: order.cancellation_request.requested_at ? String(order.cancellation_request.requested_at) : '',
            previousStatus: String(order.cancellation_request.previous_status || '') as BackendStatus | '',
            over10mWithDeposit: Boolean(order.cancellation_request.over_10m_with_deposit),
          }
        : null,
      cancelForm: {
        open: false,
        reason: '',
        note: '',
        phone: String(display?.phone || order?.shipping_phone || ''),
        submitting: false,
      },
    };
  }


  private persistTrackingState(scrollY: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      searchCode: this.searchCode,
      scrollY: Math.max(0, Math.floor(scrollY || 0)),
      savedAt: Date.now(),
    };

    window.sessionStorage.setItem(TRACKING_STATE_KEY, JSON.stringify(payload));
  }

  private readTrackingState(): { searchCode: string; scrollY: number } | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(TRACKING_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const searchCode = String(parsed?.searchCode || '').trim();
      const scrollY = Math.max(0, Number(parsed?.scrollY) || 0);
      if (!searchCode) return null;
      return { searchCode, scrollY };
    } catch {
      return null;
    }
  }

  private restoreOrScrollToResults(): void {
    const savedY = this.pendingRestoreScrollY;
    this.pendingRestoreScrollY = null;

    if (savedY !== null) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: Math.max(savedY, 0), behavior: 'auto' });
        });
      });
      return;
    }

    this.scrollToAnchor('tracking-results');
  }

  private scrollToAnchor(anchorId: string): void {
    let retries = 0;
    const maxRetries = 10;

    const tryScroll = () => {
      const node = document.getElementById(anchorId);
      if (node) {
        const top = node.getBoundingClientRect().top + window.scrollY - 180;
        window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
        return;
      }

      if (retries < maxRetries) {
        retries += 1;
        requestAnimationFrame(tryScroll);
      }
    };

    requestAnimationFrame(tryScroll);
  }
}
