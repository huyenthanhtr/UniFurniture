export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'completed',
] as const;

export const ADMIN_ORDER_STATUSES = [
  ...ORDER_STATUS_FLOW,
  'cancelled',
  'exchanged',
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  exchanged: 'Đã đổi hàng',
  cancel_pending: 'Đã hủy',
};

export function normalizeOrderStatus(status: any): string {
  const key = String(status || '').trim().toLowerCase();
  return key === 'cancel_pending' ? 'cancelled' : key;
}

export function getOrderStatusLabel(status: any): string {
  const key = normalizeOrderStatus(status);
  return STATUS_LABELS[key] || String(status || '-');
}

export function getAllowedNextOrderStatuses(status: any): AdminOrderStatus[] {
  const current = normalizeOrderStatus(status);

  if (current === 'pending') return ['confirmed', 'cancelled'];
  if (current === 'confirmed') return ['processing'];
  if (current === 'processing') return ['shipping'];
  if (current === 'shipping') return ['delivered'];
  if (current === 'delivered') return ['completed'];
  if (current === 'completed') return ['exchanged'];
  return [];
}

export function getOrderStatusRestrictionMessage(currentStatus: any, nextStatus: any): string {
  const current = normalizeOrderStatus(currentStatus);
  const target = normalizeOrderStatus(nextStatus);

  if (!target || target === current) return '';

  const allowed = getAllowedNextOrderStatuses(current);
  if (allowed.includes(target as AdminOrderStatus)) return '';

  if (current === 'cancelled') return 'Đơn này đã được hủy nên không thể cập nhật thêm trạng thái.';
  if (current === 'exchanged') return 'Đơn này đã chuyển sang trạng thái đổi hàng nên không thể cập nhật thêm.';
  if (target === 'cancelled') return 'Chỉ có thể chuyển sang "Đã hủy" khi đơn đang ở trạng thái "Chờ xác nhận".';
  if (target === 'exchanged') return 'Chỉ có thể chuyển sang "Đã đổi hàng" sau khi đơn đã ở trạng thái "Hoàn tất".';

  if (ORDER_STATUS_FLOW.includes(current as (typeof ORDER_STATUS_FLOW)[number])) {
    const currentIndex = ORDER_STATUS_FLOW.indexOf(current as (typeof ORDER_STATUS_FLOW)[number]);
    const targetIndex = ORDER_STATUS_FLOW.indexOf(target as (typeof ORDER_STATUS_FLOW)[number]);

    if (targetIndex !== -1 && targetIndex < currentIndex) {
      return 'Trạng thái đơn hàng không thể quay lại bước trước.';
    }

    return 'Trạng thái đơn hàng cần được cập nhật theo đúng thứ tự, không thể bỏ qua bước trung gian.';
  }

  return 'Không thể cập nhật đơn hàng sang trạng thái bạn vừa chọn.';
}

export function canSelectOrderStatus(currentStatus: any, nextStatus: any): boolean {
  return !getOrderStatusRestrictionMessage(currentStatus, nextStatus);
}
