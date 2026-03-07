const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    order_code: String,
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    coupon_id: { type: mongoose.Schema.Types.Mixed },
    shipping_name: String,
    shipping_phone: String,
    shipping_email: String,
    shipping_address: String,
    total_amount: Number,
    deposit_amount: Number,
    is_installed: Boolean,
    status: {type: String, required: true, enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"], default: "pending"},
    ordered_at: Date,
  },
  { timestamps: true, collection: "orders" }
);

module.exports = mongoose.model("Order", OrderSchema, "orders");