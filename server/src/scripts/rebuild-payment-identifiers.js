require("dotenv").config();
const connectDB = require("../configs/db");
const Payment = require("../models/Payment");
const Order = require("../models/Order");

const PAYMENT_TYPE_SUFFIX = {
  deposit: "DEP",
  remaining: "REM",
  full: "FULL",
};

function buildIdentity(orderCode, type) {
  const suffix = PAYMENT_TYPE_SUFFIX[String(type || "full").toLowerCase()] || "FULL";
  return `${orderCode}-${suffix}`;
}

async function main() {
  await connectDB();

  const payments = await Payment.find({}).select("_id order_id type payment_code transaction_id");
  if (!payments.length) {
    console.log("No payments found.");
    process.exit(0);
  }

  const orderIds = [...new Set(payments.map((item) => String(item.order_id || "")).filter(Boolean))];
  const orders = await Order.find({ _id: { $in: orderIds } }).select("_id order_code").lean();
  const orderCodeById = new Map(orders.map((item) => [String(item._id), String(item.order_code || item._id)]));

  let updated = 0;
  for (const payment of payments) {
    const orderId = String(payment.order_id || "");
    const orderCode = orderCodeById.get(orderId);
    if (!orderCode) continue;

    const identity = buildIdentity(orderCode, payment.type);
    if (payment.payment_code === identity && payment.transaction_id === identity) {
      continue;
    }

    payment.payment_code = identity;
    payment.transaction_id = identity;
    await payment.save();
    updated += 1;
  }

  console.log(`Updated ${updated}/${payments.length} payments.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to rebuild payment identifiers:", error);
  process.exit(1);
});
