const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../configs/db");
const Profile = require("../models/Profile");
const PointTransaction = require("../models/PointTransaction");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Review = require("../models/Review");
const { buildLoyaltySnapshot, getLoyaltyRankByKey, normalizePoints, LOYALTY_RANK_PRIORITY } = require("../utils/loyalty");

async function run() {
  await connectDB();

  const profiles = await Profile.find({ role: "customer" }).select({ _id: 1, customer_id: 1 }).lean();
  const profileIds = profiles.map((profile) => profile._id);

  const totals = await PointTransaction.aggregate([
    { $match: { profile_id: { $in: profileIds }, type: { $in: ["earn", "review_earn"] } } },
    {
      $group: {
        _id: "$profile_id",
        lifetime_points: { $sum: { $max: ["$points", 0] } },
      },
    },
  ]);

  const totalsMap = new Map(
    totals.map((item) => [String(item._id), normalizePoints(item.lifetime_points)])
  );

  let updatedProfiles = 0;
  for (const profile of profiles) {
    const points = totalsMap.get(String(profile._id)) || 0;
    const snapshot = buildLoyaltySnapshot(points);
    const currentProfile = await Profile.findById(profile._id)
      .select({ membership_tier: 1, tier_achieved_at: 1 })
      .lean();
    const currentRankKey = String(currentProfile?.membership_tier || "dong");
    const nextRank = getLoyaltyRankByKey(snapshot.loyalty_rank);
    const currentRank = getLoyaltyRankByKey(currentRankKey);
    const shouldUpgradeTier =
      (LOYALTY_RANK_PRIORITY[nextRank.key] || 1) > (LOYALTY_RANK_PRIORITY[currentRank.key] || 1);

    const patch = {
      loyalty_points_lifetime: snapshot.loyalty_points,
    };
    if (shouldUpgradeTier) {
      patch.membership_tier = nextRank.key;
      patch.tier_achieved_at = new Date();
    } else if (!currentProfile?.tier_achieved_at) {
      patch.tier_achieved_at = new Date();
    }

    await Profile.updateOne(
      { _id: profile._id },
      {
        $set: patch,
      }
    );
    updatedProfiles += 1;
  }

  await Customer.updateMany(
    {},
    { $unset: { loyalty_points: "", loyalty_rank: "", loyalty_updated_at: "" } }
  );
  await Order.updateMany(
    {},
    { $unset: { loyalty_points_awarded: "", loyalty_points_awarded_at: "" } }
  );
  await Review.updateMany(
    {},
    { $unset: { loyalty_points_awarded: "", loyalty_points_awarded_at: "" } }
  );

  console.log(JSON.stringify({ updatedProfiles }, null, 2));
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Failed to sync profile loyalty:", error);
  await mongoose.connection.close();
  process.exit(1);
});
