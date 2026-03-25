const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order_detail_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'OrderDetail',
    required: true 
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  customer_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer'
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
  images: [{ 
    type: String 
  }],
  videos: [{
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
