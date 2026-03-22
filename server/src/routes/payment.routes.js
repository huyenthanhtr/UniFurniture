const makeGenericRouter = require("./generic.routes");
const Payment = require("../models/Payment");
module.exports = makeGenericRouter(Payment);
