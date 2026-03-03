const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: {type: String, required: true},
    slug: {type: String, required: true, lowercase: true, trim: true, unique: true},
    url: {type: String, required: true, unique: true, trim: true},
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    sku: {type: String, required: true, unique: true},
    size: mongoose.Schema.Types.Mixed,     // object map
    short_description: String,
    description: String,
    material: mongoose.Schema.Types.Mixed, // object map
    origin: String,
    warranty_months: {type: Number, required: true, default: 0},
    status: {type: String, required: true, enum: ["active", "inactive"], default: "active"},
  },
  { timestamps: true, collection: "products" }
);

module.exports = mongoose.model("Product", ProductSchema, "products");