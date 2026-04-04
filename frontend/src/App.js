import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import TradingSignals from './pages/TradingSignals';
import Portfolio from './pages/Portfolio';
import Orders from './pages/Orders';
import Markets from './pages/Markets';
import Login from './pages/Login';
import Register from './pages/Register';
import LoadingSpinner from './components/LoadingSpinner';
import { authService } from './services/authService';

function ProtectedLayout({ user, theme, onToggleTheme, onLogout, sidebarOpen, onToggleSidebar, children }) {
  return (
    <>
      <Navbar
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onToggleSidebar={onToggleSidebar}
      />
      <div className="flex pt-16">
        <Sidebar isOpen={sidebarOpen} />
        <main className={`flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          {children}
        </main>
      </div>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      if (!token || !username) {
        setAuthLoading(false);
        return;
      }
      try {
        const me = await authService.getMe();
        setUser({ username: me.username || username, token });
      } catch (err) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        const isAuthFailure =
          status === 401 ||
          (status === 403 && (detail === 'Not authenticated' || detail === 'Could not validate credentials'));

        if (isAuthFailure) {
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          setUser(null);
        } else {
          // Preserve session on transient network/server errors.
          setUser({ username, token });
        }
      } finally {
        setAuthLoading(false);
      }
    };
    validateSession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen text-market-text font-sans">
        <Routes>
          <Route path="/" element={<Landing user={user} theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/login" element={user ? <Navigate to="/app" /> : <Login onLogin={setUser} />} />
          <Route path="/register" element={user ? <Navigate to="/app" /> : <Register onLogin={setUser} />} />
          <Route
            path="/app"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Dashboard />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/markets"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Markets />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/signals"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                >
                  <TradingSignals />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/portfolio"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Portfolio user={user} />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/orders"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Orders />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route path="*" element={<Navigate to={user ? '/app' : '/'} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
