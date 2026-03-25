const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Đã kết nối MongoDB thành công vào database: ecommerce");
    } catch (error) {
        console.error("Lỗi kết nối MongoDB:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;