const makeGenericRouter = require("./generic.routes");
const CustomerAddress = require("../models/CustomerAddress");
module.exports = makeGenericRouter(CustomerAddress);