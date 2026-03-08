const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrderById,
  patchOrderStatus,
} = require("../controllers/order.controller");

router.get("/", getOrders);
router.get("/:id", getOrderById);
router.patch("/:id/status", patchOrderStatus);

module.exports = router;