// usePwaInstall — detects PWA install state and exposes the Chromium
// beforeinstallprompt event so callers can trigger a native install prompt.
//
// States:
//   'installed'    — app is already running in standalone mode (no nudge needed)
//   'chromium'     — Chromium browser; beforeinstallprompt available, custom
//                    prompt can be shown
//   'ios-manual'   — iOS Safari (iPhone/iPad), not standalone; the user must
//                    use Share → Add to Home Screen manually
//   'unsupported'  — neither Chromium nor iOS Safari (e.g. desktop Firefox)
//
// References: §4 item 9 of 12-mobile-overhaul-playbook-2026-06.md

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type PwaInstallState = 'installed' | 'chromium' | 'ios-manual' | 'unsupported';

export interface UsePwaInstallResult {
  state: PwaInstallState;
  /** True only in the 'chromium' state and before the prompt has been used. */
  canPromptInstall: boolean;
  /**
   * Trigger the native Chromium install prompt. Resolves with the user's
   * choice outcome, or null when no prompt is available.
   */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // Standard display-mode check (all modern browsers)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari legacy property
  if (
    'standalone' in window.navigator &&
    (window.navigator as { standalone?: boolean }).standalone === true
  ) {
    return true;
  }
  return false;
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  // Match iPhone or iPad UA without 'Chrome' or 'CriOS' (Chromium on iOS)
  return /iphone|ipad/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Derive initial state once on mount; isStandalone() is cheap.
  const [state, setState] = useState<PwaInstallState>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    if (isStandalone()) return 'installed';
    if (isIosSafari()) return 'ios-manual';
    // 'chromium' is tentative — confirmed only when beforeinstallprompt fires;
    // we start as 'unsupported' and upgrade when the event arrives.
    return 'unsupported';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Re-check standalone in case the display-mode changed after initial mount
    // (e.g. the app was already installed and the check ran too early).
    if (isStandalone()) {
      setState('installed');
      return;
    }

    if (isIosSafari()) {
      setState('ios-manual');
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState('chromium');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If the user installs the app while it is open the display-mode changes.
    const mql = window.matchMedia('(display-mode: standalone)');
    const handleStandaloneChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) setState('installed');
    };
    mql.addEventListener('change', handleStandaloneChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      mql.removeEventListener('change', handleStandaloneChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The prompt can only be used once; clear it regardless of outcome.
    setDeferredPrompt(null);
    if (outcome === 'accepted') setState('installed');
    return outcome;
  }, [deferredPrompt]);

  return {
    state,
    canPromptInstall: state === 'chromium' && deferredPrompt !== null,
    promptInstall,
  };
}
