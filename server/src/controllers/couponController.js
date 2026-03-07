const Coupon = require('../models/Coupon');

// 1. Lấy tất cả mã khuyến mãi (Dùng cho trang Admin chính)
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách: " + error.message });
    }
};

// 2. Tạo mã mới
exports.createCoupon = async (req, res) => {
    try {
        const { code, discount_type, discount_value } = req.body;
        
        // Kiểm tra mã trùng
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) return res.status(400).json({ message: "Mã này đã tồn tại!" });

        // Logic bảo vệ: Nếu là giảm cố định thì max_discount_amount chính là giá trị giảm
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

// 3. Cập nhật mã (Ví dụ: gia hạn ngày hoặc tăng giới hạn lượt dùng)
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

// 4. Xóa mã
exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return res.status(404).json({ message: "Không tìm thấy mã" });
        res.status(200).json({ message: "Đã xóa mã khuyến mãi thành công" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi xóa: " + error.message });
    }
};