const Review = require('../models/Review');

function toPublicAssetUrl(req, value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return `${req.protocol}://${req.get('host')}${raw}`;
  }

  return raw;
}

exports.getApprovedReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ status: 'approved' })
      .populate('customer_id', 'full_name')
      .populate({
        path: 'order_detail_id',
        select: 'product_name variant_id order_id',
        populate: [
          {
            path: 'variant_id',
            select: 'product_id',
          },
          {
            path: 'order_id',
            select: 'shipping_name order_code',
          },
        ],
      })
      .sort({ createdAt: -1 });

    const matchedReviews = reviews
      .filter((review) => String(review.order_detail_id?.variant_id?.product_id || '') === String(productId))
      .map((review) => ({
        _id: review._id,
        rating: review.rating,
        content: review.content,
        images: Array.isArray(review.images) ? review.images.map((image) => toPublicAssetUrl(req, image)).filter(Boolean) : [],
        reply: review.reply?.content
          ? {
              content: review.reply.content,
              repliedAt: review.reply.repliedAt || null,
            }
          : null,
        createdAt: review.createdAt,
        customerName:
          review.customer_id?.full_name ||
          review.order_detail_id?.order_id?.shipping_name ||
          'Khach hang da mua',
        productName: review.order_detail_id?.product_name || '',
      }));

    const totalReviews = matchedReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((matchedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews).toFixed(1))
        : 0;

    res.status(200).json({
      productId,
      totalReviews,
      averageRating,
      items: matchedReviews,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('customer_id', 'customer_code full_name phone')
      .populate({
        path: 'order_detail_id',
        select: 'product_name order_id',
        populate: {
          path: 'order_id',
          select: 'order_code shipping_name shipping_email',
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(id, { status }, { new: true });
    res.status(200).json(updatedReview);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const updatedReview = await Review.findByIdAndUpdate(
      id,
      { reply: { content, repliedAt: new Date() } },
      { new: true },
    );
    res.status(200).json(updatedReview);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
