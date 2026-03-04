const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    url: String,

    sku: String,
    brand: String,

    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    collection_id: { type: mongoose.Schema.Types.ObjectId, ref: "Collection" },

    product_type: String,

    short_description: String,
    description: String,

    size: mongoose.Schema.Types.Mixed,
    material: mongoose.Schema.Types.Mixed,

    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema, "products");