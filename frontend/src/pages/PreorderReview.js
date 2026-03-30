import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MAX_PREORDER_TOTAL_QUANTITY,
  calculatePreorderTotal,
  clearPreorderDraft,
  getPreorderDraftItems,
  removePreorderDraftItem,
  updatePreorderDraftQuantity
} from '../utils/preorderDraft';

const WORKING_HOURS = {
  startMinutes: 8 * 60,
  endMinutes: 20 * 60
};

const WORKING_HOURS_LABEL = '8:00 AM - 8:00 PM';
const PUBLIC_BASE_URL = (process.env.REACT_APP_PUBLIC_BASE_URL || '').trim();

const isWithinWorkingHours = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= WORKING_HOURS.startMinutes && minutes < WORKING_HOURS.endMinutes;
};

function PreorderReview() {
  const [items, setItems] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSessionId, setPaymentSessionId] = useState('');
  const [paymentState, setPaymentState] = useState('idle');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    setItems(getPreorderDraftItems());

    const handleDraftUpdate = () => setItems(getPreorderDraftItems());
    window.addEventListener('storage', handleDraftUpdate);
    window.addEventListener('preorder-draft-changed', handleDraftUpdate);

    return () => {
      window.removeEventListener('storage', handleDraftUpdate);
      window.removeEventListener('preorder-draft-changed', handleDraftUpdate);
    };
  }, [userId, navigate]);

  const totalAmount = useMemo(() => calculatePreorderTotal(items), [items]);

  useEffect(() => {
    if (!banner.message) return undefined;
    const timer = setTimeout(() => setBanner({ type: '', message: '' }), 2800);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (!paymentSessionId || !showPaymentModal) return undefined;

    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`/api/orders/payment-session/${paymentSessionId}`);
        const state = res.data?.state || 'pending';
        setPaymentState(state);
        if (state === 'ordered') {
          clearInterval(poll);
          clearPreorderDraft();
          setItems([]);
          setShowPaymentModal(false);
          setBanner({ type: 'success', message: 'Payment complete. Order placed successfully.' });
          setTimeout(() => navigate('/orders'), 600);
        }
      } catch (err) {
        const message = err.response?.data?.msg || 'Payment session expired. Please try again.';
        setBanner({ type: 'error', message });
        clearInterval(poll);
        setShowPaymentModal(false);
        setPaymentSessionId('');
        setPaymentState('idle');
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [paymentSessionId, showPaymentModal, navigate]);

  const handleQuantityChange = (itemId, value) => {
    const result = updatePreorderDraftQuantity(itemId, value);
    setItems(getPreorderDraftItems());
    if (result.capped) {
      setBanner({
        type: 'error',
        message: `Order limit is ${MAX_PREORDER_TOTAL_QUANTITY} total items.`
      });
    }
  };

  const handleRemove = (itemId) => {
    removePreorderDraftItem(itemId);
    setItems(getPreorderDraftItems());
  };

  const handleClear = () => {
    clearPreorderDraft();
    setItems([]);
  };

  const handleFinalizeOrder = async () => {
    if (!userId) {
      setBanner({ type: 'error', message: 'Please log in before placing your order.' });
      navigate('/login', { replace: true });
      return;
    }

    if (items.length === 0) {
      setBanner({ type: 'error', message: 'Add at least one item to place an order.' });
      return;
    }

    if (!isWithinWorkingHours()) {
      setBanner({ type: 'error', message: `Orders can be finalized only between ${WORKING_HOURS_LABEL}.` });
      return;
    }

    setPlacingOrder(true);
    setBanner({ type: '', message: '' });

    try {
      const payload = {
        userId,
        items: items.map((item) => ({
          _id: item._id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          preparationTime: item.preparationTime
        })),
        totalAmount
      };

      const res = await axios.post('/api/orders/payment-session/create', payload);
      setPaymentSessionId(res.data?.sessionId || '');
      setPaymentAmount(Number(res.data?.totalAmount || totalAmount || 0));
      setPaymentState(res.data?.state || 'pending');
      setShowPaymentModal(true);
    } catch (err) {
      if (err.response?.status === 401) {
        setBanner({ type: 'error', message: 'Session expired. Please sign in again.' });
        navigate('/login', { replace: true });
      } else if (err.response?.status === 403) {
        setBanner({ type: 'error', message: err.response?.data?.msg || `Orders are open only between ${WORKING_HOURS_LABEL}.` });
      } else {
        setBanner({ type: 'error', message: err.response?.data?.msg || 'Could not start payment right now. Please try again.' });
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const appBaseUrl = PUBLIC_BASE_URL || window.location.origin;
  const paymentUrl = paymentSessionId
    ? `${appBaseUrl}/demo-payment/${paymentSessionId}`
    : '';
  const qrCodeSrc = paymentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(paymentUrl)}`
    : '';

  return (
    <section className="page-section">
      <div className="section-heading preorder-head">
        <div>
          <p className="eyebrow">Review your pre-order</p>
          <h2>Confirm before placing.</h2>
        </div>
        <button className="ghost-btn" type="button" onClick={() => navigate('/menu')}>
          Add more items
        </button>
      </div>

      {banner.message && (
        <div className={`inline-banner ${banner.type === 'error' ? 'error' : 'success'}`}>
          {banner.message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>Your pre-order list is empty</h3>
          <p>Select dishes from the menu, then come back here to finalize.</p>
        </div>
      ) : (
        <>
          <div className="preorder-list">
            {items.map((item) => {
              const quantity = Number(item.quantity) || 1;
              const unitPrice = Number(item.price) || 0;
              const lineTotal = (unitPrice * quantity).toFixed(2);

              return (
                <article key={item._id} className="preorder-item-card">
                  <div>
                    <h3>{item.name || 'Item'}</h3>
                    <p className="preorder-unit-price">Unit price: ₹{unitPrice.toFixed(2)}</p>
                  </div>

                  <div className="preorder-item-actions">
                    <label>
                      Quantity
                      <input
                        type="number"
                        min="1"
                        max={MAX_PREORDER_TOTAL_QUANTITY}
                        className="quantity-input"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(item._id, e.target.value)}
                      />
                    </label>
                    <p className="preorder-line-price">₹{lineTotal}</p>
                    <button className="ghost-btn" type="button" onClick={() => handleRemove(item._id)}>
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="preorder-summary-card">
            <p className="order-label">Total amount</p>
            <p className="preorder-total">₹{totalAmount.toFixed(2)}</p>
            <p className="order-item-meta"></p>

            <div className="preorder-summary-actions">
              <button className="ghost-btn" type="button" onClick={handleClear} disabled={placingOrder}>
                Clear list
              </button>
              <button className="primary-btn" type="button" onClick={handleFinalizeOrder} disabled={placingOrder}>
                {placingOrder ? 'Starting payment...' : 'Place order'}
              </button>
            </div>
          </div>
        </>
      )}

      {showPaymentModal && (
        <div className="payment-modal-backdrop" role="dialog" aria-modal="true" aria-label="Scan QR for demo payment">
          <div className="payment-modal-card">
            <p className="eyebrow">Demo online payment</p>
            <h3>Scan this QR on your phone</h3>
            <p className="order-item-meta">After payment is completed on phone, your order will be placed automatically.</p>
            <p className="demo-payment-amount">Amount: ₹{paymentAmount.toFixed(2)}</p>

            {qrCodeSrc && <img className="payment-qr-image" src={qrCodeSrc} alt="QR code for demo payment" />}

            <p className="payment-modal-status">Status: {paymentState === 'ordered' ? 'Order placed' : paymentState === 'processing' ? 'Processing payment' : 'Waiting for payment'}</p>
            {window.location.hostname === 'localhost' && !PUBLIC_BASE_URL && (
              <p className="order-item-meta">Tip: open this app from your PC network IP (not localhost) for phone scanning.</p>
            )}

            <div className="payment-modal-actions">
              <a className="ghost-btn" href={paymentUrl} target="_blank" rel="noreferrer">Open payment page</a>
              <button className="ghost-btn" type="button" onClick={handleClosePaymentModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default PreorderReview;
