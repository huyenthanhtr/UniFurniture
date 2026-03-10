const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema(
    {
        product_slug: { type: String, required: true },
        recommended_slug: { type: String, required: true },
        score: { type: Number, required: true }
    },
    {
        timestamps: true
    }
);

RecommendationSchema.index({ product_slug: 1 });
RecommendationSchema.index({ score: -1 });

const Recommendation = mongoose.model('Recommendation', RecommendationSchema, 'recommendations');

module.exports = Recommendation;
