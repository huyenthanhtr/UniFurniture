const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const controller = require("../controllers/product-model3d.controller");

router.post("/upload", upload.single("modelFile"), controller.uploadModel3D);

router.get("/product/:product_id", controller.getModelsByProduct);

router.get("/file/:file_id", controller.streamModelFile);

router.delete("/:id", controller.deleteModel3D);

router.get("/", controller.getAllModels);

module.exports = router;
