import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const renderSidebar = (props) =>
  render(
    <MemoryRouter future={routerFuture} initialEntries={[props.path || '/']}>
      <Sidebar {...props} />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  it('renders all navigation items when open', () => {
    renderSidebar({ isOpen: true });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('AI Signals')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('renders the quantum status panel', () => {
    renderSidebar({ isOpen: true });
    expect(screen.getByText('MARKET STATUS')).toBeInTheDocument();
    expect(screen.getByText('Assets Tracked')).toBeInTheDocument();
    expect(screen.getByText('Sentiment Index')).toBeInTheDocument();
    expect(screen.getByText('Volatility (VIX)')).toBeInTheDocument();
  });

  it('applies w-64 class when open', () => {
    const { container } = renderSidebar({ isOpen: true });
    expect(container.querySelector('aside')).toHaveClass('w-64');
  });

  it('applies w-0 class when closed', () => {
    const { container } = renderSidebar({ isOpen: false });
    expect(container.querySelector('aside')).toHaveClass('w-0');
  });

  it('highlights the active route', () => {
    render(
      <MemoryRouter future={routerFuture} initialEntries={['/app/signals']}>
        <Sidebar isOpen={true} />
      </MemoryRouter>
    );
    const activeLink = screen.getByText('AI Signals').closest('a');
    expect(activeLink).toHaveClass('bg-market-yellow');
  });

  it('does not highlight inactive routes', () => {
    render(
      <MemoryRouter future={routerFuture} initialEntries={['/app/signals']}>
        <Sidebar isOpen={true} />
      </MemoryRouter>
    );
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveClass('bg-market-yellow');
  });

  it('shows the unread notifications badge when provided', () => {
    renderSidebar({ isOpen: true, unreadNotifications: 2 });
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
