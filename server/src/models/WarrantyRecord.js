const mongoose = require("mongoose");

const WarrantyRecordSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    order_detail_id: { type: mongoose.Schema.Types.ObjectId, ref: "OrderDetail", required: true, index: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    product_name: { type: String, default: "" },
    variant_name: { type: String, default: "" },
    image_url: { type: String, default: "" },
    serviced_at: { type: Date, required: true, index: true },
    type: { type: String, enum: ["warranty", "maintenance"], required: true },
    cost: { type: Number, default: 0 },
    description: { type: String, default: "" },
  },
  { timestamps: true, collection: "warranty_records" }
);

module.exports = mongoose.model("WarrantyRecord", WarrantyRecordSchema, "warranty_records");
