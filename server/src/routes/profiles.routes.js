const makeGenericRouter = require("./generic.routes");
const Profile = require("../models/Profile");
const { changePassword } = require("../controllers/profile.controller");

const router = makeGenericRouter(Profile);

router.post("/:id/change-password", changePassword);

module.exports = router;
