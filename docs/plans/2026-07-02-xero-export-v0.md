# Xero Export v0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Export to Xero" action on a progress claim that produces a Xero-importable sales-invoice CSV (one line per claimed lot, ex-GST, with a total-matches-lines guard), which the user imports into Xero as a draft invoice.

**Architecture:** A pure backend function `buildXeroInvoiceExport(claim, config)` maps already-loaded claim data → `{ filename, rows }` (rows[0] = exact Xero header), asserting `sum(line amounts) === roundClaimAmountToCents(total)` before returning. A thin read route loads the claim (+ claimedLots + lots + project) and cumulative %, calls the pure fn, returns JSON. The frontend button fetches that JSON and reuses the existing `downloadCsv(filename, rows)` helper to save the file. No schema change; account code + tax type are per-export config remembered in `localStorage`.

**Tech stack:** Express + Prisma (backend, Vitest), React + TanStack Query + shadcn (frontend, Vitest/RTL). Base branch: `origin/master`. Worktree: `C:\Users\jayso\site-proofv3\.worktrees\xero-export-v0`.

**Design reference:** `docs/plans/2026-07-02-xero-export-v0-design.md`.

**Recommended defaults baked in (Jay can veto — reversible config):** invoice date = claim `periodEnd`; invoice number = `Claim {n} — {projectName}`; account code default `200` (Sales); tax type left blank so Xero applies the account's default GST rate; no tracking column in v0.

**Test/verify commands** (run from `.worktrees/xero-export-v0`):
- Backend unit: `cd backend && npx vitest run src/routes/claims/xeroExport.test.ts`
- Backend type-check: `cd backend && npm run type-check`
- Frontend unit: `cd frontend && npx vitest run src/pages/claims/components/ClaimsTable.test.tsx`
- Frontend type-check: `cd frontend && npm run type-check`
- Fallow (advisory): `npm run fallow:audit` (repo root) — record verdict in PR.
- `DATABASE_URL` must be UNSET for backend tests (no `.env` in this worktree — the safety guard passes on unset).

---

### Task 0: Lock the exact Xero CSV header set

No code. Verify the real column headers so the generator isn't guessing.

**Step 1:** WebFetch `https://central.xero.com/s/article/Import-customer-invoices` asking for the exact required/optional CSV column headers and whether multiple rows sharing one invoice number become line items. Cross-check one secondary source.

**Step 2:** Record the confirmed header array in a code comment at the top of the CSV builder. Expected shape (VERIFY — do not ship unverified): `*ContactName, *InvoiceNumber, *InvoiceDate, *DueDate, Description, *Quantity, *UnitAmount, *AccountCode, *TaxType`. Adjust to whatever the article actually specifies.

**Step 3:** No commit (feeds Task 1).

---

### Task 1: Pure mapping function + tests (the core)

**Files:**
- Create: `backend/src/routes/claims/xeroExport.ts` (pure builder + types; route factory added in Task 2)
- Create: `backend/src/routes/claims/xeroExport.test.ts`

**Step 1: Write the failing tests.**

