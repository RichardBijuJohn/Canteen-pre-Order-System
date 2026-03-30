import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculatePreorderTotal,
  clearPreorderDraft,
  getPreorderDraftItems,
  removePreorderDraftItem,
  updatePreorderDraftQuantity
} from '../utils/preorderDraft';

const WORKING_HOURS = {
  startMinutes: 8 * 60,
  endMinutes: 17 * 60
};

const WORKING_HOURS_LABEL = '8:00 AM - 5:00 PM';

const isWithinWorkingHours = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= WORKING_HOURS.startMinutes && minutes < WORKING_HOURS.endMinutes;
};

function PreorderReview() {
  const [items, setItems] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
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

  const handleQuantityChange = (itemId, value) => {
    updatePreorderDraftQuantity(itemId, value);
    setItems(getPreorderDraftItems());
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
      await axios.post('http://localhost:5000/api/orders/place', {
        userId,
        items: items.map((item) => ({
          _id: item._id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          preparationTime: item.preparationTime
        })),
        totalAmount
      });

      clearPreorderDraft();
      setItems([]);
      setBanner({ type: 'success', message: 'Order placed successfully.' });
      setTimeout(() => navigate('/orders'), 700);
    } catch (err) {
      if (err.response?.status === 401) {
        setBanner({ type: 'error', message: 'Session expired. Please sign in again.' });
        navigate('/login', { replace: true });
      } else if (err.response?.status === 403) {
        setBanner({ type: 'error', message: err.response?.data?.msg || `Orders are open only between ${WORKING_HOURS_LABEL}.` });
      } else {
        setBanner({ type: 'error', message: 'Could not place order right now. Please try again.' });
      }
    } finally {
      setPlacingOrder(false);
    }
  };

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

            <div className="preorder-summary-actions">
              <button className="ghost-btn" type="button" onClick={handleClear} disabled={placingOrder}>
                Clear list
              </button>
              <button className="primary-btn" type="button" onClick={handleFinalizeOrder} disabled={placingOrder}>
                {placingOrder ? 'Placing order...' : 'Place order'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default PreorderReview;
