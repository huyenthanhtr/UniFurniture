const mongoose = require("mongoose");

const KeywordSchema = new mongoose.Schema(
  {
    keyword: String,
    synonyms: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Keyword", KeywordSchema, "keywords");