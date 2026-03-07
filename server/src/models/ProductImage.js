const mongoose = require("mongoose");

const ProductImageSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    image_url: {type: String, required: true},
    alt_text: String,
    is_primary: {type: Boolean, default: false},
    sort_order: Number,
  },
  { timestamps: true, collection: "product_images" }
);

module.exports = mongoose.model("ProductImage", ProductImageSchema, "product_images");