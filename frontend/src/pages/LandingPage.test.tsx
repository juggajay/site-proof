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

  // The lead form sends personal details to a third-party processor, so the
  // page must link its own privacy policy and terms and disclose the processor
  // near the form (AU privacy hygiene — external review 2026-07-24).
  it('links privacy policy and terms, and discloses the form processor', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/terms-of-service',
    );
    expect(screen.getByText(/Formspree/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
  });

  // The error box is display:none until formStatus === 'error'; when it
  // appears it must carry role="alert" so the failure is announced. Query
  // hidden elements since the idle state keeps it hidden.
  it('announces form submission failure to assistive technology', () => {
    render(<LandingPage />);
    const alert = screen.getByRole('alert', { hidden: true });
    expect(alert).toHaveTextContent(/Something went wrong/);
  });
});
