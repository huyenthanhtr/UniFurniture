const mongoose = require("mongoose");

const ProductKeywordSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    keyword_id: { type: mongoose.Schema.Types.ObjectId, ref: "Keyword" },
  },
  { timestamps: true,collection: "product_keywords" }
);

module.exports = mongoose.model("ProductKeyword", ProductKeywordSchema, "product_keywords");