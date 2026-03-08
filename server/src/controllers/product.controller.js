const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");
const {
  ensureUniqueSlug,
  recalculateProductAggregates,
} = require("../utils/product-aggregate");

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

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      items,
    });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const doc = await Product.findById(req.params.id).lean();
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

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  patchProduct,
  removeProduct,
};