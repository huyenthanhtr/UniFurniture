const express = require("express");
require("dotenv").config();
const cors = require("cors");
const path = require("path");

const connectDB = require("./src/configs/db");

const cartRoutes = require("./src/routes/cart.routes");
const cartItemsRoutes = require("./src/routes/cart-items.routes");
const categoriesRoutes = require("./src/routes/categories.routes");
const collectionsRoutes = require("./src/routes/collections.routes");
const couponsRoutes = require("./src/routes/coupons.routes");
const customerAddressRoutes = require("./src/routes/customer-address.routes");
const customersRoutes = require("./src/routes/customers.routes");
const keywordsRoutes = require("./src/routes/keywords.routes");
const ordersRoutes = require("./src/routes/orders.routes");
const orderDetailRoutes = require("./src/routes/order-detail.routes");
const paymentRoutes = require("./src/routes/payment.routes");
const postRoutes = require("./src/routes/post.routes");
const productImagesRoutes = require("./src/routes/product-images.routes");
const productKeywordsRoutes = require("./src/routes/product-keywords.routes");
const productVariantsRoutes = require("./src/routes/product-variants.routes");
const productsRoutes = require("./src/routes/products.routes");
const profilesRoutes = require("./src/routes/profiles.routes");
const authRoutes = require("./src/routes/auth.routes");
const productModels3dRoutes = require("./src/routes/product-model-3d.routes");
const reviewRoutes = require('./src/routes/review.routes');
const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets/upload", express.static(path.join(__dirname, "..", "admin", "src", "assets", "upload")));

// connectDB(); // Moved to end of file

app.get("/", (req, res) => res.send("UniFurniture API running"));

app.use("/api/cart", cartRoutes);
app.use("/api/cart-items", cartItemsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/collections", collectionsRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/customer-address", customerAddressRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/keywords", keywordsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/order-detail", orderDetailRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/post", postRoutes);
app.use("/api/product-images", productImagesRoutes);
app.use("/api/product-keywords", productKeywordsRoutes);
app.use("/api/product-variants", productVariantsRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/product-models-3d", productModels3dRoutes);
app.use('/api/reviews', reviewRoutes);
connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`✅ Server running: ${url}`);
    console.log(`➡ Products API:  ${url}/api/products`);
  });
});
