import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

function Navbar() {
  const [userName, setUserName] = useState(localStorage.getItem('userName'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [landingSection, setLandingSection] = useState('home');
  const [navBanner, setNavBanner] = useState('');
  const [activePillStyle, setActivePillStyle] = useState({ opacity: 0, left: 0, width: 0 });
  const navLinksRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';
  const activeKey = useMemo(() => {
    if (location.pathname === '/') {
      return landingSection;
    }

    if (location.pathname === '/login') return 'login';
    if (location.pathname === '/menu') return 'menu';
    if (location.pathname === '/orders') return 'orders';
    return '';
  }, [location.pathname, landingSection]);

  const handleProtectedNav = (e, route) => {
    if (!userId) {
      e.preventDefault();
      setNavBanner(route === '/menu' ? 'Login to view the menu.' : 'Login to view your orders.');
      setTimeout(() => setNavBanner(''), 2200);
      return false;
    }
    return true;
  };

  useEffect(() => {
    const syncUser = () => {
      setUserName(localStorage.getItem('userName'));
      setUserId(localStorage.getItem('userId'));
    };

    window.addEventListener('storage', syncUser);
    window.addEventListener('user-auth-changed', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('user-auth-changed', syncUser);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      return;
    }

    if (location.hash === '#about') {
      setLandingSection('about');
      return;
    }
    if (location.hash === '#features') {
      setLandingSection('features');
      return;
    }
    setLandingSection('home');
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const navRoot = navLinksRef.current;
    if (!navRoot || !activeKey) {
      setActivePillStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const updatePill = () => {
      const activeLink = navRoot.querySelector(`[data-nav-key="${activeKey}"]`);
      if (!activeLink) {
        setActivePillStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const navRect = navRoot.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setActivePillStyle({
        opacity: 1,
        left: linkRect.left - navRect.left,
        width: linkRect.width
      });
    };

    const frame = requestAnimationFrame(updatePill);
    window.addEventListener('resize', updatePill);
    navRoot.addEventListener('scroll', updatePill, { passive: true });

    const activeLink = navRoot.querySelector(`[data-nav-key="${activeKey}"]`);
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updatePill);
      resizeObserver.observe(navRoot);
      if (activeLink) {
        resizeObserver.observe(activeLink);
      }
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePill);
      navRoot.removeEventListener('scroll', updatePill);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [activeKey, location.pathname, location.hash]);

  useEffect(() => {
    const onSectionChange = (event) => {
      const next = event?.detail?.section;
      if (location.pathname === '/' && next) {
        setLandingSection(next);
      }
    };

    window.addEventListener('home-section-change', onSectionChange);
    return () => {
      window.removeEventListener('home-section-change', onSectionChange);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    window.dispatchEvent(new Event('user-auth-changed'));
    navigate('/', { replace: true });
  };

  const isAuthed = Boolean(userId);

  const handleSectionLink = (e, sectionId) => {
    e.preventDefault();

    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) {
      navigate(`/#${sectionId}`);
      return;
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const scrollPaddingTop = Number.parseInt(rootStyles.scrollPaddingTop, 10) || 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - scrollPaddingTop;

    window.history.replaceState(null, '', `/#${sectionId}`);
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('home-section-change', { detail: { section: sectionId } }));
  };

  return (
    <header className="nav-bar">
      <div className="nav-brand">
        <div className="nav-logo">Canteen Ahead</div>
        <p>Reserve your meal before the rush.</p>
      </div>
      <nav className="nav-links" ref={navLinksRef}>
        <span
          className="nav-active-pill"
          aria-hidden="true"
          style={{
            opacity: activePillStyle.opacity,
            width: `${activePillStyle.width}px`,
            transform: `translateX(${activePillStyle.left}px)`
          }}
        />
        <NavLink to="/" className={`nav-link${activeKey === 'home' ? ' active' : ''}`} data-nav-key="home" end>Home</NavLink>
        <Link
          to="/#about"
          className={`nav-link${activeKey === 'about' ? ' active' : ''}`}
          data-nav-key="about"
          onClick={(e) => handleSectionLink(e, 'about')}
        >
          About
        </Link>
        <Link
          to="/#features"
          className={`nav-link${activeKey === 'features' ? ' active' : ''}`}
          data-nav-key="features"
          onClick={(e) => handleSectionLink(e, 'features')}
        >
          Features
        </Link>
        <NavLink to="/login" className={`nav-link${activeKey === 'login' ? ' active' : ''}`} data-nav-key="login">Login</NavLink>
        {!isAdminRoute && (
          <NavLink to="/menu" className={`nav-link${activeKey === 'menu' ? ' active' : ''}`} data-nav-key="menu" onClick={e => handleProtectedNav(e, '/menu')}>Menu</NavLink>
        )}
        {!isAdminRoute && (
          <NavLink to="/orders" className={`nav-link${activeKey === 'orders' ? ' active' : ''}`} data-nav-key="orders" onClick={e => handleProtectedNav(e, '/orders')}>Orders</NavLink>
        )}
      </nav>

      {navBanner && (
        <div className="inline-banner error" style={{ position: 'absolute', top: 70, left: 0, right: 0, zIndex: 99, maxWidth: 420, margin: '0 auto' }}>{navBanner}</div>
      )}
      {isAuthed && (
        <div className="nav-user">
          <span>Hi, {userName || 'Guest'}</span>
          <button className="ghost-btn logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      )}
    </header>
  );
}

export default Navbar;