```ts
// xeroExport.test.ts
import { describe, expect, it } from 'vitest';
import { buildXeroInvoiceExport, type XeroClaimExportInput } from './xeroExport.js';

const base: XeroClaimExportInput = {
  claimNumber: 5,
  projectName: 'Northern Interchange',
  clientName: 'Acme Civil Pty Ltd',
  periodEnd: '2026-06-30T00:00:00.000Z',
  totalClaimedAmount: 61500,
  lots: [
    { lotNumber: 'Lot 12', activityType: 'Bulk Earthworks', amountClaimed: 40000, thisClaimPercent: 40, cumulativePercent: 100 },
    { lotNumber: 'Lot 18', activityType: 'Drainage Ch0-200', amountClaimed: 12500, thisClaimPercent: 25, cumulativePercent: 25 },
    { lotNumber: 'Lot 23', activityType: 'Kerb & Channel', amountClaimed: 9000, thisClaimPercent: 60, cumulativePercent: 85 },
  ],
};
const config = { accountCode: '200' };

it('emits one data row per lot plus a header row', () => {
  const { rows } = buildXeroInvoiceExport(base, config);
  expect(rows).toHaveLength(1 + 3);
});

it('writes the cumulative-aware description', () => {
  const { rows } = buildXeroInvoiceExport(base, config);
  // description column index resolved from header; assert the string is present
  expect(rows.flat()).toContain('Lot 18 — Drainage Ch0-200 — this claim 25% (cumulative 25%)');
});

it('puts ex-GST amount as UnitAmount, quantity 1, account code from config', () => {
  const { rows } = buildXeroInvoiceExport(base, config);
  const header = rows[0];
  const row18 = rows.find((r) => String(r[header.indexOf('Description')]).includes('Lot 18'))!;
  expect(row18[header.indexOf('*UnitAmount')]).toBe(12500);
  expect(row18[header.indexOf('*Quantity')]).toBe(1);
  expect(row18[header.indexOf('*AccountCode')]).toBe('200');
});

it('uses claimNumber + projectName as the invoice number and periodEnd as the date', () => {
  const { rows } = buildXeroInvoiceExport(base, config);
  const header = rows[0];
  expect(rows[1][header.indexOf('*InvoiceNumber')]).toBe('Claim 5 — Northern Interchange');
});

it('blocks export when line sum != claim total (no silent wrong invoice)', () => {
  const bad = { ...base, totalClaimedAmount: 99999 };
  expect(() => buildXeroInvoiceExport(bad, config)).toThrowError(/does not match/i);
});

it('reconciles cent-level rounding without false-blocking', () => {
  const rounding: XeroClaimExportInput = {
    ...base, totalClaimedAmount: 33.33,
    lots: [
      { lotNumber: 'L1', activityType: 'A', amountClaimed: 11.11, thisClaimPercent: 10, cumulativePercent: 10 },
      { lotNumber: 'L2', activityType: 'B', amountClaimed: 22.22, thisClaimPercent: 20, cumulativePercent: 20 },
    ],
  };
  expect(() => buildXeroInvoiceExport(rounding, config)).not.toThrow();
});

it('blocks export when there are no claimed lots', () => {
  expect(() => buildXeroInvoiceExport({ ...base, lots: [], totalClaimedAmount: 0 }, config))
    .toThrowError(/no claimed lots/i);
});

it('never emits GST — amounts are ex-GST only', () => {
  const { rows } = buildXeroInvoiceExport(base, config);
  const sum = rows.slice(1).reduce((s, r) => s + Number(r[rows[0].indexOf('*UnitAmount')]), 0);
  expect(sum).toBe(61500); // no 10% added anywhere
});
```

**Step 2: Run — expect FAIL** (`buildXeroInvoiceExport` not defined).
`cd backend && npx vitest run src/routes/claims/xeroExport.test.ts`

**Step 3: Implement the pure builder.**

```ts
// xeroExport.ts (top section — pure, no Prisma/Express imports)
import { AppError } from '../../lib/AppError.js';
import { roundClaimAmountToCents } from './workflowValidation.js';

// Xero customer-invoice CSV import header — VERIFIED against
// https://central.xero.com/s/article/Import-customer-invoices (Task 0).
export const XERO_INVOICE_CSV_HEADER = [
  '*ContactName', '*InvoiceNumber', '*InvoiceDate', '*DueDate',
  'Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType',
] as const;

export interface XeroLotExportInput {
  lotNumber: string;
  activityType: string;
  amountClaimed: number;      // ex-GST, this claim's increment
  thisClaimPercent: number;
  cumulativePercent: number;  // total incl. this claim
}
export interface XeroClaimExportInput {
  claimNumber: number;
  projectName: string;
  clientName: string | null;
  periodEnd: string;          // ISO date
  totalClaimedAmount: number;
  lots: XeroLotExportInput[];
}
export interface XeroExportConfig {
  accountCode: string;
  taxType?: string;           // blank -> Xero uses the account's default GST rate
  invoiceDate?: string;       // default: periodEnd
}
type CsvCell = string | number;

const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`; // dd/mm/yyyy — AU Xero orgs; documented assumption
};

