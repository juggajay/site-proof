# Evidence Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the additive, no-migration Evidence Readiness layer so lots and claims explain conformance, claimability, evidence blockers, warnings, and supporting proof without changing existing business rules.

**Architecture:** Add deterministic backend readiness helpers and read-only endpoints, then render their output in the existing lot detail and claim flows. Keep conformance and claim creation rules authoritative in their current handlers; readiness explains those rules and uses `blocksAction` to prevent UI display issues from silently becoming new policy.

**Tech Stack:** Express, Prisma, Vitest, Supertest, React 18, TypeScript, TanStack Query, Playwright, Tailwind/shadcn-style components.

---

## Scope And PR Boundaries

This plan implements the approved design in four PRs:

1. **PR1: Backend lot readiness contract and endpoint**
2. **PR2: Frontend lot readiness panel**
3. **PR3: Backend claim readiness helper/endpoint plus Create Claim readiness UI**
4. **PR4: Claim Evidence Review wording and presentation cleanup**

Explicitly deferred:

- Project-level readiness summary.
- Evidence Pack export changes.
- Reports using readiness language.
- Claim `disputeNotes` data-model cleanup.
- New hard business rules for hold points, dockets, photos, diaries, or reports.
- Any database migration.

Each PR should be opened and merged independently. Do not bundle all four unless Jay explicitly asks for a larger PR.

## File Structure

### Backend

- Create `backend/src/lib/evidenceReadiness.ts`
  - Shared DTO types and helper functions.
  - Lot readiness calculation.
  - Claim readiness analysis helpers.
  - Functions must be deterministic, read-only, and reusable by route handlers.
- Create `backend/src/lib/evidenceReadiness.test.ts`
  - Unit-level tests for severity mapping, `blocksAction`, commercial filtering, and hold-point classification.
- Modify `backend/src/routes/lots.ts`
  - Add `GET /api/lots/:id/readiness`.
  - Reuse existing access patterns and `checkConformancePrerequisites`.
- Modify `backend/src/routes/lots.test.ts`
  - Add route-level tests for lot readiness, access control, subcontractor filtering, and unavailable lots.
- Modify `backend/src/routes/claims.ts`
  - Add `GET /api/projects/:projectId/claim-readiness`.
  - Refactor existing completeness-check logic to call the shared helper and return readiness-shaped data.
- Modify `backend/src/routes/claims.test.ts`
  - Add route-level tests for claim readiness and the refactored post-claim review.

### Frontend

- Create `frontend/src/types/evidenceReadiness.ts`
  - Frontend DTO types mirroring backend response shapes.
- Modify `frontend/src/lib/queryKeys.ts`
  - Add readiness query keys.
- Create `frontend/src/pages/lots/components/LotReadinessPanel.tsx`
  - Desktop/mobile responsive lot readiness panel.
- Modify `frontend/src/pages/lots/LotDetailPage.tsx`
  - Fetch readiness and render the panel near the top.
  - Keep existing quality-management actions intact.
- Modify `frontend/e2e/lot-detail.spec.ts`
  - Mock readiness endpoint and assert panel behavior.
- Modify `frontend/src/pages/claims/types.ts`
  - Replace/extend completeness types with readiness-shaped claim review types.
- Modify `frontend/src/pages/claims/components/CreateClaimModal.tsx`
  - Fetch claim readiness and use it for ready/attention/not-claimable grouping.
- Modify `frontend/src/pages/claims/components/CompletenessCheckModal.tsx`
  - Reframe as Claim Evidence Review and consume readiness-shaped data after PR3.
- Modify `frontend/e2e/claims.spec.ts`
  - Mock claim readiness/review responses and assert UI behavior.
- Modify `frontend/e2e/productionReadiness.spec.ts`
  - Replace guardrails that look for "AI Completeness Check" with "Claim Evidence Review".

## Shared Contract

Use this shape consistently in backend and frontend:

```ts
export type EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support';

export type EvidenceReadinessArea =
  | 'conformance'
  | 'claim'
  | 'itp'
  | 'hold_point'
  | 'test'
  | 'ncr'
  | 'docket'
  | 'diary'
  | 'document'
  | 'budget'
  | 'permission';

export interface EvidenceReadinessItem {
  code: string;
  severity: EvidenceReadinessSeverity;
  area: EvidenceReadinessArea;
  title: string;
  detail: string;
  blocksAction: boolean;
  actionLabel?: string;
  actionHref?: string;
  count?: number;
  relatedIds?: string[];
}

export interface ReadinessBucket {
  state: 'ready' | 'blocked' | 'warning' | 'already_conformed' | 'already_claimed' | 'not_conformed';
  blockers: EvidenceReadinessItem[];
  warnings: EvidenceReadinessItem[];
  support: EvidenceReadinessItem[];
}
```

`blocksAction` is the important safety property:

- `true` means the existing backend rule already blocks the action or the user lacks permission.
- `false` means the issue is important evidence risk but the app must not disable submission/selection because of it.

## Task 0: Preparation And Baseline

**Files:**
- Read: `CLAUDE.md`
- Read: `docs/superpowers/specs/2026-05-21-evidence-readiness-design.md`
- Read: `tasks/lessons.md`

- [ ] **Step 1: Sync and inspect the worktree**

Run:

```powershell
git status --short --branch
git log --oneline -5
```

Expected:

- You know the current branch before editing.
- You see existing unrelated dirty files and do not stage them.

- [ ] **Step 2: Create an isolated implementation branch or worktree**

Use a clean branch from current `master` if possible:

```powershell
git switch master
git pull --ff-only
git switch -c feat/evidence-readiness-backend
```

If unrelated local dirty files prevent switching, use a git worktree rather than stashing Jay's files:

```powershell
git fetch origin
git worktree add .worktrees/evidence-readiness-backend origin/master -b feat/evidence-readiness-backend
Set-Location .worktrees/evidence-readiness-backend
```

Expected:

- Implementation happens away from unrelated local `tasks/lessons.md`, `.deepsec/`, `docs/live-dogfood-qa-plan.md`, and `tasks/todo.md`.

- [ ] **Step 3: Run baseline checks for the first PR area**

Run:

```powershell
cd backend
pnpm test -- src/routes/lots.test.ts --runInBand
pnpm type-check
cd ..
```

Expected:

- Existing lot route tests pass before changing backend readiness behavior.
- If they fail, stop and investigate before editing.

## PR1: Backend Lot Readiness Contract And Endpoint

### Task 1: Add Backend Readiness Types And Pure Helpers

**Files:**
- Create: `backend/src/lib/evidenceReadiness.ts`
- Test: `backend/src/lib/evidenceReadiness.test.ts`

- [ ] **Step 1: Write failing unit tests for item classification**

Create `backend/src/lib/evidenceReadiness.test.ts` with these initial tests:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildReadinessItem,
  summarizeReadiness,
  filterCommercialReadiness,
  mapCompletenessSeverityToReadiness,
} from './evidenceReadiness.js';

