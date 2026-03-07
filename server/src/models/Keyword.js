const mongoose = require("mongoose");

const KeywordSchema = new mongoose.Schema(
  {
    keyword: {type: String, required: true, unique:true},
    synonyms: [String],
  },
  { timestamps: true, collection: "keywords" }
);

module.exports = mongoose.model("Keyword", KeywordSchema, "keywords");