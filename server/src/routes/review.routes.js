const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller')

// Lấy tất cả review
router.get('/', reviewController.getAllReviews);

// Cập nhật trạng thái (Duyệt bài)
router.patch('/:id/status', reviewController.updateReviewStatus);

// Phản hồi review
router.post('/:id/reply', reviewController.replyToReview);

module.exports = router;