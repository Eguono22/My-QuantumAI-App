import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import Alert from '../components/Alert';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(form.username, form.password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('username', data.username);
      onLogin({ username: data.username, token: data.access_token });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. API unavailable or misconfigured.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1300px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-panel lg:grid-cols-[1.1fr_520px]">
        <div className="relative hidden overflow-hidden p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#06101d_0%,#0d2340_45%,#12385f_100%)]" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 18% 20%, rgba(34,211,238,0.7) 0, transparent 28%), radial-gradient(circle at 82% 74%, rgba(16,185,129,0.3) 0, transparent 24%), radial-gradient(circle at 78% 20%, rgba(244,201,93,0.18) 0, transparent 18%)' }} />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">QuantumAI Trader</p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-none">Operator access for the trading desk</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200">
                Sign in to review AI signals, monitor the blotter, and keep the paper-trading workflow inside visible risk guard rails.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Signal Desk</p>
                <p className="mt-2 text-lg font-semibold">Model rationale beside every trade</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Order Blotter</p>
                <p className="mt-2 text-lg font-semibold">Pending and filled states in one board</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Risk Loop</p>
                <p className="mt-2 text-lg font-semibold">Paper-first workflow before promotion</p>
              </div>
            </div>
          </div>
        </div>

        <div className="market-panel m-3 rounded-[28px] p-8 md:p-10 lg:m-6">
          <div className="mb-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-sm font-bold text-cyan-700">
              QA
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold uppercase text-zinc-900">Sign In</h2>
            <p className="mt-2 text-sm text-zinc-600">Access your trading workspace and session telemetry.</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Username or Email</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username or email"
                className="market-input rounded-xl px-4 py-3"
                required
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-xs uppercase tracking-[0.18em] text-zinc-500">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="market-input rounded-xl px-4 py-3"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="market-btn-primary w-full rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-zinc-900 hover:text-black">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
