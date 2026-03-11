import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Alert from './Alert';

describe('Alert', () => {
  it('renders the message', () => {
    render(<Alert type="info" message="Test alert message" />);
    expect(screen.getByText('Test alert message')).toBeInTheDocument();
  });

  it('renders a close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<Alert type="info" message="Test" onClose={onClose} />);
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<Alert type="error" message="Error!" onClose={onClose} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render a close button when onClose is not provided', () => {
    render(<Alert type="info" message="No close" />);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  it('applies error styles for type=error', () => {
    const { container } = render(<Alert type="error" message="error msg" />);
    expect(container.firstChild).toHaveClass('bg-red-900');
    expect(container.firstChild).toHaveClass('border-red-500');
  });

  it('applies success styles for type=success', () => {
    const { container } = render(<Alert type="success" message="ok" />);
    expect(container.firstChild).toHaveClass('bg-green-900');
    expect(container.firstChild).toHaveClass('border-green-500');
  });

  it('applies warning styles for type=warning', () => {
    const { container } = render(<Alert type="warning" message="warn" />);
    expect(container.firstChild).toHaveClass('bg-yellow-900');
    expect(container.firstChild).toHaveClass('border-yellow-500');
  });

  it('applies info styles for type=info', () => {
    const { container } = render(<Alert type="info" message="info msg" />);
    expect(container.firstChild).toHaveClass('bg-blue-900');
    expect(container.firstChild).toHaveClass('border-blue-500');
  });
});
