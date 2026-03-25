const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
    category_code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    description: { type: String },
    image_url: { type: String },
    room: { 
        type: String, 
        enum: ['Phòng khách', 'Phòng ăn', 'Phòng ngủ', 'Phòng làm việc'],
        required: false
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

categorySchema.pre('save', function(next) {
    if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
});

module.exports = mongoose.model('Category', categorySchema);