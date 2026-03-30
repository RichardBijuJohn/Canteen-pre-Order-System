import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setStatus({ type: 'success', message: res.data?.msg || 'Reset token generated.' });
      if (res.data?.resetToken) {
        setToken(res.data.resetToken);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err?.response?.data?.msg || 'Unable to process reset request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await axios.post('/api/auth/reset-password', {
        token,
        newPassword
      });
      setStatus({ type: 'success', message: res.data?.msg || 'Password reset successful.' });
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      setStatus({ type: 'error', message: err?.response?.data?.msg || 'Unable to reset password.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section two-column">
      <div className="hero-copy">
        <p className="eyebrow">Account Recovery</p>
        <h1>Forgot your password?</h1>
        <p className="subtitle">Request a reset token and set a new password to access your account.</p>
      </div>

      <div className="form-panel">
        {status.message && (
          <div className={`inline-banner ${status.type === 'error' ? 'error' : 'success'}`}>
            {status.message}
          </div>
        )}

        <form className="auth-form" onSubmit={requestReset}>
          <label className="form-group">
            <span>Registered email</span>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Requesting...' : 'Get reset token'}
          </button>
        </form>

        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid rgba(15, 23, 42, 0.1)' }} />

        <form className="auth-form" onSubmit={resetPassword}>
          <label className="form-group">
            <span>Reset token</span>
            <input
              className="input-field"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste reset token"
              required
            />
          </label>

          <label className="form-group">
            <span>New password</span>
            <input
              className="input-field"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </label>

          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset password'}
          </button>

          <button className="link-btn" type="button" onClick={() => navigate('/login')}>
            Back to login
          </button>
        </form>
      </div>
    </section>
  );
}

export default ForgotPassword;
