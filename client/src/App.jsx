import { useState } from 'react'
import './App.css'

const MENU = [
  { id: 1, name: "Dal Makhani", price: 180, category: "Main", img: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
  { id: 2, name: "Butter Chicken", price: 320, category: "Main", img: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400" },
  { id: 3, name: "Paneer Tikka", price: 220, category: "Starter", img: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400" },
  { id: 4, name: "Chicken Biryani", price: 280, category: "Main", img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400" },
  { id: 5, name: "Garlic Naan", price: 40, category: "Bread", img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400" },
  { id: 6, name: "Tandoori Roti", price: 20, category: "Bread", img: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400" },
  { id: 7, name: "Veg Pulao", price: 180, category: "Main", img: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400" },
  { id: 8, name: "Lassi", price: 60, category: "Drink", img: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400" },
  { id: 9, name: "Gulab Jamun", price: 80, category: "Dessert", img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400" },
  { id: 10, name: "Cold Drink", price: 40, category: "Drink", img: "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400" },
];

const TIME_SLOTS = [
  "12:00 - 13:00",
  "13:00 - 14:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
];

function App() {
  const [booking, setBooking] = useState({
    name: "",
    phone: "",
    date: "",
    timeSlot: "",
    partySize: 2,
  });

  const [bookingDone, setBookingDone] = useState(false);
  const [cart, setCart] = useState([]);

  const handleChange = (e) => {
    setBooking({ ...booking, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!booking.name || !booking.phone || !booking.date || !booking.timeSlot) {
      alert("Please fill all fields");
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });

      const data = await response.json();
      console.log("Server Response:", data);

      setBookingDone(true);
      setTimeout(() => {
        setBookingDone(false);
        setBooking({ name: "", phone: "", date: "", timeSlot: "", partySize: 2 });
      }, 4000);
    } catch (error) {
      console.error("Error:", error);
      alert("Server connection failed. Is the server running?");
    }
  };

  const handleCheckout = async () => {
    try {
      // Step 1: Backend pe Razorpay order create karo
      const response = await fetch('http://localhost:5001/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cartTotal })
      });

      const data = await response.json();

      if (!data.success) {
        alert('Failed to create order');
        return;
      }

      // Step 2: Razorpay popup kholo
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Sharma Ji Ka Dhaba',
        description: `Order of ${cartCount} items`,
        order_id: data.orderId,
        handler: async function (paymentResponse) {
          const verifyRes = await fetch('http://localhost:5001/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              items: cart,
              total: cartTotal
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            alert(`✅ Payment successful! Order ID: ${verifyData.order.id}`);
            setCart([]);
          } else {
            alert('❌ Payment verification failed');
          }
        },
        prefill: {
          name: booking.name || '',
          contact: booking.phone || ''
        },
        theme: { color: '#8b4513' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Error:', error);
      alert('Server connection failed!');
    }
  };

  const addToCart = (item) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) =>
        c.id === item.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  const updateQty = (id, delta) => {
    setCart(cart.map((c) => {
      if (c.id === id) {
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : c;
      }
      return c;
    }).filter((c) => c.qty > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>Sharma Ji Ka Dhaba</h1>
            <p>Bharatpur, Rajasthan • Open 11 AM - 11 PM</p>
          </div>
          <div className="cart-badge">
            🛒 {cartCount}
          </div>
        </div>
      </header>

      <section className="booking-section">
        <h2>Book a Table</h2>
        {bookingDone ? (
          <div className="success-msg">
            ✅ Table booked successfully! We'll confirm on WhatsApp.
          </div>
        ) : (
          <form className="booking-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <input type="text" name="name" placeholder="Your Name" value={booking.name} onChange={handleChange} />
              <input type="tel" name="phone" placeholder="Phone Number" value={booking.phone} onChange={handleChange} />
            </div>
            <div className="form-row">
              <input type="date" name="date" min={today} value={booking.date} onChange={handleChange} />
              <select name="timeSlot" value={booking.timeSlot} onChange={handleChange}>
                <option value="">Select Time Slot</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <select name="partySize" value={booking.partySize} onChange={handleChange}>
                <option value={2}>2 People</option>
                <option value={3}>3 People</option>
                <option value={4}>4 People</option>
                <option value={6}>6 People</option>
                <option value={8}>8 People</option>
              </select>
              <button type="submit" className="book-btn">Book Table</button>
            </div>
          </form>
        )}
      </section>

      <section className="menu">
        <h2>Our Menu</h2>
        <div className="menu-grid">
          {MENU.map((item) => (
            <div key={item.id} className="menu-card">
              <img src={item.img} alt={item.name} />
              <div className="menu-info">
                <h3>{item.name}</h3>
                <p className="category">{item.category}</p>
                <p className="price">₹{item.price}</p>
                <button className="add-btn" onClick={() => addToCart(item)}>
                  Add to Order
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {cart.length > 0 && (
        <section className="cart-section">
          <h2>Your Order ({cartCount} items)</h2>
          <div className="cart-list">
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={item.img} alt={item.name} />
                <div className="cart-details">
                  <h3>{item.name}</h3>
                  <p>₹{item.price} × {item.qty}</p>
                </div>
                <div className="qty-controls">
                  <button onClick={() => updateQty(item.id, -1)}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                  🗑
                </button>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <span>Total:</span>
            <span className="total-price">₹{cartTotal}</span>
          </div>
          <button className="checkout-btn" onClick={handleCheckout}>
            Proceed to Payment →
          </button>
        </section>
      )}
    </div>
  )
}

export default App