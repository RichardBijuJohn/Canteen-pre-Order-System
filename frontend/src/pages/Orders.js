import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const formatPickupTime = (value) => {
  if (!value) return 'Awaiting slot';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const day = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    return `${time} · ${day}`;
  }
  return value;
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readyNotice, setReadyNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  const fetchOrders = (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    axios.get(`http://localhost:5000/api/orders/${id}`)
      .then(res => {
        setOrders(res.data);
        const readyOrder = res.data.find(order => (order.status || '').toLowerCase().includes('ready'));
        if (readyOrder) {
          const shortId = readyOrder._id ? readyOrder._id.slice(-5) : '00000';
          const pickupLabel = formatPickupTime(readyOrder.pickupTime);
          setReadyNotice(`Order #${shortId} is ready for pickup at ${pickupLabel}.`);
        } else {
          setReadyNotice('');
        }
      })
      .catch(() => setError('We cannot reach your recent orders.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    fetchOrders(userId);
  }, [userId, navigate]);

  // Real-time status update every 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = () => fetchOrders(userId);

  const statusTone = (status = '') => {
    const key = status.toLowerCase();
    if (key.includes('pending')) return 'pending';
    if (key.includes('complete')) return 'complete';
    if (key.includes('ready')) return 'ready';
    if (key.includes('cancel')) return 'cancelled';
    return 'default';
  };

  const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your pickup plan</p>
          <h2>Orders timeline.</h2>
        </div>
        <button className="ghost-btn" onClick={handleSync} disabled={loading}>Sync</button>
      </div>

      {userId && !loading && !error && orders.length > 0 && (
        <div className="order-summary">
          <div>
            <p className="order-label">Total amount</p>
            <p className="order-summary-value">₹{totalSpent.toFixed(2)}</p>
          </div>
          <div>
            <p className="order-label">Total orders</p>
            <p className="order-summary-value">{orders.length}</p>
          </div>
        </div>
      )}

      {readyNotice && (
        <div className="inline-banner success">{readyNotice}</div>
      )}

      {!userId && (
        <div className="inline-banner error">Sign in to review your previous orders.</div>
      )}

      {userId && loading && <div className="placeholder">Checking your most recent orders...</div>}

      {userId && error && !loading && <div className="inline-banner error">{error}</div>}

      {userId && !loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <h3>No orders yet</h3>
          <p>Plan tomorrow's lunch from the menu to see it tracked here.</p>
        </div>
      )}

      {userId && !loading && !error && orders.length > 0 && (
        <div className="card-grid orders-grid">
          {orders.map((order, index) => {
            const shortId = order._id ? order._id.slice(-5) : '00000';
            const itemCount = order.items && order.items.length
              ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              : 1;

            const isReady = (order.status || '').toLowerCase().includes('ready');
            const pickupLabel = formatPickupTime(order.pickupTime);
            return (
              <article key={order._id || `order-${index}`} className={`order-card${isReady ? ' ready-pulse' : ''}`}>
                <div className="order-header">
                  <p className="order-id">Order #{shortId}</p>
                  <span className={`status-chip ${statusTone(order.status)}`}>{order.status}</span>
                  {isReady && (
                    <span className="ready-badge">Ready for Pickup!</span>
                  )}
                </div>
                <div className="order-amount">₹{(order.totalAmount || 0).toFixed(2)}</div>
                <div className="order-meta">
                  <div>
                    <p className="order-label">Pickup time</p>
                    <p>{isReady ? pickupLabel : `ETA ${pickupLabel}`}</p>
                  </div>
                  <div>
                    <p className="order-label">Items</p>
                    <p>{itemCount}</p>
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <ul className="order-items">
                    {(() => {
                      // Compute if pickup time is reached for this order (reactive to now)
                      const pickupDate = new Date(order.pickupTime);
                      const isDone = pickupDate <= new Date(now);
                      let pendingShown = false;
                      return order.items.map((item, idx) => {
                        const quantity = item.quantity || 1;
                        const lineTotal = ((item.price || 0) * quantity).toFixed(2);
                        let itemStatus = (item.status || 'Pending').toLowerCase();
                        // If pickup time is reached, mark as done visually
                        if (isDone) itemStatus = 'done';
                        const done = itemStatus === 'done';
                        // Only show one Pending chip per order
                        let chip = null;
                        if (done) {
                          chip = <span className="item-chip done">Done</span>;
                        } else if (!pendingShown) {
                          chip = <span className="item-chip pending">Pending</span>;
                          pendingShown = true;
                        }
                        return (
                          <li key={`${order._id || 'order'}-${idx}`}>
                            <div className="order-item-main">
                              <span>{item.name || 'Item'}</span>
                              {chip}
                            </div>
                            <span className="order-item-meta">× {quantity} · ₹{lineTotal}</span>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Orders;