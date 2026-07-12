/**
 * itpRunPresentation — copy helpers shared VERBATIM by the foreman
 * (ItpRunScreen) and subbie (SubbieItpRunScreen) ITP run screens.
 *
 * These were byte-identical duplicates in both screens; they live here so the
 * two run surfaces stay worded identically and a copy fix lands in both at once.
 * Pure presentation — no behaviour, no state.
 */
import { isSuperintendentSignoffOnlyItem } from '@/shell/screens/lots/lotsShellState';
import type { ITPChecklistItem } from '@/pages/lots/types';

const RESPONSIBLE_LABEL: Record<string, string> = {
  contractor: 'Contractor',
  subcontractor: 'Subcontractor',
  superintendent: 'Superintendent',
  general: 'General',
};

const EVIDENCE_SUFFIX: Record<string, string> = {
  photo: 'photo evidence can be attached',
  test: 'test cert can be attached',
  document: 'document can be attached',
  none: '',
};

export function subline(item: ITPChecklistItem): string {
  const who = RESPONSIBLE_LABEL[item.responsibleParty] ?? 'General';
  const suffix = EVIDENCE_SUFFIX[item.evidenceRequired] ?? '';
  return suffix ? `Responsible: ${who} · ${suffix}` : `Responsible: ${who}`;
}

// Status line shown under each question in the scrub-preview content strip.
const STRIP_STATE_LINE: Record<string, string> = {
  done: '✓ Passed — saved',
  failed: '✕ Failed — needs attention',
  na: 'N/A — reason recorded',
  hold: 'Awaiting hold point release',
  review: 'Awaiting head-contractor verification',
  rejected: 'Rejected — update and resubmit',
  open: 'Not started',
};

export function stripStateLine(item: ITPChecklistItem, state: string): string {
  if (!isSuperintendentSignoffOnlyItem(item)) return STRIP_STATE_LINE[state];
  if (state === 'done') return 'Superintendent sign-off recorded';
  if (state === 'failed' || state === 'na') return STRIP_STATE_LINE[state];
  return 'Superintendent sign-off required';
}
