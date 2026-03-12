const multer = require("multer");
const path = require("path");

// Sử dụng memoryStorage để nhận file vào buffer
// Sau đó chúng ta sẽ tự tay lưu vào GridFS trong controller
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Giới hạn 50MB cho file 3D
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".glb" && ext !== ".gltf") {
      return cb(new Error("Chỉ cho phép định dạng file .glb hoặc .gltf!"), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
