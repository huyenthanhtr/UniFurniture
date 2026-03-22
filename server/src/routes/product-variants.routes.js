const express = require("express");
const mongoose = require("mongoose");
const ProductVariant = require("../models/ProductVariant");
const { recalculateProductAggregates } = require("../utils/product-aggregate");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (["page", "limit", "sort", "fields", "exclude"].includes(k)) continue;
      filter[k] = v;
    }

    const [items, total] = await Promise.all([
      ProductVariant.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      ProductVariant.countDocuments(filter),
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = await ProductVariant.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = {
      product_id: req.body.product_id,
      name: String(req.body.name || "").trim(),
      variant_name: String(req.body.variant_name || req.body.name || "").trim(),
      sku: String(req.body.sku || "").trim(),
      color: String(req.body.color || "").trim(),
      price: Number(req.body.price || 0),
      compare_at_price: Number(req.body.compare_at_price || 0),
      stock_quantity: Number(req.body.stock_quantity || 0),
      variant_status: String(req.body.variant_status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
      sold: Number(req.body.sold || 0),
    };

    const doc = await ProductVariant.create(payload);
    await recalculateProductAggregates(doc.product_id);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: "Create failed" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const current = await ProductVariant.findById(id);
    if (!current) return res.status(404).json({ message: "Not found" });

    const payload = {
      product_id: req.body.product_id || current.product_id,
      name: String(req.body.name || "").trim(),
      variant_name: String(req.body.variant_name || req.body.name || "").trim(),
      sku: String(req.body.sku || "").trim(),
      color: String(req.body.color || "").trim(),
      price: Number(req.body.price || 0),
      compare_at_price: Number(req.body.compare_at_price || 0),
      stock_quantity: Number(req.body.stock_quantity || 0),
      variant_status: String(req.body.variant_status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
      sold: Number(req.body.sold || 0),
    };

    const doc = await ProductVariant.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    await recalculateProductAggregates(current.product_id);
    if (String(current.product_id) !== String(doc.product_id)) {
      await recalculateProductAggregates(doc.product_id);
    }

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: "Update failed" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const current = await ProductVariant.findById(id);
    if (!current) return res.status(404).json({ message: "Not found" });

    const update = {};
    if (req.body.name !== undefined) update.name = String(req.body.name || "").trim();
    if (req.body.variant_name !== undefined) update.variant_name = String(req.body.variant_name || "").trim();
    if (req.body.sku !== undefined) update.sku = String(req.body.sku || "").trim();
    if (req.body.color !== undefined) update.color = String(req.body.color || "").trim();
    if (req.body.price !== undefined) update.price = Number(req.body.price || 0);
    if (req.body.compare_at_price !== undefined) update.compare_at_price = Number(req.body.compare_at_price || 0);
    if (req.body.stock_quantity !== undefined) update.stock_quantity = Number(req.body.stock_quantity || 0);
    if (req.body.sold !== undefined) update.sold = Number(req.body.sold || 0);
    if (req.body.variant_status !== undefined) {
      update.variant_status = String(req.body.variant_status).toLowerCase() === "inactive" ? "inactive" : "active";
    }

    const doc = await ProductVariant.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    await recalculateProductAggregates(current.product_id);
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: "Patch failed" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = await ProductVariant.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    await recalculateProductAggregates(doc.product_id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: "Delete failed" });
  }
});

module.exports = router;
