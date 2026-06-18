import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import Alert from '../components/Alert';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const resetUrl = result?.reset_token
    ? `${window.location.origin}/reset-password?token=${encodeURIComponent(result.reset_token)}`
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await authService.forgotPassword(identifier);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start password reset.');
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
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Account Recovery</p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase leading-none">Recover access without losing the workflow</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-200">
                Start a secure reset and get back to your operator dashboard, signal review, and paper-trading history.
              </p>
            </div>
          </div>
        </div>

        <div className="market-panel m-3 rounded-[28px] p-8 md:p-10 lg:m-6">
          <div className="mb-8">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-sm font-bold text-cyan-700">
              QA
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold uppercase text-zinc-900">Reset Password</h2>
            <p className="mt-2 text-sm text-zinc-600">Request a recovery link for your trading workspace.</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {result && (
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <p className="font-semibold">{result.message}</p>
              {resetUrl ? (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Pilot recovery link</p>
                  <Link to={`/reset-password?token=${encodeURIComponent(result.reset_token)}`} className="mt-1 inline-block break-all font-semibold text-emerald-950 hover:underline">
                    {resetUrl}
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-emerald-800">
                  If email delivery is enabled, check your inbox for the reset link.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Username or Email</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username or email"
                className="market-input rounded-xl px-4 py-3"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="market-btn-primary w-full rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {loading ? 'Preparing reset...' : 'Get Reset Link'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-600">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-zinc-900 hover:text-black">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
