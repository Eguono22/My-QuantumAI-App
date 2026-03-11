import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

const renderNavbar = (props) =>
  render(
    <MemoryRouter>
      <Navbar {...props} />
    </MemoryRouter>
  );

describe('Navbar', () => {
  it('renders the brand name', () => {
    renderNavbar({ user: null, onLogout: jest.fn(), onToggleSidebar: jest.fn() });
    expect(screen.getByText('QuantumAI Trading')).toBeInTheDocument();
  });

  it('renders the live indicator', () => {
    renderNavbar({ user: null, onLogout: jest.fn(), onToggleSidebar: jest.fn() });
    expect(screen.getByText('● Live')).toBeInTheDocument();
  });

  it('shows the username when a user is logged in', () => {
    renderNavbar({
      user: { username: 'alice' },
      onLogout: jest.fn(),
      onToggleSidebar: jest.fn(),
    });
    expect(screen.getByText(/alice/)).toBeInTheDocument();
  });

  it('shows a Logout button when user is logged in', () => {
    renderNavbar({
      user: { username: 'alice' },
      onLogout: jest.fn(),
      onToggleSidebar: jest.fn(),
    });
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('calls onLogout when Logout button is clicked', () => {
    const onLogout = jest.fn();
    renderNavbar({ user: { username: 'alice' }, onLogout, onToggleSidebar: jest.fn() });
    fireEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSidebar when the hamburger button is clicked', () => {
    const onToggleSidebar = jest.fn();
    renderNavbar({ user: null, onLogout: jest.fn(), onToggleSidebar });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('does not show Logout or username when no user is provided', () => {
    renderNavbar({ user: null, onLogout: jest.fn(), onToggleSidebar: jest.fn() });
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });
});
