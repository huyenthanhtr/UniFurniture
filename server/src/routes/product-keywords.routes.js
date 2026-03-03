const makeGenericRouter = require("./generic.routes");
const ProductKeyword = require("../models/ProductKeyword");
module.exports = makeGenericRouter(ProductKeyword);