const mongoose = require("mongoose");

const UserRecommendationSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
        recommended_slug: { type: String, required: true },
        score: { type: Number, required: true },
        type: { type: String, enum: ["user-based"], default: "user-based" }
    },
    { timestamps: true, collection: "user_recommendations" }
);

UserRecommendationSchema.index({ user_id: 1, score: -1 });

module.exports = mongoose.model("UserRecommendation", UserRecommendationSchema, "user_recommendations");
