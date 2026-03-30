import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

function DemoPayment() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        setError('Invalid payment link.');
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`/api/orders/payment-session/${sessionId}`);
        setSession(res.data);
      } catch (err) {
        setError(err.response?.data?.msg || 'Payment session not found.');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  const handlePayNow = async () => {
    if (!sessionId) return;
    setProcessing(true);
    setError('');

    try {
      const res = await axios.post(`/api/orders/payment-session/${sessionId}/pay`);
      setSession((prev) => ({ ...(prev || {}), ...res.data, totalAmount: prev?.totalAmount || session?.totalAmount }));
    } catch (err) {
      setError(err.response?.data?.msg || 'Unable to complete demo payment.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <section className="page-section demo-payment-shell">
        <div className="demo-payment-card">
          <p className="placeholder">Loading payment link...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section demo-payment-shell">
      <div className="demo-payment-card">
        <p className="eyebrow">Demo payment</p>
        <h2>Scan complete. Continue payment here.</h2>

        {error && <div className="inline-banner error">{error}</div>}

        {!error && session && (
          <>
            <p className="demo-payment-amount">Amount: ₹{Number(session.totalAmount || 0).toFixed(2)}</p>
            <p className="order-item-meta">This is a demo page for testing QR-based ordering.</p>

            {session.state === 'ordered' ? (
              <div className="inline-banner success">Payment done. Order has been placed on the web app.</div>
            ) : (
              <button className="primary-btn" type="button" onClick={handlePayNow} disabled={processing}>
                {processing ? 'Processing payment...' : 'Pay now (Demo)'}
              </button>
            )}
          </>
        )}

        <div className="preorder-summary-actions">
          <button className="ghost-btn" type="button" onClick={() => navigate('/home')}>
            Go to home
          </button>
          <Link className="ghost-btn" to="/orders">View orders</Link>
        </div>
      </div>
    </section>
  );
}

export default DemoPayment;
