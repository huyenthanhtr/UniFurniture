const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Review = require("../models/Review");
const PointTransaction = require("../models/PointTransaction");

const TIER_RULES = [
  { key: "dong", min: 0, max: 999, label: "Đồng" },
  { key: "bac", min: 1000, max: 4999, label: "Bạc" },
  { key: "vang", min: 5000, max: 14999, label: "Vàng" },
  { key: "kim_cuong", min: 15000, max: Number.POSITIVE_INFINITY, label: "Kim cương" },
];

function sanitizeMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function getTierByPoints(points) {
  const safe = Math.max(0, Math.floor(Number(points) || 0));
  return TIER_RULES.find((rule) => safe >= rule.min && safe <= rule.max) || TIER_RULES[0];
}

function getNextTier(points) {
  const safe = Math.max(0, Math.floor(Number(points) || 0));
  return TIER_RULES.find((rule) => rule.min > safe) || null;
}

function buildLoyaltySummary(lifetimePoints, estimatedPoints = 0) {
  const safeLifetime = Math.max(0, Math.floor(Number(lifetimePoints) || 0));
  const safeEstimated = Math.max(0, Math.floor(Number(estimatedPoints) || 0));
  const currentTier = getTierByPoints(safeLifetime);
  const nextTier = getNextTier(safeLifetime);

  return {
    loyalty_points_lifetime: safeLifetime,
    membership_tier: currentTier.key,
    membership_tier_label: currentTier.label,
    next_tier: nextTier?.key || null,
    next_tier_label: nextTier?.label || null,
    points_to_next_tier: nextTier ? Math.max(0, nextTier.min - safeLifetime) : 0,
    estimated_points_for_order: safeEstimated,
  };
}

const MEMBERSHIP_TIER_RANK = { dong: 1, bac: 2, vang: 3, kim_cuong: 4 };
const REVIEW_EARN_POINTS = 10;

function calculateEarnPointsFromOrderTotal(totalAmount) {
  const safeTotal = Math.max(0, Number(totalAmount || 0));
  return Math.max(0, Math.floor(safeTotal / 10000));
}

