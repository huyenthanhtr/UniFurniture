const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    url: String,
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    sku: String,
    size: mongoose.Schema.Types.Mixed,     // object map
    short_description: String,
    description: String,
    material: mongoose.Schema.Types.Mixed, // object map
    origin: String,
    warranty_months: Number,
    product_status: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema, "products");