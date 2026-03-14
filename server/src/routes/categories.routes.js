const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Import "người thủ kho" xử lý ảnh bạn đã tạo
const uploadImage = require('../middlewares/upload-image'); 

// GET không cần upload ảnh
router.get('/', categoryController.getAllCategories);

// POST và PUT phải kẹp uploadImage.single('image') VÀO GIỮA như thế này:
router.post('/', uploadImage.single('image'), categoryController.createCategory);
router.put('/:id', uploadImage.single('image'), categoryController.updateCategory);

router.delete('/:id', categoryController.deleteCategory);

module.exports = router;