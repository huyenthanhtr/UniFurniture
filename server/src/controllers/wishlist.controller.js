const mongoose = require("mongoose");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const ProductImage = require("../models/ProductImage");
const Profile = require("../models/Profile");

function asObjectId(value) {
  const raw = String(value || "").trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function toMoney(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, Number(fallback || 0));
  return parsed;
}

function mapWishlistItem(doc) {
  return {
    _id: String(doc?._id || ""),
    profile_id: String(doc?.profile_id || ""),
    account_name: String(doc?.account_name || ""),
    account_phone: String(doc?.account_phone || ""),
    product_id: String(doc?.product_id || ""),
    product_slug: String(doc?.product_slug || ""),
    name: String(doc?.name || "Sản phẩm"),
    image_url: String(doc?.image_url || ""),
    sale_price: toMoney(doc?.sale_price, 0),
    price: toMoney(doc?.price, 0),
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}

async function resolveImageUrl(productId, preferredUrl) {
  const preferred = String(preferredUrl || "").trim();
  if (preferred) return preferred;

  const product = await Product.findById(productId)
    .select("thumbnail thumbnail_url")
    .lean();

  const fromProduct = String(product?.thumbnail_url || product?.thumbnail || "").trim();
  if (fromProduct) return fromProduct;

  const imageDoc = await ProductImage.findOne({ product_id: productId })
    .sort({ is_primary: -1, sort_order: 1, _id: 1 })
    .select("image_url")
    .lean();

  return String(imageDoc?.image_url || "").trim();
}

async function getProfileById(profileId) {
  return Profile.findById(profileId).select("full_name phone").lean();
}

function normalizeAccountSnapshot(profile) {
  return {
    account_name: String(profile?.full_name || "").trim(),
    account_phone: String(profile?.phone || "").trim(),
  };
}

async function backfillWishlistAccountSnapshot(profileId, accountSnapshot) {
  const accountName = String(accountSnapshot?.account_name || "").trim();
  const accountPhone = String(accountSnapshot?.account_phone || "").trim();

  if (!accountName && !accountPhone) return;

  await Wishlist.updateMany(
    {
      profile_id: profileId,
      $or: [
        { account_name: { $exists: false } },
        { account_name: "" },
        { account_phone: { $exists: false } },
        { account_phone: "" },
      ],
    },
    {
      $set: {
        account_name: accountName,
        account_phone: accountPhone,
      },
    }
  );
}

async function listWishlist(req, res) {
  try {
    const profileId = asObjectId(req.params.profileId);
    if (!profileId) {
      return res.status(400).json({ message: "profileId không hợp lệ." });
    }

    const profile = await getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const accountSnapshot = normalizeAccountSnapshot(profile);
    await backfillWishlistAccountSnapshot(profileId, accountSnapshot);

    const items = await Wishlist.find({ profile_id: profileId }).sort({ createdAt: -1 }).lean();
    return res.json({
      items: items.map((item) =>
        mapWishlistItem({
          ...item,
          account_name: item?.account_name || accountSnapshot.account_name,
          account_phone: item?.account_phone || accountSnapshot.account_phone,
        })
      ),
    });
  } catch (error) {
    return res.status(500).json({ message: "Không thể tải danh sách yêu thích.", error: error.message });
  }
}

async function upsertWishlistItem(req, res) {
  try {
    const profileId = asObjectId(req.params.profileId);
    if (!profileId) {
      return res.status(400).json({ message: "profileId không hợp lệ." });
    }

    const profile = await getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const productId = asObjectId(req.body?.product_id);
    if (!productId) {
      return res.status(400).json({ message: "product_id không hợp lệ." });
    }

    const product = await Product.findById(productId)
      .select("name slug min_price")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    const salePrice = toMoney(req.body?.sale_price, product.min_price || 0);
    const listedPrice = toMoney(req.body?.price, Math.max(salePrice, product.min_price || 0));
    const imageUrl = await resolveImageUrl(productId, req.body?.image_url);

    const accountSnapshot = normalizeAccountSnapshot(profile);
    const payload = {
      account_name: accountSnapshot.account_name,
      account_phone: accountSnapshot.account_phone,
      product_slug: String(req.body?.product_slug || product.slug || "").trim(),
      name: String(req.body?.name || product.name || "Sản phẩm").trim() || "Sản phẩm",
      image_url: imageUrl,
      sale_price: salePrice,
      price: listedPrice,
    };

    const item = await Wishlist.findOneAndUpdate(
      { profile_id: profileId, product_id: productId },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(201).json({ item: mapWishlistItem(item) });
  } catch (error) {
    return res.status(500).json({ message: "Không thể thêm vào danh sách yêu thích.", error: error.message });
  }
}

async function removeWishlistItem(req, res) {
  try {
    const profileId = asObjectId(req.params.profileId);
    const productId = asObjectId(req.params.productId);

    if (!profileId || !productId) {
      return res.status(400).json({ message: "profileId hoặc productId không hợp lệ." });
    }

    const result = await Wishlist.deleteOne({ profile_id: profileId, product_id: productId });
    if (!result.deletedCount) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại trong danh sách yêu thích." });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: "Không thể xóa khỏi danh sách yêu thích.", error: error.message });
  }
}

module.exports = {
  listWishlist,
  upsertWishlistItem,
  removeWishlistItem,
};
