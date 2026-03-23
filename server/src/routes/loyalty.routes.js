const express = require("express");
const { getProfileLoyalty, estimatePoints } = require("../controllers/loyalty.controller");

const router = express.Router();

router.get("/profiles/:profileId", getProfileLoyalty);
router.get("/estimate", estimatePoints);

module.exports = router;

