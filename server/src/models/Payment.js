const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    payment_code: String,
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    amount: Number,
    method: String,
    status: String,
    paid_at: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema, "payment");