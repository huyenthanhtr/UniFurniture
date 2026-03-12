const mongoose = require("mongoose");

const ProductModel3DSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    file_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID của file trong GridFS
    filename: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, collection: "product_models_3d" }
);

module.exports = mongoose.model("ProductModel3D", ProductModel3DSchema, "product_models_3d");
