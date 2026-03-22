const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");
const CustomerAddress = require("../models/CustomerAddress");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const WarrantyRecord = require("../models/WarrantyRecord");
const { recalculateProductAggregates } = require("../utils/product-aggregate");
const { generateCustomerCode, generateUniqueOrderCode } = require("../utils/code-generator");

const ORDER_STATUSES = ["pending", "confirmed", "cancel_pending", "processing", "shipping", "delivered", "completed", "cancelled", "exchanged"];
const INVENTORY_DEDUCT_STATUSES = new Set(["confirmed", "processing", "shipping", "delivered", "completed"]);
const NORMAL_STATUS_ASC_WEIGHT = {
  pending: 1,
  confirmed: 2,
  cancel_pending: 3,
  processing: 4,
  shipping: 5,
  delivered: 6,
  completed: 7,
};
const NORMAL_STATUS_DESC_WEIGHT = {
  completed: 1,
  delivered: 2,
  shipping: 3,
  processing: 4,
  cancel_pending: 5,
  confirmed: 6,
  pending: 7,
};
const CANCELLATION_GRACE_HOURS = 24;
const WARRANTY_YEARS = 5;
const SOLD_COUNT_STATUSES = new Set(["completed"]);

function getExpectedDepositAmount(totalAmount, depositAmount) {
  const total = Math.max(Number(totalAmount || 0), 0);
  const explicitDeposit = Math.max(Number(depositAmount || 0), 0);
  if (explicitDeposit > 0) return explicitDeposit;
  return total >= 10000000 ? Math.round(total * 0.1) : 0;
}

function getPaymentTypeCode(type) {
  const key = String(type || "").trim().toLowerCase();
  if (key === "deposit") return "DEP";
  if (key === "remaining") return "REM";
  return "FULL";
}

function buildBankTransferTransactionId(orderCode, paymentType) {
  const normalizedOrderCode = String(orderCode || "").trim();
  if (!normalizedOrderCode) return null;
  return `${normalizedOrderCode}-${getPaymentTypeCode(paymentType)}`;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ORDER_STATUSES.includes(status) ? status : null;
}

function normalizeStoredOrderStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "refunded" || status === "cancel_pending") return "cancelled";
  return ORDER_STATUSES.includes(status) ? status : status;
}

const ADMIN_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing"],
  processing: ["shipping"],
  shipping: ["delivered"],
  delivered: ["completed"],
  completed: ["exchanged"],
  cancelled: [],
  exchanged: [],
};

async function getOrderInventoryItems(orderId) {
  const details = await OrderDetail.find({ order_id: orderId }).lean();
  return details.map((detail) => ({
    variantId: String(detail.variant_id || "").trim(),
    quantity: Math.max(0, Number(detail.quantity || 0)),
    sku: String(detail.sku || "").trim(),
    productName: String(detail.product_name || "").trim(),
    variantName: String(detail.variant_name || "").trim(),
  }));
}

async function deductInventoryForOrder(orderId) {
  const items = await getOrderInventoryItems(orderId);

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.variantId) || item.quantity <= 0) continue;

    const variant = await ProductVariant.findById(item.variantId);
    if (!variant) {
      throw new Error(`Không tìm thấy biến thể để trừ kho: ${item.variantName || item.sku || item.productName || item.variantId}`);
    }

    const currentStock = Math.max(0, Number(variant.stock_quantity || 0));
    if (currentStock < item.quantity) {
      throw new Error(
        `Tồn kho không đủ cho ${item.variantName || item.productName || variant.sku || "biến thể"}. Còn ${currentStock}, cần ${item.quantity}.`
      );
    }

    variant.stock_quantity = currentStock - item.quantity;
    await variant.save();
  }
}

async function restoreInventoryForOrder(orderId) {
  const items = await getOrderInventoryItems(orderId);

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.variantId) || item.quantity <= 0) continue;

    const variant = await ProductVariant.findById(item.variantId);
    if (!variant) continue;

    variant.stock_quantity = Math.max(0, Number(variant.stock_quantity || 0)) + item.quantity;
    await variant.save();
  }
}

async function adjustSoldCountForOrder(orderId, direction = 1) {
  const items = await getOrderInventoryItems(orderId);
  const affectedProductIds = new Set();

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.variantId) || item.quantity <= 0) continue;

    const variant = await ProductVariant.findById(item.variantId);
    if (!variant) continue;

    const currentSold = Math.max(0, Number(variant.sold || 0));
    variant.sold = direction > 0
      ? currentSold + item.quantity
      : Math.max(0, currentSold - item.quantity);
    await variant.save();

    if (variant.product_id) {
      affectedProductIds.add(String(variant.product_id));
    }
  }

  for (const productId of affectedProductIds) {
    await recalculateProductAggregates(productId);
  }
}

function validateAdminStatusTransition(order, nextStatus) {
  const rawTargetStatus = String(nextStatus || "").trim().toLowerCase();
  const currentStatus = normalizeStoredOrderStatus(order?.status);
  const targetStatus = normalizeStoredOrderStatus(nextStatus);

  if (!targetStatus || rawTargetStatus === "cancel_pending") {
    return { allowed: false, message: "Trạng thái đơn hàng không hợp lệ." };
  }

  if (targetStatus === currentStatus) {
    return { allowed: true, message: "" };
  }

  const allowedNextStatuses = ADMIN_STATUS_TRANSITIONS[currentStatus] || [];
  if (allowedNextStatuses.includes(targetStatus)) {
    return { allowed: true, message: "" };
  }

  if (currentStatus === "cancelled") {
    return { allowed: false, message: "Đơn này đã được hủy nên không thể cập nhật thêm trạng thái." };
  }

  if (currentStatus === "exchanged") {
    return { allowed: false, message: "Đơn này đã chuyển sang trạng thái đổi hàng nên không thể cập nhật thêm." };
  }

  if (targetStatus === "cancelled") {
    return { allowed: false, message: "Chỉ có thể chuyển sang \"Đã hủy\" khi đơn đang ở trạng thái \"Chờ xác nhận\"." };
  }

  if (targetStatus === "exchanged") {
    return { allowed: false, message: "Chỉ có thể chuyển sang \"Đã đổi hàng\" sau khi đơn đã ở trạng thái \"Hoàn tất\"." };
  }

  return {
    allowed: false,
    message: "Trạng thái đơn hàng cần được cập nhật theo đúng thứ tự, không thể bỏ qua bước trung gian hoặc quay lại bước trước.",
  };
}

