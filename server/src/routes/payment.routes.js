const express = require("express");
const { buildListHandler } = require("../controllers/generic.controller");
const Payment = require("../models/Payment");
const { createPayment, getPaymentById, patchPayment } = require("../controllers/payment.controller");

const router = express.Router();

router.get("/", buildListHandler(Payment));
router.get("/:id", getPaymentById);
router.post("/", createPayment);
router.patch("/:id", patchPayment);

module.exports = router;
