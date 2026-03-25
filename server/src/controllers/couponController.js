const Coupon = require('../models/Coupon');

exports.getAllCoupons = async (req, res) => {
    try {
        const now = new Date();
        await Coupon.updateMany(
            { end_at: { $lt: now }, status: { $ne: 'expired' } },
            { $set: { status: 'expired' } }
        );

        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống: " + error.message });
    }
};
exports.createCoupon = async (req, res) => {
    try {
        const { code, discount_type, discount_value } = req.body;
        
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) return res.status(400).json({ message: "Mã này đã tồn tại!" });

        let finalData = { ...req.body };
        if (discount_type === 'fixed') {
            finalData.max_discount_amount = discount_value;
        }

        const newCoupon = new Coupon(finalData);
        await newCoupon.save();
        res.status(201).json(newCoupon);
    } catch (error) {
        res.status(400).json({ message: "Dữ liệu không hợp lệ: " + error.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedCoupon) return res.status(404).json({ message: "Không tìm thấy mã" });
        res.status(200).json(updatedCoupon);
    } catch (error) {
        res.status(400).json({ message: "Cập nhật thất bại: " + error.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return res.status(404).json({ message: "Không tìm thấy mã" });
        res.status(200).json({ message: "Đã xóa mã khuyến mãi thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa: " + error.message });
    }
};