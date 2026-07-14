/**
 * LandingPage — the "Log in" nav CTA for returning users must render and point
 * at the mounted /login route (App.tsx). The page uses plain anchors (no
 * react-router), so no Router is needed here.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

// The page's mount effect calls matchMedia + IntersectionObserver, which jsdom
// does not implement. Stub the minimum surface the effect touches.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LandingPage', () => {
  it('renders a Log in link pointing at /login', () => {
    render(<LandingPage />);
    const login = screen.getByRole('link', { name: 'Log in' });
    expect(login).toHaveAttribute('href', '/login');
  });
});
