const makeGenericRouter = require("./generic.routes");
const ProductImage = require("../models/ProductImage");
module.exports = makeGenericRouter(ProductImage);