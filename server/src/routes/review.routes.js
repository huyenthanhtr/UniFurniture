const express = require('express');

const router = express.Router();
const reviewController = require('../controllers/review.controller');
const uploadReviewMedia = require('../middlewares/upload-review-media');

router.post('/media', uploadReviewMedia.array('files', 10), reviewController.uploadReviewMedia);
router.post('/', reviewController.createOrderReviews);
router.get('/order/:orderId/status', reviewController.getOrderReviewStatus);
router.get('/featured', reviewController.getFeaturedReviews);
router.get('/product/:productId', reviewController.getApprovedReviewsByProduct);
router.get('/', reviewController.getAllReviews);
router.patch('/:id/status', reviewController.updateReviewStatus);
router.post('/:id/reply', reviewController.replyToReview);

module.exports = router;

