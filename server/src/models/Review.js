const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order_detail_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'OrderDetail', // Đảm bảo bạn đã có model OrderDetail
    required: true 
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  customer_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer' // Thêm dòng này để khớp với data JSON
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  content: { 
    type: String, 
    required: true 
  },
  // THÊM TRƯỜNG LƯU ẢNH KHÁCH HÀNG UPLOAD
  images: [{ 
    type: String 
  }],
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  reply: {
    content: String,
    repliedAt: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { collection: 'review' });

module.exports = mongoose.model('Review', reviewSchema);