const Collection = require('../models/Collection');
const slugify = require('slugify');
const Product = require('../models/Product')
const mongoose = require('mongoose');

exports.getProductsByCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const conditions = [];

    if (mongoose.Types.ObjectId.isValid(id)) {
      conditions.push({ collection_id: new mongoose.Types.ObjectId(id) });
    }

    conditions.push({ collection_id: id });

    const products = await Product.find({
      $or: conditions
    }).lean();

    res.json({
      items: products,
      total: products.length
    });
  } catch (error) {
    console.error('Lỗi lấy sản phẩm theo collection:', error);
    res.status(500).json({
      message: 'Không thể lấy sản phẩm thuộc bộ sưu tập'
    });
  }
};
exports.getAllCollections = async (req, res) => {
    try {
        const collections = await Collection.find();
        res.status(200).json(collections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createCollection = async (req, res) => {
    try {
        const collectionData = { ...req.body };

        if (req.file) {
            collectionData.banner_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const collection = new Collection(collectionData);
        const newCollection = await collection.save();
        
        res.status(201).json(newCollection); 
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCollection = async (req, res) => {
    try {
        const collectionData = { ...req.body };

        if (collectionData.name) {
            const newSlug = slugify(collectionData.name, { lower: true, strict: true });
            collectionData.slug = newSlug;
            collectionData.url = `/collections/${newSlug}`;
        }

        if (req.file) {
            collectionData.banner_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const updatedCollection = await Collection.findByIdAndUpdate(
            req.params.id, 
            collectionData, 
            { returnDocument: 'after' }
        );

        if (!updatedCollection) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        }

        res.status(200).json(updatedCollection);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCollection = async (req, res) => {
    try {
        const deletedCollection = await Collection.findByIdAndDelete(req.params.id);
        if (!deletedCollection) return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        res.status(200).json({ message: 'Xóa thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};