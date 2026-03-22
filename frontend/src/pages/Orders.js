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

const computeOrderState = (order, nowMs) => {
  const pickupMs = new Date(order.pickupTime).getTime();
  const statusKey = (order.status || '').toLowerCase();
  if (statusKey.includes('picked')) return 'picked';
  if (statusKey.includes('cancel')) return 'cancelled';
  const explicitDone = statusKey.includes('ready') || statusKey.includes('complete') || statusKey.includes('done');
  const doneByTime = !Number.isNaN(pickupMs) && pickupMs <= nowMs;
  return explicitDone || doneByTime ? 'done' : 'pending';
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  const fetchOrders = (id, options = {}) => {
    const { silent = false } = options;
    if (!id) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    axios.get(`http://localhost:5000/api/orders/${id}`)
      .then(res => {
        setOrders(res.data);
      })
      .catch(() => setError('We cannot reach your recent orders.'))
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    fetchOrders(userId);
  }, [userId, navigate]);

  // Keep the timeline clock and backend status in sync.
  useEffect(() => {
    if (!userId) return undefined;

    const interval = setInterval(() => {
      setNow(Date.now());
      fetchOrders(userId, { silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  const handleSync = () => fetchOrders(userId);

  const statusTone = (status = '') => {
    const key = status.toLowerCase();
    if (key.includes('pending')) return 'pending';
    if (key.includes('complete')) return 'complete';
    if (key.includes('ready')) return 'ready';
    if (key.includes('picked')) return 'picked';
    if (key.includes('cancel')) return 'cancelled';
    return 'default';
  };

  const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const normalizedOrders = [...orders].sort((a, b) => {
    const aMs = new Date(a.pickupTime).getTime();
    const bMs = new Date(b.pickupTime).getTime();
    const safeA = Number.isNaN(aMs) ? 0 : aMs;
    const safeB = Number.isNaN(bMs) ? 0 : bMs;
    return safeA - safeB;
  });
  const pendingCount = normalizedOrders.filter((order) => computeOrderState(order, now) === 'pending').length;
  const readyCount = normalizedOrders.length - pendingCount;
  const nextPickupOrder = normalizedOrders.find((order) => computeOrderState(order, now) === 'pending');
  const nextPickupLabel = nextPickupOrder ? formatPickupTime(nextPickupOrder.pickupTime) : 'No pending pickups';

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
        <div className="order-kpi-grid">
          <div className="order-kpi-card">
            <p className="order-label">Total amount</p>
            <p className="order-summary-value">₹{totalSpent.toFixed(2)}</p>
          </div>
          <div className="order-kpi-card">
            <p className="order-label">Pending now</p>
            <p className="order-summary-value">{pendingCount}</p>
          </div>
          <div className="order-kpi-card">
            <p className="order-label">Ready now</p>
            <p className="order-summary-value">{readyCount}</p>
          </div>
          <div className="order-kpi-card">
            <p className="order-label">Next pickup</p>
            <p className="order-summary-value order-summary-small">{nextPickupLabel}</p>
          </div>
        </div>
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
          {normalizedOrders.map((order, index) => {
            const shortId = order._id ? order._id.slice(-5) : '00000';
            const itemCount = order.items && order.items.length
              ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              : 1;

            const orderState = computeOrderState(order, now);
            const isPicked = orderState === 'picked';
            const isReady = orderState === 'done';
            const pickupLabel = formatPickupTime(order.pickupTime);
            return (
              <article key={order._id || `order-${index}`} className={`order-card${isReady ? ' ready-pulse' : ''}`}>
                <div className="order-header">
                  <div>
                    <p className="order-id">Order #{shortId}</p>
                    <p className="order-time-hint">Placed for {pickupLabel}</p>
                  </div>
                  <span className={`status-chip ${isPicked ? 'picked' : (isReady ? 'ready' : statusTone(order.status))}`}>
                    {isPicked ? 'Picked' : (isReady ? 'Done' : (order.status || 'Pending'))}
                  </span>
                  {isReady && !isPicked && (
                    <span className="ready-badge">Ready for Pickup!</span>
                  )}
                </div>
                <div className="order-amount">₹{(order.totalAmount || 0).toFixed(2)}</div>
                <div className="order-meta">
                  <div>
                    <p className="order-label">Pickup time</p>
                    <p>{(isReady || isPicked) ? pickupLabel : `ETA ${pickupLabel}`}</p>
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