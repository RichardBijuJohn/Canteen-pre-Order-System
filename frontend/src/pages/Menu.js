import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MENU_BANNER_IMAGES = [
  {
    src: 'https://www.yodeck.com/wp-content/uploads/2022/07/cafe-menu-board-template.jpg',
    alt: 'Canteen menu board with assorted dishes',
    caption: 'Daily specials board'
  },
  {
    src: 'https://onhisowntrip.com/wp-content/uploads/2025/12/Screenshot-2025-12-29-at-4.05.35%E2%80%AFPM.png',
    alt: 'Street food counter and menu signage',
    caption: 'Fresh picks at the counter'
  },
  {
    src: 'https://media.istockphoto.com/id/1457979959/photo/snack-junk-fast-food-on-table-in-restaurant-soup-sauce-ornament-grill-hamburger-french-fries.jpg?s=612x612&w=0&k=20&c=QbFk2SfDb-7oK5Wo9dKmzFGNoi-h8HVEdOYWZbIjffo=',
    alt: 'Restaurant chalkboard menu display',
    caption: 'Know your options before ordering'
  }
];

const parsePrepMinutes = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 15;
};

const computePickupSlot = (minutes = 15) => {
  const eta = new Date(Date.now() + minutes * 60000);
  return {
    iso: eta.toISOString(),
    label: eta.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
};

const WORKING_HOURS = {
  startMinutes: 8 * 60, // 8:00 AM
  endMinutes: 22 * 60 // 10:00 PM
};

const WORKING_HOURS_LABEL = '8:00 AM - 10:00 PM';

const isWithinWorkingHours = () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= WORKING_HOURS.startMinutes && minutes < WORKING_HOURS.endMinutes;
};

function Menu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // floating toast
  const [placingId, setPlacingId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const userId = localStorage.getItem('userId');
  const navigate = useNavigate();

  const fetchMenu = () => {
    setLoading(true);
    setError('');
    axios.get('http://localhost:5000/api/menu')
      .then(res => setMenu(res.data))
      .catch(() => setError('Unable to load menu right now.'))
      .finally(() => setLoading(false));
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setToast({ type: 'error', message: 'Sign in to browse the menu and schedule pickups.' });
      navigate('/login', { replace: true });
      return;
    }

    fetchMenu();
  }, [userId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % MENU_BANNER_IMAGES.length);
    }, 3800);

    return () => clearInterval(timer);
  }, []);

  const handleQuantityChange = (id, value) => {
    const numeric = Math.max(1, parseInt(value, 10) || 1);
    setQuantities(prev => ({ ...prev, [id]: numeric }));
  };

  const placeOrder = async (item) => {
    if (!userId) {
      setToast({ type: 'error', message: 'Please log in before placing an order.' });
      navigate('/login', { replace: true });
      return;
    }

    if (!isWithinWorkingHours()) {
      setToast({ type: 'error', message: `Orders are open only between ${WORKING_HOURS_LABEL} (college hours).` });
      return;
    }

    setPlacingId(item._id);
    setToast(null);
    const quantity = quantities[item._id] || 1;
    const unitPrice = Number(item.price) || 0;
    const totalAmount = unitPrice * quantity;
    const prepMinutes = parsePrepMinutes(item.preparationTime);
    const pickupSlot = computePickupSlot(prepMinutes);

    try {
      await axios.post('http://localhost:5000/api/orders/place', {
        userId,
        items: [{ ...item, quantity, price: unitPrice }],
        totalAmount,
        pickupTime: pickupSlot.iso
      });

      setToast({ type: 'success', message: `${item.name} scheduled for ${pickupSlot.label}.` });
    } catch (err) {
      console.log(err);
      if (err.response?.status === 401) {
        setToast({ type: 'error', message: 'Session expired. Sign in again to continue.' });
        navigate('/login', { replace: true });
      } else if (err.response?.status === 403) {
        setToast({ type: 'error', message: err.response?.data?.msg || `Orders are open only between ${WORKING_HOURS_LABEL} (college hours).` });
      } else {
        setToast({ type: 'error', message: 'Order could not be created. Try again.' });
      }
    } finally {
      setPlacingId('');
    }
  };

  const filteredMenu = menu.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const name = (item.name || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    return name.includes(query) || category.includes(query);
  });

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today in the counter</p>
          <h2>Pick what fits your break.</h2>
        </div>
        <button className="ghost-btn" onClick={fetchMenu} disabled={loading}>Refresh</button>
      </div>

      <section className="menu-billboard" aria-label="Canteen highlights">
        <div className="menu-slider-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          {MENU_BANNER_IMAGES.map((photo) => (
            <figure key={photo.src} className="menu-slide">
              <img src={photo.src} alt={photo.alt} loading="lazy" />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>

        <div className="menu-slider-controls">
          {MENU_BANNER_IMAGES.map((photo, index) => (
            <button
              key={`${photo.caption}-${index}`}
              type="button"
              className={`menu-dot${activeSlide === index ? ' active' : ''}`}
              onClick={() => setActiveSlide(index)}
              aria-label={`Show slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <div className="menu-search-wrap">
        <input
          type="text"
          className="menu-search-input"
          placeholder="Search dishes or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <p className="menu-search-meta">Showing {filteredMenu.length} of {menu.length} items</p>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`floating-toast ${toast.type}`}>{toast.message}</div>
      )}

      {loading && (
        <div className="placeholder">Loading menu...</div>
      )}

      {error && !loading && (
        <div className="inline-banner error">{error}</div>
      )}

      {!loading && !error && filteredMenu.length > 0 && (
        <div className="card-grid">
          {filteredMenu.map(item => {
            const rating = typeof item.rating === 'number'
              ? item.rating.toFixed(1)
              : '4.0';
            const preparationTime = item.preparationTime || '10 min';
            const quantity = quantities[item._id] || 1;
            const unitPrice = Number(item.price) || 0;
            const displayTotal = (unitPrice * quantity).toFixed(2);

            return (
              <article key={item._id} className="menu-card">
                <div>
                  <p className="menu-eyebrow">{item.category || 'Chef special'}</p>
                  <h3>{item.name}</h3>
                </div>

                <div className="menu-stats">
                  <div className="metric-block">
                    <span className="metric-label">Rating</span>
                    <span className="metric-value">{rating} / 5</span>
                  </div>
                  <div className="metric-block">
                    <span className="metric-label">Prep time</span>
                    <span className="metric-value">{preparationTime}</span>
                  </div>
                </div>

                <div className="quantity-control">
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
                  <div className="quantity-total">	{displayTotal}</div>
                </div>

                <div className="menu-meta">
                  <span className="menu-price">	{item.price}</span>
                  <button
                    className="primary-btn"
                    onClick={() => placeOrder(item)}
                    disabled={!userId || placingId === item._id}
                  >
                    {placingId === item._id ? 'Scheduling...' : 'Pre-order'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredMenu.length === 0 && (
        <div className="empty-state compact-empty">
          <h3>No matching items</h3>
          <p>Try another keyword like dosa, rice, snack, or drink.</p>
        </div>
      )}
    </section>
  );
}

export default Menu;