async function findOrderByIdentifier(identifier, options = {}) {
  const value = String(identifier || "").trim();
  const { lean = false } = options;
  if (!value) return null;

  if (mongoose.Types.ObjectId.isValid(value)) {
    const byId = lean ? await Order.findById(value).lean() : await Order.findById(value);
    if (byId) return byId;
  }

  return lean
    ? await Order.findOne({ order_code: value }).lean()
    : await Order.findOne({ order_code: value });
}

function addYears(dateInput, years) {
  const date = new Date(dateInput || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function ensureWarrantySummary(orderDoc) {
  const normalizedStatus = String(orderDoc?.status || "").toLowerCase();
  const isWarrantyEligibleStatus = ["completed", "exchanged"].includes(normalizedStatus);
  const activatedRaw = orderDoc?.warranty?.activated_at
    || (isWarrantyEligibleStatus ? orderDoc?.updatedAt || orderDoc?.createdAt : null);
  const activatedAt = activatedRaw ? new Date(activatedRaw) : null;
  const safeActivatedAt = activatedAt && !Number.isNaN(activatedAt.getTime()) ? activatedAt : null;

  const expiresRaw = orderDoc?.warranty?.expires_at || (safeActivatedAt ? addYears(safeActivatedAt, WARRANTY_YEARS) : null);
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  const safeExpiresAt = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;

  const history = Array.isArray(orderDoc?.warranty?.history) ? orderDoc.warranty.history : [];

  return {
    activated_at: safeActivatedAt,
    expires_at: safeExpiresAt,
    history,
  };
}

function activateWarrantyIfNeeded(orderDoc, activationDate = new Date()) {
  if (!orderDoc.warranty) orderDoc.warranty = {};
  if (!orderDoc.warranty.activated_at) {
    orderDoc.warranty.activated_at = activationDate;
  }
  if (!orderDoc.warranty.expires_at) {
    orderDoc.warranty.expires_at = addYears(orderDoc.warranty.activated_at, WARRANTY_YEARS);
  }
}

function normalizeWarrantyHistoryRecord(record, orderDetailMap = new Map()) {
  const servicedAt = record?.serviced_at ? new Date(record.serviced_at) : null;
  const detail = orderDetailMap.get(String(record?.order_detail_id || "")) || null;
  const imageUrl = String(record?.image_url || detail?.image_url || "").trim();
  const variantName = String(record?.variant_name || detail?.variant_name || "").trim() || "-";
  const productName = String(record?.product_name || detail?.product_name || "").trim() || "-";
  const cost = Math.max(0, Number(record?.cost || 0));
  const storedType = String(record?.type || "").trim().toLowerCase();
  const activatedAt = detail?.warranty_activated_at ? new Date(detail.warranty_activated_at) : null;
  const expiresAt = detail?.warranty_expires_at ? new Date(detail.warranty_expires_at) : null;
  const inferredWithinWarranty = !!(
    servicedAt
    && activatedAt
    && expiresAt
    && !Number.isNaN(servicedAt.getTime())
    && !Number.isNaN(activatedAt.getTime())
    && !Number.isNaN(expiresAt.getTime())
    && servicedAt.getTime() >= activatedAt.getTime()
    && servicedAt.getTime() <= expiresAt.getTime()
  );
  const normalizedType = storedType === "warranty" || storedType === "maintenance"
    ? storedType
    : (inferredWithinWarranty ? "warranty" : "maintenance");

  return {
    _id: record?._id || null,
    order_detail_id: record?.order_detail_id || detail?._id || null,
    variant_id: record?.variant_id || detail?.variant_id || null,
    product_name: productName,
    variant_name: variantName,
    image_url: imageUrl,
    serviced_at: servicedAt,
    type: normalizedType,
    cost,
    description: String(record?.description || "").trim(),
    created_at: record?.created_at || record?.createdAt || null,
  };
}

async function getWarrantyHistoryForOrder(orderId, orderDetailMap = new Map()) {
  const records = await WarrantyRecord.find({ order_id: orderId })
    .sort({ serviced_at: -1, createdAt: -1, _id: -1 })
    .lean();

  if (records.length > 0) {
    return records.map((record) => normalizeWarrantyHistoryRecord(record, orderDetailMap));
  }

  return [];
}

function getConfirmedAt(order) {
  const direct = order?.confirmed_at || order?.status_confirmed_at;
  if (direct) {
    const date = new Date(direct);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const fallback = new Date(order?.updatedAt || 0);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function checkCancelEligibility(order) {
  const status = String(order?.status || "").toLowerCase();

  if (status === "pending") {
    return { allowed: true, message: "" };
  }

  if (status === "confirmed") {
    const confirmedAt = getConfirmedAt(order);
    if (!confirmedAt) {
      return { allowed: false, message: "Khong xac dinh duoc thoi diem xac nhan don." };
    }

    const elapsedMs = Date.now() - confirmedAt.getTime();
    const withinWindow = elapsedMs <= CANCELLATION_GRACE_HOURS * 60 * 60 * 1000;
    if (!withinWindow) {
      return { allowed: false, message: "Don da qua 24h ke tu luc xac nhan nen khong the yeu cau huy." };
    }

    return { allowed: true, message: "" };
  }

  if (status === "cancel_pending") {
    return { allowed: false, message: "Don dang cho xac nhan huy." };
  }

  return { allowed: false, message: "Don hang khong con trong thoi han cho phep huy." };
}

async function resolveProfile(order, customerId) {
  if (order?.account_id && mongoose.Types.ObjectId.isValid(String(order.account_id))) {
    const byAccount = await Profile.findById(order.account_id).lean();
    if (byAccount) return byAccount;
  }

  if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) {
    const byCustomer = await Profile.findOne({ customer_id: customerId }).lean();
    if (byCustomer) return byCustomer;
  }

  return null;
}

async function resolveCheckoutCustomer(accountId, safeName, safePhone) {
  const normalizedAccountId = String(accountId || "").trim();

  if (!normalizedAccountId || !mongoose.Types.ObjectId.isValid(normalizedAccountId)) {
    const guestCustomer = await Customer.create({
      customer_code: await generateCustomerCode(),
      full_name: safeName,
      phone: safePhone,
      customer_type: "guest",
      status: "active",
    });

    return {
      customerId: guestCustomer._id,
      accountId: null,
    };
  }

  const profile = await Profile.findById(normalizedAccountId);
  if (!profile) {
    const guestCustomer = await Customer.create({
      customer_code: await generateCustomerCode(),
      full_name: safeName,
      phone: safePhone,
      customer_type: "guest",
      status: "active",
    });

    return {
      customerId: guestCustomer._id,
      accountId: null,
    };
  }

  let customer = null;
  if (profile.customer_id && mongoose.Types.ObjectId.isValid(String(profile.customer_id))) {
    customer = await Customer.findById(profile.customer_id);
  }

  if (!customer) {
    customer = await Customer.create({
      customer_code: await generateCustomerCode(),
      full_name: String(profile.full_name || safeName || "").trim() || safeName,
      phone: String(profile.phone || safePhone || "").trim() || safePhone,
      customer_type: "member",
      status: "active",
    });

    profile.customer_id = customer._id;
    await profile.save();
  } else {
    customer.customer_type = "member";
    if (!String(customer.full_name || "").trim()) {
      customer.full_name = String(profile.full_name || safeName || "").trim() || safeName;
    }
    if (!String(customer.phone || "").trim()) {
      customer.phone = String(profile.phone || safePhone || "").trim() || safePhone;
    }
    await customer.save();
  }

  return {
    customerId: customer._id,
    accountId: profile._id,
  };
}

function buildDisplay(order, customer, profile) {
  const receiver_name =
    order?.shipping_name ||
    customer?.full_name ||
    profile?.full_name ||
    "KhÃ¡ch khÃ´ng Ä‘Äƒng nháº­p";

  const phone =
    order?.shipping_phone ||
    customer?.phone ||
    profile?.phone ||
    "-";

  const email =
    order?.shipping_email ||
    profile?.email ||
    "-";

  const address =
    order?.shipping_address ||
    profile?.address ||
    "-";

  return {
    receiver_name,
    phone,
    email,
    address,
    customer_type: customer?.customer_type || "guest",
    has_account: !!profile,
  };
}

function buildPaymentSummary(orderDoc, orderPayments) {
  const paidPayments = orderPayments.filter((x) => String(x.status || "").toLowerCase() === "paid");
  const paidTotal = paidPayments.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const latestPayment = orderPayments[0] || null;
  const depositAmount = getExpectedDepositAmount(orderDoc.total_amount, orderDoc.deposit_amount);
  const totalAmount = Math.max(Number(orderDoc.total_amount || 0), 0);
  const depositPaidTotal = paidPayments
    .filter((x) => String(x.type || "").toLowerCase() === "deposit")
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const hasDepositPaid = depositAmount > 0 && depositPaidTotal >= depositAmount;
  const hasFullPaid = totalAmount > 0 && paidTotal >= totalAmount;
  const hasRemainingPaid = paidPayments.some((x) => String(x.type || "").toLowerCase() === "remaining");
  const latestPaidType = paidPayments[0]?.type || null;

  return {
    method: latestPayment?.method || "-",
    status: latestPayment?.status || "-",
    count: orderPayments.length,
    paid_total: paidTotal,
    deposit_amount: depositAmount,
    deposit_paid_total: depositPaidTotal,
    has_deposit_paid: hasDepositPaid,
    has_full_paid: hasFullPaid,
    has_remaining_paid: hasRemainingPaid,
    latest_paid_type: latestPaidType,
    total_amount: totalAmount,
  };
}

function isOrderPaymentSettled(orderDoc, orderPayments = []) {
  return !!buildPaymentSummary(orderDoc, orderPayments)?.has_full_paid;
}

function getPaymentSortWeight(paymentSummary, direction) {
  const total = Number(paymentSummary?.total_amount || 0);
  const paidTotal = Number(paymentSummary?.paid_total || 0);
  const hasDepositPaid = !!paymentSummary?.has_deposit_paid;
  const hasFullPaid = !!paymentSummary?.has_full_paid;
  const latestStatus = String(paymentSummary?.status || "").toLowerCase();
  const paymentCount = Number(paymentSummary?.count || 0);

  let weight = 1;
  if (hasFullPaid || (total > 0 && paidTotal >= total)) weight = 4;
  else if (hasDepositPaid) weight = 3;
  else if (paymentCount > 0) weight = 2;

  if (latestStatus === "failed") return 5;
  if (latestStatus === "refunded") return 6;

  return direction === "desc" ? 5 - weight : weight;
}

function getStatusSortWeight(status, direction) {
  const key = normalizeStoredOrderStatus(status);
  if (key === "cancelled") return 8;
  if (key === "exchanged") return 9;
  return direction === "desc"
    ? (NORMAL_STATUS_DESC_WEIGHT[key] || 99)
    : (NORMAL_STATUS_ASC_WEIGHT[key] || 99);
}

function compareValues(left, right, direction, type = "string") {
  if (type === "number") {
    const a = Number(left || 0);
    const b = Number(right || 0);
    if (a === b) return 0;
    return a < b ? -1 * direction : 1 * direction;
  }

  if (type === "date") {
    const a = new Date(left || 0).getTime();
    const b = new Date(right || 0).getTime();
    if (a === b) return 0;
    return a < b ? -1 * direction : 1 * direction;
  }

  const a = String(left || "");
  const b = String(right || "");
  return a.localeCompare(b, "vi", { sensitivity: "base", numeric: true }) * direction;
}

function sortOrders(items, sortKey, sortDirection) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let result = 0;

    switch (sortKey) {
      case "order_code":
        result = compareValues(left.order_code, right.order_code, direction);
        break;
      case "customer_type":
        result = compareValues(left.display?.customer_type, right.display?.customer_type, direction);
        break;
      case "payment":
        result = compareValues(
          getPaymentSortWeight(left.payment_summary, sortDirection),
          getPaymentSortWeight(right.payment_summary, sortDirection),
          1,
          "number"
        );
        break;
      case "total_amount":
        result = compareValues(left.total_amount, right.total_amount, direction, "number");
        break;
      case "status":
        result = compareValues(
          getStatusSortWeight(left.status, sortDirection),
          getStatusSortWeight(right.status, sortDirection),
          1,
          "number"
        );
        break;
      case "ordered_at":
      default:
        result = compareValues(left.ordered_at || left.createdAt, right.ordered_at || right.createdAt, direction, "date");
        break;
    }

    if (result !== 0) return result;
    return compareValues(left._id, right._id, -1);
  });
}