async function reconcileProfileCompletedOrders(profileId) {
  const profile = await Profile.findById(profileId).select("loyalty_points_lifetime membership_tier tier_achieved_at").lean();
  if (!profile) return null;

  const completedOrders = await Order.find({ account_id: profileId, status: "completed" })
    .select("_id total_amount")
    .lean();

  if (completedOrders.length) {
    const orderIds = completedOrders.map((order) => order._id);
    const existedTx = await PointTransaction.find({
      profile_id: profileId,
      order_id: { $in: orderIds },
      type: "earn",
    })
      .select("order_id")
      .lean();

    const existedOrderIdSet = new Set(existedTx.map((tx) => String(tx.order_id)));
    const missingTxDocs = completedOrders
      .filter((order) => !existedOrderIdSet.has(String(order._id)))
      .map((order) => ({
        profile_id: profileId,
        order_id: order._id,
        points: calculateEarnPointsFromOrderTotal(order.total_amount),
        type: "earn",
        note: "Backfill từ đơn hoàn tất",
      }))
      .filter((doc) => doc.points > 0);

    if (missingTxDocs.length) {
      try {
        await PointTransaction.insertMany(missingTxDocs, { ordered: false });
      } catch (error) {
        if (!/duplicate key/i.test(String(error?.message || ""))) {
          throw error;
        }
      }
    }
  }

  if (completedOrders.length) {
    const completedOrderIds = completedOrders.map((order) => order._id);
    const reviewableDetails = await OrderDetail.find({ order_id: { $in: completedOrderIds } })
      .select("_id order_id")
      .lean();

    if (reviewableDetails.length) {
      const detailIdSet = new Set(reviewableDetails.map((item) => String(item._id)));
      const reviews = await Review.find({ order_detail_id: { $in: Array.from(detailIdSet) } })
        .select("_id order_detail_id createdAt")
        .lean();

      if (reviews.length) {
        const existedReviewTx = await PointTransaction.find({
          profile_id: profileId,
          order_detail_id: { $in: Array.from(detailIdSet) },
          type: "review_earn",
        })
          .select("order_detail_id")
          .lean();

        const existedDetailSet = new Set(existedReviewTx.map((tx) => String(tx.order_detail_id)));
        const orderIdByDetailId = new Map(
          reviewableDetails.map((item) => [String(item._id), item.order_id])
        );

        const missingReviewTxDocs = reviews
          .filter((review) => !existedDetailSet.has(String(review.order_detail_id)))
          .map((review) => ({
            profile_id: profileId,
            order_id: orderIdByDetailId.get(String(review.order_detail_id)) || null,
            order_detail_id: review.order_detail_id,
            points: REVIEW_EARN_POINTS,
            type: "review_earn",
            note: "Backfill điểm đánh giá sản phẩm",
            createdAt: review.createdAt || new Date(),
            updatedAt: new Date(),
          }))
          .filter((doc) => doc.order_id);

        if (missingReviewTxDocs.length) {
          try {
            await PointTransaction.insertMany(missingReviewTxDocs, { ordered: false });
          } catch (error) {
            if (!/duplicate key/i.test(String(error?.message || ""))) {
              throw error;
            }
          }
        }
      }
    }
  }

  const pointsAgg = await PointTransaction.aggregate([
    {
      $match: {
        profile_id: new mongoose.Types.ObjectId(String(profileId)),
        type: { $in: ["earn", "review_earn"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$points" } } },
  ]);
  const totalPointsFromTransactions = Math.max(0, Math.floor(Number(pointsAgg?.[0]?.total || 0)));

  const currentLifetime = Math.max(0, Math.floor(Number(profile.loyalty_points_lifetime || 0)));
  const finalLifetime = Math.max(currentLifetime, totalPointsFromTransactions);
  const currentTier = String(profile.membership_tier || "dong");
  const nextTier = getTierByPoints(finalLifetime).key;
  const shouldUpgradeTier = (MEMBERSHIP_TIER_RANK[nextTier] || 1) > (MEMBERSHIP_TIER_RANK[currentTier] || 1);

  const patch = {};
  if (finalLifetime !== currentLifetime) {
    patch.loyalty_points_lifetime = finalLifetime;
  }
  if (shouldUpgradeTier) {
    patch.membership_tier = nextTier;
    patch.tier_achieved_at = new Date();
  } else if (!profile.tier_achieved_at) {
    patch.tier_achieved_at = new Date();
  }

  if (Object.keys(patch).length) {
    await Profile.updateOne({ _id: profileId }, { $set: patch });
  }

  return {
    loyalty_points_lifetime: finalLifetime,
    membership_tier: shouldUpgradeTier ? nextTier : currentTier,
    tier_achieved_at: patch.tier_achieved_at || profile.tier_achieved_at || null,
  };
}

async function getProfileLoyalty(req, res) {
  try {
    const profileId = String(req.params.profileId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: "profileId không hợp lệ." });
    }

    const profile = await reconcileProfileCompletedOrders(profileId);

    if (!profile) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    const summary = buildLoyaltySummary(profile.loyalty_points_lifetime, 0);
    return res.json({
      ...summary,
      tier_achieved_at: profile.tier_achieved_at || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Không thể tải thông tin tích điểm.", error: error.message });
  }
}

function estimatePoints(req, res) {
  try {
    const orderValue = sanitizeMoney(req.query?.orderValue);
    const points = Math.floor(orderValue / 10000);
    return res.json({ estimated_points_for_order: points });
  } catch (error) {
    return res.status(500).json({ message: "Không thể ước tính điểm.", error: error.message });
  }
}

module.exports = {
  TIER_RULES,
  getTierByPoints,
  getNextTier,
  buildLoyaltySummary,
  getProfileLoyalty,
  estimatePoints,
};
