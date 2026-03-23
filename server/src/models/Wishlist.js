const mongoose = require("mongoose");

const WishlistSchema = new mongoose.Schema(
  {
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
    account_name: { type: String, trim: true, default: "" },
    account_phone: { type: String, trim: true, default: "" },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    product_slug: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, required: true },
    image_url: { type: String, trim: true, default: "" },
    sale_price: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "wishlists" }
);

WishlistSchema.index({ profile_id: 1, product_id: 1 }, { unique: true });
WishlistSchema.index({ profile_id: 1, createdAt: -1 });
WishlistSchema.index({ profile_id: 1, account_phone: 1 });

module.exports = mongoose.model("Wishlist", WishlistSchema, "wishlists");
