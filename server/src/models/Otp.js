const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
    {
        phone: { type: String, required: true, index: true },
        email: { type: String },
        password_hash: { type: String },
        full_name: { type: String },
        gender: { type: String, enum: ["male", "female", "other"] },
        date_of_birth: { type: Date },
        address: { type: String },
        otp_hash: { type: String, required: false },
        requestId: { type: String },
        type: { type: String, enum: ["register", "reset"], default: "register" },
        expireAt: { type: Date, required: true, expires: 0 },
    },
    { timestamps: true, collection: "otps" }
);

module.exports = mongoose.model("Otp", OtpSchema, "otps");
