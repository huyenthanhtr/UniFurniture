const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const ProductImage = require("../models/ProductImage");
const Category = require("../models/Category");
const Collection = require("../models/Collection");
const { normalizeRichHtml } = require("../utils/normalize-rich-html");
const {
  ensureUniqueSlug,
  recalculateProductAggregates,
} = require("../utils/product-aggregate");
const { getColorHex } = require("../utils/color-map.utils");

function toObjectIdOrNull(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

async function resolveTaxonomyObjectIds(model, rawValue) {
  const tokens = String(rawValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return [];
  }

  const objectIds = tokens
    .filter((item) => mongoose.Types.ObjectId.isValid(item))
    .map((item) => new mongoose.Types.ObjectId(item));

  const slugTokens = tokens.filter((item) => !mongoose.Types.ObjectId.isValid(item));
  if (!slugTokens.length) {
    return objectIds;
  }

  const matchedDocs = await model.find({ slug: { $in: slugTokens } }).select({ _id: 1 }).lean();
  const mergedIds = [...objectIds, ...matchedDocs.map((item) => item._id)];
  const seen = new Set();

  return mergedIds.filter((item) => {
    const key = String(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
    description: normalizeRichHtml(body.description || ""),
    size: body.size ?? undefined,
    material: body.material ?? undefined,
  };
}

function buildProjection(fields, exclude) {
  if (fields) {
    const names = String(fields)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!names.length) return null;

    const projection = { _id: 1 };
    for (const name of names) projection[name] = 1;
    return projection;
  }

  if (exclude) {
    const names = String(exclude)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!names.length) return null;

    const projection = {};
    for (const name of names) projection[name] = 0;
    return projection;
  }

  return null;
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
    const andConditions = [];

    if (category) {
      const categoryIds = await resolveTaxonomyObjectIds(Category, category);
      andConditions.push(
        categoryIds.length
          ? { category_id: categoryIds.length > 1 ? { $in: categoryIds } : categoryIds[0] }
          : { _id: { $in: [] } }
      );
    }

    if (collection) {
      const collectionIds = await resolveTaxonomyObjectIds(Collection, collection);
      andConditions.push(
        collectionIds.length
          ? { collection_id: collectionIds.length > 1 ? { $in: collectionIds } : collectionIds[0] }
          : { _id: { $in: [] } }
      );
    }

    if (status) {
      const statuses = String(status)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (statuses.length === 1) andConditions.push({ status: statuses[0] });
      else if (statuses.length > 1) andConditions.push({ status: { $in: statuses } });
    }

    if (q) {
      const kw = String(q).trim();
      if (kw) {
        const [matchedCategories, matchedCollections] = await Promise.all([
          Category.find({ name: { $regex: kw, $options: "i" } }).select({ _id: 1 }).lean(),
          Collection.find({ name: { $regex: kw, $options: "i" } }).select({ _id: 1 }).lean(),
        ]);

        const categoryIds = matchedCategories.map((item) => item._id);
        const collectionIds = matchedCollections.map((item) => item._id);

        andConditions.push({
          $or: [
          { name: { $regex: kw, $options: "i" } },
          { sku: { $regex: kw, $options: "i" } },
            ...(categoryIds.length ? [{ category_id: { $in: categoryIds } }] : []),
            ...(collectionIds.length ? [{ collection_id: { $in: collectionIds } }] : []),
          ],
        });
      }
    }

    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0]);
    } else if (andConditions.length > 1) {
      query.$and = andConditions;
    }

    const sortKey = ["createdAt", "updatedAt", "sold", "min_price", "name", "status", "category", "collection", "suggested"].includes(String(sortBy))
      ? String(sortBy)
      : "updatedAt";
    const projection = buildProjection(fields, exclude);
    const hasIncludeProjection = !!projection && Object.values(projection).some((value) => value === 1);

    const pipeline = [
      { $match: query },
    ];

    if (sortKey === 'suggested') {
      const { user_id } = req.query;
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        const UserRec = require('../models/UserRecommendation');
        const userRecs = await UserRec.find({ user_id }).lean();
        if (userRecs.length > 0) {
          const slugs = userRecs.map(r => r.recommended_slug);
          pipeline.push({
            $addFields: {
              rec_score: {
                $cond: {
                  if: { $in: ["$slug", slugs] },
                  then: { $arrayElemAt: [userRecs.filter(r => slugs.includes(r.recommended_slug)).map(r => r.score), { $indexOfArray: [slugs, "$slug"] }] },
                  else: 0
                }
              }
            }
          });
          pipeline.push({ $sort: { rec_score: -1, sold: -1, _id: -1 } });
        } else {
          // Fallback if no specific user recs
          pipeline.push({ $sort: { sold: -1, min_price: 1, _id: -1 } });
        }
      } else {
        // Unauthenticated fallback: High sold and low price
        pipeline.push({ $sort: { sold: -1, min_price: 1, _id: -1 } });
      }
    } else {
      pipeline.push(
        {
          $lookup: {
            from: "categories",
            localField: "category_id",
            foreignField: "_id",
            as: "category_doc",
          },
        },
        {
          $lookup: {
            from: "collections",
            localField: "collection_id",
            foreignField: "_id",
            as: "collection_doc",
          },
        },
        {
          $addFields: {
            category_name: { $ifNull: [{ $arrayElemAt: ["$category_doc.name", 0] }, ""] },
            collection_name: { $ifNull: [{ $arrayElemAt: ["$collection_doc.name", 0] }, ""] },
          },
        },
        {
          $sort: {
            [sortKey === "category" ? "category_name" : sortKey === "collection" ? "collection_name" : sortKey]: sortDirection,
            _id: -1,
          },
        }
      );
    }

    pipeline.push(
      { $skip: skip },
      { $limit: limitNum }
    );

    if (projection && hasIncludeProjection) {
      pipeline.push({ $project: projection });
    } else {
      pipeline.push({
        $project: projection
          ? {
            ...projection,
            category_doc: 0,
            collection_doc: 0,
            category_name: 0,
            collection_name: 0,
          }
          : {
            category_doc: 0,
            collection_doc: 0,
            category_name: 0,
            collection_name: 0,
          },
      });
    }

    const [items, total] = await Promise.all([
      Product.aggregate(pipeline).collation({ locale: "vi", strength: 1, numericOrdering: true }),
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

    if (req.body.description !== undefined) {
      update.description = normalizeRichHtml(req.body.description || "");
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
    const { user_id } = req.query;

    const Recommendation = require('./../models/Recommendation');
    const UserRec = require('./../models/UserRecommendation');

    // 1. Fetch item-based/content-based recommendations
    const itemRecs = await Recommendation
      .find({ product_slug: slug })
      .sort({ score: -1 })
      .limit(10)
      .lean();

    // 2. If user is logged in, fetch their personalized recommendations
    let personalRecs = [];
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      personalRecs = await UserRec.find({ user_id }).lean();
    }

    if ((!itemRecs || itemRecs.length === 0) && personalRecs.length === 0) {
      return res.json({ items: [] });
    }

    const recommendedSlugs = [
      ...new Set([
        ...itemRecs.map(r => r.recommended_slug),
        ...personalRecs.map(r => r.recommended_slug)
      ])
    ];

    const products = await Product
      .find({ slug: { $in: recommendedSlugs }, status: 'active' })
      .select('name slug min_price compare_at_price thumbnail thumbnail_url sold category_id collection_id size material')
      .lean();

    const items = products.map((product) => {
      const itemRec = itemRecs.find(r => r.recommended_slug === product.slug);
      const personalRec = personalRecs.find(r => r.recommended_slug === product.slug);

      // Score combination: Item Similarity + (Personal affinity * 2)
      let finalScore = (itemRec ? itemRec.score : 0);
      if (personalRec) {
        finalScore += (personalRec.score * 2);
      }

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
        score: finalScore
      };
    });

    items.sort((a, b) => b.score - a.score);

    res.json({ items: items.slice(0, 8) });
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
