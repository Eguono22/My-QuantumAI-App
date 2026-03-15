import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import Alert from '../components/Alert';

export default function Login({ onLogin }) {
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. API unavailable or misconfigured.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md market-panel p-8 rounded-md animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl text-market-yellow">▥</span>
          <h1 className="text-3xl font-display font-bold text-zinc-900 mt-2 uppercase tracking-wide">QuantumAI Markets</h1>
          <p className="text-zinc-600 mt-1">Sign in to your account</p>
        </div>
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              className="market-input rounded-md px-4 py-3"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-600 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="market-input rounded-md px-4 py-3"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full market-btn-primary disabled:opacity-50 font-semibold py-3 rounded-md transition"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-zinc-600 mt-4 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-zinc-900 font-semibold hover:text-black">Register</Link>
        </p>
      </div>
    </div>
  );
}
