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
      enum: ["pending", "confirmed", "cancel_pending", "processing", "shipping", "delivered", "completed", "cancelled", "exchanged"],
      default: "pending",
    },
    ordered_at: Date,
    confirmed_at: { type: Date, default: null },
    cancellation_request: {
      reason: { type: String, default: "" },
      note: { type: String, default: "" },
      phone: { type: String, default: "" },
      cancelled_by: { type: String, enum: ["customer", "admin", ""], default: "" },
      requested_at: { type: Date, default: null },
      previous_status: { type: String, default: "" },
      over_10m_with_deposit: { type: Boolean, default: false },
    },
    exchange_request: {
      reason: { type: String, default: "" },
      requested_at: { type: Date, default: null },
      previous_status: { type: String, default: "" },
    },
    warranty: {
      activated_at: { type: Date, default: null },
      expires_at: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "orders" }
);

module.exports = mongoose.model("Order", OrderSchema, "orders");
