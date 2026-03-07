const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

router.get('/', couponController.getAllCoupons);          // GET /api/coupons
router.post('/', couponController.createCoupon);         // POST /api/coupons
router.put('/:id', couponController.updateCoupon);       // PUT /api/coupons/:id
router.delete('/:id', couponController.deleteCoupon);    // DELETE /api/coupons/:id

module.exports = router;