const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discount_type: { type: String, enum: ['percent', 'fixed'], required: true },
    discount_value: { type: Number, required: true },
    max_discount_amount: { type: Number, default: null },
    min_order_value: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    total_limit: { type: Number, required: true },
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    status: { type: String, default: 'active' }
}, { timestamps: true });
module.exports = mongoose.model("Coupon", couponSchema, "coupons");