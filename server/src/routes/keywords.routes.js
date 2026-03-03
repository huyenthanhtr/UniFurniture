const makeGenericRouter = require("./generic.routes");
const Keyword = require("../models/Keyword");
module.exports = makeGenericRouter(Keyword);