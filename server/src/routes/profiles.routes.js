const makeGenericRouter = require("./generic.routes");
const Profile = require("../models/Profile");
module.exports = makeGenericRouter(Profile);