describe('evidence readiness helpers', () => {
  it('distinguishes action blockers from evidence blockers', () => {
    const actionBlocker = buildReadinessItem({
      code: 'missing_budget',
      severity: 'blocker',
      area: 'budget',
      title: 'Budget amount missing',
      detail: 'Add a budget amount before claiming this lot.',
      blocksAction: true,
    });
    const evidenceBlocker = buildReadinessItem({
      code: 'unreleased_hold_point',
      severity: 'blocker',
      area: 'hold_point',
      title: 'Hold point not released',
      detail: 'Release the hold point before sending a stronger claim pack.',
      blocksAction: false,
    });

    expect(actionBlocker.blocksAction).toBe(true);
    expect(evidenceBlocker.blocksAction).toBe(false);
  });

  it('counts blockers, warnings, and support in a summary', () => {
    const summary = summarizeReadiness({
      blockers: [
        buildReadinessItem({
          code: 'not_conformed',
          severity: 'blocker',
          area: 'claim',
          title: 'Lot not conformed',
          detail: 'Conform the lot before claiming it.',
          blocksAction: true,
        }),
      ],
      warnings: [
        buildReadinessItem({
          code: 'no_photos',
          severity: 'warning',
          area: 'document',
          title: 'No photos linked',
          detail: 'Photos strengthen the evidence pack.',
          blocksAction: false,
        }),
      ],
      support: [
        buildReadinessItem({
          code: 'itp_assigned',
          severity: 'support',
          area: 'itp',
          title: 'ITP assigned',
          detail: 'An ITP is assigned to this lot.',
          blocksAction: false,
        }),
      ],
    });

    expect(summary).toEqual({ blockerCount: 1, warningCount: 1, supportCount: 1 });
  });

  it('physically removes commercial readiness fields for subcontractor callers', () => {
    const filtered = filterCommercialReadiness(
      {
        budgetAmount: 12000,
        claimAmount: 12000,
        items: [
          buildReadinessItem({
            code: 'missing_budget',
            severity: 'blocker',
            area: 'budget',
            title: 'Budget amount missing',
            detail: 'Add a budget before claiming.',
            blocksAction: true,
          }),
          buildReadinessItem({
            code: 'itp_assigned',
            severity: 'support',
            area: 'itp',
            title: 'ITP assigned',
            detail: 'An ITP is assigned.',
            blocksAction: false,
          }),
        ],
      },
      { canViewCommercial: false },
    );

    expect('budgetAmount' in filtered).toBe(false);
    expect('claimAmount' in filtered).toBe(false);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].code).toBe('itp_assigned');
  });

  it('maps existing completeness severities into readiness vocabulary', () => {
    expect(mapCompletenessSeverityToReadiness('critical')).toBe('blocker');
    expect(mapCompletenessSeverityToReadiness('warning')).toBe('warning');
    expect(mapCompletenessSeverityToReadiness('info')).toBe('support');
  });
});
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
cd ..
```

Expected:

- Fails because `backend/src/lib/evidenceReadiness.ts` does not exist.

- [ ] **Step 3: Add the helper module**

Create `backend/src/lib/evidenceReadiness.ts`:

```ts
export type EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support';

export type EvidenceReadinessArea =
  | 'conformance'
  | 'claim'
  | 'itp'
  | 'hold_point'
  | 'test'
  | 'ncr'
  | 'docket'
  | 'diary'
  | 'document'
  | 'budget'
  | 'permission';

export interface EvidenceReadinessItem {
  code: string;
  severity: EvidenceReadinessSeverity;
  area: EvidenceReadinessArea;
  title: string;
  detail: string;
  blocksAction: boolean;
  actionLabel?: string;
  actionHref?: string;
  count?: number;
  relatedIds?: string[];
}

export interface ReadinessBucket {
  state:
    | 'ready'
    | 'blocked'
    | 'warning'
    | 'already_conformed'
    | 'already_claimed'
    | 'not_conformed';
  blockers: EvidenceReadinessItem[];
  warnings: EvidenceReadinessItem[];
  support: EvidenceReadinessItem[];
}

export interface ReadinessCounts {
  blockerCount: number;
  warningCount: number;
  supportCount: number;
}

export function buildReadinessItem(item: EvidenceReadinessItem): EvidenceReadinessItem {
  return item;
}

export function summarizeReadiness(bucket: {
  blockers: EvidenceReadinessItem[];
  warnings: EvidenceReadinessItem[];
  support: EvidenceReadinessItem[];
}): ReadinessCounts {
  return {
    blockerCount: bucket.blockers.length,
    warningCount: bucket.warnings.length,
    supportCount: bucket.support.length,
  };
}

export function mapCompletenessSeverityToReadiness(
  severity: 'critical' | 'warning' | 'info',
): EvidenceReadinessSeverity {
  if (severity === 'critical') return 'blocker';
  if (severity === 'warning') return 'warning';
  return 'support';
}

interface CommercialReadinessPayload {
  budgetAmount?: number | null;
  claimAmount?: number | null;
  items: EvidenceReadinessItem[];
}

