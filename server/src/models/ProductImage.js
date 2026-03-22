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

ProductImageSchema.index({ product_id: 1, is_primary: -1, sort_order: 1, createdAt: 1 });
ProductImageSchema.index({ variant_id: 1, is_primary: -1, sort_order: 1, _id: 1 });

module.exports = mongoose.model("ProductImage", ProductImageSchema, "product_images");
