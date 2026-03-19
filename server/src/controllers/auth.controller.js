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
    // Vietnam: 84 -> 0
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

        // Generate OTP and OTP Hash
        const otp = generateOTP();
        const otp_hash = hashValue(otp);
        
        console.log(`[DEV] Generated OTP for ${phone}: ${otp}`);

        // HASH the password before saving to Otp
        const p_hash = password_hash ? hashValue(password_hash) : undefined;

        // Save registration payload into OTP table (Expires in 5 mins)
        await Otp.deleteMany({ phone });

        await Otp.create({
            phone,
            email: email || undefined,
            password_hash: p_hash,
            full_name,
            gender: gender || undefined,
            date_of_birth: date_of_birth || undefined,
            address: address || undefined,
            otp_hash, // Save OTP hash for local verification
            expireAt: new Date(Date.now() + 5 * 60 * 1000)
        });

        // Send OTP via basic Vonage SMS API
        const smsSent = await sendOtpSms(phone, otp);
        
        if (!smsSent) {
            console.error("SMS failed to send for phone:", phone);
            // We still return 201 but log the failure
        }

        return res.status(201).json({ message: "Yêu cầu đăng ký đã được gửi. Vui lòng nhập mã OTP gửi tới điện thoại của bạn." });

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
            return res.status(400).json({ message: "Số điện thoại và mã OTP là bắt buộc" });
        }

        // Hash incoming OTP for comparison
        const incoming_otp_hash = hashValue(otp);

        // Find OTP record by phone and hashed OTP
        const otpRecord = await Otp.findOne({ phone, otp_hash: incoming_otp_hash });

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

        // Delete OTP record since it's used
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

        // Find profile by email or phone
        const profile = await Profile.findOne({
            $or: [{ phone: emailOrPhone }, { email: emailOrPhone }]
        });

        if (!profile) {
            return res.status(404).json({ message: "Tài khoản không tồn tại." });
        }

        if (profile.account_status !== 'active') {
            return res.status(403).json({ message: "Tài khoản hiện đang bị khóa hoặc vô hiệu hóa." });
        }

        // Hash incoming password for comparison
        const incoming_hash = hashValue(password);

        // Check against both hashed and plain text (for old users)
        const isMatch = (incoming_hash === profile.password_hash) || (password === profile.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Mật khẩu sai. Vui lòng thử lại." });
        }

        // Optional: Auto-upgrade plain text passwords to hash
        if (password === profile.password_hash && incoming_hash !== profile.password_hash) {
            profile.password_hash = incoming_hash;
            await profile.save();
            console.log(`Auto-upgraded password to hash for user: ${emailOrPhone}`);
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
