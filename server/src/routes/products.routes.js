const makeGenericRouter = require("./generic.routes");
const Product = require("../models/Product");
module.exports = makeGenericRouter(Product);