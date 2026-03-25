const mongoose = require('mongoose');
const slugify = require('slugify');

const collectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    url: { type: String, unique: true },
    description: { type: String },
    banner_url: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

collectionSchema.pre('save', function() {
    if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true });
        this.url = `/collections/${this.slug}`;
    }
});

module.exports = mongoose.model('Collection', collectionSchema);