import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import { ClancyPanel } from './ClancyPanel';
import { useClancyEnabled } from './clancyAccess';
import {
  clearPendingPrompt,
  closeClancy,
  markNavHandled,
  openClancy,
  sendClancy,
  toggleClancy,
  useClancyStore,
  type ClancyAction,
} from './clancyChatState';
import { firstNameOf, hasSeenIntro, markIntroSeen, projectIdFromPath } from './clancyIntro';

const NAV_LABELS: Array<[RegExp, string]> = [
  [/\/copilot/, 'Setup copilot'],
  [/\/plan-sheets/, 'Plan Sheets'],
  [/\/control-lines/, 'Control Lines'],
  [/\/lots\/[^/]+/, 'the lot'],
  [/\/lots/, 'Lots'],
  [/\/itp/, 'ITPs'],
  [/\/diary/, 'the Daily Diary'],
  [/\/dockets/, 'Dockets'],
  [/\/claims/, 'Progress Claims'],
  [/\/hold-points/, 'Hold Points'],
  [/\/ncr/, 'NCRs'],
  [/\/documents/, 'Documents'],
];

function navLabel(to: string): string {
  return NAV_LABELS.find(([re]) => re.test(to))?.[1] ?? 'where you need to be';
}

/**
 * Clancy — the in-app chat copilot. Mounted once in the classic authenticated
 * shell. Owns the right-side drawer and the global ⌘J shortcut; the entry point
 * lives in the header (see Header.tsx). Renders nothing when AI is not
 * configured on the server or the user is not an office role.
 */
export function ClancyWidget() {
  const clancyEnabled = useClancyEnabled();
  const { user } = useAuth();
  const { open, messages, inFlight, pendingPrompt, handledNavMessageId } = useClancyStore();
  const location = useLocation();
  const navigate = useNavigate();

  const projectId = projectIdFromPath(location.pathname);
  const firstName = firstNameOf(user);

  // First-run: auto-open the drawer once after a beat so the intro greets a new
  // user.
  useEffect(() => {
    if (!clancyEnabled || hasSeenIntro()) return;
    const t = setTimeout(() => openClancy(), 1500);
    return () => clearTimeout(t);
  }, [clancyEnabled]);

  // Global ⌘J / Ctrl+J toggles the drawer — mirrors the header search's ⌘K
  // listener (works everywhere, including inside inputs).
  useEffect(() => {
    if (!clancyEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        markIntroSeen();
        toggleClancy();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clancyEnabled]);

  // Consume a prompt queued by a contextual "Ask Clancy" affordance. Clear
  // before sending so the effect can't double-fire on the same prompt; hold off
  // while a send is in flight and retry when it clears.
  useEffect(() => {
    if (!pendingPrompt || inFlight) return;
    const question = pendingPrompt;
    clearPendingPrompt();
    markIntroSeen();
    void sendClancy(question, projectId);
  }, [pendingPrompt, inFlight, projectId]);

  // Execute a `navigate` action the moment Clancy's newest message carries one.
  // The handled-marker lives in the STORE, not a ref: the widget remounts on
  // layout changes while the transcript survives, and a ref reset would replay
  // the last navigation on every remount (live bug: Dashboard clicks kept
  // boomeranging back to the page Clancy last navigated to).
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || handledNavMessageId === last.id) return;
    markNavHandled(last.id);
    const nav = last.actions?.find(
      (a): a is Extract<ClancyAction, { type: 'navigate' }> => a.type === 'navigate',
    );
    if (nav) {
      toast({ description: `Taking you to ${navLabel(nav.to)}` });
      navigate(nav.to);
    }
  }, [messages, handledNavMessageId, navigate]);

  if (!clancyEnabled) return null;

  const handleClose = () => {
    markIntroSeen();
    closeClancy();
    // Return focus to the header entry point (it stays mounted behind the drawer).
    document.getElementById('clancy-header-button')?.focus();
  };

  const handleSend = (text: string) => {
    markIntroSeen();
    void sendClancy(text, projectId);
  };

  const handleOpenStage = (action: Extract<ClancyAction, { type: 'open_stage' }>) => {
    navigate(`/projects/${action.projectId}/copilot?stage=${action.stage}`);
  };

  return open ? (
    <ClancyPanel
      firstName={firstName}
      onClose={handleClose}
      onOpenStage={handleOpenStage}
      onSend={handleSend}
    />
  ) : null;
}
