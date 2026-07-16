import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { toast } from '@/components/ui/toaster';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useAuth } from '@/lib/auth';
import { getCompanyRole } from '@/lib/subcontractorIdentity';
import { ClancyPanel } from './ClancyPanel';
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

// Clancy is an office copilot for the roles that own company setup — owner,
// admin, and project manager (owner decision 2026-07-16). Field roles
// (foreman, subbie) get the mobile shells instead; the chat route enforces
// the same set server-side.
const CLANCY_ROLES = new Set(['owner', 'admin', 'project_manager']);

/**
 * Clancy — the in-app chat copilot. Mounted once in the classic authenticated
 * shell. Renders nothing when AI is not configured on the server or the user
 * is not an owner/admin.
 */
export function ClancyWidget() {
  const { aiConfigured } = useAiStatus();
  const { user } = useAuth();
  const { open, messages, unseen } = useClancyStore();
  const location = useLocation();
  const navigate = useNavigate();
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const handledNavId = useRef<string | null>(null);

  const clancyEnabled = aiConfigured && CLANCY_ROLES.has(getCompanyRole(user));
  const projectId = projectIdFromPath(location.pathname);
  const firstName = firstNameOf(user);

  // First-run: auto-open once after a beat so the intro greets a new user.
  useEffect(() => {
    if (!clancyEnabled || hasSeenIntro()) return;
    const t = setTimeout(() => openClancy(), 1500);
    return () => clearTimeout(t);
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
    bubbleRef.current?.focus();
  };

  const handleSend = (text: string) => {
    markIntroSeen();
    void sendClancy(text, projectId);
  };

  const handleOpenStage = (action: Extract<ClancyAction, { type: 'open_stage' }>) => {
    navigate(`/projects/${action.projectId}/copilot?stage=${action.stage}`);
  };

  return (
    <>
      <button
        ref={bubbleRef}
        type="button"
        onClick={toggleClancy}
        aria-label={open ? 'Close Clancy, your copilot' : 'Open Clancy, your copilot'}
        aria-expanded={open}
        className="clancy-bubble flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-1 ring-white/10 ui-chrome"
      >
        <span className="text-xl font-semibold leading-none tracking-tight" aria-hidden="true">
          J
        </span>
        <span
          className="absolute bottom-3.5 right-3.5 h-1.5 w-1.5 rounded-full bg-[#2563EB]"
          aria-hidden="true"
        />
        {unseen && !open && (
          <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-[#2563EB]" />
        )}
      </button>

      {open && (
        <ClancyPanel
          firstName={firstName}
          onClose={handleClose}
          onOpenStage={handleOpenStage}
          onSend={handleSend}
        />
      )}
    </>
  );
}
