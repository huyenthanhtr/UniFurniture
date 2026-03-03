const express = require("express");
const { buildListHandler, buildGetByIdHandler } = require("../controllers/generic.controller");

function makeGenericRouter(Model) {
  const router = express.Router();
  router.get("/", buildListHandler(Model));
  router.get("/:id", buildGetByIdHandler(Model));
  return router;
}

module.exports = makeGenericRouter;