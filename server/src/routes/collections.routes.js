const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collection.controller');

const uploadImage = require('../middlewares/upload-image'); 

router.get('/', collectionController.getAllCollections);

router.post('/', uploadImage.single('banner'), collectionController.createCollection);
router.put('/:id', uploadImage.single('banner'), collectionController.updateCollection);
router.get('/:id/products', collectionController.getProductsByCollection);
router.delete('/:id', collectionController.deleteCollection);

module.exports = router;