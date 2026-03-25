const mongoose = require("mongoose");
const { Readable } = require("stream");
const ProductModel3D = require("../models/ProductModel3D");

const uploadModel3D = async (req, res) => {
  try {
    const { product_id, variant_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Chưa chọn file để upload" });
    }

    if (!product_id) {
       return res.status(400).json({ message: "Thiếu product_id" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const filename = `model3d-${Date.now()}-${req.file.originalname}`;
    
    const uploadStream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: {
            product_id,
            originalName: req.file.originalname
        }
    });

    const readableFileStream = new Readable();
    readableFileStream.push(req.file.buffer);
    readableFileStream.push(null);
    
    readableFileStream.pipe(uploadStream);

    uploadStream.on("finish", async () => {
      try {
        const file_id = uploadStream.id;

        const newModel = new ProductModel3D({
          product_id,
          variant_id: variant_id || null,
          file_id: file_id,
          filename: filename,
        });

        await newModel.save();

        res.status(201).json({
          message: "Upload model 3D thành công",
          data: newModel,
        });
      } catch (saveError) {
        await bucket.delete(uploadStream.id);
        res.status(500).json({ message: "Lỗi khi lưu thông tin model", error: saveError.message });
      }
    });

    uploadStream.on("error", (err) => {
      res.status(500).json({ message: "Lỗi khi đẩy file vào GridFS", error: err.message });
    });

  } catch (error) {
    console.error("Lỗi upload model:", error);
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

const getModelsByProduct = async (req, res) => {
  try {
    const { product_id } = req.params;
    const models = await ProductModel3D.find({ product_id }).populate("variant_id");
    res.status(200).json(models);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy model", error: error.message });
  }
};

const streamModelFile = async (req, res) => {
  try {
    const { file_id } = req.params;
    
    if (!mongoose.connection.db) {
       return res.status(500).json({ message: "Database connection not ready" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const fileId = new mongoose.Types.ObjectId(file_id);
    const files = await bucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File không tồn tại" });
    }

    if (files[0].filename.toLowerCase().endsWith(".glb")) {
      res.set("Content-Type", "model/gltf-binary");
    } else if (files[0].filename.toLowerCase().endsWith(".gltf")) {
      res.set("Content-Type", "model/gltf+json");
    } else {
      res.set("Content-Type", "application/octet-stream");
    }
    
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on("error", (err) => {
      res.status(404).json({ message: "Lỗi khi stream file" });
    });
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi stream model", error: error.message });
  }
};

const deleteModel3D = async (req, res) => {
  try {
    const { id } = req.params;
    const model = await ProductModel3D.findById(id);
    if (!model) {
      return res.status(404).json({ message: "Model không tồn tại trong DB" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    try {
        await bucket.delete(new mongoose.Types.ObjectId(model.file_id));
    } catch (e) {
        console.error("File already deleted from GridFS or error:", e.message);
    }

    await ProductModel3D.findByIdAndDelete(id);
    res.status(200).json({ message: "Đã xóa model 3D thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa model", error: error.message });
  }
};

const getAllModels = async (req, res) => {
  try {
    const models = await ProductModel3D.find()
      .populate({
        path: "product_id",
        select: "name price min_price thumbnail thumbnail_url size material category_id",
        populate: {
          path: "category_id",
          select: "name slug"
        }
      })
      .populate("variant_id");
    res.status(200).json(models);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách model", error: error.message });
  }
};

module.exports = {
  uploadModel3D,
  getModelsByProduct,
  streamModelFile,
  deleteModel3D,
  getAllModels,
};
