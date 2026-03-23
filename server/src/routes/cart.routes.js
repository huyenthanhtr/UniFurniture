const express = require("express");
const makeGenericRouter = require("./generic.routes");
const Cart = require("../models/Cart");
const { getActiveCart, upsertCartItem, updateCartItem, deleteCartItem } = require("../controllers/cart.controller");

const router = express.Router();

router.get("/active", getActiveCart);

router.post("/items/upsert", upsertCartItem);

router.patch("/items/:id", updateCartItem);

router.delete("/items/:id", deleteCartItem);


const genericRouter = makeGenericRouter(Cart);
router.use("/", genericRouter);

module.exports = router;