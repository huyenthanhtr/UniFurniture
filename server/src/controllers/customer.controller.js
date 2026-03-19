const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");
const CustomerAddress = require("../models/CustomerAddress");
const Order = require("../models/Order");

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

    const items = itemsRaw.map(formatCustomerItem);

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

function deriveAddressFromOrder(order) {
  const shippingAddress = String(order?.shipping_address || "").trim();
  if (!shippingAddress) return null;

  const segments = shippingAddress
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  const province = segments.length >= 1 ? segments[segments.length - 1] : "-";
  const district = segments.length >= 2 ? segments[segments.length - 2] : "-";
  const addressLine = segments.length >= 3 ? segments.slice(0, segments.length - 2).join(", ") : shippingAddress;

  return {
    _id: `fallback-${String(order?._id || "")}`,
    customer_id: order?.customer_id || null,
    customer_address_name: String(order?.shipping_name || "").trim(),
    address_phone: String(order?.shipping_phone || "").trim(),
    address_line: addressLine || shippingAddress,
    ward: "-",
    district: district || "-",
    province: province || "-",
    status: "active",
    full_address: [addressLine || shippingAddress, district || "-", province || "-"].filter(Boolean).join(", "),
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
  };
}

async function ensureCustomerAddressesFromOrders(customerId) {
  if (!customerId) return [];

  const existingAddresses = await CustomerAddress.find({ customer_id: customerId }).sort({ updatedAt: -1, _id: -1 }).lean();
  if (existingAddresses.length > 0) return existingAddresses;

  const latestOrder = await Order.findOne({ customer_id: customerId })
    .sort({ ordered_at: -1, createdAt: -1, _id: -1 })
    .lean();

  const shippingAddress = String(latestOrder?.shipping_address || "").trim();
  if (!shippingAddress) return [];

  const fallbackAddress = deriveAddressFromOrder(latestOrder);
  return fallbackAddress ? [fallbackAddress] : [];
}

function mapAddress(address) {
  return {
    _id: address._id,
    customer_id: address.customer_id,
    customer_address_name: address.customer_address_name || "",
    address_phone: address.address_phone || "",
    address_line: address.address_line || "",
    ward: address.ward || "",
    district: address.district || "",
    province: address.province || "",
    status: address.status || "active",
    full_address: [address.address_line, address.ward, address.district, address.province].filter(Boolean).join(", "),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

async function getAdminCustomerDetail(req, res, next) {
  try {
    const { id } = req.params;
    const customerId = toObjectId(id);
    if (!customerId) return res.status(400).json({ message: "Invalid id" });

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const [profile, addresses] = await Promise.all([
      findProfileForCustomer(customer),
      ensureCustomerAddressesFromOrders(customerId),
    ]);

    const merged = mergeCustomerAndProfile(customer, profile);
    if (!merged.merged.address && addresses.length > 0) {
      merged.merged.address = addresses[0]?.full_address || addresses[0]?.address_line || null;
    }

    return res.json({
      ...merged,
      addresses: addresses.map(mapAddress),
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

    const addresses = await ensureCustomerAddressesFromOrders(customerId);

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
    const addressObjectId = toObjectId(addressId);

    if (!customerId || !addressObjectId) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const [customer, address] = await Promise.all([
      Customer.findById(customerId).lean(),
      CustomerAddress.findOne({ _id: addressObjectId, customer_id: customerId }).lean(),
    ]);

    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (!address) return res.status(404).json({ message: "Address not found" });

    const profile = await findProfileForCustomer(customer);
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
