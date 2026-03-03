const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    title: String,
    slug: String,
    content: String,
    thumbnail_url: String,
    post_category: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema, "post");