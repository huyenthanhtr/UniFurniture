const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");

async function populateCartItem(item) {
  let doc = item.toObject ? item.toObject() : item;
  
  if (!doc.variant_id) return doc;

  const variant = await ProductVariant.findById(doc.variant_id).lean();
  let product = null;

  if (variant && variant.product_id) {
    product = await Product.findById(variant.product_id).lean();
    doc.variant_id = { ...variant, product_id: product };
  } else {
    product = await Product.findById(doc.variant_id).lean();
    if (product) {
      doc.variant_id = { _id: null, product_id: product };
    } else {
      doc.variant_id = null;
    }
  }

  return doc;
}


async function getActiveCart(req, res) {
  try {
    const { customer_id } = req.query;
    if (!customer_id || !mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ message: "Valid customer_id is required" });
    }

    let cart = await Cart.findOne({ customer_id, status: "active" });
    if (!cart) {
      cart = await Cart.create({ customer_id, status: "active" });
    }

    const rawItems = await CartItem.find({ cart_id: cart._id }).sort({ createdAt: 1 });
    const items = await Promise.all(rawItems.map(populateCartItem));

    return res.json({ cart, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}


async function upsertCartItem(req, res) {
  try {
    const { cart_id, variant_id, quantity, unit_price } = req.body;

    if (!cart_id || !variant_id || !quantity) {
      return res.status(400).json({ message: "cart_id, variant_id, and quantity are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(cart_id) || !mongoose.Types.ObjectId.isValid(variant_id)) {
      return res.status(400).json({ message: "Invalid cart_id or variant_id" });
    }

    const qty = Math.max(1, parseInt(quantity, 10));

    let item = await CartItem.findOne({ cart_id, variant_id });
    if (item) {
      item.quantity = qty;
      if (unit_price !== undefined) item.unit_price = unit_price;
      await item.save();
    } else {
      item = await CartItem.create({ cart_id, variant_id, quantity: qty, unit_price: unit_price || 0 });
    }

    const populated = await populateCartItem(item);
    return res.status(200).json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}


async function updateCartItem(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const item = await CartItem.findById(id);
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    const { quantity, unit_price } = req.body;

    if (quantity !== undefined) item.quantity = Math.max(1, parseInt(quantity, 10));
    if (unit_price !== undefined) item.unit_price = unit_price;
    await item.save();

    const populated = await populateCartItem(item);
    return res.json({ merged: false, item: populated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}


async function deleteCartItem(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const item = await CartItem.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ message: "Cart item not found" });
    return res.json({ success: true, deleted: item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getActiveCart, upsertCartItem, updateCartItem, deleteCartItem };
