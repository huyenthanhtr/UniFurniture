const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");

function normalizeString(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const seed = slugify(baseSlug) || "san-pham";
  let slug = seed;
  let index = 1;

  while (true) {
    const existing = await Product.findOne(
      excludeId ? { slug, _id: { $ne: excludeId } } : { slug }
    ).lean();

    if (!existing) return slug;

    index += 1;
    slug = `${seed}-${index}`;
  }
}

async function syncPrimaryImageScope(imageDoc) {
  if (!imageDoc || !imageDoc.is_primary) return;

  const currentSort = Number(imageDoc.sort_order || 0);

  await ProductImage.updateMany(
    { product_id: imageDoc.product_id, _id: { $ne: imageDoc._id }, is_primary: true },
    { $set: { is_primary: false, sort_order: currentSort + 1 } }
  );
}

function imageComparator(a, b) {
  if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
  const ao = Number(a.sort_order || 0);
  const bo = Number(b.sort_order || 0);
  if (ao !== bo) return ao - bo;
  const at = new Date(a.createdAt || 0).getTime();
  const bt = new Date(b.createdAt || 0).getTime();
  return at - bt;
}

async function recalculateProductAggregates(productId) {
  if (!mongoose.Types.ObjectId.isValid(String(productId))) return;

  const [allVariants, allImages] = await Promise.all([
    ProductVariant.find({ product_id: productId }).lean(),
    ProductImage.find({ product_id: productId }).lean(),
  ]);

  const sellableVariants = allVariants.filter(
    (v) =>
      String(v.variant_status || "").toLowerCase() === "active" &&
      String(v.status || "").toLowerCase() === "available"
  );

  const sold = allVariants.reduce((sum, v) => sum + Number(v.sold || 0), 0);
  const minPrice = sellableVariants.length
    ? Math.min(...sellableVariants.map((v) => Number(v.price || 0)))
    : 0;

  const thumbnailSource = [...allImages].sort(imageComparator)[0];
  const thumbnail = thumbnailSource?.image_url || "";

  await Product.findByIdAndUpdate(productId, {
    $set: {
      min_price: Number.isFinite(minPrice) ? minPrice : 0,
      sold,
      thumbnail,
      thumbnail_url: thumbnail,
    },
  });
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  syncPrimaryImageScope,
  recalculateProductAggregates,
  imageComparator,
};