import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import Alert from '../components/Alert';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Reset link is missing a token.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await authService.resetPassword(token, form.password);
      setMessage(data.message);
      setTimeout(() => navigate('/login', { replace: true }), 1400);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md market-panel p-8 rounded-md animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl text-market-yellow">▥</span>
          <h1 className="text-3xl font-display font-bold text-zinc-900 mt-2 uppercase tracking-wide">New Password</h1>
          <p className="text-zinc-600 mt-1">Set a fresh password for your account</p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {message && <Alert type="success" message={message} onClose={() => setMessage('')} />}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">New Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="market-input rounded-md px-4 py-3"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="market-input rounded-md px-4 py-3"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full market-btn-primary disabled:opacity-50 font-semibold py-3 rounded-md transition"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="text-center text-zinc-600 mt-4 text-sm">
          Back to{' '}
          <Link to="/login" className="text-zinc-900 font-semibold hover:text-black">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
