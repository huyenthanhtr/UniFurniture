const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");
const CustomerAddress = require("../models/CustomerAddress");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { buildLoyaltySnapshot } = require("../utils/loyalty");

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const raw = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "co", "có"].includes(raw)) return true;
  if (["0", "false", "no", "khong", "không"].includes(raw)) return false;
  return null;
}

function normalizeSort(sortBy, sortDir) {
  const key = String(sortBy || "updatedAt").trim();
  const direction = String(sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;

  if (["full_name", "customer_code", "customer_type", "status", "updatedAt", "createdAt"].includes(key)) {
    return { [key]: direction, _id: -1 };
  }

  if (key === "profile.account_status") {
    return { "profile.account_status": direction, _id: -1 };
  }

  if (key === "address_count") {
    return { address_count: direction, _id: -1 };
  }

  return { updatedAt: direction, _id: -1 };
}

function buildQMatch(q) {
  const kw = String(q || "").trim();
  if (!kw) return null;

  return {
    $or: [
      { customer_code: { $regex: kw, $options: "i" } },
      { full_name: { $regex: kw, $options: "i" } },
      { phone: { $regex: kw, $options: "i" } },
      { "profile.full_name": { $regex: kw, $options: "i" } },
      { "profile.phone": { $regex: kw, $options: "i" } },
      { "profile.email": { $regex: kw, $options: "i" } },
      { "profile.address": { $regex: kw, $options: "i" } },
      { "address_docs.address_phone": { $regex: kw, $options: "i" } },
      { "address_docs.customer_address_name": { $regex: kw, $options: "i" } },
      { "address_docs.address_line": { $regex: kw, $options: "i" } },
    ],
  };
}

function buildUpdatedAtMatch(startDate, endDate) {
  const updatedAt = {};

  if (startDate) {
    const from = new Date(String(startDate));
    if (!Number.isNaN(from.getTime())) {
      from.setHours(0, 0, 0, 0);
      updatedAt.$gte = from;
    }
  }

  if (endDate) {
    const to = new Date(String(endDate));
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      updatedAt.$lte = to;
    }
  }

  return Object.keys(updatedAt).length ? { updatedAt } : null;
}
function formatCustomerItem(doc) {
  const profile = doc.profile || null;
  const customerType = String(doc.customer_type || "guest").toLowerCase() === "member" ? "member" : "guest";
  const status = String(doc.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";
  const loyalty = profile ? buildLoyaltySnapshot(profile.loyalty_points_lifetime || 0) : null;

  return {
    _id: doc._id,
    customer_code: doc.customer_code || "",
    full_name: profile?.full_name || doc.full_name || "",
    phone: profile?.phone || doc.phone || "",
    email: profile?.email || "",
    customer_type: customerType,
    status,
    has_account: !!profile,
    account_status: profile?.account_status || null,
    loyalty_points: loyalty?.loyalty_points ?? null,
    loyalty_rank: loyalty?.loyalty_rank ?? null,
    loyalty_rank_label: loyalty?.loyalty_rank_label ?? null,
    address_count: Number(doc.address_count || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function getAdminCustomers(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10) || 20, 1), 200);
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "").trim().toLowerCase();
    const customerType = String(req.query.customer_type || "").trim().toLowerCase();
    const hasAccount = toBoolean(req.query.has_account);

    const baseMatch = {};
    if (["active", "inactive"].includes(status)) baseMatch.status = status;
    if (["guest", "member"].includes(customerType)) baseMatch.customer_type = customerType;

    const updatedAtMatch = buildUpdatedAtMatch(req.query.startDate, req.query.endDate);
    if (updatedAtMatch) Object.assign(baseMatch, updatedAtMatch);

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "profiles",
          let: { customerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$customer_id", "$$customerId"] },
              },
            },
            { $sort: { updatedAt: -1, _id: -1 } },
            { $limit: 1 },
          ],
          as: "profile_docs",
        },
      },
      {
        $lookup: {
          from: "customer_address",
          localField: "_id",
          foreignField: "customer_id",
          as: "address_docs",
        },
      },
      {
        $addFields: {
          profile: { $arrayElemAt: ["$profile_docs", 0] },
          address_count: { $size: "$address_docs" },
          has_account: {
            $gt: [{ $size: "$profile_docs" }, 0],
          },
        },
      },
    ];

    const qMatch = buildQMatch(req.query.q);
    if (qMatch) pipeline.push({ $match: qMatch });

    if (hasAccount !== null) pipeline.push({ $match: { has_account: hasAccount } });

    const accountStatus = String(req.query.account_status || "").trim().toLowerCase();
    if (["active", "inactive", "banned"].includes(accountStatus)) {
      pipeline.push({ $match: { "profile.account_status": accountStatus } });
    }

    pipeline.push(
      {
        $project: {
          profile_docs: 0,
          address_docs: 0,
        },
      },
      {
        $facet: {
          meta: [{ $count: "total" }],
          items: [
            { $sort: normalizeSort(req.query.sortBy, req.query.order) },
            { $skip: skip },
            { $limit: limit },
          ],
        },
      }
    );

    const result = await Customer.aggregate(pipeline);
    const first = result[0] || {};
    const itemsRaw = first.items || [];
    const total = Number(first.meta?.[0]?.total || 0);

    const items = await Promise.all(
      itemsRaw.map(async (doc) => {
        const formatted = formatCustomerItem(doc);
        const mergedAddresses = await collectCustomerAddresses(doc?._id, doc?.profile || null);
        return {
          ...formatted,
          address_count: mergedAddresses.length,
        };
      })
    );

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items,
    });
  } catch (err) {
    next(err);
  }
}

function toObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function mergeCustomerAndProfile(customer, profile) {
  const fullName = profile?.full_name || customer?.full_name || "";
  const phone = profile?.phone || customer?.phone || "";
  const loyalty = profile ? buildLoyaltySnapshot(profile?.loyalty_points_lifetime || 0) : null;

  const base = {
    _id: customer?._id,
    customer_code: customer?.customer_code || "",
    full_name: fullName,
    phone,
    email: profile?.email || "",
    customer_type: customer?.customer_type || "guest",
    status: customer?.status || "active",
    has_account: !!profile,
    account_status: profile?.account_status || null,
    role: profile?.role || null,
    avatar_url: profile?.avatar_url || null,
    gender: profile?.gender || null,
    date_of_birth: profile?.date_of_birth || null,
    address: profile?.address || null,
    loyalty_points: loyalty?.loyalty_points ?? null,
    loyalty_rank: String(profile?.membership_tier || loyalty?.loyalty_rank || "dong"),
    loyalty_rank_label: buildLoyaltySnapshot(profile?.loyalty_points_lifetime || 0).loyalty_rank_label,
    createdAt: customer?.createdAt || null,
    updatedAt: customer?.updatedAt || null,
  };

  return {
    customer: customer || null,
    profile: profile || null,
    merged: base,
  };
}

async function findProfileForCustomer(customer) {
  if (!customer?._id) return null;

  const byCustomerId = await Profile.findOne({ customer_id: customer._id }).sort({ updatedAt: -1, _id: -1 }).lean();
  if (byCustomerId) return byCustomerId;

  return null;
}

function normalizeAddressText(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  const normalized = source
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (["-", "khac", "khac.", "khác", "n/a", "na", "null", "undefined"].includes(normalized)) {
    return "";
  }

  return source;
}

function formatFullAddress(parts) {
  return parts.map(normalizeAddressText).filter(Boolean).join(", ");
}

function isWardSegment(value) {
  const normalized = normalizeAddressText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  return /^(phuong|xa|thi tran|x\.)\b/.test(normalized);
}

