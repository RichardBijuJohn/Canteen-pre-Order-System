import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const isLogin = mode === 'login';

  useEffect(() => {
    const hasUserSession = Boolean(localStorage.getItem('userId'));
    const hasAdminSession = Boolean(localStorage.getItem('adminToken'));
    if (hasUserSession) {
      navigate('/home', { replace: true });
      return;
    }
    if (hasAdminSession) {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      if (!isLogin) {
        if (formData.email.trim().toLowerCase() === 'admin@canteen.local') {
          setStatus({ type: 'error', message: 'Admin accounts cannot be registered from this page.' });
          return;
        }

        const registerRes = await axios.post('http://localhost:5000/api/auth/register', {
          name: (formData.email.split('@')[0] || 'Student').slice(0, 30),
          email: formData.email,
          password: formData.password
        });

        if (registerRes.data?.msg) {
          setStatus({ type: 'success', message: 'Account created. Please login now.' });
          setMode('login');
          return;
        }

        setStatus({ type: 'error', message: 'Registration failed. Try again.' });
        return;
      }

      const adminRes = await axios.post('http://localhost:5000/api/admin/login', {
        email: formData.email,
        password: formData.password
      }).catch(() => null);

      if (adminRes?.data?.token) {
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.setItem('adminToken', adminRes.data.token);
        localStorage.setItem('adminName', adminRes.data?.admin?.name || 'Admin');
        window.location.href = '/admin';
        return;
      }

      const res = await axios.post('http://localhost:5000/api/auth/login', {
        email: formData.email,
        password: formData.password
      });

      if (res.data && res.data.user) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        localStorage.setItem('userId', res.data.user._id);
        localStorage.setItem('userName', res.data.user.name);
        localStorage.setItem('userEmail', res.data.user.email);
        window.dispatchEvent(new Event('user-auth-changed'));
        window.location.href = '/home';
        return;
      }

      setStatus({ type: 'error', message: res.data?.msg || 'Invalid email or password.' });
    } catch (err) {
      console.log(err);
      setStatus({ type: 'error', message: isLogin ? 'Invalid email or password.' : 'Unable to register right now.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section two-column">
      <div className="hero-copy">
        <p className="eyebrow">Campus Canteen Concierge</p>
        <h1>Pre-order lunch and pick it up right on time.</h1>
        <p className="subtitle">Lock in your meal, skip the queues, and keep your break calm instead of chaotic.</p>

        <ul className="feature-list">
          <li>Realtime pickup slots</li>
          <li>Instant order tracking</li>
          <li>Secure payments coming soon</li>
        </ul>
      </div>

      <div className="form-panel">
        <div className="form-toggle">
          <button
            type="button"
            className={`toggle-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setStatus({ type: '', message: '' });
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setStatus({ type: '', message: '' });
            }}
          >
            Register
          </button>
        </div>

        {status.message && (
          <div className={`inline-banner ${status.type === 'error' ? 'error' : 'success'}`}>
            {status.message}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-group">
            <span>Email</span>
            <input
              className="input-field"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="form-group">
            <span>Password</span>
            <input
              className="input-field"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </label>

          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          {!isLogin && (
            <p className="form-footer"></p>
          )}
        </form>
      </div>
    </section>
  );
}

export default Login;