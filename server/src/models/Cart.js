const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    status:{ 
      type: String,
      enum: ["active", "converted", "abandoned"],
      default: "active", 
      required: true
    },
  },
  { timestamps: true, 
    collection: "cart"
  }
);

module.exports = mongoose.model("Cart", CartSchema, "cart");