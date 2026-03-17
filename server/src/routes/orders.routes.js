const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrderById,
  patchOrderStatus,
  requestCancelOrder,
  createCheckoutOrder,
} = require("../controllers/order.controller");

router.get("/", getOrders);
router.post("/", createCheckoutOrder);
router.get("/:id", getOrderById);
router.patch('/:id/status', patchOrderStatus);
router.post('/:id/cancel-request', requestCancelOrder);

module.exports = router;
