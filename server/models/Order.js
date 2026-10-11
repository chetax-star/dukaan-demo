const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  razorpay_order_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // This is blank while checkout is pending and populated after verification.
  razorpay_payment_id: {
    type: String,
    default: undefined,
    sparse: true,
    unique: true,
  },
  items: [
    {
      id: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      qty: { type: Number, required: true, min: 1 },
      category: { type: String, default: '' },
      img: { type: String, default: '' },
    }
  ],
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['placed', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'placed',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);