function parseStructuredAddress(rawAddress) {
  const segments = String(rawAddress || "")
    .split(",")
    .map((part) => normalizeAddressText(part))
    .filter(Boolean);

  if (!segments.length) {
    return {
      address_line: "",
      ward: "",
      district: "",
      province: "",
      full_address: "",
    };
  }

  if (segments.length === 1) {
    return {
      address_line: segments[0],
      ward: "",
      district: "",
      province: "",
      full_address: formatFullAddress([segments[0]]),
    };
  }

  if (segments.length === 2) {
    return {
      address_line: segments[0],
      ward: "",
      district: "",
      province: segments[1],
      full_address: formatFullAddress([segments[0], segments[1]]),
    };
  }

  const province = segments[segments.length - 1];
  const district = segments[segments.length - 2];
  const possibleWard = segments.length >= 4 ? segments[segments.length - 3] : "";
  const hasWard = !!possibleWard && isWardSegment(possibleWard);
  const addressLine = hasWard
    ? segments.slice(0, segments.length - 3).join(", ")
    : segments.slice(0, segments.length - 2).join(", ");

  return {
    address_line: normalizeAddressText(addressLine),
    ward: hasWard ? normalizeAddressText(possibleWard) : "",
    district: normalizeAddressText(district),
    province: normalizeAddressText(province),
    full_address: formatFullAddress([
      addressLine,
      hasWard ? possibleWard : "",
      district,
      province,
    ]),
  };
}

function buildAddressKey(address) {
  return [
    normalizeAddressText(address?.address_line)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim(),
    normalizeAddressText(address?.ward)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim(),
    normalizeAddressText(address?.district)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim(),
    normalizeAddressText(address?.province)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim(),
  ].join("|");
}

function toTimeValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function deriveAddressFromOrder(order) {
  const parsed = parseStructuredAddress(order?.shipping_address || "");
  if (!parsed.full_address) return null;

  return {
    _id: `fallback-${String(order?._id || "")}`,
    customer_id: order?.customer_id || null,
    customer_address_name: String(order?.shipping_name || "").trim(),
    address_phone: String(order?.shipping_phone || "").trim(),
    address_line: parsed.address_line,
    ward: parsed.ward,
    district: parsed.district,
    province: parsed.province,
    status: "active",
    full_address: parsed.full_address,
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
  };
}

