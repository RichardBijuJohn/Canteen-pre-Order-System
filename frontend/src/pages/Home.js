import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('userName');
  const pageRef = useRef(null);
  const highlightRef = useRef(null);
  const aboutRef = useRef(null);
  const featuresRef = useRef(null);

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
    const emit = (section) => {
      window.dispatchEvent(new CustomEvent('home-section-change', { detail: { section } }));
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const key = entry.target.getAttribute('data-home-section');
        if (key) {
          ratios.set(key, entry.intersectionRatio);
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

      emit(current);
    }, { threshold: [0.2, 0.4, 0.6, 0.8] });

    sections.forEach((section) => observer.observe(section));
    emit(location.hash === '#about' ? 'about' : location.hash === '#features' ? 'features' : 'home');

    return () => {
      observer.disconnect();
    };
  }, [location.hash]);

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
          <button className="ghost-btn" onClick={() => navigate('/login')}>
            {userName ? 'Switch Account' : 'Login / Register'}
          </button>
        </div>

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
    </section>
  );
}

export default Home;
