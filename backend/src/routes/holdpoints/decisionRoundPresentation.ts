export const evidenceDecisionRoundsInclude = {
  orderBy: { roundNumber: 'asc' as const },
  select: {
    id: true,
    roundNumber: true,
    requestedAt: true,
    responseToPriorRejection: true,
    outcome: true,
    decidedAt: true,
    decidedByName: true,
    decidedByOrg: true,
    decisionReason: true,
    withdrawnAt: true,
    withdrawalReason: true,
    conditions: {
      orderBy: { sequence: 'asc' as const },
      select: {
        id: true,
        sequence: true,
        text: true,
        recordedSatisfiedAt: true,
        recordedSatisfiedByName: true,
        satisfactionNote: true,
        satisfactionEvidenceDocumentId: true,
      },
    },
  },
} as const;

type EvidenceConditionSource = {
  id: string;
  sequence: number;
  text: string;
  recordedSatisfiedAt: Date | null;
  recordedSatisfiedByName: string | null;
  satisfactionNote: string | null;
  satisfactionEvidenceDocumentId: string | null;
};

export type EvidenceDecisionRoundSource = {
  id: string;
  roundNumber: number;
  requestedAt: Date;
  responseToPriorRejection: string | null;
  outcome: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  decidedByOrg: string | null;
  decisionReason: string | null;
  withdrawnAt: Date | null;
  withdrawalReason: string | null;
  conditions: EvidenceConditionSource[];
};

/**
 * Maps only the immutable decision history consumed by the evidence PDF.
 * Explicit projection is a defence-in-depth boundary: Prisma round records
 * also carry recipientEmail/recipientName, which public link bearers must not
 * receive and the renderer never needs.
 */
export function mapEvidenceDecisionRounds(rounds: readonly EvidenceDecisionRoundSource[]) {
  return rounds.map((round) => ({
    id: round.id,
    roundNumber: round.roundNumber,
    requestedAt: round.requestedAt,
    responseToPriorRejection: round.responseToPriorRejection,
    outcome: round.outcome,
    decidedAt: round.decidedAt,
    decidedByName: round.decidedByName,
    decidedByOrg: round.decidedByOrg,
    decisionReason: round.decisionReason,
    withdrawnAt: round.withdrawnAt,
    withdrawalReason: round.withdrawalReason,
    conditions: round.conditions.map((condition) => ({
      id: condition.id,
      sequence: condition.sequence,
      text: condition.text,
      recordedSatisfiedAt: condition.recordedSatisfiedAt,
      recordedSatisfiedByName: condition.recordedSatisfiedByName,
      satisfactionNote: condition.satisfactionNote,
      satisfactionEvidenceDocumentId: condition.satisfactionEvidenceDocumentId,
    })),
  }));
}

export function withEvidenceDecisionRounds<THoldPoint extends Record<string, unknown>>(
  holdPoint: THoldPoint,
  rounds: readonly EvidenceDecisionRoundSource[],
) {
  return {
    ...holdPoint,
    decisionRounds: mapEvidenceDecisionRounds(rounds),
  };
}
