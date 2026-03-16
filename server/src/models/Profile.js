const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true, enum: ["customer", "admin", "staff"], default: "customer" },
    account_status: { type: String, required: true, enum: ["active", "inactive", "banned"], default: "active" },
    full_name: { type: String, required: true },
    avatar_url: { type: String, default: null },
    gender: { type: String, enum: ["male", "female", "other"] },
    date_of_birth: { type: Date },
    address: { type: String },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null }
  },
  { timestamps: true, collection: "profiles" }
);

module.exports = mongoose.model("Profile", ProfileSchema, "profiles");