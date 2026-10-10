const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const bookings = [];
const orders = [];

app.get('/', (req, res) => {
  res.json({ message: 'Sharma Ji Ka Dhaba API running!' });
});

// BOOKINGS
app.post('/api/bookings', (req, res) => {
  const { name, phone, date, timeSlot, partySize } = req.body;
  if (!name || !phone || !date || !timeSlot) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const booking = {
    id: bookings.length + 1,
    name, phone, date, timeSlot,
    partySize: partySize || 2,
    createdAt: new Date()
  };
  bookings.push(booking);
  console.log('New Booking:', booking);
  res.json({ success: true, booking });
});

app.get('/api/bookings', (req, res) => res.json(bookings));

// CREATE RAZORPAY ORDER
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);
    console.log('Razorpay Order Created:', razorpayOrder);

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// VERIFY PAYMENT
app.post('/api/verify-payment', (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      total
    } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      const order = {
        id: orders.length + 1,
        razorpay_order_id,
        razorpay_payment_id,
        items,
        total,
        paymentStatus: 'paid',
        createdAt: new Date()
      };
      orders.push(order);
      console.log('Payment Verified. Order Saved:', order);
      res.json({ success: true, order });
    } else {
      console.log('Payment verification FAILED');
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/orders', (req, res) => res.json(orders));

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});