const multer = require('multer');
const path = require('path');

// Cấu hình nơi lưu trữ và tên file cho ẢNH
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Lưu vào thư mục uploads ở root
    },
    filename: function (req, file, cb) {
        // Đặt tên file: category - thời gian - chuỗi ngẫu nhiên . đuôi_file
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'category-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});

// Lọc file (Chỉ cho phép định dạng ảnh)
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
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn ảnh 5MB cho nhẹ server
});

module.exports = uploadImage;