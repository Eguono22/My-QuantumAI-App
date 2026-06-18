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
import Pilot from './pages/Pilot';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import ConnectionCenter from './pages/ConnectionCenter';
import NotificationsCenter from './pages/NotificationsCenter';
import LoadingSpinner from './components/LoadingSpinner';
import { authService } from './services/authService';
import { tradingService } from './services/tradingService';

function ProtectedLayout({
  user,
  theme,
  onToggleTheme,
  onLogout,
  sidebarOpen,
  onToggleSidebar,
  unreadNotifications,
  children,
}) {
  return (
    <div className="min-h-screen">
      <Navbar
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onToggleSidebar={onToggleSidebar}
        unreadNotifications={unreadNotifications}
      />
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onToggleSidebar}
        />
      )}
      <div className="flex min-h-screen pt-16 overflow-x-hidden">
        <Sidebar isOpen={sidebarOpen} unreadNotifications={unreadNotifications} />
        <main className={`min-w-0 flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64 xl:ml-72' : 'ml-0'}`}>
          <div className="mx-auto max-w-[1640px] p-4 md:p-6 xl:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [notificationAcks, setNotificationAcks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('app_pref_theme') || localStorage.getItem('theme') || 'dark');
  const [preferences, setPreferences] = useState({
    language: localStorage.getItem('app_pref_language') || 'en',
    layout: localStorage.getItem('app_pref_layout') || 'trader-pro',
    aiModel: localStorage.getItem('app_pref_ai_model') || 'quantum-core-v1',
    portfolioView: localStorage.getItem('app_pref_portfolio_view') || 'overview',
  });

  const notificationAckKey = user ? `quantumai_notification_acks_${user.username}` : null;
  const unreadNotifications = notifications.filter((item) => !item.read && item.severity !== 'INFO').length;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    localStorage.setItem('app_pref_theme', theme);
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

  useEffect(() => {
    if (!notificationAckKey) {
      setNotificationAcks([]);
      setNotifications([]);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(notificationAckKey) || '[]');
      setNotificationAcks(Array.isArray(saved) ? saved : []);
    } catch (_err) {
      setNotificationAcks([]);
    }
  }, [notificationAckKey]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return undefined;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const status = await tradingService.getMql5Status();
        if (!isMounted) return;

        const now = new Date().toISOString();
        const activeAlerts = Array.isArray(status?.alerts) ? status.alerts : [];

        setNotifications((current) => {
          const currentMap = new Map(current.map((item) => [item.id, item]));
          return activeAlerts.map((alert) => {
            const id = `${alert.code}:${alert.message}`;
            const existing = currentMap.get(id);
            return {
              id,
              code: alert.code,
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              source: 'MQL5 Bridge',
              detectedAt: existing?.detectedAt || now,
              read: alert.severity === 'INFO' || notificationAcks.includes(id),
            };
          });
        });
      } catch (_err) {
        if (!isMounted) return;
      }
    };

    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [user, notificationAcks]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const updatePreference = (key, value) => {
    const storageMap = {
      language: 'app_pref_language',
      layout: 'app_pref_layout',
      aiModel: 'app_pref_ai_model',
      portfolioView: 'app_pref_portfolio_view',
    };
    if (storageMap[key]) {
      localStorage.setItem(storageMap[key], value);
    }
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const acknowledgeNotification = (id) => {
    if (!notificationAckKey) return;
    setNotificationAcks((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem(notificationAckKey, JSON.stringify(next));
      return next;
    });
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const acknowledgeAllNotifications = () => {
    if (!notificationAckKey) return;
    const unreadIds = notifications.filter((item) => item.severity !== 'INFO').map((item) => item.id);
    const next = Array.from(new Set([...notificationAcks, ...unreadIds]));
    localStorage.setItem(notificationAckKey, JSON.stringify(next));
    setNotificationAcks(next);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
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
      <div className="min-h-screen text-market-text font-sans trading-grid">
        <Routes>
          <Route path="/" element={<Landing user={user} theme={theme} onToggleTheme={toggleTheme} />} />
          <Route path="/login" element={user ? <Navigate to="/app" /> : <Login onLogin={setUser} />} />
          <Route path="/register" element={user ? <Navigate to="/app" /> : <Register onLogin={setUser} />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/app" /> : <ForgotPassword />} />
          <Route path="/reset-password" element={user ? <Navigate to="/app" /> : <ResetPassword />} />
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
                  unreadNotifications={unreadNotifications}
                >
                  <Dashboard preferences={preferences} />
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
                  unreadNotifications={unreadNotifications}
                >
                  <Markets />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/pilot"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  unreadNotifications={unreadNotifications}
                >
                  <Pilot />
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
                  unreadNotifications={unreadNotifications}
                >
                  <TradingSignals preferences={preferences} />
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
                  unreadNotifications={unreadNotifications}
                >
                  <Portfolio user={user} preferences={preferences} />
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
                  unreadNotifications={unreadNotifications}
                >
                  <Orders />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/connect"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  unreadNotifications={unreadNotifications}
                >
                  <ConnectionCenter />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/notifications"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  unreadNotifications={unreadNotifications}
                >
                  <NotificationsCenter
                    notifications={notifications}
                    unreadCount={unreadNotifications}
                    onAcknowledge={acknowledgeNotification}
                    onAcknowledgeAll={acknowledgeAllNotifications}
                  />
                </ProtectedLayout>
              ) : <Navigate to="/login" />
            }
          />
          <Route
            path="/app/settings"
            element={
              user ? (
                <ProtectedLayout
                  user={user}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                  unreadNotifications={unreadNotifications}
                >
                  <Settings
                    preferences={{ ...preferences, theme }}
                    onUpdatePreference={updatePreference}
                    onToggleTheme={toggleTheme}
                  />
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
