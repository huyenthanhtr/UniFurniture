const mongoose = require('mongoose');
const slugify = require('slugify');

const collectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    url: { type: String, unique: true }, // Đường dẫn trên web (Ví dụ: /collections/kline)
    description: { type: String },
    banner_url: { type: String }, // Dùng banner_url thay vì image_url
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

// Tự động tạo slug và url từ name trước khi lưu (Không dùng next() để tránh lỗi)
collectionSchema.pre('save', function() {
    if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true });
        this.url = `/collections/${this.slug}`; // Tự động nối thêm chữ /collections/ phía trước
    }
});

module.exports = mongoose.model('Collection', collectionSchema);