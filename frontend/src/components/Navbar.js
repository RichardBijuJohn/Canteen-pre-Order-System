import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function Navbar() {
  const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  const [userName, setUserName] = useState(localStorage.getItem('userName'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [landingSection, setLandingSection] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <header className="nav-bar">
      <div className="nav-brand">
        <div className="nav-logo">Canteen Ahead</div>
        <p>Reserve your meal before the rush.</p>
      </div>
      <nav className="nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-link${(isActive && landingSection === 'home') ? ' active' : ''}`} end>Home</NavLink>
        <Link to="/#about" className={`nav-link${location.pathname === '/' && landingSection === 'about' ? ' active' : ''}`}>About</Link>
        <Link to="/#features" className={`nav-link${location.pathname === '/' && landingSection === 'features' ? ' active' : ''}`}>Features</Link>
        <NavLink to="/login" className={navLinkClass}>Login</NavLink>
        <NavLink to="/menu" className={navLinkClass}>Menu</NavLink>
        <NavLink to="/orders" className={navLinkClass}>Orders</NavLink>
      </nav>
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