const express = require("express");
const Customer = require("../models/Customer");
const {
  buildListHandler,
  buildGetByIdHandler,
  buildCreateHandler,
  buildUpdateHandler,
  buildPatchHandler,
} = require("../controllers/generic.controller");
const {
  getAdminCustomers,
  getAdminCustomerDetail,
  getAdminCustomerAddresses,
  getAdminCustomerAddressDetail,
} = require("../controllers/customer.controller");

const router = express.Router();

router.get("/admin/list", getAdminCustomers);
router.get("/admin/:id", getAdminCustomerDetail);
router.get("/admin/:id/addresses", getAdminCustomerAddresses);
router.get("/admin/:id/addresses/:addressId", getAdminCustomerAddressDetail);

router.get("/", buildListHandler(Customer));
router.get("/:id", buildGetByIdHandler(Customer));
router.post("/", buildCreateHandler(Customer));
router.put("/:id", buildUpdateHandler(Customer));
router.patch("/:id", buildPatchHandler(Customer));

module.exports = router;
