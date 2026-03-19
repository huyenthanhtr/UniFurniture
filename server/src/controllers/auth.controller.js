const crypto = require("crypto");
const Profile = require("../models/Profile");
const Otp = require("../models/Otp");
const { sendOtpSms } = require("../utils/sms.utils");
const mongoose = require("mongoose");

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

function hashValue(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePhone(phone) {
    if (!phone) return phone;
    let p = phone.replace(/\s+/g, '').replace('+', '');
    if (p.startsWith('84') && p.length >= 11) {
        return '0' + p.substring(2);
    }
    return p;
}

async function register(req, res) {
    try {
        let { phone, email, password_hash, full_name, gender, date_of_birth, address } = req.body;
        phone = normalizePhone(phone);

        // Check if phone or email already exists in ACTIVE profiles
        const query = [{ phone }];
        if (email) {
            query.push({ email });
        }
        const existingProfile = await Profile.findOne({ $or: query });
        if (existingProfile) {
            return res.status(400).json({ message: "Phone or email already registered." });
        }

        // Generate OTP
        const otp = generateOTP();
        const otp_hash = hashValue(otp);

        // Save registration payload directly into OTP table (Expires in 5 mins)
        await Otp.deleteMany({ phone });

        await Otp.create({
            phone,
            email: email || undefined,
            password_hash: password_hash || undefined,
            full_name,
            gender: gender || undefined,
            date_of_birth: date_of_birth || undefined,
            address: address || undefined,
            otp_hash,
            expireAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        // Send SMS
        const smsSent = await sendOtpSms(phone, otp);
        if (!smsSent) {
            console.error("SMS failed to send for phone:", phone);
        }

        return res.status(201).json({ message: "Registration initiated. Please verify the OTP sent to your phone." });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
}

async function verifyOtp(req, res) {
    try {
        let { phone, otp } = req.body;
        phone = normalizePhone(phone);

        if (!phone || !otp) {
            return res.status(400).json({ message: "Phone and OTP are required" });
        }

        const otp_hash = hashValue(otp);

        // Find OTP record
        const otpRecord = await Otp.findOne({ phone, otp_hash });

        if (!otpRecord) {
            return res.status(400).json({ message: "Lỗi: Mã OTP không hợp lệ hoặc đã hết hạn." });
        }
        let newProfile = new Profile({
            phone: otpRecord.phone,
            email: otpRecord.email || undefined,
            password_hash: otpRecord.password_hash || undefined,
            full_name: otpRecord.full_name,
            gender: otpRecord.gender || undefined,
            date_of_birth: otpRecord.date_of_birth || undefined,
            address: otpRecord.address || undefined,
            account_status: "active",
            role: "customer"
        });
        await newProfile.save();

        await Otp.findByIdAndDelete(otpRecord._id);

        return res.status(200).json({ message: "Đăng ký thành công! Đang chuyển sang màn hình OTP...", profile: newProfile });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "OTP verification failed", error: err.message });
    }
}

async function login(req, res) {
    try {
        let { emailOrPhone, password } = req.body;
        emailOrPhone = normalizePhone(emailOrPhone);

        if (!emailOrPhone || !password) {
            return res.status(400).json({ message: "Information required" });
        }

        const profile = await Profile.findOne({
            $or: [{ phone: emailOrPhone }, { email: emailOrPhone }]
        });

        if (!profile) {
            return res.status(404).json({ message: "Tài khoản không tồn tại." });
        }

        if (profile.account_status !== 'active') {
            return res.status(403).json({ message: "Tài khoản hiện đang bị khóa hoặc vô hiệu hóa." });
        }

        const inputHash = hashValue(password);

        if (inputHash !== profile.password_hash) {
            return res.status(401).json({ message: "Mật khẩu sai. Vui lòng thử lại." });
        }

        return res.status(200).json({ message: "Đăng nhập thành công", profile });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Login failed", error: err.message });
    }
}
module.exports = {
    register,
    verifyOtp,
    login
};
