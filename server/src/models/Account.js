const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    phone: String,
    email: String,
    password_hash: String,
    role: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", AccountSchema, "accounts");