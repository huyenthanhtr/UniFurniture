const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", CartSchema, "cart");