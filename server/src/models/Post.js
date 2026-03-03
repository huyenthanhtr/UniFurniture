const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
  {
    title: {type: String, required: true},
    slug: {type: String, required: true},
    content: {type: String, required: true},
    thumbnail_url: String,
    post_category: {type: String, required: true,default: "Tin tức"},
    status: {type: String, required: true, enum: ["published", "draft"], default: "draft"},
  },
  { timestamps: true , collection: "posts"}
);

module.exports = mongoose.model("Post", PostSchema, "posts");