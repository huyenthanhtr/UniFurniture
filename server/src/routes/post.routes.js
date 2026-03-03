const makeGenericRouter = require("./generic.routes");
const Post = require("../models/Post");
module.exports = makeGenericRouter(Post);