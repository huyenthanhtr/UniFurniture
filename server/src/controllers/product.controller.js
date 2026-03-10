const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");
const {
  ensureUniqueSlug,
  recalculateProductAggregates,
} = require("../utils/product-aggregate");
const { getColorHex } = require("../utils/color-map.utils");

function toObjectIdOrNull(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

function normalizeProductPayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    sku: String(body.sku || "").trim(),
    brand: String(body.brand || "").trim(),
    status: String(body.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    category_id: toObjectIdOrNull(body.category_id),
    collection_id: toObjectIdOrNull(body.collection_id),
    product_type: String(body.product_type || "").trim(),
    url: String(body.url || "").trim(),
    short_description: String(body.short_description || ""),
    description: String(body.description || ""),
    size: body.size ?? undefined,
    material: body.material ?? undefined,
  };
}

async function getProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "updatedAt",
      order = "desc",
      category,
      collection,
      status,
      q,
      exclude,
      fields,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = String(order).toLowerCase() === "asc" ? 1 : -1;

    const query = {};

    if (category) {
      const ids = String(category)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      query.category_id = ids.length > 1 ? { $in: ids } : ids[0];
    }

    if (collection) query.collection_id = collection;

    if (status) {
      const statuses = String(status)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (statuses.length === 1) query.status = statuses[0];
      else if (statuses.length > 1) query.status = { $in: statuses };
    }

    if (q) {
      const kw = String(q).trim();
      if (kw) {
        query.$or = [
          { name: { $regex: kw, $options: "i" } },
          { sku: { $regex: kw, $options: "i" } },
          { slug: { $regex: kw, $options: "i" } },
          { brand: { $regex: kw, $options: "i" } },
        ];
      }
    }

    const sortKey = ["createdAt", "updatedAt", "sold", "min_price"].includes(String(sortBy))
      ? String(sortBy)
      : "updatedAt";

    let projection = undefined;
    if (fields) {
      const f = String(fields).split(",").map((s) => s.trim()).filter(Boolean);
      if (f.length) projection = f.join(" ");
    } else if (exclude) {
      const ex = String(exclude)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((x) => `-${x}`);
      if (ex.length) projection = ex.join(" ");
    }

    const [items, total] = await Promise.all([
      Product.find(query)
        .select(projection)
        .sort({ [sortKey]: sortDirection, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
    ]);

    // Batch-fetch variant colors for the returned product IDs
    const productIds = items.map((p) => p._id);
    const variantColorDocs = productIds.length
      ? await ProductVariant.find(
        { product_id: { $in: productIds }, color: { $exists: true, $ne: "" } }
      ).lean()
      : [];

    const variantIds = variantColorDocs.map(v => v._id);
    const imageDocs = variantIds.length
      ? await ProductImage.find(
        { product_id: { $in: productIds }, variant_id: { $in: variantIds } }
      ).lean()
      : [];

    // Build image map variant_id -> first image_url
    const variantImages = new Map();
    for (const img of imageDocs) {
      if (img.variant_id && img.image_url) {
        if (!variantImages.has(String(img.variant_id)) || img.is_primary) {
          variantImages.set(String(img.variant_id), img.image_url);
        }
      }
    }

    // Build a map: productId -> unique [{name, hex, price, originalPrice, imageUrl}]
    const colorsByProduct = new Map();
    for (const v of variantColorDocs) {
      const pid = String(v.product_id);
      if (!colorsByProduct.has(pid)) {
        colorsByProduct.set(pid, new Map());
      }
      const colorName = (v.color || "").trim();
      if (colorName && !colorsByProduct.get(pid).has(colorName)) {
        const productFallbackImg = items.find(p => String(p._id) === pid)?.thumbnail?.trim() || items.find(p => String(p._id) === pid)?.thumbnail_url?.trim() || "";
        colorsByProduct.get(pid).set(colorName, {
          name: colorName,
          hex: getColorHex(colorName),
          price: v.price || null,
          originalPrice: v.compare_at_price || null,
          imageUrl: variantImages.get(String(v._id)) || productFallbackImg,
        });
      }
    }

    const itemsWithColors = items.map((p) => ({
      ...p,
      colors: Array.from(colorsByProduct.get(String(p._id))?.values() || []),
    }));

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      items: itemsWithColors,
    });

  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    let doc;

    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await Product.findById(id).lean();
    } else {
      doc = await Product.findOne({ slug: id }).lean();
    }

    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const payload = normalizeProductPayload(req.body);

    if (!payload.name) return res.status(400).json({ error: "Name is required" });
    if (!payload.category_id) return res.status(400).json({ error: "Category is required" });

    const slug = await ensureUniqueSlug(req.body.slug || payload.name);

    const doc = await Product.create({
      ...payload,
      slug,
      thumbnail: "",
      thumbnail_url: "",
      min_price: 0,
      sold: 0,
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const current = await Product.findById(id);
    if (!current) return res.status(404).json({ error: "Product not found" });

    const payload = normalizeProductPayload(req.body);

    if (!payload.name) return res.status(400).json({ error: "Name is required" });
    if (!payload.category_id) return res.status(400).json({ error: "Category is required" });

    const slug = await ensureUniqueSlug(req.body.slug || payload.name, id);

    await Product.findByIdAndUpdate(
      id,
      {
        $set: {
          ...payload,
          slug,
        },
      },
      { new: true, runValidators: true }
    );

    await recalculateProductAggregates(id);

    const fresh = await Product.findById(id).lean();
    res.json(fresh);
  } catch (err) {
    next(err);
  }
}

async function patchProduct(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const update = {};

    if (req.body.status !== undefined) {
      const s = String(req.body.status).toLowerCase();
      if (!["active", "inactive"].includes(s)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      update.status = s;
    }

    if (req.body.name !== undefined) {
      update.name = String(req.body.name || "").trim();
      update.slug = await ensureUniqueSlug(req.body.slug || update.name, id);
    }

    const doc = await Product.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ error: "Product not found" });

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function removeProduct(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Product not found" });

    await Promise.all([
      ProductVariant.deleteMany({ product_id: id }),
      ProductImage.deleteMany({ product_id: id }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getProductRecommendations(req, res, next) {
  try {
    const { slug } = req.params;

    const Recommendation = require('./../models/Recommendation');
    const recs = await Recommendation
      .find({ product_slug: slug })
      .sort({ score: -1 })
      .limit(6)
      .lean();

    if (!recs || recs.length === 0) {
      return res.json({ items: [] });
    }

    const recommendedSlugs = recs.map(r => r.recommended_slug);

    const products = await Product
      .find({ slug: { $in: recommendedSlugs }, status: 'active' })
      .select('name slug min_price compare_at_price thumbnail thumbnail_url sold category_id collection_id size material')
      .lean();
    const items = products.map((product) => {
      // Find the score to keep them ordered by relevance
      const recEntry = recs.find(r => r.recommended_slug === product.slug);

      return {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        min_price: product.min_price,
        compare_at_price: product.compare_at_price,
        thumbnail: product.thumbnail,
        thumbnail_url: product.thumbnail_url,
        sold: product.sold,
        category_id: product.category_id,
        collection_id: product.collection_id,
        size: product.size,
        material: product.material,
        score: recEntry ? recEntry.score : 0
      };
    });

    items.sort((a, b) => b.score - a.score);

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProducts,
  getProductById,
  getProductRecommendations,
  createProduct,
  updateProduct,
  patchProduct,
  removeProduct,
};