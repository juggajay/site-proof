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
  /**
   * Whether the stage's read flow needs AI configured. lot_breakdown has a
   * deterministic (no-file) path, so it stays actionable without AI.
   */
  requiresAi: boolean;
}

// The four Wave-1 stages, in setup order, all wired to extractors + review flows.
export const STAGE_META: StageMeta[] = [
  {
    stage: 'project_facts',
    title: 'Project facts',
    description: 'Read the project name, number, client, and state from a drawing title block.',
    active: true,
    readLabel: 'Read from drawing',
    requiresAi: true,
  },
  {
    stage: 'control_line',
    title: 'Control line',
    description: 'Import the survey control line from a setout sheet.',
    active: true,
    readLabel: 'Read from setout sheet',
    requiresAi: true,
  },
  {
    stage: 'plan_sheets',
    title: 'Plan sheets',
    description: 'Register plan sheets to the project map.',
    active: true,
    readLabel: 'Register a plan sheet',
    requiresAi: true,
  },
  {
    stage: 'lot_breakdown',
    title: 'Lot breakdown',
    description: 'Break the alignment into thin lots by chainage and activity.',
    active: true,
    readLabel: 'Break into lots',
    requiresAi: false,
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