async function getOrders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      customerType,
      startDate,
      endDate,
      q,
      accountId,
      sortBy = "ordered_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = String(order).toLowerCase() === "asc" ? "asc" : "desc";

    const query = {};
    const andConditions = [];

    if (status) {
      const normalized = normalizeStatus(status);
      if (normalized) andConditions.push({ status: normalized });
    }

    if (accountId && mongoose.Types.ObjectId.isValid(String(accountId))) {
      andConditions.push({ account_id: new mongoose.Types.ObjectId(String(accountId)) });
    }

    if (q) {
      const kw = String(q).trim();
      if (kw) {
        andConditions.push({
          $or: [
            { order_code: { $regex: kw, $options: "i" } },
            { shipping_name: { $regex: kw, $options: "i" } },
            { shipping_phone: { $regex: kw, $options: "i" } },
            { shipping_email: { $regex: kw, $options: "i" } },
            { shipping_address: { $regex: kw, $options: "i" } },
          ],
        });
      }
    }

    const normalizedCustomerType = ["guest", "member"].includes(String(customerType || "").toLowerCase())
      ? String(customerType).toLowerCase()
      : "";

    if (normalizedCustomerType) {
      const matchedCustomers = await Customer.find({ customer_type: normalizedCustomerType })
        .select({ _id: 1 })
        .lean();
      const matchedCustomerIds = matchedCustomers.map((item) => item._id);

      if (normalizedCustomerType === "member") {
        andConditions.push({
          customer_id: { $in: matchedCustomerIds.length ? matchedCustomerIds : [] },
        });
      } else {
        andConditions.push({
          $or: [
            { customer_id: { $in: matchedCustomerIds } },
            { customer_id: null },
            { customer_id: { $exists: false } },
          ],
        });
      }
    }

    const dateQuery = {};
    if (startDate) {
      const from = new Date(String(startDate));
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        dateQuery.$gte = from;
      }
    }
    if (endDate) {
      const to = new Date(String(endDate));
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        dateQuery.$lte = to;
      }
    }
    if (Object.keys(dateQuery).length) {
      andConditions.push({ ordered_at: dateQuery });
    }

    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0]);
    } else if (andConditions.length > 1) {
      query.$and = andConditions;
    }

    const sortKey = [
      "order_code",
      "customer_type",
      "payment",
      "status",
      "ordered_at",
      "total_amount",
    ].includes(String(sortBy))
      ? String(sortBy)
      : "ordered_at";

    const orders = await Order.find(query).lean();

    const customerIds = [...new Set(orders.map((x) => String(x.customer_id || "")).filter(Boolean))];
    const orderIds = orders.map((x) => String(x._id));

    const [customers, profiles, payments, orderDetails] = await Promise.all([
      customerIds.length ? Customer.find({ _id: { $in: customerIds } }).lean() : [],
      customerIds.length ? Profile.find({ customer_id: { $in: customerIds } }).lean() : [],
      orderIds.length ? Payment.find({ order_id: { $in: orderIds } }).sort({ createdAt: -1 }).lean() : [],
      orderIds.length ? OrderDetail.find({ order_id: { $in: orderIds } }).sort({ createdAt: 1, _id: 1 }).lean() : [],
    ]);

    const variantIds = [...new Set(
      orderDetails
        .map((item) => String(item.variant_id || ""))
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    )];

    const variants = variantIds.length
      ? await ProductVariant.find({ _id: { $in: variantIds } }).select({ _id: 1, product_id: 1 }).lean()
      : [];
    const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]));

    const productIds = [...new Set(
      variants
        .map((variant) => String(variant?.product_id || ""))
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    )];

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, thumbnail: 1, thumbnail_url: 1 }).lean()
      : [];
    const productThumbMap = new Map();
    for (const product of products) {
      const key = String(product?._id || "");
      if (!key) continue;
      const thumb = String(product?.thumbnail || "").trim() || String(product?.thumbnail_url || "").trim();
      productThumbMap.set(key, thumb);
    }

    const imageDocs = variantIds.length
      ? await ProductImage.find({ variant_id: { $in: variantIds } })
        .sort({ is_primary: -1, sort_order: 1, _id: 1 })
        .lean()
      : [];

    const imageMap = new Map();
    for (const imageDoc of imageDocs) {
      const key = String(imageDoc.variant_id || "");
      if (!key || imageMap.has(key)) continue;
      imageMap.set(key, String(imageDoc.image_url || "").trim());
    }

    const productImageDocs = productIds.length
      ? await ProductImage.find({ product_id: { $in: productIds } })
        .sort({ is_primary: -1, sort_order: 1, _id: 1 })
        .lean()
      : [];
    const productImageMap = new Map();
    for (const imageDoc of productImageDocs) {
      const key = String(imageDoc.product_id || "");
      if (!key || productImageMap.has(key)) continue;
      productImageMap.set(key, String(imageDoc.image_url || "").trim());
    }

    const orderItemsMap = new Map();
    for (const detail of orderDetails) {
      const orderKey = String(detail.order_id || "");
      if (!orderKey) continue;
      if (!orderItemsMap.has(orderKey)) orderItemsMap.set(orderKey, []);
      const variant = variantMap.get(String(detail.variant_id || ""));
      const productId = String(variant?.product_id || "");
      const imageUrl =
        imageMap.get(String(detail.variant_id || "")) ||
        productThumbMap.get(productId) ||
        productImageMap.get(productId) ||
        "";
      orderItemsMap.get(orderKey).push({
        _id: detail._id,
        product_name: String(detail.product_name || "").trim(),
        variant_name: String(detail.variant_name || "").trim(),
        quantity: Math.max(1, Number(detail.quantity || 1)),
        unit_price: Math.max(0, Number(detail.unit_price || 0)),
        total: Math.max(0, Number(detail.total || 0)),
        image_url: imageUrl,
      });
    }

    const customerMap = new Map(customers.map((x) => [String(x._id), x]));
    const profileMap = new Map(profiles.map((x) => [String(x.customer_id), x]));
    const paymentMap = new Map();

    for (const payment of payments) {
      const key = String(payment.order_id);
      if (!paymentMap.has(key)) paymentMap.set(key, []);
      paymentMap.get(key).push(payment);
    }

    const items = orders.map((orderDoc) => {
      const customer = customerMap.get(String(orderDoc.customer_id || ""));
      const profile = profileMap.get(String(orderDoc.customer_id || ""));
      const display = buildDisplay(orderDoc, customer, profile);
      const orderPayments = paymentMap.get(String(orderDoc._id)) || [];

      return {
        ...orderDoc,
        status: normalizeStoredOrderStatus(orderDoc.status),
        display,
        payment_summary: buildPaymentSummary(orderDoc, orderPayments),
        order_items_preview: orderItemsMap.get(String(orderDoc._id)) || [],
      };
    });

    const sortedItems = sortOrders(items, sortKey, sortDirection);
    const total = sortedItems.length;
    const pagedItems = sortedItems.slice(skip, skip + limitNum);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      items: pagedItems,
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const orderDoc = await findOrderByIdentifier(id, { lean: true });
    const order = orderDoc
      ? {
          ...orderDoc,
          status: normalizeStoredOrderStatus(orderDoc.status),
          warranty: ensureWarrantySummary(orderDoc),
        }
      : null;
    if (!order) return res.status(404).json({ error: "Order not found" });

    const customer = order.customer_id ? await Customer.findById(order.customer_id).lean() : null;
    const profile = await resolveProfile(order, order.customer_id);
    const [items, payments] = await Promise.all([
      OrderDetail.find({ order_id: order._id }).sort({ createdAt: 1, _id: 1 }).lean(),
      Payment.find({ order_id: order._id }).sort({ createdAt: -1, _id: -1 }).lean(),
    ]);

    const variantIds = items
      .map((item) => String(item.variant_id || ""))
      .filter((value) => mongoose.Types.ObjectId.isValid(value));

    const variants = variantIds.length
      ? await ProductVariant.find({ _id: { $in: variantIds } }).lean()
      : [];
    const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]));

    const imageDocs = variantIds.length
      ? await ProductImage.find({ variant_id: { $in: variantIds } }).sort({ is_primary: -1, sort_order: 1, _id: 1 }).lean()
      : [];
    const imageMap = new Map();
    for (const image of imageDocs) {
      const key = String(image.variant_id || "");
      if (!key || imageMap.has(key)) continue;
      imageMap.set(key, image.image_url || "");
    }

    const productIds = Array.from(
      new Set(
        variants
          .map((variant) => String(variant?.product_id || ""))
          .filter((value) => mongoose.Types.ObjectId.isValid(value))
      )
    );
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, slug: 1, thumbnail: 1, thumbnail_url: 1 }).lean()
      : [];
    const productSlugMap = new Map(products.map((product) => [String(product._id), String(product.slug || "").trim()]));
    const productThumbMap = new Map();
    for (const product of products) {
      const key = String(product?._id || "");
      if (!key) continue;
      const thumb = String(product?.thumbnail || "").trim() || String(product?.thumbnail_url || "").trim();
      productThumbMap.set(key, thumb);
    }

    const productImageDocs = productIds.length
      ? await ProductImage.find({ product_id: { $in: productIds } }).sort({ is_primary: -1, sort_order: 1, _id: 1 }).lean()
      : [];
    const productImageMap = new Map();
    for (const image of productImageDocs) {
      const key = String(image.product_id || "");
      if (!key || productImageMap.has(key)) continue;
      productImageMap.set(key, String(image.image_url || "").trim());
    }

    let coupon = null;
    if (order.coupon_id && mongoose.Types.ObjectId.isValid(String(order.coupon_id))) {
      coupon = await Coupon.findById(order.coupon_id).lean();
    } else if (order.coupon_id) {
      coupon = { code: String(order.coupon_id) };
    }

    const normalizedItems = items.map((item) => {
      const variant = variantMap.get(String(item.variant_id || ""));
      const productId = String(variant?.product_id || "");
      return {
        ...item,
        product_id: variant?.product_id || null,
        product_slug: productSlugMap.get(String(variant?.product_id || "")) || "",
        image_url:
          imageMap.get(String(item.variant_id || "")) ||
          productThumbMap.get(productId) ||
          productImageMap.get(productId) ||
          "",
        variant_name: item.variant_name || variant?.variant_name || variant?.name || "-",
        product_name: item.product_name || "-",
        sku: item.sku || variant?.sku || "-",
      };
    });

    const detailIds = normalizedItems
      .map((item) => String(item._id || ""))
      .filter((value) => mongoose.Types.ObjectId.isValid(value));

    const approvedReviews = detailIds.length
      ? await Review.find({ order_detail_id: { $in: detailIds }, status: "approved" })
          .select({ order_detail_id: 1, rating: 1, content: 1, createdAt: 1 })
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      : [];

    const approvedReviewMap = new Map();
    for (const review of approvedReviews) {
      const key = String(review.order_detail_id || "");
      if (!key || approvedReviewMap.has(key)) continue;
      approvedReviewMap.set(key, {
        rating: Number(review.rating || 0),
        content: String(review.content || "").trim(),
        createdAt: review.createdAt || null,
      });
    }

    const warrantySummary = ensureWarrantySummary(order);
    const itemsWithReview = normalizedItems.map((item) => ({
      ...item,
      approved_review: approvedReviewMap.get(String(item._id || "")) || null,
      warranty_activated_at: warrantySummary.activated_at,
      warranty_expires_at: warrantySummary.expires_at,
    }));

    const itemMap = new Map(itemsWithReview.map((item) => [String(item._id || ""), item]));
    const collectionHistory = await getWarrantyHistoryForOrder(order._id, itemMap);
    const legacyHistory = collectionHistory.length === 0
      ? (Array.isArray(warrantySummary.history) ? warrantySummary.history : [])
          .map((record) => normalizeWarrantyHistoryRecord(record, itemMap))
          .sort((left, right) => {
            const a = new Date(left.serviced_at || 0).getTime();
            const b = new Date(right.serviced_at || 0).getTime();
            if (a !== b) return b - a;
            return String(right._id || "").localeCompare(String(left._id || ""));
          })
      : [];
    const warrantyHistory = collectionHistory.length > 0 ? collectionHistory : legacyHistory;

    const itemsSubtotal = itemsWithReview.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const orderTotal = Number(order.total_amount || 0);
    const discountAmount = itemsSubtotal > orderTotal ? itemsSubtotal - orderTotal : 0;

    res.json({
      order,
      customer,
      profile,
      items: itemsWithReview,
      payments,
      display: buildDisplay(order, customer, profile),
      pricing: {
        items_subtotal: itemsSubtotal,
        discount_amount: discountAmount,
        coupon_code: coupon?.code || "",
        grand_total: orderTotal,
      },
      warranty: {
        activated_at: warrantySummary.activated_at,
        expires_at: warrantySummary.expires_at,
        history: warrantyHistory,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function requestCancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || "").trim();
    const note = String(req.body?.note || "").trim();
    const phone = String(req.body?.phone || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!reason) {
      return res.status(400).json({ error: "Ly do huy la bat buoc." });
    }

    if (!phone) {
      return res.status(400).json({ error: "So dien thoai xac nhan la bat buoc." });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const eligibility = checkCancelEligibility(order);
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.message || "Don hang khong the yeu cau huy." });
    }

    const previousStatus = String(order.status || "").toLowerCase();
    const over10mWithDeposit = Number(order.total_amount || 0) >= 10000000 && Number(order.deposit_amount || 0) > 0;

    order.status = "cancelled";
    order.cancellation_request = {
      reason,
      note,
      phone,
      cancelled_by: "customer",
      requested_at: new Date(),
      previous_status: previousStatus,
      over_10m_with_deposit: over10mWithDeposit,
    };

    await order.save();

    return res.status(200).json({
      message: "Da huy don hang thanh cong.",
      order: order.toObject(),
    });
  } catch (err) {
    next(err);
  }
}

