import { useCallback, useEffect, useMemo, useState } from 'react'
import './Admin.css'

const API = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : 'https://dukaan-demo.onrender.com/api')
const TABS = ['Overview', 'Orders', 'Bookings', 'Menu']

function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem('dukaan_admin_token') || '')
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')
  const [orders, setOrders] = useState([])
  const [bookings, setBookings] = useState([])
  const [menu, setMenu] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [itemForm, setItemForm] = useState({ name: '', price: '', category: 'Main', img: '', available: true })

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401 && token) {
        sessionStorage.removeItem('dukaan_admin_token')
        setToken('')
      }
      throw new Error(data.error || 'Request failed')
    }
    return data
  }, [token])

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [nextOrders, nextBookings, nextMenu] = await Promise.all([
        api('/admin/orders'), api('/admin/bookings'), api('/admin/menu'),
      ])
      setOrders(nextOrders)
      setBookings(nextBookings)
      setMenu(nextMenu)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [api, token])

  // Fetch server data when the authenticated session changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => ({
    orders: orders.length,
    pending: orders.filter((o) => ['placed', 'preparing'].includes(o.orderStatus)).length,
    paid: orders.filter((o) => o.paymentStatus === 'paid').reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    bookings: bookings.filter((b) => b.status === 'confirmed').length,
  }), [orders, bookings])

  const login = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const response = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Login failed')
      sessionStorage.setItem('dukaan_admin_token', data.token)
      setToken(data.token); setPassword('')
    } catch (e2) { setError(e2.message) }
    finally { setSaving(false) }
  }

  const logout = () => { sessionStorage.removeItem('dukaan_admin_token'); setToken(''); setOrders([]); setBookings([]); setMenu([]) }

  const updateOrder = async (id, orderStatus) => {
    try { await api(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ orderStatus }) }); await refresh() }
    catch (e) { setError(e.message) }
  }
  const updateBooking = async (id, status) => {
    try { await api(`/admin/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh() }
    catch (e) { setError(e.message) }
  }
  const resetForm = () => { setEditingId(''); setItemForm({ name: '', price: '', category: 'Main', img: '', available: true }) }
  const editItem = (item) => { setEditingId(item._id); setItemForm({ name: item.name, price: String(item.price), category: item.category, img: item.img || '', available: item.available !== false }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const saveItem = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const path = editingId ? `/admin/menu/${editingId}` : '/admin/menu'
      await api(path, { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ ...itemForm, price: Number(itemForm.price) }) })
      resetForm(); await refresh()
    } catch (e2) { setError(e2.message) }
    finally { setSaving(false) }
  }
  const deleteItem = async (id) => {
    if (!window.confirm('Delete this menu item?')) return
    try { await api(`/admin/menu/${id}`, { method: 'DELETE' }); await refresh() }
    catch (e) { setError(e.message) }
  }

  if (!token) return <main className="admin-login-wrap"><form className="admin-login" onSubmit={login}><div className="admin-mark">SJ</div><p className="eyebrow">SHARMA JI KA DHABA</p><h1>Admin sign in</h1><p className="muted">Use the admin password configured by the site owner.</p>{error && <div className="alert">{error}</div>}<label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="primary-btn" disabled={saving}>{saving ? 'Signing in…' : 'Sign in'}</button><a href="/" className="back-link">← Back to customer website</a></form></main>

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="brand"><span className="admin-mark small">SJ</span><div><strong>Dhaba Admin</strong><small>Management panel</small></div></div><nav>{TABS.map((tab) => <button key={tab} className={activeTab === tab ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(tab)}>{tab === 'Overview' ? '◫' : tab === 'Orders' ? '▤' : tab === 'Bookings' ? '▦' : '☷'}<span>{tab}</span></button>)}</nav><button className="logout-btn" onClick={logout}>↪ Sign out</button></aside>
    <main className="admin-main"><header className="admin-topbar"><div><p className="eyebrow">SHARMA JI KA DHABA / ADMIN</p><h1>{activeTab}</h1></div><div className="top-actions"><span className="live-dot">● Connected</span><button className="secondary-btn" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></div></header>
      {error && <div className="alert page-alert">{error}</div>}
      {loading && <p className="muted loading-note">Loading your data…</p>}
      {activeTab === 'Overview' && <><section className="stats-grid"><Stat label="Total orders" value={stats.orders} hint="All recorded orders"/><Stat label="Needs attention" value={stats.pending} hint="Placed or preparing"/><Stat label="Paid revenue" value={`₹${stats.paid.toLocaleString('en-IN')}`} hint="Verified paid orders"/><Stat label="Confirmed bookings" value={stats.bookings} hint="Upcoming / confirmed"/></section><section className="panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest activity from your customers</p></div><button className="text-btn" onClick={() => setActiveTab('Orders')}>View all →</button></div><OrdersTable orders={orders.slice(0, 5)} onStatus={updateOrder}/></section><section className="panel"><div className="panel-heading"><div><h2>Recent bookings</h2><p>Table reservation requests</p></div><button className="text-btn" onClick={() => setActiveTab('Bookings')}>View all →</button></div><BookingsTable bookings={bookings.slice(0, 5)} onStatus={updateBooking}/></section></>}
      {activeTab === 'Orders' && <section className="panel"><div className="panel-heading"><div><h2>Order management</h2><p>Update the kitchen progress for each order.</p></div></div><OrdersTable orders={orders} onStatus={updateOrder}/></section>}
      {activeTab === 'Bookings' && <section className="panel"><div className="panel-heading"><div><h2>Table bookings</h2><p>Review reservation details and update status.</p></div></div><BookingsTable bookings={bookings} onStatus={updateBooking}/></section>}
      {activeTab === 'Menu' && <><section className="panel"><div className="panel-heading"><div><h2>{editingId ? 'Edit menu item' : 'Add a menu item'}</h2><p>Menu changes are stored in MongoDB and shown on the customer site.</p></div></div><form className="menu-form" onSubmit={saveItem}><label>Item name<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required maxLength={100}/></label><label>Price (₹)<input type="number" min="0" step="1" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required/></label><label>Category<input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} required maxLength={50}/></label><label>Image URL<input type="url" value={itemForm.img} onChange={(e) => setItemForm({ ...itemForm, img: e.target.value })} placeholder="https://…"/></label><label className="checkbox-label"><input type="checkbox" checked={itemForm.available} onChange={(e) => setItemForm({ ...itemForm, available: e.target.checked })}/> Available to customers</label><div className="form-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}</button>{editingId && <button type="button" className="secondary-btn" onClick={resetForm}>Cancel</button>}</div></form></section><section className="panel"><div className="panel-heading"><div><h2>Menu items <span className="count-pill">{menu.length}</span></h2><p>Manage the items displayed on your website.</p></div></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Availability</th><th>Actions</th></tr></thead><tbody>{menu.map((item) => <tr key={item._id}><td><div className="item-cell">{item.img ? <img src={item.img} alt=""/> : <span className="item-placeholder">🍽</span>}<strong>{item.name}</strong></div></td><td>{item.category}</td><td>₹{item.price}</td><td><span className={item.available ? 'status status-paid' : 'status status-cancelled'}>{item.available ? 'Available' : 'Hidden'}</span></td><td><div className="row-actions"><button className="mini-btn" onClick={() => editItem(item)}>Edit</button><button className="mini-btn danger" onClick={() => deleteItem(item._id)}>Delete</button></div></td></tr>)}</tbody></table>{menu.length === 0 && <Empty text="No menu items yet."/>}</div></section></>}
      <footer className="admin-footer">Dukaan Demo · Admin tools · Keep your admin password private</footer>
    </main></div>
}

function Stat({ label, value, hint }) { return <article className="stat-card"><p>{label}</p><strong>{value}</strong><small>{hint}</small></article> }
function Empty({ text }) { return <div className="empty-state">{text}</div> }
function OrdersTable({ orders, onStatus }) { return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Kitchen status</th></tr></thead><tbody>{orders.map((o) => <tr key={o._id}><td><strong className="mono">#{String(o._id).slice(-6).toUpperCase()}</strong></td><td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td><td>{(o.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ') || '—'}</td><td>₹{Number(o.total || 0).toLocaleString('en-IN')}</td><td><span className={`status ${o.paymentStatus === 'paid' ? 'status-paid' : 'status-pending'}`}>{o.paymentStatus || 'pending'}</span></td><td><select className="status-select" value={o.orderStatus || 'placed'} onChange={(e) => onStatus(o._id, e.target.value)}><option value="placed">Placed</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="served">Served</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table>{orders.length === 0 && <Empty text="No orders found yet."/>}</div> }
function BookingsTable({ bookings, onStatus }) { return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Date</th><th>Time</th><th>Guests</th><th>Status</th></tr></thead><tbody>{bookings.map((b) => <tr key={b._id}><td><strong>{b.name}</strong></td><td>{b.phone}</td><td>{b.date}</td><td>{b.timeSlot}</td><td>{b.partySize}</td><td><select className="status-select" value={b.status || 'confirmed'} onChange={(e) => onStatus(b._id, e.target.value)}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table>{bookings.length === 0 && <Empty text="No bookings found yet."/>}</div> }

export default AdminApp
