import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import Alert from '../components/Alert';

export default function Register({ onLogin }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await authService.register(form.username, form.email, form.password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('username', data.username);
      onLogin({ username: data.username, token: data.access_token });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md market-panel p-8 rounded-md animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl text-market-yellow">▥</span>
          <h1 className="text-3xl font-display font-bold text-zinc-900 mt-2 uppercase tracking-wide">Create Account</h1>
          <p className="text-zinc-600 mt-1">Start trading with AI-driven insights</p>
        </div>
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {[
            { key: 'username', label: 'Username', type: 'text' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'password', label: 'Password', type: 'password' },
            { key: 'confirm', label: 'Confirm Password', type: 'password' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-sm text-zinc-600 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={e => setForm({...form, [field.key]: e.target.value})}
                className="market-input rounded-md px-4 py-3"
                required
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full market-btn-primary disabled:opacity-50 font-semibold py-3 rounded-md transition"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-zinc-600 mt-4 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-900 font-semibold hover:text-black">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
