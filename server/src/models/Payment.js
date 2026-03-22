const mongoose = require("mongoose");
const Order = require("./Order");

const PAYMENT_TYPE_SUFFIX = {
  deposit: "DEP",
  remaining: "REM",
  full: "FULL",
};

async function buildPaymentIdentity(orderId, type) {
  const rawOrderId = String(orderId || "").trim();
  if (!rawOrderId || !mongoose.Types.ObjectId.isValid(rawOrderId)) {
    return null;
  }

  const order = await Order.findById(rawOrderId).select("order_code").lean();
  const orderCode = String(order?.order_code || rawOrderId).trim();
  const suffix = PAYMENT_TYPE_SUFFIX[String(type || "full").toLowerCase()] || "FULL";
  return `${orderCode}-${suffix}`;
}

const PaymentSchema = new mongoose.Schema(
  {
    payment_code: { type: String, default: null },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    type: {
      type: String,
      enum: ["deposit", "remaining", "full"],
      default: "full",
    },
    method: {
      type: String,
      enum: ["COD", "bank_transfer"],
      default: "COD",
    },
    amount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    transaction_id: { type: String, default: null },
    paid_at: { type: Date, default: null },
  },
  { timestamps: true, collection: "payment" }
);

PaymentSchema.pre("save", async function preSave() {
  const identity = await buildPaymentIdentity(this.order_id, this.type);
  if (!identity) return;

  // Keep payment_code and transaction_id consistent by rule: ORDERCODE-DEP/FULL/REM
  if (!this.payment_code || this.isModified("order_id") || this.isModified("type")) {
    this.payment_code = identity;
  }

  if (!this.transaction_id || this.isModified("order_id") || this.isModified("type")) {
    this.transaction_id = identity;
  }
});

PaymentSchema.pre("findOneAndUpdate", async function preFindOneAndUpdate() {
  const update = this.getUpdate() || {};
  const set = update.$set || {};

  const current = await this.model.findOne(this.getQuery()).select("order_id type payment_code transaction_id").lean();
  if (!current) return;

  const nextOrderId = set.order_id || update.order_id || current.order_id;
  const nextType = set.type || update.type || current.type;
  const identity = await buildPaymentIdentity(nextOrderId, nextType);
  if (!identity) return;

  const hasOrderTypeChange = !!(set.order_id || update.order_id || set.type || update.type);
  const hasLegacyCode = /^PAY/i.test(String(current.payment_code || ""));
  const shouldPatchCode = hasOrderTypeChange || !current.payment_code || hasLegacyCode;
  const shouldPatchTxn = hasOrderTypeChange || !current.transaction_id;

  if (shouldPatchCode || shouldPatchTxn) {
    update.$set = update.$set || {};
    if (shouldPatchCode && !update.$set.payment_code) {
      update.$set.payment_code = identity;
    }
    if (shouldPatchTxn && !update.$set.transaction_id) {
      update.$set.transaction_id = identity;
    }
    this.setUpdate(update);
  }
});
module.exports = mongoose.model("Payment", PaymentSchema, "payment");
