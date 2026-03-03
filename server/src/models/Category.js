const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    category_code: String,
    name: String,
    slug: String,
    url: String,
    description: String,
    image_url: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema, "categories");