const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

const uploadImage = require('../middlewares/upload-image'); 

router.get('/', categoryController.getAllCategories);
router.get('/:id/products', categoryController.getProductsByCategory);

router.post('/', uploadImage.single('image'), categoryController.createCategory);
router.put('/:id', uploadImage.single('image'), categoryController.updateCategory);

router.delete('/:id', categoryController.deleteCategory);

module.exports = router;