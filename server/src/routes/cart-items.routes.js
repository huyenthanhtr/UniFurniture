const makeGenericRouter = require("./generic.routes");
const CartItem = require("../models/CartItem");
module.exports = makeGenericRouter(CartItem);