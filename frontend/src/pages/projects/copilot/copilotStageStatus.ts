import type { CopilotProposal, CopilotStage } from './copilotData';

export type StageStatus = 'not_started' | 'review_ready' | 'done';

export interface StageMeta {
  stage: CopilotStage;
  title: string;
  description: string;
  /** Active stages ship an extractor + review flow; inactive ones show "Coming soon". */
  active: boolean;
  /** The "not started" read CTA label (only meaningful for active stages). */
  readLabel: string;
}

// The four Wave-1 stages, in setup order. project_facts and control_line are
// wired to extractors; plan_sheets/lot_breakdown show "Coming soon" for their
// read CTA but still surface any proposal/data status (forward-compatible).
export const STAGE_META: StageMeta[] = [
  {
    stage: 'project_facts',
    title: 'Project facts',
    description: 'Read the project name, number, client, and state from a drawing title block.',
    active: true,
    readLabel: 'Read from drawing',
  },
  {
    stage: 'control_line',
    title: 'Control line',
    description: 'Import the survey control line from a setout sheet.',
    active: true,
    readLabel: 'Read from setout sheet',
  },
  {
    stage: 'plan_sheets',
    title: 'Plan sheets',
    description: 'Register plan sheets to the project map.',
    active: false,
    readLabel: '',
  },
  {
    stage: 'lot_breakdown',
    title: 'Lot breakdown',
    description: 'Generate lots along the alignment.',
    active: false,
    readLabel: '',
  },
];

/**
 * A stage's card status from its newest proposal and whether the underlying data
 * already exists. A pending ('proposed') proposal always wins — there is a
 * decision waiting. Otherwise the stage is "Done" if the data exists or the
 * proposal was applied (accepted/edited); else "Not started".
 */
export function deriveStageStatus(
  proposal: CopilotProposal | null,
  dataExists: boolean,
): StageStatus {
  if (proposal?.status === 'proposed') return 'review_ready';
  if (dataExists) return 'done';
  if (proposal && (proposal.status === 'accepted' || proposal.status === 'edited')) return 'done';
  return 'not_started';
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: 'Not started',
  review_ready: 'Review ready',
  done: 'Done',
};
