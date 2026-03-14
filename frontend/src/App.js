import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TradingSignals from './pages/TradingSignals';
import Portfolio from './pages/Portfolio';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
      setUser({ username, token });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

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
