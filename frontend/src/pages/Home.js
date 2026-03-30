import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const campusQuotes = [
  'Good food tastes better when shared with great friends.',
  'A quick meal and a long laugh can fix almost any college day.',
  'Friends gather where food is warm and stories are endless.',
  'The best campus memories start with a table full of snacks.',
  'Food brings us to the table, friendship keeps us there.',
  'Some of the best group projects begin over fries and chai.',
  'Eat together, smile together, and make every break count.'
];

const formatTimeLabel = (isoTime) => {
  if (!isoTime) return '';
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName');
  const userId = localStorage.getItem('userId');
  const [orderInsight, setOrderInsight] = useState({
    loading: false,
    finalReadyTime: '',
    pendingCount: 0,
    message: ''
  });
  const [quoteIndex, setQuoteIndex] = useState(0);
  const pageRef = useRef(null);
  const highlightRef = useRef(null);
  const aboutRef = useRef(null);
  const featuresRef = useRef(null);
  const activeSectionRef = useRef('home');

  const loadOrderInsight = async () => {
    if (!userId) {
      setOrderInsight({ loading: false, finalReadyTime: '', pendingCount: 0, message: '' });
      return;
    }

    setOrderInsight((prev) => ({ ...prev, loading: true }));
    try {
      const res = await axios.get(`http://localhost:5000/api/orders/${userId}`);
      const now = Date.now();
      const orders = Array.isArray(res.data) ? res.data : [];

      const pendingOrders = orders.filter((order) => {
        const pickup = new Date(order.pickupTime).getTime();
        if (Number.isNaN(pickup)) return false;

        const statusKey = (order.status || '').toLowerCase();
        const markedReady = statusKey.includes('ready') || statusKey.includes('complete') || statusKey.includes('done');
        return pickup > now && !markedReady;
      });

      if (!pendingOrders.length) {
        setOrderInsight({
          loading: false,
          finalReadyTime: '',
          pendingCount: 0,
          message: 'No active pending orders right now.'
        });
        return;
      }

      const finalReadyTs = Math.max(...pendingOrders.map((order) => new Date(order.pickupTime).getTime()));
      const finalReadyTime = formatTimeLabel(finalReadyTs);

      setOrderInsight({
        loading: false,
        finalReadyTime,
        pendingCount: pendingOrders.length,
        message: `All your current orders should be ready by ${finalReadyTime}.`
      });
    } catch (err) {
      setOrderInsight({
        loading: false,
        finalReadyTime: '',
        pendingCount: 0,
        message: 'Unable to load your pickup summary at the moment.'
      });
    }
  };

  const scrollToHighlights = () => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (location.hash === '#about') {
      aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (location.hash === '#features') {
      featuresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll('[data-home-section]'));
    if (!sections.length) return;

    const ratios = new Map();
    const emit = (section, force = false) => {
      if (!force && activeSectionRef.current === section) {
        return;
      }

      activeSectionRef.current = section;
      window.dispatchEvent(new CustomEvent('home-section-change', { detail: { section } }));
    };

    const rootStyles = getComputedStyle(document.documentElement);
    const headerOffset = Number.parseInt(rootStyles.scrollPaddingTop, 10) || 0;
    const rootMarginTop = -(headerOffset + 8);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const key = entry.target.getAttribute('data-home-section');
        if (key) {
          ratios.set(key, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
      });

      let current = 'home';
      let best = 0;
      ratios.forEach((ratio, key) => {
        if (ratio > best) {
          best = ratio;
          current = key;
        }
      });

      if (best < 0.1) {
        let nearestDistance = Number.POSITIVE_INFINITY;
        sections.forEach((section) => {
          const key = section.getAttribute('data-home-section');
          if (!key) return;

          const distance = Math.abs(section.getBoundingClientRect().top - headerOffset - 24);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            current = key;
          }
        });
      }

      emit(current);
    }, {
      rootMargin: `${rootMarginTop}px 0px -45% 0px`,
      threshold: [0, 0.15, 0.35, 0.6]
    });

    sections.forEach((section) => observer.observe(section));
    emit(location.hash === '#about' ? 'about' : location.hash === '#features' ? 'features' : 'home', true);

    return () => {
      observer.disconnect();
    };
  }, [location.hash]);

  useEffect(() => {
    loadOrderInsight();

    const timer = setInterval(() => {
      loadOrderInsight();
    }, 60000);

    const sync = () => loadOrderInsight();
    window.addEventListener('storage', sync);
    window.addEventListener('user-auth-changed', sync);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', sync);
      window.removeEventListener('user-auth-changed', sync);
    };
  }, [userId]);

  useEffect(() => {
    const quoteTimer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % campusQuotes.length);
    }, 4500);

    return () => {
      clearInterval(quoteTimer);
    };
  }, []);

  return (
    <section className="page-section public-home" ref={pageRef}>
      <div className="public-home-hero" data-home-section="home" id="home">
        <p className="eyebrow">Smart Campus Canteen</p>
        <h1 className="home-title">
          Food ready when <span className="hero-accent">your break starts</span>.
        </h1>
        <p className="subtitle">
          Skip uncertainty and long lines. Pre-order in seconds, keep your day on track, and pick up fresh meals right on time.
        </p>

        <div className="home-actions">
          <button className="primary-btn" onClick={() => navigate('/menu')}>Order Now</button>
          {userId ? (
            <button className="ghost-btn" onClick={() => navigate('/orders')}>View Orders</button>
          ) : (
            <button className="ghost-btn" onClick={() => navigate('/login')}>
              {userName ? 'Switch Account' : 'Login / Register'}
            </button>
          )}
        </div>

        <div className="quote-rotator" aria-live="polite" aria-atomic="true">
          <p className="quote-text" key={quoteIndex}>{campusQuotes[quoteIndex]}</p>
        </div>

        {userId && (
          <div className="home-order-insight">
            <p className="order-insight-title">Pickup Summary</p>
            <p className="order-insight-message">
              {orderInsight.loading ? 'Checking your latest order timeline...' : orderInsight.message}
            </p>
            {!orderInsight.loading && orderInsight.finalReadyTime && (
              <p className="order-insight-time">Final ready time: {orderInsight.finalReadyTime}</p>
            )}
            {!orderInsight.loading && orderInsight.pendingCount > 0 && (
              <p className="order-insight-count">Active pending orders: {orderInsight.pendingCount}</p>
            )}
          </div>
        )}

        <button className="scroll-cue" onClick={scrollToHighlights} aria-label="Scroll down">
          <span>Scroll Down</span>
          <span className="scroll-arrow">↓</span>
        </button>
      </div>

      <div className="home-highlight-grid" ref={highlightRef} id="highlights">
        <article className="highlight-card reveal-up">
          <h3>Fast decisions</h3>
          <p>See clear prep times before placing an order, so you know exactly what fits your break.</p>
        </article>
        <article className="highlight-card reveal-up delay-1">
          <h3>Live pickup flow</h3>
          <p>Track pending to ready status for each order and head to the counter when your meal is done.</p>
        </article>
        <article className="highlight-card reveal-up delay-2">
          <h3>Built for student life</h3>
          <p>From quick snacks to lunch combos, order from anywhere on campus without losing your queue time.</p>
        </article>
      </div>

      <div className="home-section-cta">
        <button className="ghost-btn" onClick={scrollToAbout}>How It Works</button>
      </div>

      <div className="section-separator" aria-hidden="true">
        <span>About</span>
      </div>

      <section className="home-stack-section section-band about-band" ref={aboutRef} id="about" data-home-section="about">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">About The Platform</p>
            <h2>How this works in 3 steps.</h2>
          </div>
        </div>

        <div className="about-visuals-row">
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075977.png" alt="Order food" className="about-img" />
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075979.png" alt="Wait for prep" className="about-img" />
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075975.png" alt="Pickup meal" className="about-img" />
        </div>

        <div className="steps-grid">
          <article className="step-card reveal-up">
            <span className="step-index">1</span>
            <h3>Order</h3>
            <p>Choose your food, set quantity, and place your pre-order from anywhere on campus.</p>
          </article>
          <article className="step-card reveal-up delay-1">
            <span className="step-index">2</span>
            <h3>Wait</h3>
            <p>Your food is prepared while you stay in class or catch up with friends.</p>
          </article>
          <article className="step-card reveal-up delay-2">
            <span className="step-index">3</span>
            <h3>Pickup</h3>
            <p>Get your meal when the order is ready, without wasting your full break in line.</p>
          </article>
        </div>

        <div className="problem-panel reveal-up">
          <p className="eyebrow">Problem Statement</p>
          <h3>Students lose valuable break time in canteen queues.</h3>
          <p>
            Peak lunch hours create long lines and uncertain waiting time. Students either skip meals or miss rest time before
            the next class. Canteen Ahead solves this by letting students order early and pick up at the right time.
          </p>
        </div>

        <div className="home-section-cta">
          <button className="ghost-btn" onClick={scrollToFeatures}>See Features</button>
        </div>
      </section>

      <div className="section-separator" aria-hidden="true">
        <span>Features</span>
      </div>

      <section className="home-stack-section section-band features-band" ref={featuresRef} id="features" data-home-section="features">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Why Students Love It</p>
            <h2>Why this is cool for students.</h2>
          </div>
        </div>

        <div className="features-visuals-row">
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075972.png" alt="Save time" className="features-img" />
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075973.png" alt="No queues" className="features-img" />
          <img src="https://cdn-icons-png.flaticon.com/512/3075/3075974.png" alt="Order anywhere" className="features-img" />
        </div>

        <div className="features-hero reveal-up">
          <h3>Designed around student schedules, not kitchen queues.</h3>
          <p>
            Canteen Ahead helps you spend less time waiting and more time studying, socializing, and enjoying your break.
          </p>
        </div>

        <div className="feature-pill-grid">
          <article className="feature-pill-card reveal-up">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>Save time between lectures</p>
          </article>
          <article className="feature-pill-card reveal-up delay-1">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>No queues during rush hours</p>
          </article>
          <article className="feature-pill-card reveal-up delay-2">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>Order from anywhere on campus</p>
          </article>
          <article className="feature-pill-card reveal-up">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>Fresh and hot pickup experience</p>
          </article>
          <article className="feature-pill-card reveal-up delay-1">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>Flexible payments support</p>
          </article>
          <article className="feature-pill-card reveal-up delay-2">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>Simple real-time order tracking</p>
          </article>
        </div>

        <div className="home-section-cta">
          <button className="primary-btn" onClick={() => navigate('/menu')}>Start Ordering</button>
          <button className="ghost-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back To Top</button>
        </div>
      </section>
      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-col">
            <div className="footer-logo">Canteen Ahead</div>
            <div className="footer-desc">Smart pre-ordering for campus canteens. Save time, skip queues, and enjoy your break!</div>
          </div>
          <div className="footer-col" style={{alignItems: 'center'}}>
            <div className="footer-contact">
              <span>Contact: <a href="mailto:help@canteenahead.com" className="footer-link">help@canteenahead.com</a></span>
            </div>
            <div className="footer-social">
              <a href="https://instagram.com/" className="footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📸</a>
              <a href="https://twitter.com/" className="footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Twitter">🐦</a>
              <a href="https://facebook.com/" className="footer-social-link" target="_blank" rel="noopener noreferrer" aria-label="Facebook">📘</a>
            </div>
            <div className="footer-meta" style={{marginTop: '18px'}}>
              <span>&copy; {new Date().getFullYear()} Canteen Ahead</span>
              <span>Made for campus convenience</span>
            </div>
          </div>
          <div className="footer-col">
            <div className="footer-quick-info">
              <span>Location: Main Campus, Food Court</span>
              <span>Hours: 8:00am – 6:00pm</span>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}

export default Home;
