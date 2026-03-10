const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  getProductRecommendations,
  createProduct,
  updateProduct,
  patchProduct,
  removeProduct,
} = require("../controllers/product.controller");

router.get("/", getProducts);
router.get("/:slug/recommendations", getProductRecommendations);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.patch("/:id", patchProduct);
router.delete("/:id", removeProduct);

module.exports = router;