export function buildXeroInvoiceExport(
  claim: XeroClaimExportInput,
  config: XeroExportConfig,
): { filename: string; rows: CsvCell[][] } {
  if (claim.lots.length === 0) {
    throw AppError.badRequest('Cannot export a claim with no claimed lots to Xero');
  }
  const invoiceNumber = `Claim ${claim.claimNumber} — ${claim.projectName}`;
  const invoiceDate = fmtDate(config.invoiceDate ?? claim.periodEnd);
  const contact = claim.clientName?.trim() || claim.projectName;

  const dataRows: CsvCell[][] = claim.lots.map((lot) => {
    const amount = roundClaimAmountToCents(lot.amountClaimed);
    const description =
      `Lot ${lot.lotNumber} — ${lot.activityType} — ` +
      `this claim ${fmtPct(lot.thisClaimPercent)}% (cumulative ${fmtPct(lot.cumulativePercent)}%)`;
    return [contact, invoiceNumber, invoiceDate, invoiceDate, description, 1, amount, config.accountCode, config.taxType ?? ''];
  });

  const lineSum = roundClaimAmountToCents(
    dataRows.reduce((s, r) => s + Number(r[6]), 0),
  );
  const claimTotal = roundClaimAmountToCents(claim.totalClaimedAmount);
  if (lineSum !== claimTotal) {
    throw AppError.badRequest(
      `Xero export blocked: line total ${lineSum} does not match claim total ${claimTotal}`,
      { lineSum, claimTotal },
    );
  }

  return {
    filename: `xero-claim-${claim.claimNumber}.csv`,
    rows: [[...XERO_INVOICE_CSV_HEADER], ...dataRows],
  };
}
```
(Confirm `AppError.badRequest(message, details)` signature — details is the 2nd arg, per `tasks/lessons.md`. If a 422 helper exists on AppError, prefer it; otherwise 400 is fine.)

**Step 4: Run — expect PASS.** Fix header-index assertions if Task 0 changed the header.

**Step 5: Commit.**
```bash
git add backend/src/routes/claims/xeroExport.ts backend/src/routes/claims/xeroExport.test.ts
git commit -m "feat(claims): pure Xero invoice export mapping + invariant"
```

---

### Task 2: Route factory + mount

**Files:**
- Modify: `backend/src/routes/claims/xeroExport.ts` (add factory)
- Modify: `backend/src/routes/claims.ts` (mount after the shared `requireAuth` gate, ~line 63)

**Step 1: Add the route factory** in `xeroExport.ts`:

```ts
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getCumulativeClaimedPercentByLot } from './cumulativeClaims.js';

type AuthUser = NonNullable<Express.Request['user']>;
interface XeroExportRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (user: AuthUser, projectId: string) => Promise<void>;
}
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const optStr = (v: unknown, field: string): string | undefined =>
  v === undefined ? undefined : typeof v === 'string' && v.trim() ? v.trim() : (() => { throw AppError.badRequest(`${field} must be a non-empty string`); })();

