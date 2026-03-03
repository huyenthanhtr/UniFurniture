const makeGenericRouter = require("./generic.routes");
const Coupon = require("../models/Coupon");
module.exports = makeGenericRouter(Coupon);