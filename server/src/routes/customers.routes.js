const makeGenericRouter = require("./generic.routes");
const Customer = require("../models/Customer");
module.exports = makeGenericRouter(Customer);