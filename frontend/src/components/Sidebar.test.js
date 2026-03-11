import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const renderSidebar = (props) =>
  render(
    <MemoryRouter initialEntries={[props.path || '/']}>
      <Sidebar {...props} />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  it('renders all navigation items when open', () => {
    renderSidebar({ isOpen: true });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('AI Signals')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('renders the quantum status panel', () => {
    renderSidebar({ isOpen: true });
    expect(screen.getByText('QUANTUM STATUS')).toBeInTheDocument();
    expect(screen.getByText('Qubits Active')).toBeInTheDocument();
    expect(screen.getByText('Coherence')).toBeInTheDocument();
    expect(screen.getByText('Gate Fidelity')).toBeInTheDocument();
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
      <MemoryRouter initialEntries={['/signals']}>
        <Sidebar isOpen={true} />
      </MemoryRouter>
    );
    const activeLink = screen.getByText('AI Signals').closest('a');
    expect(activeLink).toHaveClass('bg-blue-600');
  });

  it('does not highlight inactive routes', () => {
    render(
      <MemoryRouter initialEntries={['/signals']}>
        <Sidebar isOpen={true} />
      </MemoryRouter>
    );
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveClass('bg-blue-600');
  });
});
