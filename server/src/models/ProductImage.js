const mongoose = require("mongoose");

const ProductImageSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    image_url: { type: String, required: true, trim: true },
    alt_text: { type: String, default: "" },
    is_primary: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "product_images" }
);

module.exports = mongoose.model("ProductImage", ProductImageSchema, "product_images");