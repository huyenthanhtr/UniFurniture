const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    customer_code: String,
    full_name: {type: String, required: true},
    phone: String,
    customer_type: {type:String, required: true, enum:["member", "guest"], default: "guest"},
    status: {type: String, required: true, enum: ["active", "inactive"], default: "active"},
  },
  { timestamps: true, collection: "customers" }
);

module.exports = mongoose.model("Customer", CustomerSchema, "customers");
