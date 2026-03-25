const Category = require('../models/Category');
const slugify = require('slugify');
const Product = require('../models/Product');
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const categoryData = { ...req.body };

        if (req.file) {
            categoryData.image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const category = new Category(categoryData);
        const newCategory = await category.save();
        
        res.status(201).json(newCategory); 
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const categoryData = { ...req.body };

        if (categoryData.name) {
            categoryData.slug = slugify(categoryData.name, { lower: true, strict: true });
        }

        if (req.file) {
            categoryData.image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id, 
            categoryData, 
            { returnDocument: 'after'}
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục' });
        }

        res.status(200).json(updatedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);
        
        if (!deletedCategory) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục để xóa' });
        }

        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
        const products = await Product.find({ category_id: id })
        .select('name sku brand thumbnail thumbnail_url price status slug')
        .sort({ createdAt: -1 });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};