import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiStateService } from '../../shared/ui-state.service';
import { TrackingCancelFlowComponent } from './components/tracking-cancel-flow/tracking-cancel';
import {
  API_BASE_URL,
  BackendStatus,
  CANCEL_REASONS,
  MAX_REVIEW_IMAGES,
  MAX_REVIEW_VIDEOS,
  SHOP_ZALO_URL,
  TimelineStep,
  TRACKING_STATE_KEY,
  TrackingOrder,
  TrackingProduct,
} from './components/models/order-tracking.models';
import { TrackingOrderSummaryComponent } from './components/tracking-order-summary/tracking-order-summary';
import { TrackingReviewFlowComponent } from './components/tracking-review-flow/tracking-review';
import { OrderTrackingDataService } from './order-tracking-data.service';


interface PendingQrState {
  orderId: string;
  orderCode: string;
  total: number;
  requireDeposit: boolean;
  depositAmount: number;
  createdAt: number;
}


@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackingOrderSummaryComponent, TrackingCancelFlowComponent, TrackingReviewFlowComponent],
  templateUrl: './order-tracking.html',
  styleUrl: './order-tracking.css',
})
export class OrderTrackingComponent implements OnInit, OnDestroy {
  searchCode = '';
  loading = false;
  errorMessage = '';
  infoMessage = '';
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  reviewThanksOpen = false;
  reviewThanksTitle = '';
  reviewThanksMessage = '';
  orders: TrackingOrder[] = [];
  reviewSubmittingProductKey: string | null = null;
  cancelSuccessOrderId: string | null = null;
  reviewInlineErrors: Record<string, string> = {};
  pendingQr: PendingQrState | null = null;
  pendingQrChoice: 'deposit' | 'full' = 'full';
  pendingQrSecondsLeft = 0;
  pendingQrCopied = '';
  private pendingQrTick: ReturnType<typeof setInterval> | null = null;
  cameraOpen = false;
  cameraError = '';
  cameraFacingMode: 'user' | 'environment' = 'environment';
  cameraMode: 'image' | 'video' = 'image';
  cameraDevices: Array<{ id: string; label: string }> = [];
  selectedCameraId = '';
  cameraRecording = false;
  cameraRecordedSeconds = 0;
  private cameraRecordTimer: ReturnType<typeof setInterval> | null = null;
  private cameraRecorder: MediaRecorder | null = null;
  private cameraRecordChunks: Blob[] = [];
  private cameraProduct: TrackingProduct | null = null;
  private cameraStream: MediaStream | null = null;

