import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  API_BASE_URL,
  BackendStatus,
  CancellationRequestData,
  SubmittedReviewData,
  TrackingOrder,
  TrackingProduct,
} from './components/models/order-tracking.models';

@Injectable({
  providedIn: 'root',
})
export class OrderTrackingDataService {
  constructor(private readonly http: HttpClient) {}

  parseCodes(raw: string): string[] {
    const normalized = raw
      .split(/[\s,;]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value)}d`;
  }

  async uploadReviewMedia(files: File[]): Promise<{ images: string[]; videos: string[] }> {
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

  async applyExistingReviews(order: TrackingOrder): Promise<void> {
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
        images: Array.isArray(item?.images) ? item.images.map((x: any) => this.toMediaUrl(x)).filter(Boolean) : [],
        videos: Array.isArray(item?.videos) ? item.videos.map((x: any) => this.toMediaUrl(x)).filter(Boolean) : [],
        status: String(item?.status || 'pending'),
        createdAt: item?.createdAt ? String(item.createdAt) : '',
      });
    });

    order.products.forEach((product) => {
      product.submittedReview = submittedMap.get(product.orderDetailId) || null;
    });
  }

  toMediaUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `http://localhost:3000${raw}`;
    return raw;
  }

    statusLabel(status: BackendStatus | 'exchanged'): string {
    const map: Record<string, string> = {
      pending: 'Đã đặt hàng',
      confirmed: 'Đã xác nhận',
      cancel_pending: 'Đã hủy',
      processing: 'Đang xử lý',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao hàng',
      completed: 'Hoàn tất',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
      exchanged: 'Đã đổi hàng',
    };
    return map[String(status || '').toLowerCase()] || status;
  }

  async fetchOrderByCode(code: string): Promise<TrackingOrder | null> {
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

    const totalAmount = Number(pricing.grand_total ?? order.total_amount ?? 0);
    const expectedDeposit = totalAmount >= 10000000
      ? Math.max(0, Number(order?.deposit_amount || Math.round(totalAmount * 0.1)))
      : 0;

    const paidPayments = payments.filter((item: any) => String(item?.status || '').toLowerCase() === 'paid');
    const paidAmount = paidPayments.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0);
    const depositPaidAmount = paidPayments
      .filter((item: any) => String(item?.type || '').toLowerCase() === 'deposit')
      .reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0);

    const hasSettled = totalAmount > 0 && paidAmount >= totalAmount;
    const hasDepositPaid = expectedDeposit > 0 && depositPaidAmount >= expectedDeposit;
    const paymentState = hasSettled ? 'settled' : hasDepositPaid ? 'deposit_paid' : 'pending';
    const paymentStateLabel = hasSettled ? '\u0054\u1ea5t to\u00e1n' : hasDepositPaid ? '\u0110\u00e3 c\u1ecdc' : 'Ch\u1edd thanh to\u00e1n';
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);

    const products: TrackingProduct[] = items.map((item: any, index: number) => ({
      id: String(item?._id || item?.variant_id || `item-${index}`),
      orderDetailId: String(item?._id || ''),
      productId: String(item?.product_id || ''),
      productSlug: String(item?.product_slug || item?.slug || '').trim(),
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
    const rawStatus = String(order?.status || 'pending').toLowerCase();
    const backendStatus = (rawStatus === 'cancel_pending' ? 'cancelled' : rawStatus) as BackendStatus;

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
        images: Array.isArray(item?.images) ? item.images.map((x: any) => this.toMediaUrl(x)).filter(Boolean) : [],
        videos: Array.isArray(item?.videos) ? item.videos.map((x: any) => this.toMediaUrl(x)).filter(Boolean) : [],
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
      total: totalAmount,
      paymentState,
      paymentStateLabel,
      paidAmount,
      remainingAmount,
      backendStatus,
      statusLabel: this.statusLabel(backendStatus),
      products,
      reviewSubmitted,
      confirmedAt: order?.confirmed_at ? String(order.confirmed_at) : '',
      cancellationRequest: (() => {
        const raw = order?.cancellation_request;
        if (!raw || typeof raw !== 'object') return null;

        const mapped: CancellationRequestData = {
          reason: String(raw.reason || ''),
          note: String(raw.note || ''),
          phone: String(raw.phone || ''),
          requestedAt: raw.requested_at ? String(raw.requested_at) : '',
          previousStatus: String(raw.previous_status || '') as BackendStatus | '',
          over10mWithDeposit: Boolean(raw.over_10m_with_deposit),
        };

        const hasMeaningfulData = Boolean(
          mapped.reason.trim() ||
          mapped.phone.trim() ||
          mapped.note.trim() ||
          mapped.requestedAt.trim(),
        );

        return hasMeaningfulData ? mapped : null;
      })(),
      cancelForm: {
        open: false,
        reason: '',
        note: '',
        phone: String(display?.phone || order?.shipping_phone || ''),
        submitting: false,
      },
    };
  }

  private normalizePayment(method: string | undefined): string {
    const value = String(method || '').toLowerCase();
    if (value === 'bank_transfer') return 'Chuyển khoản ngân hàng';
    if (value === 'cod') return 'COD (Thanh toán khi nhận hàng)';
    return method || 'Không xác định';
  }
}