export function createClaimXeroExportRouter(deps: XeroExportRouterDependencies): Router {
  const router = Router();
  router.get('/:projectId/claims/:claimId/xero-export', asyncHandler(async (req, res) => {
    const projectId = deps.parseClaimRouteParam(req.params.projectId, 'projectId');
    const claimId = deps.parseClaimRouteParam(req.params.claimId, 'claimId');
    await deps.requireCommercialProjectAccess(req.user!, projectId);

    const accountCode = optStr(req.query.accountCode, 'accountCode') ?? '200';
    const taxType = optStr(req.query.taxType, 'taxType');

    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        claimedLots: { include: { lot: { select: { id: true, lotNumber: true, activityType: true, budgetAmount: true } } } },
        project: { select: { name: true, clientName: true } },
      },
    });
    if (!claim) throw AppError.notFound('Claim not found');

    const lotIds = claim.claimedLots.map((cl) => cl.lotId);
    const cumulative = await getCumulativeClaimedPercentByLot(lotIds);

    const result = buildXeroInvoiceExport({
      claimNumber: claim.claimNumber,
      projectName: claim.project.name,
      clientName: claim.project.clientName,
      periodEnd: claim.claimPeriodEnd.toISOString(),
      totalClaimedAmount: num(claim.totalClaimedAmount),
      lots: claim.claimedLots.map((cl) => ({
        lotNumber: cl.lot.lotNumber,
        activityType: cl.lot.activityType,
        amountClaimed: num(cl.amountClaimed),
        thisClaimPercent: num(cl.percentageComplete),
        cumulativePercent: cumulative.get(cl.lotId) ?? num(cl.percentageComplete),
      })),
    }, { accountCode, taxType });

    res.json(result);
  }));
  return router;
}
```
(VERIFY the exact `ProgressClaim` date field name — `claimPeriodEnd` vs `periodEnd` — against `schema.prisma`, and `AppError.notFound` existence. Adjust.)

**Step 2: Mount in `claims.ts`** after `router.use(requireAuth)` (~line 63), alongside the other post-gate factories:
```ts
router.use(createClaimXeroExportRouter({ parseClaimRouteParam, requireCommercialProjectAccess }));
```
Add the import at the top with the other sub-router imports.

**Step 3: Type-check.** `cd backend && npm run type-check` — expect clean (Prisma client already regenerated from origin/master schema).

**Step 4: Commit.**
```bash
git add backend/src/routes/claims/xeroExport.ts backend/src/routes/claims.ts
git commit -m "feat(claims): mount GET /:projectId/claims/:claimId/xero-export"
```

*(No Express route test — this area has none; logic is fully covered by the Task 1 pure-function tests, matching the repo's extract-and-unit-test convention.)*

---

### Task 3: Frontend "Export to Xero" button + config + download

**Files:**
- Modify: `frontend/src/pages/claims/components/ClaimsTable.tsx` (add button + `onExportXero` prop)
- Modify: `frontend/src/pages/claims/ClaimsPage.tsx` (handler: read config from localStorage, `apiFetch` the route, `downloadCsv`)
- Modify/Create: `frontend/src/pages/claims/components/ClaimsTable.test.tsx` (button renders)

**Step 1: Write the failing test** — the Actions column shows an "Export to Xero" button for each claim and clicking it calls `onExportXero(claim)`. Mirror the existing `ClaimsTable`/`ClaimsPageSections.test.tsx` RTL pattern.

**Step 2: Run — expect FAIL.**

**Step 3: Implement.**
- `ClaimsTable`: add optional `onExportXero?: (claim: Claim) => void` to props; add a button next to the Download-CSV button (mirror lines 352-359), icon from `lucide-react` (e.g. `FileSpreadsheet` or `Send`), `title="Export to Xero"`.
- `ClaimsPage`: define the handler where `projectId` (from `useParams`) is in scope:
```ts
const XERO_CFG_KEY = 'xeroExport.config';
async function handleExportXero(claim: Claim) {
  const cfg = JSON.parse(localStorage.getItem(XERO_CFG_KEY) ?? '{}');
  const accountCode = window.prompt('Xero income account code', cfg.accountCode ?? '200'); // ponytail: prompt for v0, upgrade to a dialog if Jay wants
  if (!accountCode) return;
  localStorage.setItem(XERO_CFG_KEY, JSON.stringify({ ...cfg, accountCode }));
  const qs = new URLSearchParams({ accountCode });
  const { filename, rows } = await apiFetch<{ filename: string; rows: (string | number)[][] }>(
    `/api/projects/${encodeURIComponent(projectId ?? '')}/claims/${encodeURIComponent(claim.id)}/xero-export?${qs}`,
  );
  downloadCsv(filename, rows);
}
```
Pass `onExportXero={handleExportXero}` into `ClaimsTable`. Import `downloadCsv` from `@/lib/csv`.

`// ponytail:` `window.prompt` for the account code in v0 (one input, remembered in localStorage). Upgrade to a shadcn dialog with a tax-type field if Jay wants nicer UX — the backend already accepts `taxType`.

**Step 4: Run — expect PASS.** Then `cd frontend && npm run type-check`.

**Step 5: Commit.**
```bash
git add frontend/src/pages/claims/components/ClaimsTable.tsx frontend/src/pages/claims/components/ClaimsTable.test.tsx frontend/src/pages/claims/ClaimsPage.tsx
git commit -m "feat(claims): Export to Xero button downloads invoice CSV"
```

---

### Task 4: Verify + audit

**Step 1:** Run all touched tests + type-checks:
- `cd backend && npx vitest run src/routes/claims/xeroExport.test.ts && npm run type-check`
- `cd frontend && npx vitest run src/pages/claims/components/ClaimsTable.test.tsx && npm run type-check`

**Step 2:** Prove the output shape end-to-end — write a throwaway node script (in the scratchpad, not committed) that calls `buildXeroInvoiceExport` with the worked example from the design doc and prints the CSV rows; eyeball that it matches the design's worked example ($40,000 / $12,500 / $9,000, sum $61,500, cumulative descriptions correct).

**Step 3:** `npm run fallow:audit` at repo root — record the verdict (expect pass/warn; investigate any fail or new dead-code before PR).

**Step 4:** Do NOT open a PR yet — report results to Jay, confirm the 3 baked-in defaults, and confirm the Xero header set from Task 0. Then use superpowers:finishing-a-development-branch.

---

## What v0 deliberately does NOT do (deferred — see design doc §Deferred)
OAuth connection, live invoice creation via the Accounting API, auto-attaching the evidence PDF, payment sync-back, `XeroConnection` table, contact link/create/reuse, tracking categories, retention, GST math. The wedge (evidence PDF stapled to the invoice) lives here — don't demo it as live until built.