export function filterCommercialReadiness<T extends CommercialReadinessPayload>(
  payload: T,
  { canViewCommercial }: { canViewCommercial: boolean },
): Omit<T, 'budgetAmount' | 'claimAmount'> | T {
  if (canViewCommercial) {
    return payload;
  }

  const { budgetAmount: _budgetAmount, claimAmount: _claimAmount, ...rest } = payload;
  return {
    ...rest,
    items: payload.items.filter((item) => item.area !== 'budget' && item.area !== 'claim'),
  };
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
cd ..
```

Expected:

- Tests pass.

### Task 2: Add Lot Readiness Calculation

**Files:**
- Modify: `backend/src/lib/evidenceReadiness.ts`
- Test: `backend/src/lib/evidenceReadiness.test.ts`

- [ ] **Step 1: Add failing tests for lot readiness states**

Append these tests to `backend/src/lib/evidenceReadiness.test.ts`:

```ts
import { buildLotReadinessFromInputs } from './evidenceReadiness.js';

describe('lot readiness calculation', () => {
  it('mirrors conformance blockers from the existing prerequisite result', () => {
    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: 'lot-1',
        lotNumber: 'LOT-001',
        status: 'in_progress',
        budgetAmount: 1000,
        claimedInId: null,
      },
      canViewCommercial: true,
      conformStatus: {
        canConform: false,
        blockingReasons: ['ITP checklist incomplete (2/5 items completed)'],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: false,
          itpCompletedCount: 2,
          itpTotalCount: 5,
          hasPassingTest: true,
          noOpenNcrs: true,
          openNcrs: [],
        },
      },
      evidenceCounts: {
        unreleasedHoldPoints: 0,
        releasedHoldPoints: 1,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: 0,
        photos: 0,
        pendingTests: 0,
      },
    });

    expect(readiness.conformance.state).toBe('blocked');
    expect(readiness.conformance.blockers.map((item) => item.code)).toContain('itp_incomplete');
    expect(readiness.conformance.blockers.every((item) => item.blocksAction)).toBe(true);
    expect(readiness.claim.state).toBe('not_conformed');
    expect(readiness.claim.blockers.find((item) => item.code === 'not_conformed')?.blocksAction).toBe(true);
  });

  it('treats unreleased hold points as claim evidence blockers that do not block selection', () => {
    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: 'lot-2',
        lotNumber: 'LOT-002',
        status: 'conformed',
        budgetAmount: 5000,
        claimedInId: null,
      },
      canViewCommercial: true,
      conformStatus: {
        canConform: true,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 5,
          itpTotalCount: 5,
          hasPassingTest: true,
          noOpenNcrs: true,
          openNcrs: [],
        },
      },
      evidenceCounts: {
        unreleasedHoldPoints: 2,
        releasedHoldPoints: 0,
        approvedDockets: 1,
        diaryEntries: 0,
        documents: 0,
        photos: 0,
        pendingTests: 0,
      },
    });

    const hpBlocker = readiness.claim.blockers.find(
      (item) => item.code === 'unreleased_hold_points',
    );
    expect(readiness.claim.state).toBe('warning');
    expect(hpBlocker).toMatchObject({ blocksAction: false, area: 'hold_point' });
  });

  it('removes commercial fields and budget blockers for non-commercial callers', () => {
    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: 'lot-3',
        lotNumber: 'LOT-003',
        status: 'conformed',
        budgetAmount: null,
        claimedInId: null,
      },
      canViewCommercial: false,
      conformStatus: {
        canConform: true,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 1,
          itpTotalCount: 1,
          hasPassingTest: true,
          noOpenNcrs: true,
          openNcrs: [],
        },
      },
      evidenceCounts: {
        unreleasedHoldPoints: 0,
        releasedHoldPoints: 0,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: 0,
        photos: 0,
        pendingTests: 0,
      },
    });

    expect('budgetAmount' in readiness.claim).toBe(false);
    expect(readiness.claim.blockers.some((item) => item.area === 'budget')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
cd ..
```

Expected:

- Fails because `buildLotReadinessFromInputs` is missing.

- [ ] **Step 3: Implement `buildLotReadinessFromInputs`**

Add to `backend/src/lib/evidenceReadiness.ts`:

```ts
interface ConformStatusInput {
  canConform: boolean;
  blockingReasons: string[];
  prerequisites: {
    itpAssigned: boolean;
    itpCompleted: boolean;
    itpCompletedCount: number;
    itpTotalCount: number;
    hasPassingTest: boolean;
    noOpenNcrs: boolean;
    openNcrs: { id: string; ncrNumber: string; status: string }[];
  };
}

interface LotReadinessInput {
  lot: {
    id: string;
    lotNumber: string;
    status: string;
    budgetAmount: number | null;
    claimedInId: string | null;
  };
  canViewCommercial: boolean;
  conformStatus: ConformStatusInput;
  evidenceCounts: {
    unreleasedHoldPoints: number;
    releasedHoldPoints: number;
    approvedDockets: number;
    diaryEntries: number;
    documents: number;
    photos: number;
    pendingTests: number;
  };
}

export interface LotEvidenceReadiness {
  lotId: string;
  lotNumber: string;
  status: string;
  conformance: ReadinessBucket;
  claim: ReadinessBucket & { budgetAmount?: number | null };
  summary: ReadinessCounts & {
    nextActionLabel: string;
    nextActionHref?: string;
  };
}

function classifyConformanceBlockers(conformStatus: ConformStatusInput): EvidenceReadinessItem[] {
  const blockers: EvidenceReadinessItem[] = [];
  const prereq = conformStatus.prerequisites;

  if (!prereq.itpAssigned) {
    blockers.push(
      buildReadinessItem({
        code: 'no_itp_assigned',
        severity: 'blocker',
        area: 'itp',
        title: 'No ITP assigned',
        detail: 'Assign an ITP before this lot can be conformed.',
        blocksAction: true,
        actionLabel: 'Assign ITP',
        actionHref: '?tab=itp',
      }),
    );
  }

  if (prereq.itpAssigned && !prereq.itpCompleted) {
    blockers.push(
      buildReadinessItem({
        code: 'itp_incomplete',
        severity: 'blocker',
        area: 'itp',
        title: 'ITP incomplete',
        detail: `${prereq.itpCompletedCount}/${prereq.itpTotalCount} checklist items complete.`,
        blocksAction: true,
        actionLabel: 'Open ITP',
        actionHref: '?tab=itp',
      }),
    );
  }

  if (!prereq.hasPassingTest) {
    blockers.push(
      buildReadinessItem({
        code: 'no_passing_verified_test',
        severity: 'blocker',
        area: 'test',
        title: 'No passing verified test',
        detail: 'Add or verify a passing test result before normal conformance.',
        blocksAction: true,
        actionLabel: 'Open tests',
        actionHref: '?tab=tests',
      }),
    );
  }

  if (!prereq.noOpenNcrs) {
    blockers.push(
      buildReadinessItem({
        code: 'open_ncrs',
        severity: 'blocker',
        area: 'ncr',
        title: `${prereq.openNcrs.length} open NCR${prereq.openNcrs.length === 1 ? '' : 's'}`,
        detail: 'Close open NCRs before normal conformance.',
        blocksAction: true,
        actionLabel: 'Open NCRs',
        actionHref: '?tab=ncrs',
        count: prereq.openNcrs.length,
        relatedIds: prereq.openNcrs.map((ncr) => ncr.id),
      }),
    );
  }

  return blockers;
}

function buildSupportItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const support: EvidenceReadinessItem[] = [];
  const prereq = input.conformStatus.prerequisites;

  if (prereq.itpAssigned) {
    support.push(
      buildReadinessItem({
        code: 'itp_assigned',
        severity: 'support',
        area: 'itp',
        title: 'ITP assigned',
        detail: `${prereq.itpCompletedCount}/${prereq.itpTotalCount} checklist items complete.`,
        blocksAction: false,
      }),
    );
  }

  if (prereq.hasPassingTest) {
    support.push(
      buildReadinessItem({
        code: 'passing_verified_test',
        severity: 'support',
        area: 'test',
        title: 'Passing verified test',
        detail: 'At least one passing test result is verified.',
        blocksAction: false,
      }),
    );
  }

  if (input.evidenceCounts.releasedHoldPoints > 0) {
    support.push(
      buildReadinessItem({
        code: 'released_hold_points',
        severity: 'support',
        area: 'hold_point',
        title: `${input.evidenceCounts.releasedHoldPoints} hold point${input.evidenceCounts.releasedHoldPoints === 1 ? '' : 's'} released`,
        detail: 'Released hold points support the evidence pack.',
        blocksAction: false,
        count: input.evidenceCounts.releasedHoldPoints,
      }),
    );
  }

  if (input.evidenceCounts.approvedDockets > 0) {
    support.push(
      buildReadinessItem({
        code: 'approved_dockets',
        severity: 'support',
        area: 'docket',
        title: `${input.evidenceCounts.approvedDockets} approved docket${input.evidenceCounts.approvedDockets === 1 ? '' : 's'}`,
        detail: 'Approved dockets support claim substantiation.',
        blocksAction: false,
        count: input.evidenceCounts.approvedDockets,
      }),
    );
  }

  return support;
}

function buildWarningItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const warnings: EvidenceReadinessItem[] = [];

  if (input.evidenceCounts.photos === 0) {
    warnings.push(
      buildReadinessItem({
        code: 'no_photos',
        severity: 'warning',
        area: 'document',
        title: 'No photos linked',
        detail: 'Photos strengthen the evidence pack but do not block v1 workflows.',
        blocksAction: false,
        actionLabel: 'Open photos',
        actionHref: '?tab=photos',
      }),
    );
  }

  if (input.evidenceCounts.approvedDockets === 0) {
    warnings.push(
      buildReadinessItem({
        code: 'no_approved_dockets',
        severity: 'warning',
        area: 'docket',
        title: 'No approved dockets linked',
        detail: 'Approved dockets strengthen claim support but are not a v1 hard gate.',
        blocksAction: false,
      }),
    );
  }

  if (input.evidenceCounts.pendingTests > 0) {
    warnings.push(
      buildReadinessItem({
        code: 'pending_tests',
        severity: 'warning',
        area: 'test',
        title: `${input.evidenceCounts.pendingTests} pending test${input.evidenceCounts.pendingTests === 1 ? '' : 's'}`,
        detail: 'Pending tests should be resolved before sending the strongest evidence pack.',
        blocksAction: false,
        actionLabel: 'Open tests',
        actionHref: '?tab=tests',
        count: input.evidenceCounts.pendingTests,
      }),
    );
  }

  return warnings;
}

