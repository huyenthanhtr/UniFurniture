const express = require("express");
const router = express.Router();
const { getProducts, getProductById, patchProduct } = require("../controllers/product.controller");

router.get("/", getProducts);
router.get("/:id", getProductById);
router.patch("/:id", patchProduct);

module.exports = router;