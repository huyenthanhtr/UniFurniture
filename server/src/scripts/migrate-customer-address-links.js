require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../configs/db");
const CustomerAddress = require("../models/CustomerAddress");
const Customer = require("../models/Customer");
const Profile = require("../models/Profile");

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

async function resolveCustomerIdForAddress(address, customerMapById, customerMapByPhone, profileMapById, profileMapByPhone) {
  const currentId = String(address.customer_id || "").trim();

  if (currentId && customerMapById.has(currentId)) {
    return { customerId: currentId, reason: "already_valid" };
  }

  if (currentId && profileMapById.has(currentId)) {
    const profile = profileMapById.get(currentId);
    const profileCustomerId = String(profile?.customer_id || "").trim();
    if (profileCustomerId && customerMapById.has(profileCustomerId)) {
      return { customerId: profileCustomerId, reason: "from_profile_link" };
    }
  }

  const phone = String(address.address_phone || "").trim();
  if (phone && customerMapByPhone.has(phone)) {
    return { customerId: String(customerMapByPhone.get(phone)._id), reason: "by_customer_phone" };
  }

  if (phone && profileMapByPhone.has(phone)) {
    const profile = profileMapByPhone.get(phone);
    const profileCustomerId = String(profile?.customer_id || "").trim();
    if (profileCustomerId && customerMapById.has(profileCustomerId)) {
      return { customerId: profileCustomerId, reason: "by_profile_phone" };
    }
  }

  return { customerId: "", reason: "unresolved" };
}

async function run() {
  const apply = hasFlag("--apply");

  await connectDB();

  const [addresses, customers, profiles] = await Promise.all([
    CustomerAddress.find({}).lean(),
    Customer.find({}).lean(),
    Profile.find({}).lean(),
  ]);

  const customerMapById = new Map(customers.map((c) => [String(c._id), c]));
  const customerMapByPhone = new Map(
    customers
      .map((c) => [String(c.phone || "").trim(), c])
      .filter(([phone]) => phone)
  );
  const profileMapById = new Map(profiles.map((p) => [String(p._id), p]));
  const profileMapByPhone = new Map(
    profiles
      .map((p) => [String(p.phone || "").trim(), p])
      .filter(([phone]) => phone)
  );

  let kept = 0;
  let updated = 0;
  let unresolved = 0;
  const reasonCount = {};
  const unresolvedIds = [];

  for (const address of addresses) {
    const currentId = String(address.customer_id || "").trim();
    const { customerId, reason } = await resolveCustomerIdForAddress(
      address,
      customerMapById,
      customerMapByPhone,
      profileMapById,
      profileMapByPhone
    );
    reasonCount[reason] = (reasonCount[reason] || 0) + 1;

    if (!customerId) {
      unresolved += 1;
      unresolvedIds.push(String(address._id));
      continue;
    }

    if (currentId === customerId) {
      kept += 1;
      continue;
    }

    if (apply) {
      await CustomerAddress.updateOne(
        { _id: address._id },
        { $set: { customer_id: new mongoose.Types.ObjectId(customerId) } }
      );
    }
    updated += 1;
  }

  console.log("=== Customer Address Link Migration ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Total addresses: ${addresses.length}`);
  console.log(`Kept (already valid): ${kept}`);
  console.log(`Updated links: ${updated}`);
  console.log(`Unresolved: ${unresolved}`);
  console.log("Reasons:", reasonCount);
  if (unresolvedIds.length) {
    console.log("Unresolved address ids:", unresolvedIds.join(", "));
  }
}

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.connection.close();
    process.exit(1);
  });
