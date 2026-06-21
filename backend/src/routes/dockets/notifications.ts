// =============================================================================
// Docket notification payload builders: pure functions that produce the in-app
// notification record (minus the per-recipient userId) and the email payload
// for each docket workflow transition (submit/approve/reject/query/respond).
// Extracted from dockets.ts to remove repeated inline payload construction —
// the notification type, title, message, projectName, and linkUrl are preserved
// exactly. Recipient lookup, createMany, and the sendNotificationIfEnabled loops
// stay in the route handlers, so notification/transaction ordering is unchanged.
// =============================================================================

export type DocketInAppNotification = {
  projectId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
};

export type DocketEmailNotification = {
  title: string;
  message: string;
  projectName: string;
  linkUrl: string;
};

const docketsLink = (projectId: string): string => `/projects/${projectId}/dockets`;

export type DocketSubmittedNotificationContext = {
  projectId: string;
  projectName: string;
  docketNumber: string;
  docketDate: string;
  subcontractorName: string;
  pendingCount: number;
};

export function buildDocketSubmittedNotifications(ctx: DocketSubmittedNotificationContext): {
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
} {
  const { projectId, projectName, docketNumber, docketDate, subcontractorName, pendingCount } = ctx;
  const linkUrl = docketsLink(projectId);
  return {
    inApp: {
      projectId,
      type: 'docket_pending',
      title: 'Docket Pending Approval',
      message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval. ${pendingCount} docket${pendingCount !== 1 ? 's' : ''} pending.`,
      linkUrl,
    },
    email: {
      title: 'Docket Pending Approval',
      message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval.\n\nProject: ${projectName}\nPending Dockets: ${pendingCount}\n\nPlease review and approve at your earliest convenience.`,
      projectName,
      linkUrl,
    },
  };
}

export type DocketApprovedNotificationContext = {
  projectId: string;
  projectName: string;
  docketNumber: string;
  docketDate: string;
  approverName: string;
  foremanNotes: string | null | undefined;
  adjustmentReason: string | null | undefined;
};

export function buildDocketApprovedNotifications(ctx: DocketApprovedNotificationContext): {
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
} {
  const {
    projectId,
    projectName,
    docketNumber,
    docketDate,
    approverName,
    foremanNotes,
    adjustmentReason,
  } = ctx;
  const linkUrl = docketsLink(projectId);
  return {
    inApp: {
      projectId,
      type: 'docket_approved',
      title: 'Docket Approved',
      message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}. Status: Approved${adjustmentReason ? ` (with adjustments)` : ''}.`,
      linkUrl,
    },
    email: {
      title: 'Docket Approved',
      message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}.\n\nProject: ${projectName}\nStatus: Approved\n${foremanNotes ? `Notes: ${foremanNotes}` : ''}\n${adjustmentReason ? `Adjustment Reason: ${adjustmentReason}` : ''}`,
      projectName,
      linkUrl,
    },
  };
}

export type DocketRejectedNotificationContext = {
  projectId: string;
  projectName: string;
  docketNumber: string;
  docketDate: string;
  rejectorName: string;
  reason: string;
};

export function buildDocketRejectedNotifications(ctx: DocketRejectedNotificationContext): {
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
} {
  const { projectId, projectName, docketNumber, docketDate, rejectorName, reason } = ctx;
  const linkUrl = docketsLink(projectId);
  return {
    inApp: {
      projectId,
      type: 'docket_rejected',
      title: 'Docket Rejected',
      message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.${reason ? ` Reason: ${reason}` : ''}`,
      linkUrl,
    },
    email: {
      title: 'Docket Rejected',
      message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.\n\nProject: ${projectName}\nStatus: Rejected\nReason: ${reason}\n\nPlease review and resubmit if necessary.`,
      projectName,
      linkUrl,
    },
  };
}

export type DocketQueriedNotificationContext = {
  projectId: string;
  projectName: string;
  docketNumber: string;
  docketDate: string;
  querierName: string;
  questions: string;
};

export function buildDocketQueriedNotifications(ctx: DocketQueriedNotificationContext): {
  inApp: DocketInAppNotification;
  email: DocketEmailNotification;
} {
  const { projectId, projectName, docketNumber, docketDate, querierName, questions } = ctx;
  const linkUrl = docketsLink(projectId);
  return {
    inApp: {
      projectId,
      type: 'docket_queried',
      title: 'Docket Query',
      message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nQuestions: ${questions.substring(0, 200)}${questions.length > 200 ? '...' : ''}\n\nPlease review and respond or amend the docket.`,
      linkUrl,
    },
    email: {
      title: 'Docket Query - Response Required',
      message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nProject: ${projectName}\n\nQuestions/Issues:\n${questions}\n\nPlease review and respond or amend the docket.`,
      projectName,
      linkUrl,
    },
  };
}

export type DocketQueryResponseNotificationContext = {
  projectId: string;
  docketNumber: string;
  docketDate: string;
  responderName: string;
  response: string;
};

export function buildDocketQueryResponseNotification(ctx: DocketQueryResponseNotificationContext): {
  inApp: DocketInAppNotification;
} {
  const { projectId, docketNumber, docketDate, responderName, response } = ctx;
  return {
    inApp: {
      projectId,
      type: 'docket_query_response',
      title: 'Docket Query Response',
      message: `${responderName} has responded to the query on docket ${docketNumber} (${docketDate}).\n\nResponse: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}\n\nThe docket is ready for review.`,
      linkUrl: docketsLink(projectId),
    },
  };
}
