const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const OrderDetail = require('../models/OrderDetail');

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


exports.uploadReviewMedia = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];

    const urls = files.map((file) => `/uploads/reviews/${file.filename}`);
    const images = files
      .filter((file) => String(file.mimetype || '').startsWith('image/'))
      .map((file) => `/uploads/reviews/${file.filename}`);
    const videos = files
      .filter((file) => String(file.mimetype || '').startsWith('video/'))
      .map((file) => `/uploads/reviews/${file.filename}`);

    return res.status(200).json({
      urls,
      images,
      videos,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createOrderReviews = async (req, res) => {
  try {
    const { orderId, reviews } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
      return res.status(400).json({ message: 'orderId is invalid' });
    }

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ message: 'reviews is required' });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!['delivered', 'completed'].includes(String(order.status || '').toLowerCase())) {
      return res.status(400).json({ message: 'Order status does not allow review' });
    }

    const orderDetails = await OrderDetail.find({ order_id: orderId }).lean();
    const detailMap = new Map(orderDetails.map((item) => [String(item._id), item]));

    const incomingDetailIds = reviews
      .map((item) => String(item?.order_detail_id || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (!incomingDetailIds.length) {
      return res.status(400).json({ message: 'No valid order_detail_id found' });
    }

    const existingReviews = await Review.find({ order_detail_id: { $in: incomingDetailIds } })
      .select({ _id: 1, order_detail_id: 1 })
      .lean();

    if (existingReviews.length > 0) {
      return res.status(409).json({
        message: 'Đơn hàng này đã được đánh giá trước đó, không thể đánh giá lại.',
        reviewedDetailIds: existingReviews.map((item) => String(item.order_detail_id || '')),
      });
    }

    const created = [];

    for (const item of reviews) {
      const detailId = String(item?.order_detail_id || '');
      const rating = Number(item?.rating || 0);
      const content = String(item?.content || '').trim();
      const images = Array.isArray(item?.images)
        ? item.images.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const videos = Array.isArray(item?.videos)
        ? item.videos.map((x) => String(x || '').trim()).filter(Boolean)
        : [];

      if (!mongoose.Types.ObjectId.isValid(detailId)) {
        continue;
      }

      const detailDoc = detailMap.get(detailId);
      if (!detailDoc) {
        continue;
      }

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        continue;
      }

      const payload = {
        order_detail_id: detailId,
        customer_id: order.customer_id || null,
        rating,
        content: content || 'Khách hàng đã để lại đánh giá.',
        images,
        videos,
        status: 'pending',
      };

      const doc = await Review.create(payload);
      created.push(doc._id);
    }

    return res.status(201).json({
      message: 'Reviews submitted',
      createdCount: created.length,
      createdIds: created,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getOrderReviewStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
      return res.status(400).json({ message: 'orderId is invalid' });
    }

    const orderDetails = await OrderDetail.find({ order_id: orderId }).select({ _id: 1 }).lean();
    const detailIds = orderDetails.map((item) => String(item._id || '')).filter(Boolean);

    if (!detailIds.length) {
      return res.status(200).json({ orderId, reviewedDetailIds: [], hasReviewed: false, items: [] });
    }

    const existed = await Review.find({ order_detail_id: { $in: detailIds } })
      .select({ order_detail_id: 1, rating: 1, content: 1, images: 1, videos: 1, status: 1, createdAt: 1 })
      .lean();

    const reviewedDetailIds = existed.map((item) => String(item.order_detail_id || '')).filter(Boolean);
    const items = existed.map((item) => ({
      order_detail_id: String(item.order_detail_id || ''),
      rating: Number(item.rating || 0),
      content: String(item.content || ''),
      images: Array.isArray(item.images) ? item.images.map((image) => toPublicAssetUrl(req, image)).filter(Boolean) : [],
      videos: Array.isArray(item.videos) ? item.videos.map((video) => toPublicAssetUrl(req, video)).filter(Boolean) : [],
      status: String(item.status || 'pending'),
      createdAt: item.createdAt || null,
    }));

    return res.status(200).json({
      orderId,
      reviewedDetailIds,
      hasReviewed: reviewedDetailIds.length > 0,
      items,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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
        videos: Array.isArray(review.videos) ? review.videos.map((video) => toPublicAssetUrl(req, video)).filter(Boolean) : [],
        reply: review.reply?.content
          ? {
              content: review.reply.content,
              repliedAt: review.reply.repliedAt || null,
            }
          : null,
        createdAt: review.createdAt,
        customerName:
          review.order_detail_id?.order_id?.shipping_name ||
          review.customer_id?.full_name ||
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
        select: 'product_name order_id variant_id', // Thêm variant_id để lấy ảnh
        populate: [
          {
            path: 'order_id',
            select: 'order_code shipping_name shipping_email',
          },
          {
            path: 'variant_id',
            select: 'image product_id',
            populate: {
              path: 'product_id',
              select: 'thumbnail_url thumbnail'
            }
          }
        ]
      })
      .sort({ createdAt: -1 });

    const normalized = reviews.map((review) => {
      // Tìm ảnh sản phẩm từ biến thể (variant) hoặc sản phẩm gốc (product)
      let productImageUrl = '';
      if (review.order_detail_id?.variant_id) {
        const variant = review.order_detail_id.variant_id;
        if (variant.image) {
          productImageUrl = variant.image;
        } else if (variant.product_id) {
          const prod = variant.product_id;
          productImageUrl = prod.thumbnail_url || prod.thumbnail || '';
        }
      }

      return {
        ...review.toObject(),
        productImageUrl: toPublicAssetUrl(req, productImageUrl), // Trả về frontend
        images: Array.isArray(review.images)
          ? review.images.map((image) => toPublicAssetUrl(req, image)).filter(Boolean)
          : [],
        videos: Array.isArray(review.videos)
          ? review.videos.map((video) => toPublicAssetUrl(req, video)).filter(Boolean)
          : [],
      };
    });

    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFeaturedReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'approved', rating: 5 })
      .populate('customer_id', 'full_name')
      .populate({
        path: 'order_detail_id',
        select: 'product_name variant_id',
        populate: {
          path: 'variant_id',
          select: 'image product_id',
          populate: {
            path: 'product_id',
            select: 'thumbnail_url thumbnail slug'
          }
        }
      })
      .sort({ createdAt: -1 })
      .limit(10); // get top 10

    const normalized = reviews.map((review) => {
      // Find a product image URL
      let productImageUrl = '';
      let productSlug = '';
      let productId = '';

      if (review.order_detail_id?.variant_id) {
        const variant = review.order_detail_id.variant_id;
        if (variant.image) {
          productImageUrl = variant.image;
        }
        
        if (variant.product_id) {
          const prod = variant.product_id;
          productId = String(prod._id || '');
          productSlug = prod.slug || '';
          if (!productImageUrl) {
            productImageUrl = prod.thumbnail_url || prod.thumbnail || '';
          }
        }
      }

      return {
        _id: review._id,
        rating: review.rating,
        content: review.content,
        customerName: review.customer_id?.full_name || 'Khách Hàng Ẩn Danh',
        productName: review.order_detail_id?.product_name || '',
        productImageUrl: toPublicAssetUrl(req, productImageUrl),
        productSlug: productSlug,
        productId: productId,
        images: Array.isArray(review.images) ? review.images.map((image) => toPublicAssetUrl(req, image)).filter(Boolean) : [],
        createdAt: review.createdAt,
      };
    });

    res.status(200).json(normalized);
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
