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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md market-panel p-8 rounded-md animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl text-market-yellow">▥</span>
          <h1 className="text-3xl font-display font-bold text-zinc-900 mt-2 uppercase tracking-wide">Reset Password</h1>
          <p className="text-zinc-600 mt-1">Recover access to your trading workspace</p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {result && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">{result.message}</p>
            {resetUrl && (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Pilot recovery link</p>
                <Link to={`/reset-password?token=${encodeURIComponent(result.reset_token)}`} className="mt-1 inline-block break-all font-semibold text-emerald-950 hover:underline">
                  {resetUrl}
                </Link>
              </div>
            )}
            {!resetUrl && (
              <p className="mt-3 text-emerald-800">
                If email delivery is enabled, check your inbox for the reset link.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter username or email"
              className="market-input rounded-md px-4 py-3"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full market-btn-primary disabled:opacity-50 font-semibold py-3 rounded-md transition"
          >
            {loading ? 'Preparing reset...' : 'Get Reset Link'}
          </button>
        </form>

        <p className="text-center text-zinc-600 mt-4 text-sm">
          Remembered it?{' '}
          <Link to="/login" className="text-zinc-900 font-semibold hover:text-black">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
