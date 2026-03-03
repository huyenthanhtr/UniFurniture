const makeGenericRouter = require("./generic.routes");
const Order = require("../models/Order");
module.exports = makeGenericRouter(Order);