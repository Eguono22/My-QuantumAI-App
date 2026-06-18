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
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1300px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-panel lg:grid-cols-[1.05fr_520px]">
        <div className="relative hidden overflow-hidden p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#06101d_0%,#0d2340_45%,#12385f_100%)]" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 18% 20%, rgba(34,211,238,0.7) 0, transparent 28%), radial-gradient(circle at 82% 74%, rgba(16,185,129,0.3) 0, transparent 24%), radial-gradient(circle at 78% 20%, rgba(244,201,93,0.18) 0, transparent 18%)' }} />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Security Reset</p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-none">Set a fresh password and reopen the desk</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200">
                Finish the reset flow and return to your portfolio, signal control panels, and operating history.
              </p>
            </div>
          </div>
        </div>

        <div className="market-panel m-3 rounded-[28px] p-8 md:p-10 lg:m-6">
          <div className="mb-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-sm font-bold text-cyan-700">
              QA
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold uppercase text-zinc-900">New Password</h2>
            <p className="mt-2 text-sm text-zinc-600">Set a fresh password for your account.</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {message && <Alert type="success" message={message} onClose={() => setMessage('')} />}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">New Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="market-input rounded-xl px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Confirm Password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className="market-input rounded-xl px-4 py-3"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="market-btn-primary w-full rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-600">
            Back to{' '}
            <Link to="/login" className="font-semibold text-zinc-900 hover:text-black">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
