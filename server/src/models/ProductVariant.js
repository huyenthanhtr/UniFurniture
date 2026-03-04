const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: {type: String, required: true},
    variant_name: {type: String, required: true},
    sku: {type: String, required: true, unique: true},
    color: String,
    price: {type: Number, required: true},
    compare_at_price: Number,
    stock_quantity: {type: Number, default: 0},
    variant_status: {type: String, enum: ["available", "unavailable"], default: "available"},
    status: {type: String, enum: ["active", "inactive"], default: "active"},
    sold: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "product_variants" }
);

module.exports = mongoose.model("ProductVariant", ProductVariantSchema, "product_variants");