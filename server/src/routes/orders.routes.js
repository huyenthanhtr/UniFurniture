const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrderById,
  patchOrderStatus,
  requestCancelOrder,
  createCheckoutOrder,
  addWarrantyRecord,
} = require("../controllers/order.controller");

router.get("/", getOrders);
router.post("/", createCheckoutOrder);
router.get("/:id", getOrderById);
router.patch('/:id/status', patchOrderStatus);
router.post('/:id/cancel-request', requestCancelOrder);
router.post('/:id/warranty-records', addWarrantyRecord);

module.exports = router;
