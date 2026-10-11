const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const Razorpay = require('razorpay');

const Booking = require('./models/Booking');
const Order = require('./models/Order');
const MenuItem = require('./models/MenuItem');

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = new Set([
  'http://localhost:5173',
  process.env.CLIENT_ORIGIN
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '100kb' }));

// Simple signed admin sessions using Node's built-in crypto (no extra auth package).
// Configure ADMIN_PASSWORD and ADMIN_TOKEN_SECRET in the hosting environment.
const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;
function signAdminToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.ADMIN_TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 2 || !process.env.ADMIN_TOKEN_SECRET || !process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const expected = crypto.createHmac('sha256', process.env.ADMIN_TOKEN_SECRET).update(parts[0]).digest();
  let provided;
  try { provided = Buffer.from(parts[1], 'base64url'); } catch { return res.status(401).json({ error: 'Invalid admin session' }); }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid admin session' });
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (payload.role !== 'admin' || !Number.isFinite(payload.exp) || payload.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Admin session expired' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid admin session' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_TOKEN_SECRET) {
    return res.status(503).json({ error: 'Admin login is not configured on the server' });
  }
  if (typeof password !== 'string' || password.length > 200) {
    return res.status(400).json({ error: 'Enter the admin password' });
  }
  const supplied = crypto.createHash('sha256').update(password).digest();
  const expected = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = signAdminToken({ role: 'admin', exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SECONDS });
  return res.json({ success: true, token, expiresIn: ADMIN_TOKEN_TTL_SECONDS });
});

app.get('/api/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ available: true }).sort({ createdAt: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

app.get('/api/admin/menu', requireAdmin, async (req, res) => {
  try { res.json(await MenuItem.find().sort({ createdAt: -1 })); }
  catch { res.status(500).json({ error: 'Failed to fetch menu items' }); }
});

app.post('/api/admin/menu', requireAdmin, async (req, res) => {
  try {
    const { name, price, category, img = '', available = true } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'Name, valid price, and category are required' });
    }
    const item = await MenuItem.create({ name: name.trim(), price: Number(price), category: category.trim(), img: typeof img === 'string' ? img.trim() : '', available: Boolean(available) });
    res.status(201).json(item);
  } catch { res.status(500).json({ error: 'Failed to create menu item' }); }
});

app.patch('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  try {
    const updates = {};
    const { name, price, category, img, available } = req.body || {};
    if (name !== undefined) { if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Invalid name' }); updates.name = name.trim(); }
    if (price !== undefined) { if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'Invalid price' }); updates.price = Number(price); }
    if (category !== undefined) { if (typeof category !== 'string' || !category.trim()) return res.status(400).json({ error: 'Invalid category' }); updates.category = category.trim(); }
    if (img !== undefined) updates.img = typeof img === 'string' ? img.trim() : '';
    if (available !== undefined) updates.available = Boolean(available);
    const item = await MenuItem.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch { res.status(400).json({ error: 'Failed to update menu item' }); }
});

app.delete('/api/admin/menu/:id', requireAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Failed to delete menu item' }); }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 }).limit(500)); }
  catch { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const allowed = ['placed', 'preparing', 'ready', 'served', 'cancelled'];
  if (!allowed.includes(req.body?.orderStatus)) return res.status(400).json({ error: 'Invalid order status' });
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.orderStatus }, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch { res.status(400).json({ error: 'Failed to update order status' }); }
});

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try { res.json(await Booking.find().sort({ createdAt: -1 }).limit(500)); }
  catch { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

app.patch('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  if (!['confirmed', 'cancelled', 'completed'].includes(req.body?.status)) return res.status(400).json({ error: 'Invalid booking status' });
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch { res.status(400).json({ error: 'Failed to update booking status' }); }
});

// MongoDB connect
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));


