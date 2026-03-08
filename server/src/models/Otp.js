const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
    {
        phone: { type: String, required: true, index: true },
        email: { type: String, required: true },
        password_hash: { type: String, required: true },
        full_name: { type: String, required: true },
        gender: { type: String, enum: ["male", "female", "other"], required: true },
        date_of_birth: { type: Date, required: true },
        address: { type: String, required: true },
        otp_hash: { type: String, required: true },
        expireAt: { type: Date, required: true, expires: 0 },
    },
    { timestamps: true, collection: "otps" }
);

module.exports = mongoose.model("Otp", OtpSchema, "otps");
