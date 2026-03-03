const makeGenericRouter = require("./generic.routes");
const Collection = require("../models/Collection");
module.exports = makeGenericRouter(Collection);