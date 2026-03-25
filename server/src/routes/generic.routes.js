const express = require("express");
const {
  buildListHandler,
  buildGetByIdHandler,
  buildCreateHandler,
  buildUpdateHandler,
  buildPatchHandler,
  buildDeleteHandler,
} = require("../controllers/generic.controller");

function makeGenericRouter(Model) {
  const router = express.Router();

  router.get("/", buildListHandler(Model));
  router.get("/:id", buildGetByIdHandler(Model));

  router.post("/", buildCreateHandler(Model));
  router.put("/:id", buildUpdateHandler(Model));
  router.patch("/:id", buildPatchHandler(Model));
  router.delete("/:id", buildDeleteHandler(Model));

  return router;
}

module.exports = makeGenericRouter;
