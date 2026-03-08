const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    payment_code: String,
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

module.exports = mongoose.model("Payment", PaymentSchema, "payment");