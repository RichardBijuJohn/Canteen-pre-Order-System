import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ADMIN_API = 'http://localhost:5000/api/admin';

const defaultMenuForm = {
  name: '',
  price: '',
  category: '',
  preparationTime: '15 min',
  rating: '4',
  available: true
};

const ORDER_STATUS_OPTIONS = ['Pending', 'Ready for Pickup', 'Picked', 'Cancelled', 'Complete'];

const formatPickupTime = (value) => {
  if (!value) return 'Awaiting slot';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return `${time} · ${day}`;
};

function Admin() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [adminName, setAdminName] = useState(localStorage.getItem('adminName') || 'Admin');
  const [banner, setBanner] = useState({ type: '', message: '' });

  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuForm, setMenuForm] = useState(defaultMenuForm);
  const [menuDrafts, setMenuDrafts] = useState({});
  const [menuSavingId, setMenuSavingId] = useState('');
  const [statusSavingId, setStatusSavingId] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const raiseBanner = (type, message) => setBanner({ type, message });

  useEffect(() => {
    if (!banner.message) return undefined;
    const timer = setTimeout(() => setBanner({ type: '', message: '' }), 2400);
    return () => clearTimeout(timer);
  }, [banner]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    setToken('');
    setAdminName('Admin');
    setMenuItems([]);
    setOrders([]);
    raiseBanner('success', 'Admin session ended.');
  };

  const loadMenu = async () => {
    const res = await axios.get(`${ADMIN_API}/menu`, { headers });
    setMenuItems(res.data || []);
    const drafts = {};
    (res.data || []).forEach((item) => {
      drafts[item._id] = {
        name: item.name || '',
        price: item.price ?? '',
        category: item.category || '',
        preparationTime: item.preparationTime || '15 min',
        rating: item.rating ?? 4,
        available: Boolean(item.available)
      };
    });
    setMenuDrafts(drafts);
  };

  const loadOrders = async () => {
    const res = await axios.get(`${ADMIN_API}/orders`, { headers });
    setOrders(res.data || []);
  };

  const loadAllData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      await Promise.all([loadMenu(), loadOrders()]);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        handleLogout();
        raiseBanner('error', 'Admin session expired. Login again.');
      } else {
        raiseBanner('error', 'Unable to load admin data right now.');
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token]);

  const addMenuItem = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${ADMIN_API}/menu`, {
        ...menuForm,
        price: Number(menuForm.price),
        rating: Number(menuForm.rating)
      }, { headers });
      setMenuForm(defaultMenuForm);
      raiseBanner('success', 'Menu item added.');
      await loadMenu();
    } catch (err) {
      raiseBanner('error', err?.response?.data?.msg || 'Unable to add menu item.');
    }
  };

  const saveMenuDraft = async (itemId) => {
    const draft = menuDrafts[itemId];
    if (!draft) return;
    setMenuSavingId(itemId);
    try {
      await axios.put(`${ADMIN_API}/menu/${itemId}`, {
        ...draft,
        price: Number(draft.price),
        rating: Number(draft.rating)
      }, { headers });
      raiseBanner('success', 'Menu item updated.');
      await loadMenu();
    } catch (err) {
      raiseBanner('error', err?.response?.data?.msg || 'Unable to update menu item.');
    } finally {
      setMenuSavingId('');
    }
  };

  const deleteMenuItem = async (itemId) => {
    setMenuSavingId(itemId);
    try {
      await axios.delete(`${ADMIN_API}/menu/${itemId}`, { headers });
      raiseBanner('success', 'Menu item removed.');
      await loadMenu();
    } catch (err) {
      raiseBanner('error', err?.response?.data?.msg || 'Unable to remove menu item.');
    } finally {
      setMenuSavingId('');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    setStatusSavingId(orderId);
    try {
      await axios.patch(`${ADMIN_API}/orders/${orderId}/status`, { status }, { headers });
      raiseBanner('success', 'Order status updated.');
      await loadOrders();
    } catch (err) {
      raiseBanner('error', err?.response?.data?.msg || 'Unable to update order status.');
    } finally {
      setStatusSavingId('');
    }
  };

  if (!token) {
    return (
      <section className="page-section admin-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin Access</p>
            <h2>Use the main login page for admin sign in.</h2>
          </div>
        </div>

        <div className="form-panel admin-login-panel">
          <p className="subtitle">Open the shared login page and choose Admin Login.</p>
          <button className="primary-btn" type="button" onClick={() => navigate('/login')}>
            Go To Login
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section admin-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h2>Manage menu and user orders.</h2>
          <p className="subtitle admin-subtitle">Signed in as {adminName}</p>
        </div>
        <div className="admin-actions">
          <button className="ghost-btn" onClick={loadAllData} disabled={loadingData}>Refresh</button>
          <button className="ghost-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {banner.message && (
        <div className={`inline-banner ${banner.type === 'error' ? 'error' : 'success'}`}>{banner.message}</div>
      )}

      <div className="admin-grid">
        <section className="admin-card">
          <h3>Add Menu Item</h3>
          <form className="admin-form" onSubmit={addMenuItem}>
            <input className="input-field" placeholder="Name" value={menuForm.name} onChange={(e) => setMenuForm((prev) => ({ ...prev, name: e.target.value }))} required />
            <input className="input-field" placeholder="Price" type="number" min="1" value={menuForm.price} onChange={(e) => setMenuForm((prev) => ({ ...prev, price: e.target.value }))} required />
            <input className="input-field" placeholder="Category" value={menuForm.category} onChange={(e) => setMenuForm((prev) => ({ ...prev, category: e.target.value }))} />
            <input className="input-field" placeholder="Preparation Time" value={menuForm.preparationTime} onChange={(e) => setMenuForm((prev) => ({ ...prev, preparationTime: e.target.value }))} />
            <input className="input-field" placeholder="Rating" type="number" min="1" max="5" step="0.1" value={menuForm.rating} onChange={(e) => setMenuForm((prev) => ({ ...prev, rating: e.target.value }))} />
            <label className="admin-checkbox">
              <input type="checkbox" checked={menuForm.available} onChange={(e) => setMenuForm((prev) => ({ ...prev, available: e.target.checked }))} />
              Available
            </label>
            <button className="primary-btn" type="submit">Add Item</button>
          </form>
        </section>

        <section className="admin-card">
          <h3>Menu Inventory</h3>
          <div className="admin-list">
            {menuItems.map((item) => {
              const draft = menuDrafts[item._id] || {};
              return (
                <article key={item._id} className="admin-list-item">
                  <div className="admin-item-grid">
                    <input className="input-field" value={draft.name || ''} onChange={(e) => setMenuDrafts((prev) => ({ ...prev, [item._id]: { ...prev[item._id], name: e.target.value } }))} />
                    <input className="input-field" type="number" min="1" value={draft.price ?? ''} onChange={(e) => setMenuDrafts((prev) => ({ ...prev, [item._id]: { ...prev[item._id], price: e.target.value } }))} />
                    <input className="input-field" value={draft.category || ''} onChange={(e) => setMenuDrafts((prev) => ({ ...prev, [item._id]: { ...prev[item._id], category: e.target.value } }))} />
                    <input className="input-field" value={draft.preparationTime || ''} onChange={(e) => setMenuDrafts((prev) => ({ ...prev, [item._id]: { ...prev[item._id], preparationTime: e.target.value } }))} />
                    <label className="admin-checkbox">
                      <input type="checkbox" checked={Boolean(draft.available)} onChange={(e) => setMenuDrafts((prev) => ({ ...prev, [item._id]: { ...prev[item._id], available: e.target.checked } }))} />
                      Available
                    </label>
                  </div>
                  <div className="admin-item-actions">
                    <button className="ghost-btn" onClick={() => saveMenuDraft(item._id)} disabled={menuSavingId === item._id}>{menuSavingId === item._id ? 'Saving...' : 'Save'}</button>
                    <button className="ghost-btn admin-danger" onClick={() => deleteMenuItem(item._id)} disabled={menuSavingId === item._id}>Delete</button>
                  </div>
                </article>
              );
            })}
            {menuItems.length === 0 && <p className="placeholder">No menu items yet.</p>}
          </div>
        </section>
      </div>

      <section className="admin-card admin-orders-card">
        <h3>User Orders</h3>
        <div className="admin-list">
          {orders.map((order) => {
            const itemCount = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
            return (
              <article key={order._id} className="admin-list-item order-admin-item">
                <div className="order-admin-head">
                  <div>
                    <p className="order-id">Order #{order._id?.slice(-6)}</p>
                    <p className="order-time-hint">User: {order.userId}</p>
                  </div>
                  <div className="admin-status-controls">
                    <select
                      className="input-field"
                      value={order.status || 'Pending'}
                      onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                      disabled={statusSavingId === order._id}
                    >
                      {ORDER_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="order-meta">
                  <div>
                    <p className="order-label">Pickup</p>
                    <p>{formatPickupTime(order.pickupTime)}</p>
                  </div>
                  <div>
                    <p className="order-label">Items</p>
                    <p>{itemCount}</p>
                  </div>
                  <div>
                    <p className="order-label">Amount</p>
                    <p>Rs {(order.totalAmount || 0).toFixed(2)}</p>
                  </div>
                </div>
              </article>
            );
          })}
          {orders.length === 0 && <p className="placeholder">No orders placed yet.</p>}
        </div>
      </section>
    </section>
  );
}

export default Admin;