export function buildLotReadinessFromInputs(input: LotReadinessInput): LotEvidenceReadiness {
  const conformanceBlockers = classifyConformanceBlockers(input.conformStatus);
  const support = buildSupportItems(input);
  const warnings = buildWarningItems(input);

  const conformanceState =
    input.lot.status === 'claimed'
      ? 'already_claimed'
      : input.lot.status === 'conformed'
        ? 'already_conformed'
        : conformanceBlockers.length > 0
          ? 'blocked'
          : 'ready';

  const claimBlockers: EvidenceReadinessItem[] = [];

  if (input.lot.status !== 'conformed') {
    claimBlockers.push(
      buildReadinessItem({
        code: 'not_conformed',
        severity: 'blocker',
        area: 'claim',
        title: 'Lot not conformed',
        detail: 'Conform this lot before it can be claimed.',
        blocksAction: true,
        actionLabel: 'Open conformance',
      }),
    );
  }

  if (input.lot.claimedInId || input.lot.status === 'claimed') {
    claimBlockers.push(
      buildReadinessItem({
        code: 'already_claimed',
        severity: 'blocker',
        area: 'claim',
        title: 'Already claimed',
        detail: 'This lot is already linked to a progress claim.',
        blocksAction: true,
      }),
    );
  }

  if (input.canViewCommercial && (!input.lot.budgetAmount || input.lot.budgetAmount <= 0)) {
    claimBlockers.push(
      buildReadinessItem({
        code: 'missing_budget',
        severity: 'blocker',
        area: 'budget',
        title: 'Budget amount missing',
        detail: 'Add a positive budget amount before claiming this lot.',
        blocksAction: true,
        actionLabel: 'Edit budget',
      }),
    );
  }

  if (input.evidenceCounts.unreleasedHoldPoints > 0) {
    claimBlockers.push(
      buildReadinessItem({
        code: 'unreleased_hold_points',
        severity: 'blocker',
        area: 'hold_point',
        title: `${input.evidenceCounts.unreleasedHoldPoints} hold point${input.evidenceCounts.unreleasedHoldPoints === 1 ? '' : 's'} not released`,
        detail: 'Release hold points before sending a client-ready claim evidence pack.',
        blocksAction: false,
        actionLabel: 'Open hold points',
        count: input.evidenceCounts.unreleasedHoldPoints,
      }),
    );
  }

  const actionBlockers = claimBlockers.filter((item) => item.blocksAction);
  const claimState =
    input.lot.status === 'claimed' || input.lot.claimedInId
      ? 'already_claimed'
      : input.lot.status !== 'conformed'
        ? 'not_conformed'
        : actionBlockers.length > 0
          ? 'blocked'
          : claimBlockers.length > 0 || warnings.length > 0
            ? 'warning'
            : 'ready';

  const claimBucket: LotEvidenceReadiness['claim'] = {
    state: claimState,
    blockers: input.canViewCommercial
      ? claimBlockers
      : claimBlockers.filter((item) => item.area !== 'budget' && item.area !== 'claim'),
    warnings,
    support,
    ...(input.canViewCommercial ? { budgetAmount: input.lot.budgetAmount } : {}),
  };

  const conformanceBucket: ReadinessBucket = {
    state: conformanceState,
    blockers: conformanceBlockers,
    warnings,
    support,
  };

  const counts = summarizeReadiness({
    blockers: [...conformanceBucket.blockers, ...claimBucket.blockers],
    warnings,
    support,
  });

  const nextAction = conformanceBucket.blockers[0] ?? claimBucket.blockers[0] ?? warnings[0];

  return {
    lotId: input.lot.id,
    lotNumber: input.lot.lotNumber,
    status: input.lot.status,
    conformance: conformanceBucket,
    claim: claimBucket,
    summary: {
      ...counts,
      nextActionLabel: nextAction?.actionLabel ?? 'Review evidence',
      nextActionHref: nextAction?.actionHref,
    },
  };
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
cd ..
```

Expected:

- Tests pass.

### Task 3: Add Lot Readiness Route

**Files:**
- Modify: `backend/src/routes/lots.ts`
- Test: `backend/src/routes/lots.test.ts`

- [ ] **Step 1: Add failing route tests**

Append tests near the existing `GET /api/lots/:id/conform-status` coverage in `backend/src/routes/lots.test.ts`:

```ts
describe('GET /api/lots/:id/readiness', () => {
  it('returns readiness for an internal project user without writing audit logs', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `LOT-READY-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 1200,
      },
    });

    const beforeAuditCount = await prisma.auditLog.count({ where: { entityId: lot.id } });

    const res = await request(app)
      .get(`/api/lots/${lot.id}/readiness`)
      .set('Authorization', `Bearer ${authToken}`);

    const afterAuditCount = await prisma.auditLog.count({ where: { entityId: lot.id } });

    expect(res.status).toBe(200);
    expect(res.body.readiness.lotId).toBe(lot.id);
    expect(res.body.readiness.conformance.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'no_itp_assigned', blocksAction: true }),
      ]),
    );
    expect(afterAuditCount).toBe(beforeAuditCount);
  });

  it('omits commercial fields from subcontractor readiness responses', async () => {
    const targetLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `LOT-READY-SUB-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 9999,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Readiness Subcontractor ${Date.now()}`,
        primaryContactName: 'Readiness Subcontractor',
        primaryContactEmail: `readiness-sub-${Date.now()}@example.com`,
        status: 'approved',
        portalAccess: {
          lots: true,
          itps: true,
          holdPoints: true,
          testResults: true,
          ncrs: true,
          documents: true,
        },
      },
    });
    const subcontractorRes = await request(app).post('/api/auth/register').send({
      email: `readiness-sub-user-${Date.now()}@example.com`,
      password: 'SecureP@ssword123!',
      fullName: 'Readiness Subcontractor User',
      tosAccepted: true,
    });
    const subcontractorToken = subcontractorRes.body.token;
    const subcontractorUserId = subcontractorRes.body.user.id;

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });
    await prisma.lotSubcontractorAssignment.create({
      data: {
        projectId,
        lotId: targetLot.id,
        subcontractorCompanyId: subcontractorCompany.id,
        canCompleteITP: true,
        itpRequiresVerification: true,
        status: 'active',
        assignedById: userId,
      },
    });

    let unassignedLotId: string | null = null;

    try {
      const res = await request(app)
        .get(`/api/lots/${targetLot.id}/readiness`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.readiness.claim).not.toHaveProperty('budgetAmount');
      expect(JSON.stringify(res.body.readiness)).not.toContain('9999');
      expect(JSON.stringify(res.body.readiness)).not.toContain('missing_budget');

      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-READY-UNASSIGNED-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      unassignedLotId = unassignedLot.id;

      const unassignedRes = await request(app)
        .get(`/api/lots/${unassignedLot.id}/readiness`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(unassignedRes.status).toBe(403);
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: targetLot.id } });
      if (unassignedLotId) {
        await prisma.lot.delete({ where: { id: unassignedLotId } }).catch(() => {});
      }
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractorUserId } });
      await prisma.subcontractorCompany.delete({ where: { id: subcontractorCompany.id } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
      await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
    }
  });
});
```

The unassigned-lot check must use the subcontractor token, not the internal `authToken`. This keeps the readiness endpoint aligned with existing lot-detail and conform-status portal access behavior.

- [ ] **Step 2: Run the route tests and verify the new tests fail**

Run:

```powershell
cd backend
pnpm test -- src/routes/lots.test.ts -t "GET /api/lots/:id/readiness" --runInBand
cd ..
```

Expected:

- Fails with 404 for `/readiness`.

- [ ] **Step 3: Implement the route**

In `backend/src/routes/lots.ts`:

1. Import the helper:

```ts
import { buildLotReadinessFromInputs } from '../lib/evidenceReadiness.js';
import { isSubcontractorPortalRole } from '../lib/projectAccess.js';
```

2. Add the route near `GET /api/lots/:id/conform-status`:

```ts
// GET /api/lots/:id/readiness - Get deterministic lot evidence readiness
router.get(
  '/:id/readiness',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');

    const conformStatus = await checkConformancePrerequisites(id);
    if (conformStatus.error || !conformStatus.lot) {
      throw AppError.notFound('Lot');
    }

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
        budgetAmount: true,
        claimedInId: true,
        holdPoints: { select: { id: true, status: true } },
        testResults: { select: { id: true, status: true } },
        documents: { select: { id: true, documentType: true } },
        dockets: { select: { id: true, status: true } },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectAccess(req.user!, lot.projectId);
    await requireSubcontractorPortalModuleAccess({
      userId: req.user!.userId,
      role: req.user!.roleInCompany,
      projectId: lot.projectId,
      module: 'lots',
    });

    const isSubcontractor = isSubcontractorPortalRole(req.user!.roleInCompany);
    const canViewCommercial = !isSubcontractor && canViewLotBudget(req.user!.roleInCompany);

    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        status: lot.status,
        budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : null,
        claimedInId: lot.claimedInId,
      },
      canViewCommercial,
      conformStatus: {
        canConform: Boolean(conformStatus.canConform),
        blockingReasons: conformStatus.blockingReasons ?? [],
        prerequisites: conformStatus.prerequisites!,
      },
      evidenceCounts: {
        unreleasedHoldPoints: lot.holdPoints.filter((hp) => hp.status !== 'released').length,
        releasedHoldPoints: lot.holdPoints.filter((hp) => hp.status === 'released').length,
        approvedDockets: lot.dockets.filter((docket) => docket.status === 'approved').length,
        diaryEntries: 0,
        documents: lot.documents.length,
        photos: lot.documents.filter((document) => document.documentType === 'photo').length,
        pendingTests: lot.testResults.filter((test) =>
          ['pending', 'submitted'].includes(test.status),
        ).length,
      },
    });

    res.json({ readiness });
  }),
);
```

For PR1, keep `approvedDockets: 0` in this endpoint unless an existing included relation already exposes approved docket counts without additional query complexity. Do not add a schema migration or new persistence just to populate this support count.

- [ ] **Step 4: Run focused backend tests**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
pnpm test -- src/routes/lots.test.ts -t "readiness|conform-status|subcontractor lot detail" --runInBand
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- All pass.

- [ ] **Step 5: Commit PR1**

Run:

```powershell
git add backend/src/lib/evidenceReadiness.ts backend/src/lib/evidenceReadiness.test.ts backend/src/routes/lots.ts backend/src/routes/lots.test.ts
git commit -m "feat: add lot evidence readiness endpoint"
```

Expected:

- Commit contains only PR1 backend files.

## PR2: Frontend Lot Readiness Panel

Start from `master` after PR1 is merged, or continue on the PR1 branch only if Jay explicitly wants stacked work.

### Task 4: Add Frontend Readiness Types And Query Key

**Files:**
- Create: `frontend/src/types/evidenceReadiness.ts`
- Modify: `frontend/src/lib/queryKeys.ts`

- [ ] **Step 1: Add frontend types**

Create `frontend/src/types/evidenceReadiness.ts`:

```ts
export type EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support';

export type EvidenceReadinessArea =
  | 'conformance'
  | 'claim'
  | 'itp'
  | 'hold_point'
  | 'test'
  | 'ncr'
  | 'docket'
  | 'diary'
  | 'document'
  | 'budget'
  | 'permission';

export interface EvidenceReadinessItem {
  code: string;
  severity: EvidenceReadinessSeverity;
  area: EvidenceReadinessArea;
  title: string;
  detail: string;
  blocksAction: boolean;
  actionLabel?: string;
  actionHref?: string;
  count?: number;
  relatedIds?: string[];
}

export interface ReadinessBucket {
  state: 'ready' | 'blocked' | 'warning' | 'already_conformed' | 'already_claimed' | 'not_conformed';
  blockers: EvidenceReadinessItem[];
  warnings: EvidenceReadinessItem[];
  support: EvidenceReadinessItem[];
  budgetAmount?: number | null;
}

export interface LotEvidenceReadiness {
  lotId: string;
  lotNumber: string;
  status: string;
  conformance: ReadinessBucket;
  claim: ReadinessBucket;
  summary: {
    blockerCount: number;
    warningCount: number;
    supportCount: number;
    nextActionLabel: string;
    nextActionHref?: string;
  };
}
```

- [ ] **Step 2: Add query key**

In `frontend/src/lib/queryKeys.ts`, under Lots:

```ts
lotReadiness: (id: string) => ['lot-readiness', id] as const,
```

- [ ] **Step 3: Type-check frontend**

Run:

```powershell
cd frontend
pnpm type-check
cd ..
```

Expected:

- Type-check passes.

### Task 5: Build LotReadinessPanel Component

**Files:**
- Create: `frontend/src/pages/lots/components/LotReadinessPanel.tsx`
- Test: `frontend/e2e/lot-detail.spec.ts`

- [ ] **Step 1: Add failing Playwright expectations**

In `frontend/e2e/lot-detail.spec.ts`, extend `mockLotDetailApi` to handle `/api/lots/${E2E_LOT_ID}/readiness`:

```ts
if (url.pathname === `/api/lots/${E2E_LOT_ID}/readiness`) {
  await json({
    readiness: {
      lotId: E2E_LOT_ID,
      lotNumber: 'LOT-ITP-001',
      status: 'in_progress',
      conformance: {
        state: 'blocked',
        blockers: [
          {
            code: 'itp_incomplete',
            severity: 'blocker',
            area: 'itp',
            title: 'ITP incomplete',
            detail: '0/1 checklist items complete.',
            blocksAction: true,
            actionLabel: 'Open ITP',
            actionHref: '?tab=itp',
          },
        ],
        warnings: [],
        support: [],
      },
      claim: {
        state: 'not_conformed',
        blockers: [
          {
            code: 'not_conformed',
            severity: 'blocker',
            area: 'claim',
            title: 'Lot not conformed',
            detail: 'Conform this lot before it can be claimed.',
            blocksAction: true,
          },
        ],
        warnings: [],
        support: [],
      },
      summary: {
        blockerCount: 2,
        warningCount: 0,
        supportCount: 0,
        nextActionLabel: 'Open ITP',
        nextActionHref: '?tab=itp',
      },
    },
  });
  return;
}
```

Add a test:

```ts
test('shows evidence readiness blockers near the top of lot detail', async ({ page }) => {
  await mockLotDetailApi(page);

  await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}`);

  await expect(page.getByRole('heading', { name: 'Evidence readiness' })).toBeVisible();
  await expect(page.getByText('Conformance: Blocked')).toBeVisible();
  await expect(page.getByText('ITP incomplete')).toBeVisible();
  await expect(page.getByText('Claim: Not ready')).toBeVisible();
  await expect(page.getByText('Lot not conformed')).toBeVisible();
});
```

- [ ] **Step 2: Run the Playwright test and verify it fails**

Run:

```powershell
cd frontend
pnpm test:e2e -- e2e/lot-detail.spec.ts -g "evidence readiness"
cd ..
```

Expected:

- Fails because the component is not rendered yet.

- [ ] **Step 3: Create the panel**

Create `frontend/src/pages/lots/components/LotReadinessPanel.tsx`:

```tsx
import { AlertTriangle, CheckCircle2, CircleDot, ShieldCheck } from 'lucide-react';
import type { EvidenceReadinessItem, LotEvidenceReadiness, ReadinessBucket } from '@/types/evidenceReadiness';
import type { LotTab } from '../types';

interface LotReadinessPanelProps {
  readiness: LotEvidenceReadiness | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onTabChange: (tab: LotTab) => void;
}

function stateLabel(bucket: ReadinessBucket, kind: 'conformance' | 'claim'): string {
  if (bucket.state === 'ready') return `${kind === 'conformance' ? 'Conformance' : 'Claim'}: Ready`;
  if (bucket.state === 'warning') return `${kind === 'conformance' ? 'Conformance' : 'Claim'}: Needs attention`;
  if (bucket.state === 'already_conformed') return 'Conformance: Complete';
  if (bucket.state === 'already_claimed') return 'Claim: Already claimed';
  if (bucket.state === 'not_conformed') return 'Claim: Not ready';
  return `${kind === 'conformance' ? 'Conformance' : 'Claim'}: Blocked`;
}

function readinessTone(bucket: ReadinessBucket): string {
  if (bucket.blockers.some((item) => item.blocksAction)) return 'border-red-200 bg-red-50 text-red-900';
  if (bucket.blockers.length > 0 || bucket.warnings.length > 0) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-green-200 bg-green-50 text-green-900';
}

function tabFromHref(href?: string): LotTab | null {
  if (!href) return null;
  const match = href.match(/tab=([^&]+)/);
  const tab = match?.[1];
  if (tab === 'itp' || tab === 'tests' || tab === 'ncrs' || tab === 'photos' || tab === 'documents' || tab === 'comments' || tab === 'history') {
    return tab;
  }
  return null;
}

function ItemList({
  items,
  onTabChange,
}: {
  items: EvidenceReadinessItem[];
  onTabChange: (tab: LotTab) => void;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {items.slice(0, 3).map((item) => {
        const tab = tabFromHref(item.actionHref);
        return (
          <li key={`${item.area}-${item.code}`} className="flex items-start gap-2 text-sm">
            {item.severity === 'support' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            ) : item.blocksAction ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            ) : (
              <CircleDot className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            )}
            <span>
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground"> — {item.detail}</span>
              {tab && item.actionLabel && (
                <button
                  type="button"
                  className="ml-2 text-primary underline-offset-4 hover:underline"
                  onClick={() => onTabChange(tab)}
                >
                  {item.actionLabel}
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function LotReadinessPanel({
  readiness,
  loading,
  error,
  onRetry,
  onTabChange,
}: LotReadinessPanelProps) {
  if (loading) {
    return (
      <section className="mt-4 rounded-lg border bg-card p-4" aria-label="Evidence readiness">
        <h2 className="text-lg font-semibold">Evidence readiness</h2>
        <p className="mt-2 text-sm text-muted-foreground">Checking blockers and supporting proof...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4" aria-label="Evidence readiness">
        <h2 className="text-lg font-semibold text-amber-900">Evidence readiness unavailable</h2>
        <p className="mt-1 text-sm text-amber-800">{error}</p>
        <button type="button" className="mt-3 text-sm font-medium text-amber-900 underline" onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  if (!readiness) return null;

  return (
    <section className="mt-4 rounded-lg border bg-card p-4" aria-label="Evidence readiness">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evidence readiness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.summary.blockerCount} blocker{readiness.summary.blockerCount === 1 ? '' : 's'} ·{' '}
            {readiness.summary.warningCount} warning{readiness.summary.warningCount === 1 ? '' : 's'} ·{' '}
            {readiness.summary.supportCount} support item{readiness.summary.supportCount === 1 ? '' : 's'}
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className={`rounded-lg border p-3 ${readinessTone(readiness.conformance)}`}>
          <h3 className="font-medium">{stateLabel(readiness.conformance, 'conformance')}</h3>
          <ItemList
            items={[
              ...readiness.conformance.blockers,
              ...readiness.conformance.warnings,
              ...readiness.conformance.support,
            ]}
            onTabChange={onTabChange}
          />
        </div>
        <div className={`rounded-lg border p-3 ${readinessTone(readiness.claim)}`}>
          <h3 className="font-medium">{stateLabel(readiness.claim, 'claim')}</h3>
          <ItemList
            items={[...readiness.claim.blockers, ...readiness.claim.warnings, ...readiness.claim.support]}
            onTabChange={onTabChange}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Integrate the panel into LotDetailPage**

In `frontend/src/pages/lots/LotDetailPage.tsx`:

1. Import:

```tsx
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { LotReadinessPanel } from './components/LotReadinessPanel';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';
```

2. Add query after `lotId` is available:

```tsx
const {
  data: readinessData,
  isLoading: loadingReadiness,
  error: readinessError,
  refetch: refetchReadiness,
} = useQuery({
  queryKey: queryKeys.lotReadiness(lotId || ''),
  queryFn: () =>
    apiFetch<{ readiness: LotEvidenceReadiness }>(
      `/api/lots/${encodeURIComponent(lotId!)}/readiness`,
    ),
  enabled: Boolean(lotId),
  refetchInterval: 20_000,
});
```

3. Render near the top of the lot page after the header/status area and before tab content:

```tsx
<LotReadinessPanel
  readiness={readinessData?.readiness ?? null}
  loading={loadingReadiness}
  error={readinessError ? 'Could not load evidence readiness.' : null}
  onRetry={() => void refetchReadiness()}
  onTabChange={setActiveTab}
/>
```

Use the existing tab state setter name from `LotDetailPage.tsx`. If it is not `setActiveTab`, use the current state setter that powers `LotTabNavigation`.

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd frontend
pnpm test:e2e -- e2e/lot-detail.spec.ts -g "evidence readiness"
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- New Playwright test passes.
- Type-check and lint pass.

- [ ] **Step 6: Commit PR2**

Run:

```powershell
git add frontend/src/types/evidenceReadiness.ts frontend/src/lib/queryKeys.ts frontend/src/pages/lots/components/LotReadinessPanel.tsx frontend/src/pages/lots/LotDetailPage.tsx frontend/e2e/lot-detail.spec.ts
git commit -m "feat: show lot evidence readiness"
```

Expected:

- Commit contains only lot readiness frontend files.

## PR3: Claim Readiness Helper, Endpoint, And Create Claim UI

### Task 6: Extract Claim Readiness Analyzer

**Files:**
- Modify: `backend/src/lib/evidenceReadiness.ts`
- Modify: `backend/src/routes/claims.ts`
- Test: `backend/src/routes/claims.test.ts`

- [ ] **Step 1: Add failing backend tests for pre-create claim readiness**

Add a new describe block to `backend/src/routes/claims.test.ts`:

```ts
describe('GET /api/projects/:projectId/claim-readiness', () => {
  it('shows missing budget before claim creation while preserving create-time enforcement', async () => {
    const lotWithoutBudget = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLAIM-READY-NO-BUDGET-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        conformedAt: new Date(),
        conformedById: userId,
      },
    });

    const readinessRes = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(readinessRes.status).toBe(200);
    const readinessLot = readinessRes.body.lots.find(
      (lot: { lotId: string }) => lot.lotId === lotWithoutBudget.id,
    );
    expect(readinessLot.claim.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_budget', blocksAction: true }),
      ]),
    );

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/claims`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        lots: [{ lotId: lotWithoutBudget.id, percentageComplete: 100 }],
      });

    expect(createRes.status).toBe(400);
    expect(createRes.body.error.message).toContain('do not have a rate set');
  });

  it('shows unreleased hold points as evidence blockers without action blocking', async () => {
    const lot = await createClaimableLot(`CLAIM-READY-HP-${Date.now()}`, 2000);
    await prisma.holdPoint.create({
      data: {
        lotId: lot.id,
        description: 'Superintendent release required',
        status: 'requested',
        requestedById: userId,
        requestedAt: new Date(),
      },
    });

    const res = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const readinessLot = res.body.lots.find((item: { lotId: string }) => item.lotId === lot.id);
    expect(readinessLot.claim.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unreleased_hold_points',
          blocksAction: false,
        }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
cd backend
pnpm test -- src/routes/claims.test.ts -t "claim-readiness" --runInBand
cd ..
```

Expected:

- Fails because `/claim-readiness` is missing.

- [ ] **Step 3: Add claim readiness route**

In `backend/src/routes/claims.ts`, add a route before `POST /:projectId/claims`:

```ts
router.get(
  '/:projectId/claim-readiness',
  asyncHandler(async (req, res) => {
    const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
    await requireCommercialProjectAccess(req.user!, projectId);

    const lots = await prisma.lot.findMany({
      where: {
        projectId,
        status: { in: ['not_started', 'in_progress', 'ncr_raised', 'on_hold', 'conformed', 'claimed'] },
      },
      include: {
        holdPoints: true,
        testResults: true,
        documents: true,
        ncrLots: { include: { ncr: true } },
        itpInstance: {
          include: {
            template: { include: { checklistItems: true } },
            completions: true,
          },
        },
      },
      orderBy: { lotNumber: 'asc' },
    });

    const readinessLots = await Promise.all(
      lots.map(async (lot) => {
        const conformStatus = await checkConformancePrerequisites(lot.id);
        return buildLotReadinessFromInputs({
          lot: {
            id: lot.id,
            lotNumber: lot.lotNumber,
            status: lot.status,
            budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : null,
            claimedInId: lot.claimedInId,
          },
          canViewCommercial: true,
          conformStatus: {
            canConform: Boolean(conformStatus.canConform),
            blockingReasons: conformStatus.blockingReasons ?? [],
            prerequisites: conformStatus.prerequisites!,
          },
          evidenceCounts: {
            unreleasedHoldPoints: lot.holdPoints.filter((hp) => hp.status !== 'released').length,
            releasedHoldPoints: lot.holdPoints.filter((hp) => hp.status === 'released').length,
            approvedDockets: 0,
            diaryEntries: 0,
            documents: lot.documents.length,
            photos: lot.documents.filter((document) => document.documentType === 'photo').length,
            pendingTests: lot.testResults.filter((test) =>
              ['pending', 'submitted'].includes(test.status),
            ).length,
          },
        });
      }),
    );

    res.json({ lots: readinessLots });
  }),
);
```

If this creates a lint issue due to route imports, import `buildLotReadinessFromInputs` and `checkConformancePrerequisites` at the top. Do not add any DB writes.

- [ ] **Step 4: Extract post-claim review logic into the shared helper**

Move the deterministic issue-building logic from `claims.ts` completeness-check into `backend/src/lib/evidenceReadiness.ts` as a function:

```ts
export interface ClaimEvidenceReview {
  claimId: string;
  claimNumber: number;
  analyzedAt: string;
  summary: {
    totalLots: number;
    readyCount: number;
    reviewCount: number;
    blockedCount: number;
    totalClaimAmount: number;
    recommendedAmount: number;
  };
  lots: Array<{
    lotId: string;
    lotNumber: string;
    activityType: string;
    claimAmount: number;
    claim: ReadinessBucket;
  }>;
  overallSuggestions: string[];
}
```

The helper should emit `ReadinessBucket` shape directly. It must map:

- Existing critical issues -> `severity: 'blocker'`
- Existing warning issues -> `severity: 'warning'`
- Existing info issues -> `severity: 'support'` when they describe present evidence, otherwise `warning`

Keep the endpoint path `/completeness-check` for compatibility but return the new readiness shape. Update frontend types in Task 8.

- [ ] **Step 5: Run backend tests**

Run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
pnpm test -- src/routes/claims.test.ts -t "claim-readiness|completeness-check|without budget amount|Claim Lots Association" --runInBand
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- Tests pass.
- Existing claim create behavior remains unchanged.

### Task 7: Update Create Claim Modal For Readiness

**Files:**
- Modify: `frontend/src/types/evidenceReadiness.ts`
- Modify: `frontend/src/lib/queryKeys.ts`
- Modify: `frontend/src/pages/claims/components/CreateClaimModal.tsx`
- Test: `frontend/e2e/claims.spec.ts`

- [ ] **Step 1: Add claim readiness frontend types**

Append to `frontend/src/types/evidenceReadiness.ts`:

```ts
export interface ClaimReadinessLot {
  lotId: string;
  lotNumber: string;
  activityType: string | null;
  claim: ReadinessBucket;
}

export interface ProjectClaimReadiness {
  lots: ClaimReadinessLot[];
}
```

- [ ] **Step 2: Add query key**

In `frontend/src/lib/queryKeys.ts`, under Claims:

```ts
claimReadiness: (projectId: string) => ['claim-readiness', projectId] as const,
claimEvidenceReview: (projectId: string, claimId: string) =>
  ['claim-evidence-review', projectId, claimId] as const,
```

- [ ] **Step 3: Add failing Playwright expectations**

In `frontend/e2e/claims.spec.ts`, update the claim lots route mock or add a new route for `/claim-readiness`:

```ts
if (
  url.pathname === `/api/projects/${E2E_PROJECT_ID}/claim-readiness` &&
  route.request().method() === 'GET'
) {
  await json({
    lots: [
      {
        lotId: 'e2e-ready-lot',
        lotNumber: 'LOT-READY-001',
        activityType: 'Earthworks',
        claim: {
          state: 'ready',
          blockers: [],
          warnings: [],
          support: [
            {
              code: 'passing_verified_test',
              severity: 'support',
              area: 'test',
              title: 'Passing verified test',
              detail: 'At least one passing test result is verified.',
              blocksAction: false,
            },
          ],
          budgetAmount: 100000,
        },
      },
      {
        lotId: 'e2e-hp-lot',
        lotNumber: 'LOT-HP-001',
        activityType: 'Drainage',
        claim: {
          state: 'warning',
          blockers: [
            {
              code: 'unreleased_hold_points',
              severity: 'blocker',
              area: 'hold_point',
              title: '1 hold point not released',
              detail: 'Release hold points before sending a client-ready claim evidence pack.',
              blocksAction: false,
            },
          ],
          warnings: [],
          support: [],
          budgetAmount: 50000,
        },
      },
      {
        lotId: 'e2e-no-budget-lot',
        lotNumber: 'LOT-BUDGET-001',
        activityType: 'Pavements',
        claim: {
          state: 'blocked',
          blockers: [
            {
              code: 'missing_budget',
              severity: 'blocker',
              area: 'budget',
              title: 'Budget amount missing',
              detail: 'Add a positive budget amount before claiming this lot.',
              blocksAction: true,
            },
          ],
          warnings: [],
          support: [],
        },
      },
    ],
  });
  return;
}
```

Add a test:

```ts
test('shows claim readiness and only disables action-blocked lots', async ({ page }) => {
  await mockSeededClaimsApi(page);

  await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);
  await page.getByRole('button', { name: 'New Claim' }).click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Create New Progress Claim' });
  await expect(modal.getByText('LOT-READY-001')).toBeVisible();
  await expect(modal.getByText('LOT-HP-001')).toBeVisible();
  await expect(modal.getByText('1 hold point not released')).toBeVisible();
  await expect(modal.getByText('LOT-BUDGET-001')).toBeVisible();
  await expect(modal.getByText('Budget amount missing')).toBeVisible();

  await modal.getByText('LOT-HP-001').locator('..').getByRole('checkbox').check();
  await expect(modal.getByRole('button', { name: 'Create Claim' })).toBeEnabled();
  await expect(modal.getByText('LOT-BUDGET-001').locator('..').getByRole('checkbox')).toBeDisabled();
});
```

- [ ] **Step 4: Update CreateClaimModal**

Keep the existing claim creation POST body unchanged. Replace the lot loading query with `/claim-readiness` and derive selectable lots:

```tsx
const data = await apiFetch<ProjectClaimReadiness>(
  `/api/projects/${encodeURIComponent(projectId)}/claim-readiness`,
);
```

For each lot:

- Checkbox disabled when `lot.claim.blockers.some((item) => item.blocksAction)` is true.
- Evidence blockers with `blocksAction: false` appear as "Needs attention" but remain selectable.
- `budgetAmount` renders only when present.

Do not send readiness issues in the claim create request. Send only:

```tsx
{
  periodStart: newClaim.periodStart,
  periodEnd: newClaim.periodEnd,
  lots: claimLots.map((lot) => ({
    lotId: lot.lotId,
    percentageComplete: lot.percentageComplete,
  })),
}
```

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd frontend
pnpm test:e2e -- e2e/claims.spec.ts -g "claim readiness"
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- Evidence blockers do not disable checkboxes.
- Action blockers disable checkboxes.
- Claim creation request shape remains unchanged.

- [ ] **Step 6: Commit PR3**

Run:

```powershell
git add backend/src/lib/evidenceReadiness.ts backend/src/lib/evidenceReadiness.test.ts backend/src/routes/claims.ts backend/src/routes/claims.test.ts frontend/src/types/evidenceReadiness.ts frontend/src/lib/queryKeys.ts frontend/src/pages/claims/components/CreateClaimModal.tsx frontend/e2e/claims.spec.ts
git commit -m "feat: add claim evidence readiness"
```

Expected:

- Commit includes backend helper/endpoint plus Create Claim UI.

## PR4: Claim Evidence Review Copy And Presentation Cleanup

### Task 8: Remove AI Language From Claim Review

**Files:**
- Modify: `frontend/src/pages/claims/components/CompletenessCheckModal.tsx`
- Modify: `frontend/src/pages/claims/ClaimsPage.tsx`
- Modify: `frontend/e2e/claims.spec.ts`
- Modify: `frontend/e2e/productionReadiness.spec.ts`

- [ ] **Step 1: Add failing static guard for AI wording**

In `frontend/e2e/productionReadiness.spec.ts`, add or update a guard:

```ts
test('claim evidence review uses deterministic wording instead of AI branding', async () => {
  const completenessModal = await readFile(
    new URL('../src/pages/claims/components/CompletenessCheckModal.tsx', import.meta.url),
    'utf8',
  );
  const claimsPage = await readFile(
    new URL('../src/pages/claims/ClaimsPage.tsx', import.meta.url),
    'utf8',
  );

  expect(completenessModal).not.toMatch(/\bAI\b|Brain|Completeness Analysis|AI Suggestions/);
  expect(claimsPage).not.toContain('AI Completeness Check');
  expect(completenessModal).toContain('Claim Evidence Review');
  expect(completenessModal).toContain('Reviewing claim evidence');
});
```

- [ ] **Step 2: Run the guard and verify it fails**

Run:

```powershell
cd frontend
pnpm test:readiness -- -g "claim evidence review"
cd ..
```

Expected:

- Fails because existing UI still uses AI wording.

- [ ] **Step 3: Update copy and icons**

In `CompletenessCheckModal.tsx`:

- Replace `Brain` icon with `ClipboardCheck` or `ShieldCheck`.
- Replace heading `AI Completeness Analysis` with `Claim Evidence Review`.
- Replace loading copy with `Reviewing claim evidence...`.
- Replace `AI Suggestions` with `Recommended actions`.
- Remove prominent percentage score display if PR3 changed backend response shape; otherwise demote it to a smaller internal indicator until backend shape is fully converted.

Example heading:

```tsx
<ModalHeader>
  <div className="flex items-center gap-2">
    <ShieldCheck className="h-5 w-5 text-primary" />
    <span>Claim Evidence Review</span>
  </div>
</ModalHeader>
```

In `ClaimsPage.tsx`, replace button text:

```tsx
Claim Evidence Review
```

- [ ] **Step 4: Update Playwright expectations**

In `frontend/e2e/claims.spec.ts`, replace:

```ts
await expect(claimRow.getByRole('button', { name: 'AI Completeness Check' })).toBeVisible();
```

with:

```ts
await expect(claimRow.getByRole('button', { name: 'Claim Evidence Review' })).toBeVisible();
```

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd frontend
pnpm test:e2e -- e2e/claims.spec.ts
pnpm test:readiness -- -g "claim evidence review"
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- Claims E2E passes.
- Production readiness guard passes.
- No user-facing "AI Completeness" wording remains in active claim review UI.

- [ ] **Step 6: Commit PR4**

Run:

```powershell
git add frontend/src/pages/claims/components/CompletenessCheckModal.tsx frontend/src/pages/claims/ClaimsPage.tsx frontend/e2e/claims.spec.ts frontend/e2e/productionReadiness.spec.ts
git commit -m "copy: rename claim completeness to evidence review"
```

## Final Verification After PR4

After all four PRs are merged, run:

```powershell
cd backend
pnpm test -- src/lib/evidenceReadiness.test.ts --runInBand
pnpm test -- src/routes/lots.test.ts --runInBand
pnpm test -- src/routes/claims.test.ts --runInBand
pnpm format:check
pnpm type-check
pnpm lint
cd ../frontend
pnpm test:e2e -- e2e/lot-detail.spec.ts
pnpm test:e2e -- e2e/claims.spec.ts
pnpm test:readiness
pnpm format:check
pnpm type-check
pnpm lint
cd ..
git diff --check
```

Expected:

- All listed checks pass.
- No Prisma migration exists.
- No `prisma db push`, `migrate dev`, `migrate deploy`, `db execute`, backup, restore, Railway, or Supabase commands have been run.

## Dogfood Checklist

Run after PR2 and again after PR3 in a visible browser with sacrificial data:

- [ ] Create a lot with no ITP and confirm readiness says "No ITP assigned".
- [ ] Assign an ITP and confirm readiness changes to ITP incomplete.
- [ ] Complete ITP items and verify a passing test.
- [ ] Create an unreleased hold point and confirm it appears as a claim evidence blocker with `blocksAction: false`.
- [ ] Confirm force-conform UI still lives in the quality-management action area.
- [ ] Conform the lot.
- [ ] Confirm missing budget appears as an action blocker for claim readiness.
- [ ] Add budget and confirm claim selection is enabled.
- [ ] Create a claim and run Claim Evidence Review.
- [ ] Confirm no commercial values appear in a subcontractor session.

## Plan Self-Review

Spec coverage:

- Lot readiness panel: PR1 and PR2.
- Claim readiness before creation: PR3.
- Claim Evidence Review wording and contract alignment: PR3 and PR4.
- Project-level summary: explicitly deferred.
- No migration: preserved.
- Downstream implications: covered by `blocksAction`, server-side filtering, TanStack Query cadence, and known deferred gaps.

Placeholder scan:

- This plan intentionally avoids open-ended "handle later" implementation steps.
- Deferred items are named in Scope and are not part of v1.

Type consistency:

- Backend and frontend use `EvidenceReadinessItem`, `ReadinessBucket`, `LotEvidenceReadiness`, and `ClaimReadinessLot`.
- `blocksAction` appears in every readiness item example and every disabling rule.
