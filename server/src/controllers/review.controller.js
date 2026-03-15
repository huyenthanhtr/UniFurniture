const Review = require('../models/Review');

// Lấy danh sách đánh giá (Cho Admin)
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      // 1. Nhánh lấy thông tin Khách hàng (Customer)
      .populate('customer_id', 'customer_code full_name phone') 
      // 2. Nhánh lấy thông tin Đơn hàng & Sản phẩm (Order & OrderDetail)
      .populate({
        path: 'order_detail_id',
        select: 'product_name order_id',
        populate: {
          path: 'order_id',
          select: 'order_code shipping_name shipping_email'
        }
      })
      .sort({ createdAt: -1 }); // Sắp xếp đánh giá mới nhất lên đầu

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Duyệt hoặc Từ chối đánh giá
exports.updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' hoặc 'rejected'
    const updatedReview = await Review.findByIdAndUpdate(id, { status }, { new: true });
    res.status(200).json(updatedReview);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Admin phản hồi đánh giá
exports.replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      id, 
      { reply: { content, repliedAt: new Date() } }, 
      { new: true }
    );
    res.status(200).json(updatedReview);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};