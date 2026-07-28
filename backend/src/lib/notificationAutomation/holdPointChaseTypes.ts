/** Wave E2 — the row and group shapes the chase pass and its group half share. */

export type EligibleHoldPoint = {
  id: string;
  description: string | null;
  status: string;
  scheduledDate: Date | null;
  notificationSentAt: Date | null;
  notificationSentTo: string | null;
  chaseCount: number;
  lastChasedAt: Date | null;
  createdAt: Date;
  lot: {
    id: string;
    lotNumber: string;
    projectId: string;
    project: { id: string; name: string; workingDays: string | null };
  };
};

/** One `(project, normalized recipient email)` pair — the digest's unit. */
export type RecipientGroup = {
  projectId: string;
  projectName: string;
  workingDays: string | null;
  normalizedEmail: string;
  /** First-seen stored casing — what the address is actually mailed at. */
  email: string;
  holdPoints: EligibleHoldPoint[];
};
