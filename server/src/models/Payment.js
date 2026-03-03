const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    payment_code: String,
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    amount: {type: Number, required: true},
    method: {type: String, required: true},
    status: {type: String, required: true, enum: ["pending", "completed", "failed"], default: "pending"},
    paid_at: Date,
  },
  { timestamps: true, collection: "payment" }
);

module.exports = mongoose.model("Payment", PaymentSchema, "payment");