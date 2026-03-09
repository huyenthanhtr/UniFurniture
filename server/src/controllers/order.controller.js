const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");
const Payment = require("../models/Payment");

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipping", "delivered", "completed", "cancelled", "refunded"];

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ORDER_STATUSES.includes(status) ? status : null;
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

async function getOrders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      q,
      sortBy = "ordered_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = String(order).toLowerCase() === "asc" ? 1 : -1;

    const query = {};

    if (status) {
      const normalized = normalizeStatus(status);
      if (normalized) query.status = normalized;
    }

    if (q) {
      const kw = String(q).trim();
      if (kw) {
        query.$or = [
          { order_code: { $regex: kw, $options: "i" } },
          { shipping_name: { $regex: kw, $options: "i" } },
          { shipping_phone: { $regex: kw, $options: "i" } },
          { shipping_email: { $regex: kw, $options: "i" } },
          { shipping_address: { $regex: kw, $options: "i" } },
        ];
      }
    }

    const sortKey = ["ordered_at", "createdAt", "updatedAt", "total_amount"].includes(String(sortBy))
      ? String(sortBy)
      : "ordered_at";

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ [sortKey]: sortDirection, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
    ]);

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
      const paidPayments = orderPayments.filter((x) => String(x.status || "").toLowerCase() === "paid");
      const paidTotal = paidPayments.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const latestPayment = orderPayments[0] || null;
      const hasDepositPaid = paidPayments.some((x) => String(x.type || "").toLowerCase() === "deposit");
      const hasFullPaid = paidPayments.some((x) => String(x.type || "").toLowerCase() === "full");
      const hasRemainingPaid = paidPayments.some((x) => String(x.type || "").toLowerCase() === "remaining");
      const latestPaidType = paidPayments[0]?.type || null;

      return {
        ...orderDoc,
        display,
        payment_summary: {
          method: latestPayment?.method || "-",
          status: latestPayment?.status || "-",
          count: orderPayments.length,
          paid_total: paidTotal,
          has_deposit_paid: hasDepositPaid,
          has_full_paid: hasFullPaid,
          has_remaining_paid: hasRemainingPaid,
          latest_paid_type: latestPaidType,
          total_amount: Number(orderDoc.total_amount || 0),
        },
      };
    });

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      items,
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

    res.json({
      order,
      customer,
      profile,
      items,
      payments,
      display: buildDisplay(order, customer, profile),
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

    const doc = await Order.findByIdAndUpdate(
      id,
      { $set: { status: nextStatus } },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ error: "Order not found" });

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrders,
  getOrderById,
  patchOrderStatus,
};
