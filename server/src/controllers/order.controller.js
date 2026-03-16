const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");
const Payment = require("../models/Payment");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");
const Coupon = require("../models/Coupon");

const ORDER_STATUSES = ["pending", "confirmed", "cancel_pending", "processing", "shipping", "delivered", "completed", "cancelled", "refunded"];
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

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ORDER_STATUSES.includes(status) ? status : null;
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
      return { allowed: false, message: "Không xác định được thời điểm xác nhận đơn." };
    }

    const elapsedMs = Date.now() - confirmedAt.getTime();
    const withinWindow = elapsedMs <= CANCELLATION_GRACE_HOURS * 60 * 60 * 1000;
    if (!withinWindow) {
      return { allowed: false, message: "Đơn đã quá 24h kể từ lúc xác nhận nên không thể yêu cầu hủy." };
    }

    return { allowed: true, message: "" };
  }

  if (status === "cancel_pending") {
    return { allowed: false, message: "Đơn đang chờ xác nhận hủy." };
  }

  return { allowed: false, message: "Đơn hàng không còn trong thời hạn cho phép hủy." };
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

function buildDisplay(order, customer, profile) {
  const receiver_name =
    order?.shipping_name ||
    customer?.full_name ||
    profile?.full_name ||
    "Khách không đăng nhập";

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
  const depositAmount = Math.max(Number(orderDoc.deposit_amount || 0), 0);
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
  const key = String(status || "").toLowerCase();
  if (key === "cancelled") return 7;
  if (key === "refunded") return 8;
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

    const [customers, profiles, payments] = await Promise.all([
      customerIds.length ? Customer.find({ _id: { $in: customerIds } }).lean() : [],
      customerIds.length ? Profile.find({ customer_id: { $in: customerIds } }).lean() : [],
      orderIds.length ? Payment.find({ order_id: { $in: orderIds } }).sort({ createdAt: -1 }).lean() : [],
    ]);

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
        display,
        payment_summary: buildPaymentSummary(orderDoc, orderPayments),
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    const customer = order.customer_id ? await Customer.findById(order.customer_id).lean() : null;
    const profile = await resolveProfile(order, order.customer_id);
    const [items, payments] = await Promise.all([
      OrderDetail.find({ order_id: id }).sort({ createdAt: 1, _id: 1 }).lean(),
      Payment.find({ order_id: id }).sort({ createdAt: -1, _id: -1 }).lean(),
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

    let coupon = null;
    if (order.coupon_id && mongoose.Types.ObjectId.isValid(String(order.coupon_id))) {
      coupon = await Coupon.findById(order.coupon_id).lean();
    } else if (order.coupon_id) {
      coupon = { code: String(order.coupon_id) };
    }

    const normalizedItems = items.map((item) => {
      const variant = variantMap.get(String(item.variant_id || ""));
      return {
        ...item,
        product_id: variant?.product_id || null,
        image_url: imageMap.get(String(item.variant_id || "")) || "",
        variant_name: item.variant_name || variant?.variant_name || variant?.name || "-",
        product_name: item.product_name || "-",
        sku: item.sku || variant?.sku || "-",
      };
    });

    const itemsSubtotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const orderTotal = Number(order.total_amount || 0);
    const discountAmount = itemsSubtotal > orderTotal ? itemsSubtotal - orderTotal : 0;

    res.json({
      order,
      customer,
      profile,
      items: normalizedItems,
      payments,
      display: buildDisplay(order, customer, profile),
      pricing: {
        items_subtotal: itemsSubtotal,
        discount_amount: discountAmount,
        coupon_code: coupon?.code || "",
        grand_total: orderTotal,
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
      return res.status(400).json({ error: "Lý do hủy là bắt buộc." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Số điện thoại xác nhận là bắt buộc." });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const eligibility = checkCancelEligibility(order);
    if (!eligibility.allowed) {
      return res.status(400).json({ error: eligibility.message || "Đơn hàng không thể yêu cầu hủy." });
    }

    const previousStatus = String(order.status || "").toLowerCase();
    const over10mWithDeposit = Number(order.total_amount || 0) >= 10000000 && Number(order.deposit_amount || 0) > 0;

    order.status = "cancel_pending";
    order.cancellation_request = {
      reason,
      note,
      phone,
      requested_at: new Date(),
      previous_status: previousStatus,
      over_10m_with_deposit: over10mWithDeposit,
    };

    await order.save();

    return res.status(200).json({
      message: "Đã ghi nhận yêu cầu hủy đơn. Vui lòng chờ admin xác nhận.",
      warning: over10mWithDeposit
        ? "Đơn trên 10 triệu đã đặt cọc 10% sẽ không được hoàn lại tiền cọc."
        : "",
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!nextStatus) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const doc = await Order.findById(id);
    if (!doc) return res.status(404).json({ error: "Order not found" });

    doc.status = nextStatus;

    if (nextStatus === "confirmed" && !doc.confirmed_at) {
      doc.confirmed_at = new Date();
    }

    await doc.save();
    res.json(doc.toObject());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrders,
  getOrderById,
  patchOrderStatus,
  requestCancelOrder,
};
