const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrderById,
  patchOrderStatus,
  requestCancelOrder,
} = require("../controllers/order.controller");

router.get("/", getOrders);
router.get("/:id", getOrderById);
router.patch('/:id/status', patchOrderStatus);
router.post('/:id/cancel-request', requestCancelOrder);

module.exports = router;
