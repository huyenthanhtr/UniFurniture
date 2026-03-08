const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, trim: true, default: "" },
    variant_name: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, required: true, unique: true },
    color: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, default: 0 },
    compare_at_price: { type: Number, default: 0 },
    stock_quantity: { type: Number, default: 0 },
    status: { type: String, enum: ["available", "unavailable"], default: "available" },
    variant_status: { type: String, enum: ["active", "inactive"], default: "active" },
    sold: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "product_variants" }
);

module.exports = mongoose.model("ProductVariant", ProductVariantSchema, "product_variants");