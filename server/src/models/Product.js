const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, index: true },
    url: { type: String, trim: true },

    sku: { type: String, trim: true },
    brand: { type: String, trim: true },

    thumbnail: { type: String, trim: true, default: "" },
    thumbnail_url: { type: String, trim: true, default: "" },

    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    collection_id: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", default: null },

    product_type: { type: String, trim: true },

    short_description: { type: String, default: "" },
    description: { type: String, default: "" },

    min_price: { type: Number, default: 0 },

    size: mongoose.Schema.Types.Mixed,
    material: mongoose.Schema.Types.Mixed,

    status: { type: String, enum: ["active", "inactive"], default: "active" },
    sold: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "products" }
);

ProductSchema.virtual("variants", {
  ref: "ProductVariant",
  localField: "_id",
  foreignField: "product_id",
});

ProductSchema.virtual("available_colors").get(function () {
  if (!this.variants) return [];

  const colorMap = new Map();

  this.variants.forEach((v) => {
    if (v.color && !colorMap.has(v.color)) {
      colorMap.set(v.color, {
        name: v.color,
        variant_id: v._id,
        price: v.price,
        image: v.image,
      });
    }
  });

  return Array.from(colorMap.values());
});

ProductSchema.virtual("color_count").get(function () {
  return this.available_colors?.length || 0;
});

module.exports = mongoose.model("Product", ProductSchema, "products");