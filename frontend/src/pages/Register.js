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
      <div className="w-full max-w-md bg-deep-900/85 p-8 rounded-3xl shadow-2xl shadow-cyan-900/30 border border-cyan-200/10 backdrop-blur-xl animate-fadeRise">
        <div className="text-center mb-8">
          <span className="text-4xl">⚛</span>
          <h1 className="text-3xl font-display font-bold text-white mt-2">Create Account</h1>
          <p className="text-slate-300/80 mt-1">Start trading with quantum AI</p>
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
              <label className="block text-sm text-slate-300 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={e => setForm({...form, [field.key]: e.target.value})}
                className="w-full bg-deep-950 border border-cyan-200/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-300"
                required
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-deep-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-amber-500/25"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-slate-300/80 mt-4 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-300 hover:text-cyan-200">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