const INITIAL_MENU = [
  { name: 'Dal Makhani', price: 180, category: 'Main', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400' },
  { name: 'Butter Chicken', price: 320, category: 'Main', img: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400' },
  { name: 'Paneer Tikka', price: 220, category: 'Starter', img: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400' },
  { name: 'Chicken Biryani', price: 280, category: 'Main', img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400' },
  { name: 'Garlic Naan', price: 40, category: 'Bread', img: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400' },
  { name: 'Tandoori Roti', price: 20, category: 'Bread', img: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400' },
  { name: 'Veg Pulao', price: 180, category: 'Main', img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400' },
  { name: 'Lassi', price: 60, category: 'Drink', img: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400' },
  { name: 'Gulab Jamun', price: 80, category: 'Dessert', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400' },
  { name: 'Cold Drink', price: 40, category: 'Drink', img: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400' },
];

mongoose.connection.once('open', async () => {
  try {
    if (await MenuItem.countDocuments() === 0) {
      await MenuItem.insertMany(INITIAL_MENU.map((item) => ({ ...item, available: true })));
      console.log('Initial menu seeded');
    }
  } catch (error) { console.error('Menu seed failed:', error.message); }
});

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.get('/', (req, res) => {
  res.json({ message: 'Sharma Ji Ka Dhaba API running!', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ---------- BOOKINGS ----------
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, phone, date, timeSlot, partySize } = req.body;

    if (!name || !phone || !date || !timeSlot) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const booking = await Booking.create({
      name, phone, date, timeSlot,
      partySize: partySize || 2
    });

    console.log('New Booking saved:', booking._id);
    res.json({ success: true, booking });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

app.get('/api/bookings', requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ---------- CREATE RAZORPAY ORDER ----------
// The client sends only menu item IDs and quantities. Prices are loaded from MongoDB.
async function buildPricedCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    return { error: 'Cart must contain between 1 and 50 item lines' };
  }

  const quantities = new Map();
  for (const line of rawItems) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      return { error: 'Invalid cart item' };
    }
    const id = typeof line.id === 'string' ? line.id : '';
    const qty = Number(line.qty);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { error: 'Invalid menu item or quantity' };
    }
    const nextQty = (quantities.get(id) || 0) + qty;
    if (nextQty > 99) return { error: 'Quantity limit exceeded for an item' };
    quantities.set(id, nextQty);
  }

  const ids = [...quantities.keys()];
  const menuItems = await MenuItem.find({ _id: { $in: ids }, available: true });
  if (menuItems.length !== ids.length) {
    return { error: 'One or more menu items are unavailable. Refresh the menu and try again.' };
  }

  const byId = new Map(menuItems.map((item) => [String(item._id), item]));
  const items = ids.map((id) => {
    const menuItem = byId.get(id);
    return {
      id: String(menuItem._id),
      name: menuItem.name,
      price: Number(menuItem.price),
      qty: quantities.get(id),
      category: menuItem.category,
      img: menuItem.img || '',
    };
  });

  const totalPaise = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || totalPaise > 100000000) {
    return { error: 'Order total is invalid or exceeds the allowed limit' };
  }
  return { items, totalPaise };
}

app.post('/api/create-order', async (req, res) => {
  try {
    const cart = await buildPricedCart(req.body?.items);
    if (cart.error) return res.status(400).json({ success: false, error: cart.error });

    const options = {
      amount: cart.totalPaise,
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);
    // Persist the server-priced order before showing checkout, so verify-payment
    // cannot trust item names, quantities or totals sent back by the browser.
    const localOrder = await Order.create({
      razorpay_order_id: razorpayOrder.id,
      items: cart.items,
      total: cart.totalPaise / 100,
      paymentStatus: 'pending',
      orderStatus: 'placed',
    });

    console.log('Razorpay order created:', razorpayOrder.id, 'local order:', localOrder._id);
    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// ---------- VERIFY PAYMENT ----------
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({ success: false, error: 'Missing or invalid payment verification fields' });
    }

    const localOrder = await Order.findOne({ razorpay_order_id });
    if (!localOrder) {
      return res.status(404).json({ success: false, error: 'Order not found. Please contact the restaurant before retrying payment.' });
    }

    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const suppliedBuffer = Buffer.from(razorpay_signature, 'hex');
    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      console.warn('Payment signature verification failed for order:', razorpay_order_id);
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Make retries idempotent: do not insert a duplicate order for the same payment.
    if (localOrder.paymentStatus === 'paid') {
      if (localOrder.razorpay_payment_id === razorpay_payment_id) {
        return res.json({ success: true, order: localOrder, alreadyProcessed: true });
      }
      return res.status(409).json({ success: false, error: 'This order has already been paid' });
    }

    // Fetch payment directly from Razorpay and compare it with the server-created order.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const expectedAmountPaise = Math.round(Number(localOrder.total) * 100);
    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== expectedAmountPaise ||
      payment.currency !== 'INR'
    ) {
      console.warn('Payment details did not match local order:', razorpay_order_id);
      return res.status(400).json({ success: false, error: 'Payment details do not match the order' });
    }
    if (payment.status !== 'captured') {
      return res.status(409).json({ success: false, error: 'Payment is not captured yet. Check Razorpay payment status before retrying.' });
    }

    localOrder.razorpay_payment_id = razorpay_payment_id;
    localOrder.paymentStatus = 'paid';
    await localOrder.save();

    console.log('Payment verified and order marked paid:', localOrder._id);
    return res.json({ success: true, order: localOrder });
  } catch (error) {
    console.error('Verify error:', error.message);
    return res.status(500).json({ success: false, error: 'Payment verification could not be completed. Check the Razorpay dashboard before retrying.' });
  }
});

// ---------- ORDERS ----------
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});