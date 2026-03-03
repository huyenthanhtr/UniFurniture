const mongoose = require("mongoose");

const CollectionSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    url: String,
    description: String,
    banner_url: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Collection", CollectionSchema, "collections");