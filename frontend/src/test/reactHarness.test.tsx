import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function HarnessProbe() {
  return <button type="button">Evidence readiness</button>;
}

describe('React unit test harness', () => {
  it('renders components with Testing Library and jest-dom matchers', () => {
    render(<HarnessProbe />);

    expect(screen.getByRole('button', { name: /evidence readiness/i })).toBeInTheDocument();
  });
});
