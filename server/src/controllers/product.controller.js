const mongoose = require("mongoose");
const Product = require("../models/Product");

async function getProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
      category,
      collection,
      status,
      q,
      exclude,
      fields,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum <= 0 || limitNum <= 0) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }
    if (!["asc", "desc"].includes(String(order))) {
      return res.status(400).json({ error: "Invalid order parameter" });
    }
    if (!["createdAt", "bestSelling", "updatedAt"].includes(String(sortBy))) {
      return res.status(400).json({ error: "Invalid sortBy parameter" });
    }

    const sortDirection = String(order) === "desc" ? -1 : 1;
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (category) {
      const ids = String(category)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      query.category_id = ids.length === 1 ? ids[0] : { $in: ids };
    }

    if (collection) query.collection_id = collection;

    if (status) {
      query.status = new RegExp(`^${String(status).trim()}$`, "i");
    }

    if (q) {
      const kw = String(q).trim();
      if (kw) {
        query.$or = [
          { name: { $regex: kw, $options: "i" } },
          { sku: { $regex: kw, $options: "i" } },
        ];
      }
    }

    const sortOptions =
      String(sortBy) === "bestSelling"
        ? { sold: sortDirection, createdAt: -1, _id: -1 }
        : String(sortBy) === "updatedAt"
        ? { updatedAt: sortDirection, _id: -1 }
        : { createdAt: sortDirection, _id: -1 };

    let projection = undefined;
    if (fields) {
      const f = String(fields)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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
      Product.find(query).select(projection).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      items,
    });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const doc = await Product.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json(doc);
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

    const allowed = ["status"];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }

    if (update.status !== undefined) {
      const s = String(update.status).toLowerCase();
      if (!["active", "inactive"].includes(s)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      update.status = s;
    }

    const doc = await Product.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ error: "Product not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getProductById, patchProduct };