  @ViewChild(TrackingReviewFlowComponent) private reviewFlowComponent?: TrackingReviewFlowComponent;
  private pendingRestoreScrollY: number | null = null;
  private pendingQrSource: PendingQrState | null = null;
  readonly cancelReasons = CANCEL_REASONS;
  readonly shopZaloUrl = SHOP_ZALO_URL;
  readonly bankInfo = {
    accountName: 'CONG TY TNHH NOI THAT U-HOME FURNI',
    accountNumber: '0011111222333',
    bankName: 'Vietcombank - CN TP.HCM',
    qrUrl: 'assets/images/qrcode-default.png',
  };
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
    private readonly trackingData: OrderTrackingDataService,
  ) {}

  ngOnInit(): void {
    this.loadPendingQr();
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


  ngOnDestroy(): void {
    this.stopCameraStream();
    this.stopPendingQrTimer();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  private showToast(message: string): void {
    this.toastMessage = String(message || '').trim();
    if (!this.toastMessage) return;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimer = null;
      this.cdr.detectChanges();
    }, 3200);
  }


  private showReviewThanks(productName: string, rewardedPoints = 0): void {
    this.reviewThanksTitle = 'Đã được tích điểm đánh giá';
    this.reviewThanksMessage =
      rewardedPoints > 0
        ? `Bạn đã gửi đánh giá cho ${productName} và nhận +${rewardedPoints} điểm.`
        : `Bạn đã gửi đánh giá cho ${productName} thành công.`;
    this.reviewThanksOpen = true;
  }

  closeReviewThanks(): void {
    this.reviewThanksOpen = false;
    this.reviewThanksTitle = '';
    this.reviewThanksMessage = '';
  }

  get pendingQrAmount(): number {
    if (!this.pendingQr) return 0;
    if (this.pendingQrChoice === 'deposit' && this.pendingQr.requireDeposit) {
      return this.pendingQr.depositAmount;
    }
    return this.pendingQr.total;
  }

  get pendingQrTimerDisplay(): string {
    const m = Math.floor(this.pendingQrSecondsLeft / 60).toString().padStart(2, '0');
    const s = (this.pendingQrSecondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}\u20ab`;
  }

  async searchOrder(): Promise<void> {
    const codes = this.trackingData.parseCodes(this.searchCode);

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
    this.orders = [];

    try {
      const results = await Promise.all(codes.map((code) => this.trackingData.fetchOrderByCode(code)));
      const foundOrders = results.filter((item): item is TrackingOrder => item !== null);
      const foundSet = new Set(foundOrders.map((order) => order.orderCode));
      const missingCodes = codes.filter((code) => !foundSet.has(code));

      this.orders = foundOrders;

      this.syncPendingQrByResults(foundOrders);

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

  hasCancellationHistory(order: TrackingOrder): boolean {
    const req = order.cancellationRequest;
    if (!req) return false;

    return Boolean(
      String(req.reason || '').trim() ||
      String(req.phone || '').trim() ||
      String(req.note || '').trim() ||
      String(req.requestedAt || '').trim(),
    );
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
    if (!order.cancelForm.open && this.cancelSuccessOrderId === order.id) {
      this.cancelSuccessOrderId = null;
    }
    this.cdr.detectChanges();
  }

  async submitCancelRequest(order: TrackingOrder): Promise<void> {
    const reason = String(order.cancelForm.reason || '').trim();
    const phone = String(order.cancelForm.phone || '').trim();

    if (!reason) {
      this.errorMessage = `Vui lòng chọn lý do cho đơn hàng ${order.orderCode}.`;
      return;
    }

    if (!phone) {
      this.errorMessage = `Vui lòng nhập số điện thoại xác nhận cho đơn hàng ${order.orderCode}.`;
      return;
    }

    order.cancelForm.submitting = true;
    this.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.http.post<{ order?: any; message?: string }>(`${API_BASE_URL}/orders/${order.id}/cancel-request`, {
          reason,
          note: String(order.cancelForm.note || '').trim(),
          phone,
        }),
      );

      const previousStatus = String(
        response?.order?.cancellation_request?.previous_status || order.backendStatus || '',
      ) as BackendStatus | '';

      order.backendStatus = 'cancelled';
      order.statusLabel = 'Đã hủy';
      order.cancelForm.open = false;
      order.cancellationRequest = {
        reason,
        note: String(order.cancelForm.note || '').trim(),
        phone,
        requestedAt: new Date().toISOString(),
        previousStatus,
        over10mWithDeposit: Boolean(response?.order?.cancellation_request?.over_10m_with_deposit),
      };

      this.infoMessage = '';
      this.cancelSuccessOrderId = order.id;
      this.cdr.detectChanges();
      this.scrollToAnchor('tracking-feedback');
    } catch (error: any) {
      this.errorMessage = error?.error?.error || `Không thể gửi yêu cầu hủy cho đơn hàng ${order.orderCode}.`;
      this.cdr.detectChanges();
    } finally {
      order.cancelForm.submitting = false;
      this.cdr.detectChanges();
    }
  }

  closeCancelSuccess(): void {
    this.cancelSuccessOrderId = null;
    this.cdr.detectChanges();
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
    const productPath = String(product.productSlug || product.productId || '').trim();
    if (!productPath) {
      this.infoMessage = 'Không tìm thấy liên kết sản phẩm để mở lại.';
      return;
    }

    this.persistTrackingState(window.scrollY);

    if (target === 'review') {
      void this.router.navigate(['/products', productPath], {
        queryParams: { tab: 'review' },
        fragment: 'product-review-summary',
      });
      return;
    }

    void this.router.navigate(['/products', productPath], {
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
        cartKey: productId,
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
    if (value > 0) {
      const detailId = product.orderDetailId || product.id;
      Object.keys(this.reviewInlineErrors).forEach((key) => {
        if (key.endsWith(`:${detailId}`)) {
          this.reviewInlineErrors[key] = '';
        }
      });
    }
  }

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 5:
        return 'Rất hài lòng';
      case 4:
        return 'Hài lòng';
      case 3:
        return 'Trung bình';
      case 2:
        return 'Chua hài lòng';
      case 1:
        return 'Tệ';
      default:
        return '';
    }
  }

  onImageSelected(event: Event, product: TrackingProduct): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const remaining = MAX_REVIEW_IMAGES - product.review.imageFiles.length;

    if (remaining <= 0) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
      input.value = '';
      return;
    }

    const acceptedFiles = files.slice(0, remaining);
    acceptedFiles.forEach((file) => {
      product.review.imageFiles.push(file);
      product.review.imagePreviews.push(URL.createObjectURL(file));
    });

    if (acceptedFiles.length < files.length) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
    }

    input.value = '';
  }

  onVideoSelected(event: Event, product: TrackingProduct): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const remaining = MAX_REVIEW_VIDEOS - product.review.videoFiles.length;

    if (remaining <= 0) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_VIDEOS} video.`;
      input.value = '';
      return;
    }

    const acceptedFiles = files.slice(0, remaining);
    acceptedFiles.forEach((file) => {
      product.review.videoFiles.push(file);
      product.review.videoPreviews.push(URL.createObjectURL(file));
    });

    if (acceptedFiles.length < files.length) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_VIDEOS} video.`;
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


  private reviewKey(order: TrackingOrder, product: TrackingProduct): string {
    return `${order.id}:${product.orderDetailId || product.id}`;
  }

  private hasAnyInteraction(product: TrackingProduct): boolean {
    return (
      product.review.rating > 0
      || String(product.review.comment || '').trim().length > 0
      || product.review.imageFiles.length > 0
      || product.review.videoFiles.length > 0
    );
  }

  async submitSingleReview(order: TrackingOrder, product: TrackingProduct): Promise<void> {
    const key = this.reviewKey(order, product);
    this.reviewInlineErrors[key] = '';

    if (!this.hasAnyInteraction(product)) {
      this.reviewInlineErrors[key] = 'Vui lòng chọn sao trước khi đánh giá.';
      this.cdr.detectChanges();
      return;
    }

    if (product.review.rating < 1) {
      this.reviewInlineErrors[key] = 'Vui lòng chọn sao cho sản phẩm trước khi gửi đánh giá';
      this.cdr.detectChanges();
      return;
    }

    if (!product.orderDetailId || product.submittedReview) {
      return;
    }

    this.errorMessage = '';
    this.reviewSubmittingProductKey = key;

    try {
      const [uploadedImages, uploadedVideos] = await Promise.all([
        this.trackingData.uploadReviewMedia(product.review.imageFiles),
        this.trackingData.uploadReviewMedia(product.review.videoFiles),
      ]);

      const payloadReview = {
        order_detail_id: product.orderDetailId,
        rating: product.review.rating,
        content: String(product.review.comment || '').trim(),
        images: uploadedImages.images,
        videos: uploadedVideos.videos,
      };

      const rawProfile = String(localStorage.getItem('user_profile') || '').trim();
      let reviewerAccountId = '';
      if (rawProfile) {
        try {
          const profile = JSON.parse(rawProfile);
          reviewerAccountId = String(profile?._id || profile?.id || '').trim();
        } catch {
          reviewerAccountId = '';
        }
      }

      const reviewSubmitRes = await firstValueFrom(
        this.http.post<{ rewardedPoints?: number }>(`${API_BASE_URL}/reviews`, {
          orderId: order.id,
          reviews: [payloadReview],
          reviewer_account_id: reviewerAccountId,
        }),
      );

      const submittedAt = new Date().toISOString();
      product.submittedReview = {
        rating: payloadReview.rating,
        content: payloadReview.content,
        images: payloadReview.images.map((url) => this.trackingData.toMediaUrl(url)),
        videos: payloadReview.videos.map((url) => this.trackingData.toMediaUrl(url)),
        status: 'pending',
        createdAt: submittedAt,
      };

      const reviewableProducts = order.products.filter((item) => !!item.orderDetailId);
      order.reviewSubmitted = reviewableProducts.length > 0 && reviewableProducts.every((item) => !!item.submittedReview);
      this.reviewInlineErrors[key] = '';
      const rewardedPoints = Math.max(0, Number(reviewSubmitRes?.rewardedPoints || 0));
      const rewardText = rewardedPoints > 0 ? ` Bạn nhận +${rewardedPoints} điểm.` : '';
      this.showToast(`Đã gửi đánh giá cho sản phẩm ${product.name}.${rewardText}`);
      this.showReviewThanks(product.name, rewardedPoints);
      this.cdr.detectChanges();

      if (order.reviewSubmitted) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.scrollToAnchor(`review-success-${order.id}`));
        });
      }
    } catch (error: any) {
      if (error?.status === 409) {
        await this.trackingData.applyExistingReviews(order);
        const reviewableProducts = order.products.filter((item) => !!item.orderDetailId);
        order.reviewSubmitted = reviewableProducts.length > 0 && reviewableProducts.every((item) => !!item.submittedReview);
        this.reviewInlineErrors[key] = error?.error?.message || 'Sản phẩm này đã được đánh giá trước đó, không thể chỉnh sửa.';
        this.showToast(this.reviewInlineErrors[key]);
        this.cdr.detectChanges();
      } else {
        this.reviewInlineErrors[key] = 'Không thể gửi đánh giá lúc này. Vui lòng gửi lại sau';
        this.showToast(this.reviewInlineErrors[key]);
        this.cdr.detectChanges();
      }
    } finally {
      this.reviewSubmittingProductKey = null;
      this.cdr.detectChanges();
    }
  }

  async openCameraForImage(product: TrackingProduct): Promise<void> {
    await this.openCamera(product, 'image');
  }

  async openCameraForVideo(product: TrackingProduct): Promise<void> {
    await this.openCamera(product, 'video');
  }

  closeCamera(): void {
    if (this.cameraRecording) {
      this.stopVideoRecording();
    }

    this.cameraOpen = false;
    this.cameraError = '';
    this.stopCameraStream();
    this.cameraProduct = null;
    this.selectedCameraId = '';
    this.cameraMode = 'image';
  }

  async switchCameraFacing(): Promise<void> {
    this.cameraFacingMode = this.cameraFacingMode === 'user' ? 'environment' : 'user';
    this.selectedCameraId = '';
    await this.startCamera();
  }

  async onCameraDeviceChange(deviceId: string): Promise<void> {
    this.selectedCameraId = deviceId;
    await this.startCamera();
  }

  async capturePhotoFromCamera(): Promise<void> {
    const videoRef = this.reviewFlowComponent?.cameraVideoRef?.nativeElement;
    if (!this.cameraProduct || !videoRef) {
      return;
    }

    if (this.isImageLimitReached(this.cameraProduct)) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
      return;
    }

    const video = videoRef;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      this.cameraError = 'Không thể chụp ảnh từ camera.';
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      this.cameraError = 'Không thể tạo ảnh từ camera.';
      return;
    }

    const file = new File([blob], `review-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    this.cameraProduct.review.imageFiles.push(file);
    this.cameraProduct.review.imagePreviews.push(URL.createObjectURL(file));
    this.cdr.detectChanges();

    if (this.isImageLimitReached(this.cameraProduct)) {
      this.closeCamera();
    }
  }

  startVideoRecording(): void {
    if (!this.cameraProduct || !this.cameraStream) {
      return;
    }

    if (this.isVideoLimitReached(this.cameraProduct)) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_VIDEOS} video.`;
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      this.cameraError = 'Trình duyệt không hỗ trợ quay video trực tiếp.';
      return;
    }

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = mimeCandidates.find((item) => MediaRecorder.isTypeSupported(item)) || '';

    this.cameraRecordChunks = [];
    const targetProduct = this.cameraProduct;

    this.cameraRecorder = mimeType
      ? new MediaRecorder(this.cameraStream, { mimeType })
      : new MediaRecorder(this.cameraStream);

    this.cameraRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.cameraRecordChunks.push(event.data);
      }
    };

    this.cameraRecorder.onstop = () => {
      this.cameraRecording = false;
      this.cameraRecordedSeconds = 0;
      this.clearCameraRecordTimer();

      if (!targetProduct || !this.cameraRecordChunks.length) {
        this.cameraRecordChunks = [];
        this.cdr.detectChanges();
        return;
      }

      const blob = new Blob(this.cameraRecordChunks, { type: mimeType || 'video/webm' });
      this.cameraRecordChunks = [];

      if (blob.size === 0) {
        this.cdr.detectChanges();
        return;
      }

      const file = new File([blob], `review-camera-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
      targetProduct.review.videoFiles.push(file);
      targetProduct.review.videoPreviews.push(URL.createObjectURL(file));
      this.cdr.detectChanges();

      if (this.isVideoLimitReached(targetProduct)) {
        this.closeCamera();
      }
    };

    this.cameraRecorder.start();
    this.cameraRecording = true;
    this.cameraRecordedSeconds = 0;
    this.clearCameraRecordTimer();
    this.cameraRecordTimer = setInterval(() => {
      this.cameraRecordedSeconds += 1;
      if (this.cameraRecordedSeconds >= 30) {
        this.stopVideoRecording();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  stopVideoRecording(): void {
    if (this.cameraRecorder && this.cameraRecorder.state !== 'inactive') {
      this.cameraRecorder.stop();
    }
  }

  private async openCamera(product: TrackingProduct, mode: 'image' | 'video'): Promise<void> {
    if (mode === 'image' && this.isImageLimitReached(product)) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_IMAGES} ảnh.`;
      return;
    }

    if (mode === 'video' && this.isVideoLimitReached(product)) {
      this.infoMessage = `Mỗi sản phẩm chỉ tối đa ${MAX_REVIEW_VIDEOS} video.`;
      return;
    }

    this.cameraProduct = product;
    this.cameraMode = mode;
    this.cameraOpen = true;
    this.cameraError = '';
    this.cameraRecordedSeconds = 0;

    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Thiết bị không hỗ trợ camera trên trình duyệt này.';
      return;
    }

    this.stopCameraStream();
    this.cameraError = '';

    const constraints: MediaStreamConstraints = this.selectedCameraId
      ? { video: { deviceId: { exact: this.selectedCameraId } }, audio: this.cameraMode === 'video' }
      : { video: { facingMode: { ideal: this.cameraFacingMode } }, audio: this.cameraMode === 'video' };

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      await this.bindCameraStream();
      await this.loadCameraDevices();
    } catch {
      this.cameraError = 'Không thể mở camera. Vui lòng cấp quyền truy cập camera';
    }
  }

  private async bindCameraStream(): Promise<void> {
    if (!this.cameraStream) {
      return;
    }

    let retries = 0;
    const maxRetries = 8;

    while (!this.reviewFlowComponent?.cameraVideoRef?.nativeElement && retries < maxRetries) {
      retries += 1;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const video = this.reviewFlowComponent?.cameraVideoRef?.nativeElement;
    if (!video) {
      return;
    }

    video.srcObject = this.cameraStream;
    await video.play().catch(() => undefined);
  }

  private async loadCameraDevices(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    this.cameraDevices = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));

    if (!this.selectedCameraId && this.cameraDevices.length === 1) {
      this.selectedCameraId = this.cameraDevices[0].id;
    }
  }

  private clearCameraRecordTimer(): void {
    if (this.cameraRecordTimer) {
      clearInterval(this.cameraRecordTimer);
      this.cameraRecordTimer = null;
    }
  }

  private stopCameraStream(): void {
    this.clearCameraRecordTimer();
    this.cameraRecorder = null;
    this.cameraRecording = false;

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    const video = this.reviewFlowComponent?.cameraVideoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  copyPendingQrValue(value: string, field: string): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      this.pendingQrCopied = field;
      setTimeout(() => {
        if (this.pendingQrCopied === field) this.pendingQrCopied = '';
        this.cdr.detectChanges();
      }, 1500);
    }).catch(() => undefined);
  }

  private loadPendingQr(): void {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('checkout_qr_state');
    if (!raw) return;

    let state: PendingQrState;
    try {
      state = JSON.parse(raw) as PendingQrState;
    } catch {
      return;
    }

    const elapsed = Date.now() - Number(state.createdAt || 0);
    const remaining = 5 * 60 * 1000 - elapsed;
    if (remaining <= 0) {
      if (state.orderId) {
        void this.syncDemoTransferTimeout(state.orderId);
      }
      window.sessionStorage.removeItem('checkout_qr_state');
      return;
    }

    this.pendingQrSource = state;

    const codeFromQuery = this.route.snapshot.queryParamMap.get('code');
    if (codeFromQuery && codeFromQuery === state.orderCode) {
      this.activatePendingQr(state, remaining);
    }
  }

  private activatePendingQr(state: PendingQrState, remainingMs?: number): void {
    const elapsed = Date.now() - Number(state.createdAt || 0);
    const remaining = typeof remainingMs === 'number' ? remainingMs : 5 * 60 * 1000 - elapsed;

    if (remaining <= 0) {
      this.clearPendingQr();
      return;
    }

    this.pendingQr = state;
    this.pendingQrSecondsLeft = Math.ceil(remaining / 1000);
    this.pendingQrChoice = state.requireDeposit ? 'deposit' : 'full';
    this.startPendingQrTimer();
  }

  private clearPendingQr(removeStorage = true): void {
    const orderId = this.pendingQrSource?.orderId || this.pendingQr?.orderId || '';

    this.stopPendingQrTimer();
    this.pendingQr = null;
    this.pendingQrSource = null;

    if (removeStorage && typeof window !== 'undefined') {
      window.sessionStorage.removeItem('checkout_qr_state');
    }

    if (orderId) {
      void this.syncDemoTransferTimeout(orderId);
    }
  }

  private syncPendingQrByResults(foundOrders: TrackingOrder[]): void {
    if (!this.pendingQrSource) {
      this.stopPendingQrTimer();
      this.pendingQr = null;
      return;
    }

    const matchedOrder = foundOrders.find((order) => order.orderCode === this.pendingQrSource?.orderCode);
    if (!matchedOrder) {
      this.stopPendingQrTimer();
      this.pendingQr = null;
      return;
    }

    const normalizedSource: PendingQrState = {
      ...this.pendingQrSource,
      total: Number(this.pendingQrSource.total || matchedOrder.total || 0),
      depositAmount: Number(this.pendingQrSource.depositAmount || Math.round((matchedOrder.total || 0) * 0.1)),
      requireDeposit: Boolean(this.pendingQrSource.requireDeposit || Number(matchedOrder.total || 0) >= 10000000),
    };

    this.pendingQrSource = normalizedSource;
    this.activatePendingQr(normalizedSource);
  }

  private startPendingQrTimer(): void {
    if (this.pendingQrTick) return;
    this.pendingQrTick = setInterval(() => {
      this.pendingQrSecondsLeft -= 1;
      if (this.pendingQrSecondsLeft <= 0) {
        this.clearPendingQr();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopPendingQrTimer(): void {
    if (this.pendingQrTick) {
      clearInterval(this.pendingQrTick);
      this.pendingQrTick = null;
    }
  }

  private async syncDemoTransferTimeout(orderId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/orders/${orderId}/demo-transfer-timeout`, {}));
    } catch {

    }
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




