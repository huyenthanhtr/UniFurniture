const Collection = require('../models/Collection');
const slugify = require('slugify');

// Lấy tất cả bộ sưu tập
exports.getAllCollections = async (req, res) => {
    try {
        const collections = await Collection.find();
        res.status(200).json(collections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Tạo bộ sưu tập mới
exports.createCollection = async (req, res) => {
    try {
        const collectionData = { ...req.body };

        // KIỂM TRA: Nếu có file ảnh được tải lên (tên là 'banner')
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

// Cập nhật bộ sưu tập
exports.updateCollection = async (req, res) => {
    try {
        const collectionData = { ...req.body };

        // Nếu admin đổi tên, tự động cập nhật lại slug và url
        if (collectionData.name) {
            const newSlug = slugify(collectionData.name, { lower: true, strict: true });
            collectionData.slug = newSlug;
            collectionData.url = `/collections/${newSlug}`;
        }

        // KIỂM TRA: Nếu Admin tải lên một ảnh banner mới
        if (req.file) {
            collectionData.banner_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const updatedCollection = await Collection.findByIdAndUpdate(
            req.params.id, 
            collectionData, 
            { returnDocument: 'after' } // Trả về data mới nhất sau khi update
        );

        if (!updatedCollection) {
            return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        }

        res.status(200).json(updatedCollection);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Xóa bộ sưu tập
exports.deleteCollection = async (req, res) => {
    try {
        const deletedCollection = await Collection.findByIdAndDelete(req.params.id);
        if (!deletedCollection) return res.status(404).json({ message: 'Không tìm thấy bộ sưu tập' });
        res.status(200).json({ message: 'Xóa thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};