async function patchOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const nextStatus = normalizeStatus(req.body.status);
    const statusReason = String(req.body?.reason || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!nextStatus) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const doc = await Order.findById(id);
    if (!doc) return res.status(404).json({ error: "Order not found" });

    const previousStatus = normalizeStoredOrderStatus(doc.status);
    const transitionValidation = validateAdminStatusTransition(doc, nextStatus);
    if (!transitionValidation.allowed) {
      return res.status(400).json({ error: transitionValidation.message });
    }

    if (nextStatus === "completed") {
      const orderPayments = await Payment.find({ order_id: doc._id }).lean();
      if (!isOrderPaymentSettled(doc, orderPayments)) {
        return res.status(400).json({
          error: "Chỉ có thể chuyển đơn sang \"Hoàn tất\" khi trạng thái thanh toán đã là \"Tất toán\".",
        });
      }
    }

    if (INVENTORY_DEDUCT_STATUSES.has(nextStatus) && !doc.inventory_deducted) {
      await deductInventoryForOrder(doc._id);
      doc.inventory_deducted = true;
      doc.inventory_deducted_at = new Date();
    }

    if (nextStatus === "cancelled" && doc.inventory_deducted) {
      await restoreInventoryForOrder(doc._id);
      doc.inventory_deducted = false;
      doc.inventory_deducted_at = null;
    }

    if (nextStatus === "completed" && !doc.sold_counted) {
      await adjustSoldCountForOrder(doc._id, 1);
      doc.sold_counted = true;
      doc.sold_counted_at = new Date();
    }

    if (nextStatus === "cancelled" && doc.sold_counted) {
      await adjustSoldCountForOrder(doc._id, -1);
      doc.sold_counted = false;
      doc.sold_counted_at = null;
    }

    doc.status = normalizeStoredOrderStatus(nextStatus);

    if (nextStatus === "confirmed" && !doc.confirmed_at) {
      doc.confirmed_at = new Date();
    }

    if (["completed", "exchanged"].includes(nextStatus)) {
      activateWarrantyIfNeeded(doc, new Date());
    }

    if (nextStatus === "cancelled") {
      const existingCancellation = doc.cancellation_request || {};
      const existingReason = String(existingCancellation.reason || "").trim();

      if (!statusReason && !existingReason) {
        return res.status(400).json({ error: "LÃ½ do huá»· Ä‘Æ¡n lÃ  báº¯t buá»™c." });
      }

      const over10mWithDeposit =
        Number(doc.total_amount || 0) >= 10000000 && Number(doc.deposit_amount || 0) > 0;

      doc.cancellation_request = {
        reason: statusReason || existingReason,
        note: String(existingCancellation.note || "").trim(),
        phone: String(existingCancellation.phone || doc.shipping_phone || "").trim(),
        cancelled_by: String(existingCancellation.cancelled_by || "").toLowerCase() === "customer" ? "customer" : "admin",
        requested_at: existingCancellation.requested_at || new Date(),
        previous_status: previousStatus,
        over_10m_with_deposit: over10mWithDeposit,
      };
    }

    if (nextStatus === "exchanged") {
      if (!statusReason) {
        return res.status(400).json({ error: "LÃ½ do Ä‘á»•i hÃ ng lÃ  báº¯t buá»™c." });
      }

      doc.exchange_request = {
        reason: statusReason,
        requested_at: new Date(),
        previous_status: previousStatus,
      };
    }

    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message || "Không thể cập nhật trạng thái đơn hàng." });
    }
    next(err);
  }
}

