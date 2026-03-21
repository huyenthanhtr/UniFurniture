require("dotenv").config();
const connectDB = require("../configs/db");
const { reconcileCompletedOrdersWithPayments } = require("../utils/reconcile-completed-orders");
const { rebuildSoldCounts } = require("../utils/rebuild-sold-counts");

async function main() {
  await connectDB();
  const result = await reconcileCompletedOrdersWithPayments();
  await rebuildSoldCounts();
  console.log("Reconciled completed orders:", result);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to reconcile completed orders:", error);
  process.exit(1);
});
