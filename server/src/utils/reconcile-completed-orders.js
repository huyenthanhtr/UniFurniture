const Order = require("../models/Order");
const Payment = require("../models/Payment");

function getExpectedDepositAmount(totalAmount, depositAmount) {
  const total = Math.max(Number(totalAmount || 0), 0);
  const explicitDeposit = Math.max(Number(depositAmount || 0), 0);
  if (explicitDeposit > 0) return explicitDeposit;
  return total >= 10000000 ? Math.round(total * 0.1) : 0;
}

function isOrderFullySettled(orderDoc, orderPayments = []) {
  const paidPayments = orderPayments.filter((payment) => String(payment?.status || "").toLowerCase() === "paid");
  const paidTotal = paidPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
  const totalAmount = Math.max(Number(orderDoc?.total_amount || 0), 0);
  const depositAmount = getExpectedDepositAmount(orderDoc?.total_amount, orderDoc?.deposit_amount);
  const depositPaidTotal = paidPayments
    .filter((payment) => String(payment?.type || "").toLowerCase() === "deposit")
    .reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);

  if (depositAmount > 0 && depositPaidTotal < depositAmount) {
    return false;
  }

  return totalAmount > 0 && paidTotal >= totalAmount;
}

async function reconcileCompletedOrdersWithPayments() {
  const completedOrders = await Order.find({ status: "completed" }).lean();
  if (!completedOrders.length) {
    return { checked: 0, downgraded: 0, orderCodes: [] };
  }

  const orderIds = completedOrders.map((order) => order._id);
  const payments = await Payment.find({ order_id: { $in: orderIds } }).lean();
  const paymentsByOrderId = new Map();

  for (const payment of payments) {
    const key = String(payment?.order_id || "");
    if (!paymentsByOrderId.has(key)) paymentsByOrderId.set(key, []);
    paymentsByOrderId.get(key).push(payment);
  }

  const invalidOrders = completedOrders.filter((order) => {
    const orderPayments = paymentsByOrderId.get(String(order?._id || "")) || [];
    return !isOrderFullySettled(order, orderPayments);
  });

  if (!invalidOrders.length) {
    return { checked: completedOrders.length, downgraded: 0, orderCodes: [] };
  }

  const invalidOrderIds = invalidOrders.map((order) => order._id);
  await Order.updateMany(
    { _id: { $in: invalidOrderIds } },
    {
      $set: {
        status: "delivered",
        sold_counted: false,
        sold_counted_at: null,
        "warranty.activated_at": null,
        "warranty.expires_at": null,
      },
    }
  );

  return {
    checked: completedOrders.length,
    downgraded: invalidOrders.length,
    orderCodes: invalidOrders.map((order) => String(order?.order_code || order?._id || "")),
  };
}

module.exports = {
  reconcileCompletedOrdersWithPayments,
};
