const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    customer_code: String,
    full_name: String,
    phone: String,
    customer_type: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", CustomerSchema, "customers");