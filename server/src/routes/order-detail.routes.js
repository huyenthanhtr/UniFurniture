const makeGenericRouter = require("./generic.routes");
const OrderDetail = require("../models/OrderDetail");
module.exports = makeGenericRouter(OrderDetail);