function buildAddressCandidate(source) {
  const parsed = source?.parsed || {};
  const addressLine = normalizeAddressText(source?.address_line || parsed.address_line);
  const ward = normalizeAddressText(source?.ward || parsed.ward);
  const district = normalizeAddressText(source?.district || parsed.district);
  const province = normalizeAddressText(source?.province || parsed.province);
  const fullAddress = formatFullAddress([addressLine, ward, district, province]);

  if (!fullAddress) return null;

  const syntheticId =
    source?._id ||
    `${String(source?.source || "address").trim()}-${Buffer.from(
      [
        String(source?.source_order_id || "").trim(),
        addressLine,
        ward,
        district,
        province,
        String(source?.customer_address_name || "").trim(),
        String(source?.address_phone || "").trim(),
      ].join("|"),
      "utf8"
    ).toString("base64url")}`;

  return {
    _id: syntheticId,
    customer_id: source?.customer_id || null,
    customer_address_name: normalizeAddressText(source?.customer_address_name),
    address_phone: normalizeAddressText(source?.address_phone),
    address_line: addressLine,
    ward,
    district,
    province,
    status: String(source?.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    full_address: fullAddress,
    createdAt: source?.createdAt || null,
    updatedAt: source?.updatedAt || null,
    source: source?.source || "address_book",
    source_order_id: source?.source_order_id || null,
  };
}

async function collectCustomerAddresses(customerId, profile) {
  if (!customerId) return [];

  const cutoffTime = profile?.createdAt ? toTimeValue(profile.createdAt) : 0;
  const [addressDocs, orders] = await Promise.all([
    CustomerAddress.find({ customer_id: customerId }).sort({ updatedAt: -1, _id: -1 }).lean(),
    Order.find({ customer_id: customerId }).sort({ ordered_at: -1, createdAt: -1, _id: -1 }).lean(),
  ]);

  const candidates = [];
  const hasAccount = !!profile;

  for (const addressDoc of addressDocs) {
    if (hasAccount && cutoffTime && toTimeValue(addressDoc?.createdAt) < cutoffTime) continue;
    const candidate = buildAddressCandidate({
      ...addressDoc,
      source: "address_book",
    });
    if (candidate) candidates.push(candidate);
  }

  for (const order of orders) {
    if (hasAccount && cutoffTime && toTimeValue(order?.createdAt || order?.ordered_at) < cutoffTime) continue;
    const candidate = buildAddressCandidate({
      _id: null,
      customer_id: order?.customer_id || customerId,
      customer_address_name: order?.shipping_name,
      address_phone: order?.shipping_phone,
      status: "active",
      createdAt: order?.createdAt || order?.ordered_at || null,
      updatedAt: order?.updatedAt || order?.createdAt || order?.ordered_at || null,
      source: "order",
      source_order_id: order?._id || null,
      parsed: parseStructuredAddress(order?.shipping_address || ""),
    });
    if (candidate) candidates.push(candidate);
  }

  if (hasAccount) {
    const profileAddress = buildAddressCandidate({
      _id: null,
      customer_id: customerId,
      customer_address_name: profile?.full_name,
      address_phone: profile?.phone,
      status: "active",
      createdAt: profile?.createdAt || null,
      updatedAt: profile?.updatedAt || profile?.createdAt || null,
      source: "profile",
      parsed: parseStructuredAddress(profile?.address || ""),
    });
    if (profileAddress) candidates.push(profileAddress);
  }

  candidates.sort((left, right) => {
    const dateDiff = toTimeValue(right.updatedAt || right.createdAt) - toTimeValue(left.updatedAt || left.createdAt);
    if (dateDiff !== 0) return dateDiff;
    const leftPriority = left.source === "address_book" ? 3 : left.source === "order" ? 2 : 1;
    const rightPriority = right.source === "address_book" ? 3 : right.source === "order" ? 2 : 1;
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
    return String(right._id || "").localeCompare(String(left._id || ""));
  });

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = buildAddressKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function mapAddress(address) {
  return {
    _id: address._id,
    customer_id: address.customer_id,
    customer_address_name: address.customer_address_name || "",
    address_phone: address.address_phone || "",
    address_line: normalizeAddressText(address.address_line),
    ward: normalizeAddressText(address.ward),
    district: normalizeAddressText(address.district),
    province: normalizeAddressText(address.province),
    status: address.status || "active",
    full_address: formatFullAddress([address.address_line, address.ward, address.district, address.province]),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
    source: address.source || "address_book",
    source_order_id: address.source_order_id || null,
  };
}

function buildPaymentSummary(orderDoc, orderPayments) {
  const paidPayments = orderPayments.filter((item) => String(item.status || "").toLowerCase() === "paid");
  const paidTotal = paidPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const latestPayment = orderPayments[0] || null;
  const totalAmount = Math.max(Number(orderDoc?.total_amount || 0), 0);
  const depositAmount = Math.max(Number(orderDoc?.deposit_amount || 0), 0);
  const depositPaidTotal = paidPayments
    .filter((item) => String(item.type || "").toLowerCase() === "deposit")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    method: latestPayment?.method || "-",
    status: latestPayment?.status || "-",
    count: orderPayments.length,
    paid_total: paidTotal,
    deposit_amount: depositAmount,
    deposit_paid_total: depositPaidTotal,
    has_deposit_paid: depositAmount > 0 && depositPaidTotal >= depositAmount,
    has_full_paid: totalAmount > 0 && paidTotal >= totalAmount,
    total_amount: totalAmount,
  };
}

async function getCustomerOrderHistory(customerId, customer, profile) {
  if (!customerId) return [];

  const cutoffTime = profile?.createdAt ? toTimeValue(profile.createdAt) : 0;
  const orders = await Order.find({ customer_id: customerId })
    .sort({ ordered_at: -1, createdAt: -1, _id: -1 })
    .lean();

  const filteredOrders = profile
    ? orders.filter((order) => toTimeValue(order?.createdAt || order?.ordered_at) >= cutoffTime)
    : orders;

  const orderIds = filteredOrders.map((order) => order._id);
  const payments = orderIds.length
    ? await Payment.find({ order_id: { $in: orderIds } }).sort({ createdAt: -1, _id: -1 }).lean()
    : [];

  const paymentMap = new Map();
  for (const payment of payments) {
    const key = String(payment.order_id || "");
    if (!paymentMap.has(key)) paymentMap.set(key, []);
    paymentMap.get(key).push(payment);
  }

  return filteredOrders.map((order) => ({
    _id: order._id,
    order_code: order.order_code || "",
    shipping_name: order.shipping_name || "",
    shipping_phone: order.shipping_phone || "",
    shipping_address: formatFullAddress([order.shipping_address]),
    total_amount: Number(order.total_amount || 0),
    deposit_amount: Number(order.deposit_amount || 0),
    status: order.status || "pending",
    ordered_at: order.ordered_at || order.createdAt || null,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    display: {
      receiver_name: order.shipping_name || profile?.full_name || customer?.full_name || "",
      phone: order.shipping_phone || profile?.phone || customer?.phone || "",
      address: formatFullAddress([order.shipping_address]),
      customer_type: customer?.customer_type || "guest",
      has_account: !!profile,
    },
    payment_summary: buildPaymentSummary(order, paymentMap.get(String(order._id)) || []),
  }));
}

async function getAdminCustomerDetail(req, res, next) {
  try {
    const { id } = req.params;
    const customerId = toObjectId(id);
    if (!customerId) return res.status(400).json({ message: "Invalid id" });

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const profile = await findProfileForCustomer(customer);
    const [addresses, orders] = await Promise.all([
      collectCustomerAddresses(customerId, profile),
      getCustomerOrderHistory(customerId, customer, profile),
    ]);

    const merged = mergeCustomerAndProfile(customer, profile);
    if (!merged.merged.address && addresses.length > 0) {
      merged.merged.address = addresses[0]?.full_address || addresses[0]?.address_line || null;
    }

    return res.json({
      ...merged,
      addresses: addresses.map(mapAddress),
      orders,
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminCustomerAddresses(req, res, next) {
  try {
    const { id } = req.params;
    const customerId = toObjectId(id);
    if (!customerId) return res.status(400).json({ message: "Invalid id" });

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const profile = await findProfileForCustomer(customer);
    const addresses = await collectCustomerAddresses(customerId, profile);

    return res.json({
      customer_id: id,
      total: addresses.length,
      items: addresses.map(mapAddress),
    });
  } catch (err) {
    next(err);
  }
}

async function getAdminCustomerAddressDetail(req, res, next) {
  try {
    const { id, addressId } = req.params;
    const customerId = toObjectId(id);

    if (!customerId || !String(addressId || "").trim()) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const customer = await Customer.findById(customerId).lean();

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const profile = await findProfileForCustomer(customer);
    const allAddresses = await collectCustomerAddresses(customerId, profile);
    const address = allAddresses.find((item) => String(item?._id || "") === String(addressId || "").trim());
    if (!address) return res.status(404).json({ message: "Address not found" });

    const merged = mergeCustomerAndProfile(customer, profile);

    return res.json({
      customer: merged.customer,
      profile: merged.profile,
      merged: merged.merged,
      address: mapAddress(address),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminCustomers,
  getAdminCustomerDetail,
  getAdminCustomerAddresses,
  getAdminCustomerAddressDetail,
};
