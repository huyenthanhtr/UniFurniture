const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'category-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ hỗ trợ tải lên các định dạng hình ảnh!'), false);
    }
};

const uploadImage = multer({ 
    storage: storage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = uploadImage;