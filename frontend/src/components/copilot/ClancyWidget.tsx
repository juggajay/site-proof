import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import { ClancyPanel } from './ClancyPanel';
import { useClancyEnabled } from './clancyAccess';
import {
  closeClancy,
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
  const { open, messages } = useClancyStore();
  const location = useLocation();
  const navigate = useNavigate();
  const handledNavId = useRef<string | null>(null);

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

  // Execute a `navigate` action the moment Clancy's newest message carries one.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || handledNavId.current === last.id) return;
    handledNavId.current = last.id;
    const nav = last.actions?.find(
      (a): a is Extract<ClancyAction, { type: 'navigate' }> => a.type === 'navigate',
    );
    if (nav) {
      toast({ description: `Taking you to ${navLabel(nav.to)}` });
      navigate(nav.to);
    }
  }, [messages, navigate]);

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
