require("dotenv").config();
const connectDB = require("../configs/db");
const { rebuildSoldCounts } = require("../utils/rebuild-sold-counts");

async function main() {
  await connectDB();
  const result = await rebuildSoldCounts();
  console.log("Rebuilt sold counts:", result);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to rebuild sold counts:", error);
  process.exit(1);
});
