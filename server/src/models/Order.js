const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    order_code: String,
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null },
    coupon_id: { type: mongoose.Schema.Types.Mixed, default: null },
    shipping_name: String,
    shipping_phone: String,
    shipping_email: String,
    shipping_address: String,
    total_amount: Number,
    deposit_amount: Number,
    is_installed: Boolean,
    status: {
      type: String,
      required: true,
      enum: ["pending", "confirmed", "processing", "shipping", "delivered", "completed", "cancelled", "refunded"],
      default: "pending",
    },
    ordered_at: Date,
  },
  { timestamps: true, collection: "orders" }
);

module.exports = mongoose.model("Order", OrderSchema, "orders");