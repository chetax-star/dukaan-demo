const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  razorpay_order_id: {
    type: String,
    required: true
  },
  razorpay_payment_id: {
    type: String,
    required: true
  },
  items: [
    {
      id: Number,
      name: String,
      price: Number,
      qty: Number,
      category: String,
      img: String
    }
  ],
  total: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['placed', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'placed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);