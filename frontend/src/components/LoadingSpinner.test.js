import React from 'react';
import { render } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies small size class', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-4', 'w-4');
  });

  it('applies medium size class (default)', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-8', 'w-8');
  });

  it('applies large size class', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-12', 'w-12');
  });

  it('always renders the spinner div with animate-spin', () => {
    const { container } = render(<LoadingSpinner size="md" />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
