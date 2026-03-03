const makeGenericRouter = require("./generic.routes");
const Category = require("../models/Category");
module.exports = makeGenericRouter(Category);