const mongoose = require("mongoose");

const CustomerAddressSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_address_name: {type: String, required: true},
    address_phone: {type: String, required: true},
    address_line: {type: String, required: true},
    ward: {type: String, required: true},
    district: {type: String, required: true},
    province: {type: String, required: true},
    is_default: { type: Boolean, default: false },
    status: {type: String, required: true, enum: ["active", "inactive"], default: "active"},
  },
  { timestamps: true, collection: "customer_address" }
);

module.exports = mongoose.model("CustomerAddress", CustomerAddressSchema, "customer_address");
