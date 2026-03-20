const Order = require("../models/Order");
const OrderDetail = require("../models/OrderDetail");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const { recalculateProductAggregates } = require("./product-aggregate");

async function rebuildSoldCounts() {
  await ProductVariant.updateMany({}, { $set: { sold: 0 } });
  await Product.updateMany({}, { $set: { sold: 0 } });

  const completedOrders = await Order.find({ status: "completed" }).select({ _id: 1 }).lean();
  const completedOrderIds = completedOrders.map((order) => order._id);

  if (!completedOrderIds.length) {
    await Order.updateMany({}, { $set: { sold_counted: false, sold_counted_at: null } });
    return {
      completedOrders: 0,
      updatedVariants: 0,
      updatedProducts: 0,
    };
  }

  const summaries = await OrderDetail.aggregate([
    { $match: { order_id: { $in: completedOrderIds } } },
    {
      $group: {
        _id: "$variant_id",
        sold: { $sum: { $max: [{ $toDouble: "$quantity" }, 0] } },
      },
    },
  ]);

  const touchedProductIds = new Set();
  let updatedVariants = 0;

  for (const summary of summaries) {
    if (!summary?._id) continue;

    const variant = await ProductVariant.findByIdAndUpdate(
      summary._id,
      { $set: { sold: Number(summary.sold || 0) } },
      { returnDocument: "after" }
    ).lean();

    if (!variant) continue;
    updatedVariants += 1;

    if (variant.product_id) {
      touchedProductIds.add(String(variant.product_id));
    }
  }

  await Order.updateMany(
    { status: "completed" },
    { $set: { sold_counted: true }, $currentDate: { sold_counted_at: true } }
  );
  await Order.updateMany(
    { status: { $ne: "completed" } },
    { $set: { sold_counted: false, sold_counted_at: null } }
  );

  for (const productId of touchedProductIds) {
    await recalculateProductAggregates(productId);
  }

  return {
    completedOrders: completedOrderIds.length,
    updatedVariants,
    updatedProducts: touchedProductIds.size,
  };
}

module.exports = {
  rebuildSoldCounts,
};
