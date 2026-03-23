const mongoose = require("mongoose");

const PointTransactionSchema = new mongoose.Schema(
  {
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    order_detail_id: { type: mongoose.Schema.Types.ObjectId, ref: "OrderDetail", default: null },
    points: { type: Number, required: true, default: 0 },
    type: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "point_transactions" }
);

module.exports = mongoose.model("PointTransaction", PointTransactionSchema, "point_transactions");
