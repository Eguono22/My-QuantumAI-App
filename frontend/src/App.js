import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TradingSignals from './pages/TradingSignals';
import Portfolio from './pages/Portfolio';
import Markets from './pages/Markets';
import Login from './pages/Login';
import Register from './pages/Register';
import LoadingSpinner from './components/LoadingSpinner';
import { authService } from './services/authService';

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

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
        {user && (
          <>
            <Navbar user={user} onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className="flex pt-16">
              <Sidebar isOpen={sidebarOpen} />
              <main className={`flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/signals" element={<TradingSignals />} />
                  <Route path="/portfolio" element={<Portfolio user={user} />} />
                  <Route path="/login" element={<Navigate to="/" />} />
                  <Route path="/register" element={<Navigate to="/" />} />
                </Routes>
              </main>
            </div>
          </>
        )}
        {!user && (
          <Routes>
            <Route path="/login" element={<Login onLogin={setUser} />} />
            <Route path="/register" element={<Register onLogin={setUser} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