async function addWarrantyRecord(req, res, next) {
  try {
    const { id } = req.params;
    const orderDetailId = String(req.body?.order_detail_id || "").trim();
    const servicedAtRaw = req.body?.serviced_at;
    const description = String(req.body?.description || "").trim();
    const cost = Math.max(0, Number(req.body?.cost || 0));

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderDetailId)) {
      return res.status(400).json({ error: "Sản phẩm bảo hành không hợp lệ." });
    }

    const servicedAt = new Date(servicedAtRaw || "");
    if (Number.isNaN(servicedAt.getTime())) {
      return res.status(400).json({ error: "Thời gian bảo hành không hợp lệ." });
    }

    if (!description) {
      return res.status(400).json({ error: "Mô tả chi tiết là bắt buộc." });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const warrantySummary = ensureWarrantySummary(order);
    if (!warrantySummary.activated_at || !warrantySummary.expires_at) {
      return res.status(400).json({ error: "Đơn hàng chưa kích hoạt bảo hành." });
    }

    const withinWarranty = servicedAt.getTime() >= new Date(warrantySummary.activated_at).getTime()
      && servicedAt.getTime() <= new Date(warrantySummary.expires_at).getTime();

    const orderDetail = await OrderDetail.findOne({ _id: orderDetailId, order_id: id }).lean();
    if (!orderDetail) {
      return res.status(400).json({ error: "Sản phẩm không thuộc đơn hàng này." });
    }

    let imageUrl = "";
    if (orderDetail.variant_id && mongoose.Types.ObjectId.isValid(String(orderDetail.variant_id))) {
      const imageDoc = await ProductImage.findOne({ variant_id: orderDetail.variant_id })
        .sort({ is_primary: -1, sort_order: 1, _id: 1 })
        .lean();
      imageUrl = String(imageDoc?.image_url || "").trim();
    }

    await WarrantyRecord.create({
      order_id: order._id,
      order_detail_id: orderDetail._id,
      variant_id: orderDetail.variant_id || null,
      product_name: String(orderDetail.product_name || "").trim(),
      variant_name: String(orderDetail.variant_name || "").trim(),
      image_url: imageUrl,
      serviced_at: servicedAt,
      type: withinWarranty ? "warranty" : "maintenance",
      cost: withinWarranty ? 0 : cost,
      description,
    });

    const freshOrder = await Order.findById(id).lean();
    const normalizedWarranty = ensureWarrantySummary(freshOrder);
    const orderItems = await OrderDetail.find({ order_id: id }).lean();
    const variantIds = orderItems
      .map((item) => String(item.variant_id || ""))
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
    const images = variantIds.length
      ? await ProductImage.find({ variant_id: { $in: variantIds } }).sort({ is_primary: -1, sort_order: 1, _id: 1 }).lean()
      : [];
    const imageMap = new Map();
    for (const image of images) {
      const key = String(image.variant_id || "");
      if (!key || imageMap.has(key)) continue;
      imageMap.set(key, String(image.image_url || "").trim());
    }
    const itemMap = new Map(
      orderItems.map((item) => [
        String(item._id || ""),
        {
          ...item,
          image_url: imageMap.get(String(item.variant_id || "")) || "",
          warranty_activated_at: normalizedWarranty.activated_at,
          warranty_expires_at: normalizedWarranty.expires_at,
        },
      ])
    );

    const history = await getWarrantyHistoryForOrder(id, itemMap);

    return res.status(201).json({
      activated_at: normalizedWarranty.activated_at,
      expires_at: normalizedWarranty.expires_at,
      history,
    });
  } catch (err) {
    next(err);
  }
}

