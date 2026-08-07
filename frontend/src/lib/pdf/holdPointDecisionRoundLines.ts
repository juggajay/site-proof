import { DEFAULT_APP_TIME_ZONE } from '../localDate';
import type { HoldPointDecisionRound } from './types';

function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('en-AU', {
    timeZone: DEFAULT_APP_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function outcomeLabel(outcome: HoldPointDecisionRound['outcome']): string {
  if (outcome === 'rejected') return 'Release refused';
  if (outcome === 'released_with_conditions') {
    return 'Permission to proceed granted with conditions (a CIVOS convention)';
  }
  if (outcome === 'released') return 'Permission to proceed granted';
  return 'Undecided';
}

export function holdPointDecisionRoundLines(
  rounds: HoldPointDecisionRound[] | null | undefined,
  generatedAt: Date,
): string[] {
  const decidedRounds = (rounds ?? [])
    .filter((round) => round.outcome !== null)
    .sort((a, b) => a.roundNumber - b.roundNumber);
  if (decidedRounds.length === 0) return [];

  const lines = ['Decision rounds'];
  for (const round of decidedRounds) {
    lines.push(`Round ${round.roundNumber}: ${outcomeLabel(round.outcome)}`);
    lines.push(
      `Decided by: ${round.decidedByName || 'Not recorded'}${round.decidedByOrg ? `, ${round.decidedByOrg}` : ''} at ${dateTime(round.decidedAt)}`,
    );
    if (round.decisionReason) lines.push(`Reason: ${round.decisionReason}`);
    if (round.conditions.length > 0) {
      lines.push(`Condition status as at ${dateTime(generatedAt)}`);
      for (const condition of [...round.conditions].sort((a, b) => a.sequence - b.sequence)) {
        const state = condition.recordedSatisfiedAt
          ? `SATISFIED by ${condition.recordedSatisfiedByName || 'Not recorded'} at ${dateTime(condition.recordedSatisfiedAt)}`
          : 'OPEN';
        lines.push(`Condition ${condition.sequence} [${state}]: ${condition.text}`);
        if (condition.satisfactionNote) {
          lines.push(`Satisfaction note: ${condition.satisfactionNote}`);
        }
      }
    }
  }
  return lines;
}
