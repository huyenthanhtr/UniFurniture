const makeGenericRouter = require("./generic.routes");
const Account = require("../models/Account");
module.exports = makeGenericRouter(Account);