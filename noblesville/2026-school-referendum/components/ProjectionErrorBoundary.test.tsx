import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectionErrorBoundary } from './ProjectionErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ProjectionErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ProjectionErrorBoundary>
        <p>fine</p>
      </ProjectionErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('catches a thrown render error and shows a visible, neutral notice instead of a blank page', () => {
    // React logs the caught error to the console by default; silence it so
    // the expected-failure test output isn't noisy.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ProjectionErrorBoundary>
        <Bomb />
      </ProjectionErrorBoundary>,
    );
    spy.mockRestore();

    expect(screen.getByRole('alert')).toHaveTextContent(/projection is unavailable/i);
    // Not a silent return null: an alert role with real text is present.
    expect(screen.queryByText('fine')).not.toBeInTheDocument();
  });
});
