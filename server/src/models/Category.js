const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    category_code: {type: String, required: true},
    name: {type: String, required: true},
    slug: {type: String, required: true, unique: true,lowercase: true, trim: true},
    url: {type: String, trim: true},
    description: String,
    image_url: String,
    status: {type: String, required: true, enum: ["active", "inactive"], default: "active"},
  },
  { timestamps: true, collection: "categories" }
);

module.exports = mongoose.model("Category", CategorySchema, "categories");