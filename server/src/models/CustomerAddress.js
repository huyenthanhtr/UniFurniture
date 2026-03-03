const mongoose = require("mongoose");

const CustomerAddressSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customer_address_name: String,
    address_phone: String,
    address_line: String,
    ward: String,
    district: String,
    province: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomerAddress", CustomerAddressSchema, "customer_address");