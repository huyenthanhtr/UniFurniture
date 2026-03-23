const express = require("express");
const {
  listWishlist,
  upsertWishlistItem,
  removeWishlistItem,
} = require("../controllers/wishlist.controller");

const router = express.Router();

router.get('/profiles/:profileId', listWishlist);
router.post('/profiles/:profileId/items', upsertWishlistItem);
router.delete('/profiles/:profileId/items/:productId', removeWishlistItem);

module.exports = router;
