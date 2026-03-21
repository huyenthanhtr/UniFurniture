export type BackendStatus =
  | 'pending'
  | 'confirmed'
  | 'cancel_pending'
  | 'processing'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface ProductReview {
  rating: number;
  comment: string;
  imageFiles: File[];
  videoFiles: File[];
  imagePreviews: string[];
  videoPreviews: string[];
}

export interface SubmittedReviewData {
  rating: number;
  content: string;
  images: string[];
  videos: string[];
  status: string;
  createdAt: string;
}

export interface TrackingProduct {
  id: string;
  orderDetailId: string;
  productId: string;
  productSlug?: string;
  variantId: string;
  imageUrl: string;
  name: string;
  classification: string;
  quantity: number;
  unitPrice: number;
  review: ProductReview;
  submittedReview: SubmittedReviewData | null;
}

export interface CancellationRequestData {
  reason: string;
  note: string;
  phone: string;
  requestedAt: string;
  previousStatus: BackendStatus | '';
  over10mWithDeposit: boolean;
}

export interface CancelFormModel {
  open: boolean;
  reason: string;
  note: string;
  phone: string;
  submitting: boolean;
}

export interface TrackingOrder {
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

export interface TimelineStep {
  label: string;
}

export const API_BASE_URL = 'http://localhost:3000/api';
export const TRACKING_STATE_KEY = 'unifurniture_tracking_state_v1';
export const MAX_REVIEW_IMAGES = 5;
export const MAX_REVIEW_VIDEOS = 5;
export const SHOP_ZALO_URL = 'https://zalo.me/0123456789';

export const CANCEL_REASONS = [
  'Đổi ý không muốn mua nữa',
  'Muốn đổi địa chỉ hoặc thời gian nhận',
  'Tìm được sản phẩm phù hợp hơn',
  'Đặt nhầm sản phẩm/số lượng',
  'Lý do khác',
] as const;
