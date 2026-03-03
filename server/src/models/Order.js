const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    order_code: String,
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    coupon_id: { type: mongoose.Schema.Types.Mixed }, // có thể null
    shipping_name: String,
    shipping_phone: String,
    shipping_email: String,
    shipping_address: String,
    total_amount: Number,
    deposit_amount: Number,
    is_installed: Boolean,
    status: String,
    ordered_at: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema, "orders");