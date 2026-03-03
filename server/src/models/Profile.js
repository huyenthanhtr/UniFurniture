const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    full_name: String,
    avatar_url: String,
    gender: String,
    date_of_birth: Date,
    address: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", ProfileSchema, "profiles");