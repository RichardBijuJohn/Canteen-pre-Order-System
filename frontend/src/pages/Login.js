import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const isLogin = mode === 'login';

  useEffect(() => {
    if (localStorage.getItem('userId')) {
      navigate('/home', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setStatus({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      if (isLogin) {
        const res = await axios.post('http://localhost:5000/api/auth/login', {
          email: formData.email,
          password: formData.password
        });

        if (res.data && res.data.user) {
          localStorage.setItem('userId', res.data.user._id);
          localStorage.setItem('userName', res.data.user.name);
          localStorage.setItem('userEmail', res.data.user.email);
          window.dispatchEvent(new Event('user-auth-changed'));
          window.location.href = '/home';
          return;
        }

        setStatus({ type: 'error', message: res.data?.msg || 'Invalid credentials' });
      } else {
        const res = await axios.post('http://localhost:5000/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password
        });

        if (res.data?.msg) {
          setStatus({ type: 'success', message: 'Account created. Sign in to continue.' });
          setMode('login');
          setFormData({ name: '', email: formData.email, password: '' });
          return;
        }

        setStatus({ type: 'error', message: 'Registration failed.' });
      }
    } catch (err) {
      console.log(err);
      setStatus({ type: 'error', message: 'Something went wrong. Try again.' });
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
            onClick={() => switchMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => switchMode('register')}
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
          {!isLogin && (
            <label className="form-group">
              <span>Name</span>
              <input
                className="input-field"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Riya Sharma"
                required
              />
            </label>
          )}

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

          <p className="form-footer">
            {isLogin ? 'Need an account?' : 'Already registered?'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode(isLogin ? 'register' : 'login')}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </form>
      </div>
    </section>
  );
}

export default Login;