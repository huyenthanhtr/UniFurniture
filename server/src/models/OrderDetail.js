const mongoose = require("mongoose");

const OrderDetailSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    product_name: String,
    variant_name: String,
    sku: String,
    quantity: Number,
    unit_price: Number,
    total: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderDetail", OrderDetailSchema, "order_detail");