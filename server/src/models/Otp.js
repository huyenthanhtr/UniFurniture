const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
    {
        phone: { type: String, required: true, index: true },
        email: { type: String },
        password_hash: { type: String, required: true },
        full_name: { type: String, required: true },
        gender: { type: String, enum: ["male", "female", "other"] },
        date_of_birth: { type: Date },
        address: { type: String },
        otp_hash: { type: String, required: false }, // Make optional for Verify API
        requestId: { type: String }, // For Vonage Verify API
        expireAt: { type: Date, required: true, expires: 0 },
    },
    { timestamps: true, collection: "otps" }
);

module.exports = mongoose.model("Otp", OtpSchema, "otps");
