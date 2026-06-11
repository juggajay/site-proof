// InstallNudge — bottom-anchored install prompt for all authenticated users on mobile.
//
// Shows after the user's second session (open-count >= 2) and only when the
// app is not already installed.  Dismissed nudges re-appear no sooner than
// 14 days later.
//
// iOS: illustrated "Share → Add to Home Screen" steps (no beforeinstallprompt).
// Chromium: a single "Install" button that triggers the deferred native prompt.
//
// References: §4 items 1, 3, 9 of 12-mobile-overhaul-playbook-2026-06.md

import { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  readInstallNudgeOpenCount,
  incrementInstallNudgeOpenCount,
  readInstallNudgeDismissedAt,
  writeInstallNudgeDismissedAt,
} from '@/lib/storagePreferences';

const RE_NUDGE_DAYS = 14;
const RE_NUDGE_MS = RE_NUDGE_DAYS * 24 * 60 * 60 * 1000;

function shouldShowNudge(): boolean {
  // Gate 1: at least second session
  const openCount = readInstallNudgeOpenCount();
  if (openCount < 2) return false;

  // Gate 2: not dismissed within the re-nudge window
  const dismissedAt = readInstallNudgeDismissedAt();
  if (dismissedAt !== null && Date.now() - dismissedAt < RE_NUDGE_MS) return false;

  return true;
}

export function InstallNudge() {
  const isMobile = useIsMobile();
  const { state: installState, canPromptInstall, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  // Count this app open once per component mount (i.e., once per session load).
  useEffect(() => {
    incrementInstallNudgeOpenCount();
  }, []);

  // Decide whether to show the nudge after counting the open.
  useEffect(() => {
    if (!isMobile) return;
    if (installState === 'installed' || installState === 'unsupported') return;
    // Show only for ios-manual or chromium (canPromptInstall may be false for
    // chromium until the event fires, so we show both as soon as state is set).
    if (installState !== 'ios-manual' && installState !== 'chromium') return;
    if (shouldShowNudge()) setVisible(true);
  }, [isMobile, installState]);

  const handleDismiss = () => {
    writeInstallNudgeDismissedAt();
    setVisible(false);
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Install SiteProof app"
      className="fixed right-4 left-4 z-50 above-bottom-nav"
    >
      <div className="rounded-xl border bg-card shadow-lg p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold leading-snug">
            Install SiteProof for offline mode — your work is safer on the home screen.
          </p>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Chromium: native install button */}
        {installState === 'chromium' && (
          <button
            onClick={() => void handleInstall()}
            disabled={!canPromptInstall}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Install
          </button>
        )}

        {/* iOS: illustrated manual steps */}
        {installState === 'ios-manual' && (
          <ol className="space-y-3" aria-label="Steps to install on iOS">
            <li className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Share className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">
                Tap the <strong>Share</strong> button at the bottom of Safari
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <PlusSquare className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">
                Scroll down and tap <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">
                Tap <strong>Add</strong> to confirm
              </span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
