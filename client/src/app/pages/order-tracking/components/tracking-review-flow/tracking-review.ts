import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrackingOrder, TrackingProduct } from '../models/order-tracking.models';

@Component({
  selector: 'app-tracking-review-flow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-review.html',
  styleUrl: '../../order-tracking.css',
})
export class TrackingReviewFlowComponent {
  readonly reviewRewardPoints = 10;
  @Input({ required: true }) order!: TrackingOrder;
  @Input() reviewSubmittingProductKey: string | null = null;
  @Input() reviewInlineErrors: Record<string, string> = {};

  @Input() cameraOpen = false;
  @Input() cameraError = '';
  @Input() cameraMode: 'image' | 'video' = 'image';
  @Input() cameraDevices: Array<{ id: string; label: string }> = [];
  @Input() selectedCameraId = '';
  @Input() cameraRecording = false;
  @Input() cameraRecordedSeconds = 0;

  @Output() setRatingClick = new EventEmitter<{ product: TrackingProduct; value: number }>();
  @Output() imageSelected = new EventEmitter<{ event: Event; product: TrackingProduct }>();
  @Output() videoSelected = new EventEmitter<{ event: Event; product: TrackingProduct }>();
  @Output() removeImageClick = new EventEmitter<{ product: TrackingProduct; index: number }>();
  @Output() removeVideoClick = new EventEmitter<{ product: TrackingProduct; index: number }>();
  @Output() submitSingleReviewClick = new EventEmitter<{ order: TrackingOrder; product: TrackingProduct }>();
  @Output() openCameraImageClick = new EventEmitter<TrackingProduct>();
  @Output() openCameraVideoClick = new EventEmitter<TrackingProduct>();
  @Output() closeCameraClick = new EventEmitter<void>();
  @Output() switchCameraFacingClick = new EventEmitter<void>();
  @Output() cameraDeviceChangeClick = new EventEmitter<string>();
  @Output() capturePhotoClick = new EventEmitter<void>();
  @Output() startVideoRecordingClick = new EventEmitter<void>();
  @Output() stopVideoRecordingClick = new EventEmitter<void>();
  @Output() viewProductClick = new EventEmitter<{ product: TrackingProduct; target: 'top' | 'review' }>();
  @Output() buyAgainClick = new EventEmitter<TrackingProduct>();

  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;

  stars = [1, 2, 3, 4, 5];

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 5:
        return 'Rất hài lòng';
      case 4:
        return 'Hài lòng';
      case 3:
        return 'Trung bình';
      case 2:
        return 'Ít hài lòng';
      case 1:
        return 'Không hài lòng';
      default:
        return '';
    }
  }

  reviewModerationLabel(status: string): string {
    const key = String(status || '').toLowerCase();
    if (key === 'approved') return 'Đã duyệt';
    if (key === 'rejected') return 'Đã từ chối';
    return 'Đang chờ duyệt';
  }

  imageCountLabel(product: TrackingProduct): string {
    return `${product.review.imageFiles.length}/5 ảnh`;
  }

  videoCountLabel(product: TrackingProduct): string {
    return `${product.review.videoFiles.length}/5 video`;
  }

  isImageLimitReached(product: TrackingProduct): boolean {
    return product.review.imageFiles.length >= 5;
  }

  isVideoLimitReached(product: TrackingProduct): boolean {
    return product.review.videoFiles.length >= 5;
  }

  hasSubmittedReviews(): boolean {
    return this.order.products.some((item) => !!item.submittedReview);
  }

  showReviewSection(): boolean {
    if (this.order.backendStatus !== 'completed') return false;
    return this.order.products.some((item) => !!item.orderDetailId && !item.submittedReview);
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
  }

  reviewKey(product: TrackingProduct): string {
    return `${this.order.id}:${product.orderDetailId || product.id}`;
  }

  isSubmittingProduct(product: TrackingProduct): boolean {
    return this.reviewSubmittingProductKey === this.reviewKey(product);
  }

  canSubmitProduct(product: TrackingProduct): boolean {
    return (
      product.review.rating > 0
      || String(product.review.comment || '').trim().length > 0
      || product.review.imageFiles.length > 0
      || product.review.videoFiles.length > 0
    );
  }
}

