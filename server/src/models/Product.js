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

module.exports = mongoose.model("Product", ProductSchema, "products");