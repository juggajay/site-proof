// Unit tests for UpdatePrompt.
//
// The `virtual:pwa-register/react` module is mocked so the test controls
// `needRefresh` and captures `updateServiceWorker`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// --- hoisted mocks ---

const { mockNeedRefresh, mockSetNeedRefresh, mockUpdateServiceWorker, mockOnRegisteredSW } =
  vi.hoisted(() => ({
    mockNeedRefresh: { current: false },
    mockSetNeedRefresh: vi.fn(),
    mockUpdateServiceWorker: vi.fn().mockResolvedValue(undefined),
    mockOnRegisteredSW: {
      current: undefined as
        | ((swUrl: string, reg: ServiceWorkerRegistration | undefined) => void)
        | undefined,
    },
  }));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: {
    onRegisteredSW?: (swUrl: string, reg: ServiceWorkerRegistration | undefined) => void;
  }) => {
    // Capture the onRegisteredSW callback so tests can invoke it.
    mockOnRegisteredSW.current = options?.onRegisteredSW;
    return {
      needRefresh: [mockNeedRefresh.current, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

import { UpdatePrompt } from './UpdatePrompt';

beforeEach(() => {
  vi.clearAllMocks();
  mockNeedRefresh.current = false;
  mockOnRegisteredSW.current = undefined;
});

describe('UpdatePrompt', () => {
  it('renders nothing when needRefresh is false', () => {
    mockNeedRefresh.current = false;
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the update banner when needRefresh is true', () => {
    mockNeedRefresh.current = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/A new version of CIVOS is available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply update and reload/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Dismiss update notification/i }),
    ).toBeInTheDocument();
  });

  it('calls updateServiceWorker(true) when the Update button is clicked', () => {
    mockNeedRefresh.current = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /Apply update and reload/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('calls setNeedRefresh(false) when the dismiss button is clicked', () => {
    mockNeedRefresh.current = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss update notification/i }));
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  describe('onRegisteredSW periodic checks', () => {
    it('sets up a 60-minute interval and focus listener when registration is provided', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      mockNeedRefresh.current = false;
      render(<UpdatePrompt />);

      // Invoke the onRegisteredSW callback with a mock registration.
      const mockRegistration = {
        update: vi.fn().mockResolvedValue(undefined),
      } as unknown as ServiceWorkerRegistration;

      mockOnRegisteredSW.current?.('sw.js', mockRegistration);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
      expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    });

    it('does not set up interval or listener when registration is undefined', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      mockNeedRefresh.current = false;
      render(<UpdatePrompt />);

      mockOnRegisteredSW.current?.('sw.js', undefined);

      expect(setIntervalSpy).not.toHaveBeenCalled();
      // focus listener is only added via onRegisteredSW, not via useEffect.
      // Check it wasn't added for 'focus' specifically.
      const focusCalls = addEventListenerSpy.mock.calls.filter(([type]) => type === 'focus');
      expect(focusCalls).toHaveLength(0);
    });

    it('calls registration.update() when the focus event fires', () => {
      const mockRegistration = {
        update: vi.fn().mockResolvedValue(undefined),
      } as unknown as ServiceWorkerRegistration;

      mockNeedRefresh.current = false;
      render(<UpdatePrompt />);
      mockOnRegisteredSW.current?.('sw.js', mockRegistration);

      // Simulate window focus.
      window.dispatchEvent(new Event('focus'));

      expect(mockRegistration.update).toHaveBeenCalled();
    });

    it('clears interval and removes focus listener on unmount', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      mockNeedRefresh.current = false;
      const { unmount } = render(<UpdatePrompt />);

      const mockRegistration = {
        update: vi.fn().mockResolvedValue(undefined),
      } as unknown as ServiceWorkerRegistration;
      mockOnRegisteredSW.current?.('sw.js', mockRegistration);

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    });
  });
});
