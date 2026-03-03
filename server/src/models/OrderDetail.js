const mongoose = require("mongoose");

const OrderDetailSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    product_name: {type: String, required: true},
    variant_name: {type: String, required: true},
    sku: {type: String, required: true},
    quantity: {type: Number, required: true},
    unit_price: {type: Number, required: true},
    total: {type: Number, required: true},
  },
  { timestamps: true, collection: "order_detail" }
);

module.exports = mongoose.model("OrderDetail", OrderDetailSchema, "order_detail");