const Category = require('../models/Category');
const slugify = require('slugify');

// Lấy tất cả danh mục
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Tạo danh mục mới
exports.createCategory = async (req, res) => {
    try {
        // Lấy tất cả dữ liệu (tên, mã, không gian...) từ form gửi lên
        const categoryData = { ...req.body };

        // KIỂM TRA: Nếu có file ảnh được upload qua Multer
        if (req.file) {
            // Tạo đường dẫn URL cho ảnh (Ví dụ: http://localhost:3000/uploads/category-123456.jpg)
            categoryData.image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const category = new Category(categoryData);
        const newCategory = await category.save();
        
        res.status(201).json(newCategory); 
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Cập nhật danh mục
exports.updateCategory = async (req, res) => {
    try {
        // Lấy dữ liệu gửi lên
        const categoryData = { ...req.body };

        // Nếu có đổi tên, ta tạo lại slug mới
        if (categoryData.name) {
            categoryData.slug = slugify(categoryData.name, { lower: true, strict: true });
        }

        // KIỂM TRA: Nếu Admin tải lên một ảnh mới để thay thế ảnh cũ
        if (req.file) {
            categoryData.image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id, 
            categoryData, 
            { returnDocument: 'after'} // Option này giúp mongoose trả về dữ liệu MỚI sau khi đã update
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Không tìm thấy danh mục' });
        }

        res.status(200).json(updatedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Xóa danh mục
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