const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema(
  {
    cart_id: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    quantity: Number,
    unit_price: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CartItem", CartItemSchema, "cart_items");