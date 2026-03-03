const makeGenericRouter = require("./generic.routes");
const ProductVariant = require("../models/ProductVariant");
module.exports = makeGenericRouter(ProductVariant);