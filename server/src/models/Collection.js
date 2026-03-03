const mongoose = require("mongoose");

const CollectionSchema = new mongoose.Schema(
  {
    name: {type: String, required: true},
    slug: {type: String, required: true, unique: true, lowercase: true, trim: true},
    url: {type: String, trim: true},
    description: String,
    banner_url: String,
    status: {type: String, required: true, enum: ["active", "inactive"], default: "active"},
  },
  { timestamps: true, collection: "collections" }
);

module.exports = mongoose.model("Collection", CollectionSchema, "collections");