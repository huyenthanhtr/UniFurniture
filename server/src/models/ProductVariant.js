const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    variant_name: String,
    sku: String,
    color: String,
    price: Number,
    compare_at_price: Number,
    stock_quantity: Number,
    variant_status: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductVariant", ProductVariantSchema, "product_variants");