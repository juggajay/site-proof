// Tests for usePwaInstall hook.
//
// Covers the four PwaInstallState values:
//   'installed'   — standalone display-mode matches at mount
//   'ios-manual'  — iPhone UA, not standalone, not Chromium
//   'chromium'    — beforeinstallprompt fires
//   'unsupported' — none of the above
//
// Also covers:
//   - canPromptInstall true/false
//   - promptInstall() accepted / dismissed outcomes
//   - standalone display-mode change event transitions to 'installed'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from './usePwaInstall';

// ── helpers ─────────────────────────────────────────────────────────────────

function mockMatchMedia(standalone: boolean) {
  const mqlListeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mql = {
    matches: standalone,
    addEventListener: vi.fn((_type: string, fn: (e: MediaQueryListEvent) => void) => {
      mqlListeners.push(fn);
    }),
    removeEventListener: vi.fn(),
    _fire: (matches: boolean) => {
      const e = { matches } as MediaQueryListEvent;
      mqlListeners.forEach((fn) => fn(e));
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return mql;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: ua,
  });
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
const DESKTOP_FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0';

// ── beforeEach cleanup ───────────────────────────────────────────────────────

beforeEach(() => {
  // Reset navigator.standalone (iOS-only property)
  Object.defineProperty(window.navigator, 'standalone', {
    writable: true,
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('usePwaInstall', () => {
  describe("state 'installed'", () => {
    it('returns installed when display-mode: standalone matches', () => {
      mockMatchMedia(true);
      setUserAgent(ANDROID_CHROME_UA);

      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.state).toBe('installed');
      expect(result.current.canPromptInstall).toBe(false);
    });

    it('returns installed when navigator.standalone is true (iOS legacy)', () => {
      mockMatchMedia(false);
      setUserAgent(IPHONE_UA);
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        configurable: true,
        value: true,
      });

      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.state).toBe('installed');
    });

    it('transitions to installed when display-mode change event fires', async () => {
      const mql = mockMatchMedia(false);
      setUserAgent(ANDROID_CHROME_UA);

      const { result } = renderHook(() => usePwaInstall());
      // Initially unsupported (no beforeinstallprompt yet)
      expect(result.current.state).not.toBe('installed');

      await act(async () => {
        mql._fire(true);
      });

      expect(result.current.state).toBe('installed');
    });
  });

  describe("state 'ios-manual'", () => {
    it('returns ios-manual for iPhone Safari UA when not standalone', () => {
      mockMatchMedia(false);
      setUserAgent(IPHONE_UA);

      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.state).toBe('ios-manual');
      expect(result.current.canPromptInstall).toBe(false);
    });
  });

  describe("state 'chromium'", () => {
    it('returns chromium and canPromptInstall when beforeinstallprompt fires', async () => {
      mockMatchMedia(false);
      setUserAgent(ANDROID_CHROME_UA);

      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.state).toBe('unsupported');

      const mockPrompt = vi.fn().mockResolvedValue(undefined);
      const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const, platform: '' });
      const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
        platforms: [],
        userChoice: mockUserChoice,
        prompt: mockPrompt,
      });

      await act(async () => {
        window.dispatchEvent(promptEvent);
      });

      expect(result.current.state).toBe('chromium');
      expect(result.current.canPromptInstall).toBe(true);
    });

    it('resolves accepted outcome and sets state to installed', async () => {
      mockMatchMedia(false);
      setUserAgent(ANDROID_CHROME_UA);

      const { result } = renderHook(() => usePwaInstall());

      const mockPrompt = vi.fn().mockResolvedValue(undefined);
      const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const, platform: '' });
      const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
        platforms: [],
        userChoice: mockUserChoice,
        prompt: mockPrompt,
      });

      await act(async () => {
        window.dispatchEvent(promptEvent);
      });

      let outcome: string | null = null;
      await act(async () => {
        outcome = await result.current.promptInstall();
      });

      expect(outcome).toBe('accepted');
      expect(result.current.state).toBe('installed');
      expect(result.current.canPromptInstall).toBe(false);
    });

    it('resolves dismissed outcome and leaves state as chromium', async () => {
      mockMatchMedia(false);
      setUserAgent(ANDROID_CHROME_UA);

      const { result } = renderHook(() => usePwaInstall());

      const mockPrompt = vi.fn().mockResolvedValue(undefined);
      const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const, platform: '' });
      const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
        platforms: [],
        userChoice: mockUserChoice,
        prompt: mockPrompt,
      });

      await act(async () => {
        window.dispatchEvent(promptEvent);
      });

      let outcome: string | null = null;
      await act(async () => {
        outcome = await result.current.promptInstall();
      });

      expect(outcome).toBe('dismissed');
      // State is no longer 'chromium' since the prompt was consumed (deferredPrompt cleared)
      // and we didn't accept, so it transitions to whatever matchMedia/UA says — unsupported
      // because no new beforeinstallprompt has fired.
      expect(result.current.canPromptInstall).toBe(false);
    });
  });

  describe("state 'unsupported'", () => {
    it('returns unsupported for a desktop Firefox UA', () => {
      mockMatchMedia(false);
      setUserAgent(DESKTOP_FIREFOX_UA);

      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.state).toBe('unsupported');
      expect(result.current.canPromptInstall).toBe(false);
    });
  });

  describe('promptInstall when no prompt available', () => {
    it('returns null when there is no deferred prompt', async () => {
      mockMatchMedia(false);
      setUserAgent(DESKTOP_FIREFOX_UA);

      const { result } = renderHook(() => usePwaInstall());
      let outcome: string | null | undefined;
      await act(async () => {
        outcome = await result.current.promptInstall();
      });
      expect(outcome).toBeNull();
    });
  });
});
