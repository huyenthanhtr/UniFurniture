const makeGenericRouter = require("./generic.routes");
const Cart = require("../models/Cart");
module.exports = makeGenericRouter(Cart);