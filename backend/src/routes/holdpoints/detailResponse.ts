import { parseHPDefaultRecipients, type HPProjectSettings } from './validation.js';
import {
  projectLatestRound,
  type LatestDecisionRoundSource,
  type LatestRoundProjection,
} from './roundCore.js';

export const latestDecisionRoundDetailInclude = {
  orderBy: { roundNumber: 'desc' as const },
  take: 1,
  select: {
    outcome: true,
    decidedAt: true,
    decisionReason: true,
    linkedNcr: {
      select: {
        id: true,
        ncrNumber: true,
        status: true,
      },
    },
    _count: {
      select: {
        conditions: {
          where: { recordedSatisfiedAt: null },
        },
      },
    },
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

export type HoldPointDetailCondition = {
  id: string;
  sequence: number;
  text: string;
  recordedSatisfiedAt: Date | null;
  recordedSatisfiedByName: string | null;
  satisfactionNote: string | null;
  satisfactionEvidenceDocumentId: string | null;
};

type LatestDecisionRoundDetailSource = LatestDecisionRoundSource & {
  conditions: HoldPointDetailCondition[];
};

export type LatestRoundDetailProjection = LatestRoundProjection & {
  conditions: HoldPointDetailCondition[];
};

function projectLatestRoundDetail(
  rounds: readonly LatestDecisionRoundDetailSource[] | null | undefined,
): LatestRoundDetailProjection | null {
  const projected = projectLatestRound(rounds);
  if (!projected) return null;

  return {
    ...projected,
    conditions: rounds?.[0]?.conditions ?? [],
  };
}

type HoldPointPrerequisite = {
  id: string;
  description: string;
  sequenceNumber: number;
  isHoldPoint: boolean;
  isCompleted: boolean;
  isVerified: boolean;
  completedAt: Date | null | undefined;
};

type ExistingHoldPointDetail = {
  id: string;
  status: string;
  notificationSentAt: Date | null;
  scheduledDate: Date | null;
  releasedAt: Date | null;
  releasedByName: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
  releaseTokens?: Array<{
    recipientEmail: string;
    usedAt: Date | null;
  }>;
  releaseNotes: string | null;
  decisionRounds?: LatestDecisionRoundDetailSource[];
};

type HoldPointDetailItem = {
  id: string;
  description: string;
  sequenceNumber: number;
};

type HoldPointDetailSettingsInput = {
  hasRequestPermission: boolean;
  projectSettings: string | null | undefined;
};

export function resolveHoldPointDetailSettings({
  hasRequestPermission,
  projectSettings,
}: HoldPointDetailSettingsInput): {
  defaultRecipients: string[];
  approvalRequirement: string;
} {
  let defaultRecipients: string[] = [];
  let approvalRequirement = 'any';

  if (!hasRequestPermission || !projectSettings) {
    return { defaultRecipients, approvalRequirement };
  }

  try {
    const settings = JSON.parse(projectSettings);
    if (settings.hpRecipients && Array.isArray(settings.hpRecipients)) {
      defaultRecipients = parseHPDefaultRecipients(settings as HPProjectSettings);
    }
    if (settings.hpApprovalRequirement) {
      approvalRequirement = settings.hpApprovalRequirement;
    }
  } catch (_e) {
    // Invalid JSON, use defaults.
  }

  return { defaultRecipients, approvalRequirement };
}

type HoldPointDetailResponseInput = {
  lotId: string;
  lotNumber: string;
  itemId: string;
  holdPointItem: HoldPointDetailItem;
  existingHoldPoint?: ExistingHoldPointDetail;
  prerequisites: HoldPointPrerequisite[];
  incompletePrerequisites: HoldPointPrerequisite[];
  canRequestRelease: boolean;
  defaultRecipients: string[];
  approvalRequirement: string;
};

export function buildHoldPointDetailResponse({
  lotId,
  lotNumber,
  itemId,
  holdPointItem,
  existingHoldPoint,
  prerequisites,
  incompletePrerequisites,
  canRequestRelease,
  defaultRecipients,
  approvalRequirement,
}: HoldPointDetailResponseInput): {
  holdPoint: {
    id: string | null;
    lotId: string;
    lotNumber: string;
    itpChecklistItemId: string;
    description: string;
    sequenceNumber: number;
    status: string;
    notificationSentAt: Date | null | undefined;
    scheduledDate: Date | null | undefined;
    releasedAt: Date | null | undefined;
    releasedByName: string | null | undefined;
    releasedByOrg: string | null | undefined;
    releaseMethod: string | null | undefined;
    releaseRecipientEmail: string | null | undefined;
    releaseNotes: string | null | undefined;
    latestRound: LatestRoundDetailProjection | null;
  };
  prerequisites: HoldPointPrerequisite[];
  incompletePrerequisites: HoldPointPrerequisite[];
  canRequestRelease: boolean;
  defaultRecipients: string[];
  approvalRequirement: string;
} {
  return {
    holdPoint: {
      id: existingHoldPoint?.id || null,
      lotId,
      lotNumber,
      itpChecklistItemId: itemId,
      description: holdPointItem.description,
      sequenceNumber: holdPointItem.sequenceNumber,
      status: existingHoldPoint?.status || 'pending',
      notificationSentAt: existingHoldPoint?.notificationSentAt,
      scheduledDate: existingHoldPoint?.scheduledDate,
      releasedAt: existingHoldPoint?.releasedAt,
      releasedByName: existingHoldPoint?.releasedByName,
      releasedByOrg: existingHoldPoint?.releasedByOrg,
      releaseMethod: existingHoldPoint?.releaseMethod,
      releaseRecipientEmail:
        existingHoldPoint?.releaseTokens?.find((token) => token.usedAt)?.recipientEmail ?? null,
      releaseNotes: existingHoldPoint?.releaseNotes,
      latestRound: projectLatestRoundDetail(existingHoldPoint?.decisionRounds),
    },
    prerequisites,
    incompletePrerequisites,
    canRequestRelease,
    defaultRecipients,
    approvalRequirement,
  };
}
