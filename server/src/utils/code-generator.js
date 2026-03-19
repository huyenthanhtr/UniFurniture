const crypto = require("crypto");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

const CUSTOMER_CODE_PATTERN = /^KH-(\d{5})$/;
const ORDER_CODE_PATTERN = /^UF-(\d{8})-([A-Z0-9]{4})$/;

function padSequence(value) {
  return String(value).padStart(5, "0");
}

function formatDatePart(value) {
  const date = new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function hasUppercaseAndDigit(value) {
  return /[A-Z]/.test(value) && /\d/.test(value);
}

function generateOrderSuffix() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  while (true) {
    let output = "";
    for (let index = 0; index < 4; index += 1) {
      output += chars[crypto.randomInt(0, chars.length)];
    }
    if (hasUppercaseAndDigit(output)) return output;
  }
}

function isValidCustomerCode(value) {
  return CUSTOMER_CODE_PATTERN.test(String(value || "").trim());
}

function isValidOrderCode(value) {
  const raw = String(value || "").trim();
  const match = raw.match(ORDER_CODE_PATTERN);
  if (!match) return false;
  return hasUppercaseAndDigit(match[2]);
}

async function generateCustomerCode() {
  const customers = await Customer.find({ customer_code: { $regex: /^KH-\d{5}$/ } })
    .select({ customer_code: 1 })
    .lean();

  const maxSequence = customers.reduce((maxValue, item) => {
    const match = String(item?.customer_code || "").match(CUSTOMER_CODE_PATTERN);
    const nextValue = match ? Number(match[1]) : 0;
    return nextValue > maxValue ? nextValue : maxValue;
  }, 0);

  return `KH-${padSequence(maxSequence + 1)}`;
}

async function generateUniqueOrderCode(dateValue = new Date(), usedCodes = null) {
  const datePart = formatDatePart(dateValue);
  const reserved = usedCodes || new Set();

  while (true) {
    const nextCode = `UF-${datePart}-${generateOrderSuffix()}`;
    if (reserved.has(nextCode)) continue;

    if (!usedCodes) {
      const exists = await Order.exists({ order_code: nextCode });
      if (exists) continue;
    }

    reserved.add(nextCode);
    return nextCode;
  }
}

module.exports = {
  CUSTOMER_CODE_PATTERN,
  ORDER_CODE_PATTERN,
  isValidCustomerCode,
  isValidOrderCode,
  generateCustomerCode,
  generateUniqueOrderCode,
};
