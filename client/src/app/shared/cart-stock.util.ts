export const STOCK_LIMIT_ERROR_MESSAGE = 'Đã vượt quá số lượng tồn kho';

export interface StockConstrainedQuantity {
  requestedQuantity: number;
  allowedQuantity: number;
  exceededStock: boolean;
  isOutOfStock: boolean;
}

export function normalizeCartQuantity(rawValue: number, fallback = 1): number {
  const nextValue = Number.isFinite(rawValue) ? Math.floor(rawValue) : fallback;
  return Math.max(1, nextValue);
}

export function getStockConstrainedQuantity(
  rawValue: number,
  maxStock?: number,
  fallback = 1,
): StockConstrainedQuantity {
  const requestedQuantity = normalizeCartQuantity(rawValue, fallback);

  if (typeof maxStock !== 'number' || !Number.isFinite(maxStock)) {
    return {
      requestedQuantity,
      allowedQuantity: requestedQuantity,
      exceededStock: false,
      isOutOfStock: false,
    };
  }

  const normalizedStock = Math.max(0, Math.floor(maxStock));

  return {
    requestedQuantity,
    allowedQuantity: Math.min(requestedQuantity, normalizedStock),
    exceededStock: requestedQuantity > normalizedStock,
    isOutOfStock: normalizedStock === 0,
  };
}
