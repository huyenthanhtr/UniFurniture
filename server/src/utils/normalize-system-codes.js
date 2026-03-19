const Customer = require("../models/Customer");
const Order = require("../models/Order");
const {
  CUSTOMER_CODE_PATTERN,
  isValidCustomerCode,
  isValidOrderCode,
  generateUniqueOrderCode,
} = require("./code-generator");

let isRunning = false;

async function normalizeCustomerCodes() {
  const customers = await Customer.find({})
    .select({ customer_code: 1, createdAt: 1 })
    .sort({ createdAt: 1, _id: 1 });

  let maxSequence = customers.reduce((maxValue, customer) => {
    const match = String(customer?.customer_code || "").match(CUSTOMER_CODE_PATTERN);
    const nextValue = match ? Number(match[1]) : 0;
    return nextValue > maxValue ? nextValue : maxValue;
  }, 0);

  for (const customer of customers) {
    if (isValidCustomerCode(customer.customer_code)) continue;
    maxSequence += 1;
    customer.customer_code = `KH-${String(maxSequence).padStart(5, "0")}`;
    await customer.save();
  }
}

async function normalizeOrderCodes() {
  const orders = await Order.find({})
    .select({ order_code: 1, ordered_at: 1, createdAt: 1 })
    .sort({ createdAt: 1, _id: 1 });

  const usedCodes = new Set(
    orders
      .map((order) => String(order?.order_code || "").trim())
      .filter((code) => isValidOrderCode(code))
  );

  for (const order of orders) {
    if (isValidOrderCode(order.order_code)) continue;
    order.order_code = await generateUniqueOrderCode(order.ordered_at || order.createdAt || new Date(), usedCodes);
    await order.save();
  }
}

async function normalizeSystemCodes() {
  if (isRunning) return;
  isRunning = true;

  try {
    await normalizeCustomerCodes();
    await normalizeOrderCodes();
  } finally {
    isRunning = false;
  }
}

module.exports = {
  normalizeSystemCodes,
};
