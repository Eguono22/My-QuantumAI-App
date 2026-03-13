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
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-deep-900/85 p-8 rounded-3xl shadow-2xl shadow-cyan-900/30 border border-cyan-200/10 backdrop-blur-xl animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl">⚛</span>
          <h1 className="text-3xl font-display font-bold text-white mt-2">QuantumAI Trading</h1>
          <p className="text-slate-300/80 mt-1">Sign in to your account</p>
        </div>
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              className="w-full bg-deep-950 border border-cyan-200/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-300"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="w-full bg-deep-950 border border-cyan-200/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-300"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-deep-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-cyan-400/30"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-slate-300/80 mt-4 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-300 hover:text-amber-200">Register</Link>
        </p>
      </div>
    </div>
  );
}