async function createCheckoutOrder(req, res, next) {
  try {
    const {
      account_id,
      shipping_name,
      shipping_phone,
      shipping_email,
      shipping_address,
      province,
      district,
      payment_method,
      shipping_method,
      coupon_code,
      coupon_discount,
      total_amount,
      deposit_amount,
      items,
    } = req.body || {};

    const safeName = String(shipping_name || '').trim();
    const safePhone = String(shipping_phone || '').trim();
    const safeEmail = String(shipping_email || '').trim();
    const safeAddress = String(shipping_address || '').trim();
    const safeProvince = String(province || '').trim();
    const safeDistrict = String(district || '').trim();

    if (!safeName || !safePhone || !safeAddress || !safeProvince || !safeDistrict) {
      return res.status(400).json({ error: 'Thiếu thông tin giao hàng bắt buộc.' });
    }

    const rawItems = Array.isArray(items) ? items : [];
    if (!rawItems.length) {
      return res.status(400).json({ error: 'Đơn hàng chưa có sản phẩm.' });
    }

    const prepared = [];
    for (const item of rawItems) {
      const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
      const productId = String(item?.product_id || item?.productId || '').trim();
      const variantId = String(item?.variant_id || item?.variantId || '').trim();

      let variantDoc = null;
      if (variantId && mongoose.Types.ObjectId.isValid(variantId)) {
        variantDoc = await ProductVariant.findById(variantId).lean();
      }

      if (variantDoc && String(variantDoc.variant_status || '').toLowerCase() !== 'active') {
        variantDoc = null;
      }

      if (!variantDoc && productId && mongoose.Types.ObjectId.isValid(productId)) {
        variantDoc = await ProductVariant.findOne({
          product_id: productId,
          variant_status: 'active',
        })
          .sort({ stock_quantity: -1, sold: 1, _id: 1 })
          .lean();
      }

      if (!variantDoc) {
        return res.status(400).json({
          error: `Không tìm thấy biến thể sản phẩm hợp lệ cho: ${item?.name || item?.product_name || 'Sản phẩm'}`,
        });
      }

      const currentStock = Math.max(0, Number(variantDoc.stock_quantity || 0));
      if (currentStock < quantity) {
        return res.status(400).json({
          error: `Sản phẩm ${item?.variant_name || item?.name || variantDoc.variant_name || variantDoc.name || 'này'} chỉ còn ${currentStock} trong kho.`,
        });
      }

      const unitPrice = Math.max(0, Number(item?.unit_price ?? item?.salePrice ?? item?.price ?? variantDoc.price ?? 0));
      const lineTotal = unitPrice * quantity;

      prepared.push({
        variant: variantDoc,
        quantity,
        unitPrice,
        lineTotal,
        productName: String(item?.product_name || item?.name || variantDoc.name || 'Sản phẩm').trim(),
        variantName: String(item?.variant_name || item?.variantLabel || variantDoc.variant_name || variantDoc.name || 'Mặc định').trim(),
        sku: String(variantDoc.sku || item?.sku || '-').trim(),
      });
    }

    const itemsSubtotal = prepared.reduce((sum, item) => sum + item.lineTotal, 0);
    const couponDiscount = Math.max(0, Number(coupon_discount || 0));
    const computedTotal = Math.max(0, itemsSubtotal - couponDiscount);
    const requestTotal = Math.max(0, Number(total_amount || 0));
    const finalTotal = requestTotal > 0 ? requestTotal : computedTotal;

    const requireDeposit = finalTotal >= 10000000;
    const finalDeposit = requireDeposit
      ? Math.max(0, Number(deposit_amount || Math.round(finalTotal * 0.1)))
      : 0;

    const checkoutCustomer = await resolveCheckoutCustomer(account_id, safeName, safePhone);
    const orderCode = await generateUniqueOrderCode(new Date());

    const orderDoc = await Order.create({
      order_code: orderCode,
      customer_id: checkoutCustomer.customerId,
      account_id: checkoutCustomer.accountId,
      coupon_id: String(coupon_code || '').trim() || null,
      shipping_name: safeName,
      shipping_phone: safePhone,
      shipping_email: safeEmail,
      shipping_address: `${safeAddress}, ${safeDistrict}, ${safeProvince}`,
      total_amount: finalTotal,
      deposit_amount: finalDeposit,
      is_installed: String(shipping_method || '') === 'GIAO_VA_LAP',
      status: 'pending',
      ordered_at: new Date(),
    });

    await OrderDetail.insertMany(
      prepared.map((item) => ({
        order_id: orderDoc._id,
        variant_id: item.variant._id,
        product_name: item.productName,
        variant_name: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.lineTotal,
      }))
    );

    const method = String(payment_method || '').toUpperCase() === 'CHUYEN_KHOAN' ? 'bank_transfer' : 'COD';
    const paymentType = method === 'bank_transfer'
      ? (finalDeposit > 0 ? 'deposit' : 'full')
      : 'full';

    const paymentAmount = paymentType === 'deposit' ? finalDeposit : finalTotal;
    const paymentStatus = 'pending';

    await Payment.create({
      order_id: orderDoc._id,
      type: paymentType,
      method,
      amount: paymentAmount,
      status: paymentStatus,
      transaction_id: method === "bank_transfer"
        ? buildBankTransferTransactionId(orderDoc.order_code, paymentType)
        : null,
      paid_at: paymentStatus === 'paid' ? new Date() : null,
    });

    const fullShippingAddress = `${safeAddress}, ${safeDistrict}, ${safeProvince}`;
    const existingAddress = await CustomerAddress.findOne({
      customer_id: checkoutCustomer.customerId,
      address_line: safeAddress,
      district: safeDistrict,
      province: safeProvince,
      address_phone: safePhone,
    }).lean();

    if (!existingAddress) {
      await CustomerAddress.create({
        customer_id: checkoutCustomer.customerId,
        customer_address_name: safeName,
        address_phone: safePhone,
        address_line: safeAddress,
        ward: "-",
        district: safeDistrict,
        province: safeProvince,
        status: "active",
      });
    }

    return res.status(201).json({
      message: 'Đặt hàng thành công.',
      order_id: orderDoc._id,
      order_code: orderDoc.order_code,
      total_amount: orderDoc.total_amount,
      deposit_amount: orderDoc.deposit_amount,
      status: orderDoc.status,
    });
  } catch (err) {
    next(err);
  }
}


