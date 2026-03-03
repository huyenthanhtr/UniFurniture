const mongoose = require("mongoose");

const ProductImageSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    image_url: String,
    alt_text: String,
    is_primary: Boolean,
    sort_order: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductImage", ProductImageSchema, "product_images");