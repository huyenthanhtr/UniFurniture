const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code: String,
    discount_type: String,
    discount_value: Number,
    used: Number,
    total_limit: Number,
    min_order_value: Number,
    start_at: Date,
    end_at: Date,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", CouponSchema, "coupons");