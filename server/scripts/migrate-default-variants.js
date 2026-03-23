require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const products = await Product.find({}).lean();
    let migratedCount = 0;

    for (let product of products) {
      const variants = await ProductVariant.find({ product_id: product._id }).lean();
      
      if (variants.length === 0) {
        // No variants found, create a default one
        const sku = (product.sku && String(product.sku).trim() !== "") 
            ? String(product.sku).trim() 
            : product._id.toString();
            
        await ProductVariant.create({
          product_id: product._id,
          sku: sku,
          color: "",
          label: "Mặc định",
          price: product.min_price || 0,
          compare_at_price: product.compare_at_price || null,
          stock_quantity: 50,
          images: [product.thumbnail_url || product.thumbnail].filter(Boolean)
        });
        migratedCount++;
        console.log(`Created default variant for product: ${product.name} (SKU: ${sku})`);
      }
    }

    console.log(`Migration complete. Created ${migratedCount} default variants for ${products.length} total products.`);
  } catch (err) {
    console.error("Error running migration:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
