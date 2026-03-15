import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

type BackendStatus = 'pending' | 'confirmed' | 'processing' | 'shipping' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

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
  imageUrl: string;
  name: string;
  classification: string;
  quantity: number;
  unitPrice: number;
  review: ProductReview;
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
}

interface TimelineStep {
  label: string;
}

const API_BASE_URL = 'http://localhost:3000/api';
const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_VIDEOS = 5;

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
  ) {}

  ngOnInit(): void {
    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (codeFromQuery) {
      this.searchCode = codeFromQuery;
      void this.searchOrder();
    }
  }

  async searchOrder(): Promise<void> {
    const codes = this.parseCodes(this.searchCode);

    if (!codes.length) {
      this.errorMessage = 'Vui lòng nhập ít nhất 1 mã vận đơn.';
      this.infoMessage = '';
      this.orders = [];
      this.cdr.detectChanges();
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
        this.scrollToAnchor('tracking-feedback');
        return;
      }

      if (missingCodes.length) {
        this.infoMessage = `Không tìm thấy ${missingCodes.length} mã: ${missingCodes.join(', ')}`;
      }

      this.cdr.detectChanges();
      this.scrollToAnchor('tracking-results');
    } catch {
      this.errorMessage = 'Không thể tra cứu đơn hàng lúc này. Vui lòng thử lại sau.';
      this.orders = [];
      this.cdr.detectChanges();
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
    return order.backendStatus === 'completed' && !order.reviewSubmitted;
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
    const missing = order.products.some((item) => item.review.rating < 1);
    if (missing) {
      this.errorMessage = `Vui lòng chọn số sao cho tất cả sản phẩm của đơn ${order.orderCode}.`;
      return;
    }

    const reviewProducts = order.products.filter((item) => !!item.orderDetailId);

    if (!reviewProducts.length) {
      this.errorMessage = `Không tìm thấy chi tiết sản phẩm để lưu đánh giá cho đơn ${order.orderCode}.`;
      return;
    }

    this.errorMessage = '';
    this.infoMessage = '';
    this.reviewSubmittingOrderId = order.id;

    try {
      const payloadReviews = [];

      for (const item of reviewProducts) {
        const [uploadedImages, uploadedVideos] = await Promise.all([
          this.uploadReviewMedia(item.review.imageFiles),
          this.uploadReviewMedia(item.review.videoFiles),
        ]);

        payloadReviews.push({
          order_detail_id: item.orderDetailId,
          rating: item.review.rating,
          content: String(item.review.comment || '').trim(),
          images: uploadedImages.images,
          videos: uploadedVideos.videos,
        });
      }

      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/reviews`, {
          orderId: order.id,
          reviews: payloadReviews,
        }),
      );

      order.reviewSubmitted = true;
      this.infoMessage = `Cảm ơn bạn đã gửi đánh giá cho đơn ${order.orderCode}. Admin sẽ duyệt trong thời gian sớm nhất.`;
    } catch {
      this.errorMessage = `Không thể gửi đánh giá cho đơn ${order.orderCode}. Vui lòng thử lại.`;
    } finally {
      this.reviewSubmittingOrderId = null;
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
      processing: 'Đang xử lý',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao hàng',
      completed: 'Hoàn tất',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
    };
    return map[status] || status;
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
    }));

    const latestPayment = payments[0] || null;
    const backendStatus = String(order?.status || 'pending').toLowerCase() as BackendStatus;

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
      reviewSubmitted: false,
    };
  }

  private scrollToAnchor(anchorId: string): void {
    let retries = 0;
    const maxRetries = 10;

    const tryScroll = () => {
      const node = document.getElementById(anchorId);
      if (node) {
        const top = node.getBoundingClientRect().top + window.scrollY - 120;
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
