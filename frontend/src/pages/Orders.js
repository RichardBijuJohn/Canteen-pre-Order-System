import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatOrderDisplayId } from '../utils/orderDisplayId';

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
  const explicitReady = statusKey.includes('ready') || statusKey.includes('complete') || statusKey.includes('done');
  const readyByTime = !Number.isNaN(pickupMs) && pickupMs <= nowMs;
  return explicitReady || readyByTime ? 'ready' : 'pending';
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pickedNotice, setPickedNotice] = useState('');
  const [reviewBanner, setReviewBanner] = useState({ type: '', message: '' });
  const [reviewDrafts, setReviewDrafts] = useState({});
  const previousStatusRef = useRef({});
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  const notifyPicked = (message) => {
    if (!message) return;
    if (typeof window === 'undefined') return;

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Order picked', { body: message });
        return;
      }
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('Order picked', { body: message });
          } else {
            window.alert(message);
          }
        });
        return;
      }
    }

    window.alert(message);
  };

  const fetchOrders = (id, options = {}) => {
    const { silent = false } = options;
    if (!id) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    axios.get(`http://localhost:5000/api/orders/${id}`)
      .then(res => {
        const nextOrders = res.data || [];
        const previousStatusMap = previousStatusRef.current || {};
        let pickedMessage = '';

        nextOrders.forEach((order) => {
          const statusKey = String(order.status || '').toLowerCase();
          const wasPicked = String(previousStatusMap[order._id] || '').toLowerCase().includes('picked');
          const isPicked = statusKey.includes('picked');
          if (!wasPicked && isPicked) {
            const shortId = formatOrderDisplayId(order.orderCode || order._id);
            pickedMessage = `Order #${shortId} picked.`;
          }
        });

        previousStatusRef.current = nextOrders.reduce((acc, order) => {
          acc[order._id] = order.status || '';
          return acc;
        }, {});

        if (pickedMessage) {
          setPickedNotice(pickedMessage);
          notifyPicked(pickedMessage);
        }

        setOrders(nextOrders);
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

  useEffect(() => {
    if (!pickedNotice) return undefined;
    const timer = setTimeout(() => setPickedNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [pickedNotice]);

  useEffect(() => {
    if (!reviewBanner.message) return undefined;
    const timer = setTimeout(() => setReviewBanner({ type: '', message: '' }), 2600);
    return () => clearTimeout(timer);
  }, [reviewBanner]);

  const handleSync = () => fetchOrders(userId);

  const submitReview = async (orderId) => {
    const draft = reviewDrafts[orderId] || {};
    const ratingValue = Number(draft.rating);

    if (!userId) {
      setReviewBanner({ type: 'error', message: 'Login required to review orders.' });
      return;
    }

    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      setReviewBanner({ type: 'error', message: 'Pick a rating between 1 and 5.' });
      return;
    }

    try {
      setReviewDrafts((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saving: true }
      }));
      await axios.post(`http://localhost:5000/api/orders/${orderId}/review`, {
        userId,
        rating: ratingValue
      });
      setReviewBanner({ type: 'success', message: 'Thanks for the review.' });
      setReviewDrafts((prev) => ({
        ...prev,
        [orderId]: { rating: '' }
      }));
      fetchOrders(userId, { silent: true });
    } catch (err) {
      const message = err?.response?.data?.msg || 'Unable to submit review.';
      setReviewBanner({ type: 'error', message });
    } finally {
      setReviewDrafts((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saving: false }
      }));
    }
  };

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
  const readyCount = normalizedOrders.filter((order) => computeOrderState(order, now) === 'ready').length;
  const nextPickupOrder = normalizedOrders.find((order) => computeOrderState(order, now) === 'pending');
  const nextPickupLabel = readyCount > 0
    ? (readyCount === 1 ? 'Order ready for pickup' : `${readyCount} orders ready for pickup`)
    : (nextPickupOrder ? formatPickupTime(nextPickupOrder.pickupTime) : 'No pending pickups');

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

      {pickedNotice && (
        <div className="inline-banner success">{pickedNotice}</div>
      )}

      {reviewBanner.message && (
        <div className={`inline-banner ${reviewBanner.type === 'error' ? 'error' : 'success'}`}>
          {reviewBanner.message}
        </div>
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
            const shortId = formatOrderDisplayId(order.orderCode || order._id);
            const itemCount = order.items && order.items.length
              ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              : 1;
            const review = order.review || {};
            const hasReview = Boolean(review.rating);
            const reviewDraft = reviewDrafts[order._id] || {};

            const orderState = computeOrderState(order, now);
            const isPicked = orderState === 'picked';
            const isReady = orderState === 'ready';
            const canReview = Boolean(order.pickedAt) || isPicked;
            const pickupLabel = formatPickupTime(order.pickupTime);
            return (
              <article key={order._id || `order-${index}`} className={`order-card${isReady ? ' ready-pulse' : ''}`}>
                <div className="order-header">
                  <div>
                    <p className="order-id">Order #{shortId}</p>
                    <p className="order-time-hint">Placed for {pickupLabel}</p>
                  </div>
                  <span className={`status-chip ${isPicked ? 'picked' : (isReady ? 'ready' : statusTone(order.status))}`}>
                    {isPicked ? 'Picked' : (isReady ? 'Ready for Pickup' : (order.status || 'Pending'))}
                  </span>
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
                  <div>
                    <p className="order-label">Mode of payment</p>
                    <p>{order.paymentMode || 'Cash'}</p>
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

                {canReview && !hasReview && (
                  <div className="order-review">
                    <p className="order-label">Rate your pickup</p>
                    <div className="order-review-controls">
                      <select
                        className="input-field"
                        value={reviewDraft.rating || ''}
                        onChange={(e) =>
                          setReviewDrafts((prev) => ({
                            ...prev,
                            [order._id]: { ...prev[order._id], rating: e.target.value }
                          }))
                        }
                      >
                        <option value="">Rating</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => submitReview(order._id)}
                        disabled={reviewDraft.saving}
                      >
                        {reviewDraft.saving ? 'Submitting...' : 'Submit review'}
                      </button>
                    </div>
                  </div>
                )}

                {hasReview && (
                  <div className="order-review">
                    <p className="order-label">Your review</p>
                    <p>Rating: {review.rating} / 5</p>
                  </div>
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