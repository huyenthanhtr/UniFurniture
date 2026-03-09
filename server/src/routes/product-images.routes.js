const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ProductImage = require("../models/ProductImage");
const {
  recalculateProductAggregates,
  syncPrimaryImageScope,
} = require("../utils/product-aggregate");

const router = express.Router();

function slugify(value) {
  return String(value || "san-pham")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function extensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  return map[mimeType] || "jpg";
}

router.post("/upload", async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.dataUrl);
    if (!parsed) return res.status(400).json({ message: "Invalid image data" });

    const buffer = Buffer.from(parsed.base64, "base64");
    if (!buffer.length) return res.status(400).json({ message: "Empty image data" });

    const ext = extensionFromMime(parsed.mimeType);
    const productSlug = slugify(req.body?.productName || "san-pham");
    const randomHash = crypto.randomBytes(16).toString("hex");
    const filename = `${productSlug}_${randomHash}.${ext}`;

    const uploadDir = path.resolve(__dirname, "..", "..", "..", "admin", "src", "assets", "upload");
    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.writeFile(path.join(uploadDir, filename), buffer);

    const origin = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${origin}/assets/upload/${filename}`;
    res.status(201).json({ filename, image_url: imageUrl });
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 500);
    const skip = (page - 1) * limit;

    const filter = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (["page", "limit", "sort", "fields", "exclude"].includes(k)) continue;
      filter[k] = v;
    }

    const [items, total] = await Promise.all([
      ProductImage.find(filter).sort({ is_primary: -1, sort_order: 1, createdAt: 1, _id: 1 }).skip(skip).limit(limit),
      ProductImage.countDocuments(filter),
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = await ProductImage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const doc = await ProductImage.create({
      product_id: req.body.product_id,
      variant_id: req.body.variant_id || null,
      image_url: String(req.body.image_url || "").trim(),
      alt_text: String(req.body.alt_text || ""),
      is_primary: Boolean(req.body.is_primary),
      sort_order: Number(req.body.sort_order || 0),
    });

    await syncPrimaryImageScope(doc);
    await recalculateProductAggregates(doc.product_id);

    const fresh = await ProductImage.findById(doc._id);
    res.status(201).json(fresh);
  } catch (err) {
    res.status(400).json({ message: "Create failed" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const current = await ProductImage.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Not found" });

    const doc = await ProductImage.findByIdAndUpdate(
      req.params.id,
      {
        product_id: req.body.product_id || current.product_id,
        variant_id: req.body.variant_id || null,
        image_url: String(req.body.image_url || "").trim(),
        alt_text: String(req.body.alt_text || ""),
        is_primary: Boolean(req.body.is_primary),
        sort_order: Number(req.body.sort_order || 0),
      },
      { new: true, runValidators: true }
    );

    await syncPrimaryImageScope(doc);
    await recalculateProductAggregates(doc.product_id);

    res.json(await ProductImage.findById(doc._id));
  } catch (err) {
    res.status(400).json({ message: "Update failed" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const current = await ProductImage.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Not found" });

    const update = {};
    if (req.body.product_id !== undefined) update.product_id = req.body.product_id;
    if (req.body.variant_id !== undefined) update.variant_id = req.body.variant_id || null;
    if (req.body.image_url !== undefined) update.image_url = String(req.body.image_url || "").trim();
    if (req.body.alt_text !== undefined) update.alt_text = String(req.body.alt_text || "");
    if (req.body.is_primary !== undefined) update.is_primary = Boolean(req.body.is_primary);
    if (req.body.sort_order !== undefined) update.sort_order = Number(req.body.sort_order || 0);

    const doc = await ProductImage.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    await syncPrimaryImageScope(doc);
    await recalculateProductAggregates(doc.product_id);

    res.json(await ProductImage.findById(doc._id));
  } catch (err) {
    res.status(400).json({ message: "Patch failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = await ProductImage.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    await recalculateProductAggregates(doc.product_id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Delete failed" });
  }
});

module.exports = router;
