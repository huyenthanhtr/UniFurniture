const mongoose = require("mongoose");

const PointTransactionSchema = new mongoose.Schema(
  {
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    order_detail_id: { type: mongoose.Schema.Types.ObjectId, ref: "OrderDetail", default: null, index: true },
    points: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["earn", "review_earn", "redeem", "expire", "manual_adjust"], default: "earn", index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "point_transactions" }
);

PointTransactionSchema.index({ profile_id: 1, order_id: 1, type: 1 }, { unique: true });
PointTransactionSchema.index(
  { profile_id: 1, order_detail_id: 1, type: 1 },
  { unique: true, partialFilterExpression: { order_detail_id: { $type: "objectId" } } }
);

module.exports = mongoose.model("PointTransaction", PointTransactionSchema, "point_transactions");
