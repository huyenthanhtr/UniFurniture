const mongoose = require("mongoose");
const Payment = require("../models/Payment");

function normalizePaidAtInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldStampPaidAt(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return normalizedStatus === "paid" || normalizedStatus === "refunded";
}

async function createPayment(req, res) {
  try {
    const payload = { ...req.body };
    if (shouldStampPaidAt(payload.status)) {
      payload.paid_at = normalizePaidAtInput(payload.paid_at) || new Date();
    } else {
      payload.paid_at = null;
    }

    const doc = await Payment.create(payload);
    return res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Create failed" });
  }
}

async function getPaymentById(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doc = await Payment.findById(id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function patchPayment(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: "Not found" });

    const editableFields = ["type", "method", "amount", "status", "transaction_id", "order_id"];
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    }

    if (!payment.paid_at && shouldStampPaidAt(req.body?.status ?? payment.status)) {
      payment.paid_at = normalizePaidAtInput(req.body?.paid_at) || new Date();
    }

    await payment.save();
    return res.json(payment);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Patch failed" });
  }
}

module.exports = {
  createPayment,
  getPaymentById,
  patchPayment,
};
