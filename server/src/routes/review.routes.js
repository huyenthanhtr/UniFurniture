const express = require('express');

const router = express.Router();
const reviewController = require('../controllers/review.controller');

router.get('/product/:productId', reviewController.getApprovedReviewsByProduct);
router.get('/', reviewController.getAllReviews);
router.patch('/:id/status', reviewController.updateReviewStatus);
router.post('/:id/reply', reviewController.replyToReview);

module.exports = router;