async function demoTransferTimeoutComplete(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderId = order._id;
    const totalAmount = Math.max(Number(order.total_amount || 0), 0);
    const expectedDeposit = getExpectedDepositAmount(totalAmount, order.deposit_amount);
    const requireDeposit = totalAmount >= 10000000;

    const allPayments = await Payment.find({ order_id: orderId }).sort({ createdAt: -1, _id: -1 });

    const ensurePayment = async (type, amount) => {
      let payment = allPayments.find((item) => String(item.type || '').toLowerCase() === type);
      if (!payment) {
        payment = await Payment.create({
          order_id: orderId,
          type,
          method: 'bank_transfer',
          amount,
          status: 'pending',
          paid_at: null,
        });
        allPayments.unshift(payment);
      }
      return payment;
    };

    // Demo fixed rule:
    // - ??n < 10tr: t? x?c nh?n full (t?t to?n) khi h?t 5 ph?t
    // - ??n >= 10tr: t? x?c nh?n ?? c?c khi h?t 5 ph?t
    if (requireDeposit && expectedDeposit > 0) {
      const depositPayment = await ensurePayment('deposit', expectedDeposit);
      depositPayment.status = 'paid';
      depositPayment.paid_at = depositPayment.paid_at || new Date();
      await depositPayment.save();
    } else {
      const fullPayment = await ensurePayment('full', totalAmount);
      fullPayment.status = 'paid';
      fullPayment.paid_at = fullPayment.paid_at || new Date();
      await fullPayment.save();
    }

    const refreshedPayments = await Payment.find({ order_id: orderId }).sort({ createdAt: -1, _id: -1 });
    const payment_summary = buildPaymentSummary(order, refreshedPayments);

    return res.status(200).json({
      message: 'Da cap nhat trang thai thanh toan demo.',
      order_id: orderId,
      payment_summary,
    });
  } catch (err) {
    next(err);
  }
}
module.exports = {
  getOrders,
  getOrderById,
  patchOrderStatus,
  requestCancelOrder,
  createCheckoutOrder,
  addWarrantyRecord,
  demoTransferTimeoutComplete,
  validateAdminStatusTransition,
  SOLD_COUNT_STATUSES,
};


