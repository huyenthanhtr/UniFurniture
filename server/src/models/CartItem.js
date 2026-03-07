const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema(
  {
    cart_id: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
  },
  { timestamps: true, collection: "cart_items" }
);

module.exports = mongoose.model("CartItem", CartItemSchema, "cart_items");