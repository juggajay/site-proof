# Dev handoff — QA & progress-claim changes

_Written 2026-06-09. Self-contained brief for an AI dev. Companion docs: [change-requests.md](change-requests.md) (the backlog) and [research-findings-qa-claims.md](research-findings-qa-claims.md) (the research that validated this direction)._

## Context you need
- **SiteProof** = a quality-management + progress-claim platform for Australian civil contractors. Backend = Express + Prisma + TypeScript (`backend/`), Frontend = React + Vite + TypeScript (`frontend/`).
- **Guiding principle:** SiteProof is a **single-sided, contractor-side tool.** The client / Principal / **superintendent is external** — captured via outputs (PDF/exports) and the existing **tokenised hold-point email release link**, never via an in-app login. Don't build client logins.
- **How to work:** one focused PR per ticket; behaviour-preserving where possible; add/adjust tests; deploys via merge to `master` (backend→Railway, frontend→Vercel). Run `cd backend && npm test` and `npm run type-check`; `cd frontend && npm run type-check`.
- **Recommended order:** B1 → B2 → T1 → T2 → C2 → N1 → C1 → I1 (bugs/concrete first, design changes last).

---

## B1 — Fix Evidence Package PDF crash  *(bug, high)*
**Problem:** "Generate Evidence Package" fails with `Cannot read properties of undefined (reading 'filter')` and produces no PDF.
**Evidence:** `frontend/src/lib/pdf/claimEvidencePackagePdf.ts:269` `lot.itp.completions.filter(...)` and `:280` `lot.itp.holdPoints.filter(...)` — these (and similar array accesses) crash when a lot's `itp` / `completions` / `holdPoints` / `testResults` / `ncrs` / `photos` are undefined.
**Change:** Null-guard every array access in the PDF builder (e.g. `(lot.itp?.completions ?? []).filter(...)`, `(lot.itp?.holdPoints ?? []).filter(...)`, guard `lot.itp` itself). Audit the whole file for `.filter/.map/.length` on possibly-undefined fields.
**Acceptance:** Generating the evidence package for a lot that has **no photos, no NCRs, no hold points** produces a valid PDF (no crash). Add a fixture/test for the empty-lot case in `frontend/src/lib/pdf/__tests__/`.

---

## B2 — Attach a certificate to an existing test  *(bug, high — unblocks conformance)*
**Problem:** Verifying a test requires a certificate, but there's **no way to attach a certificate to an existing test**. The only cert-upload (header "Upload Certificate") runs AI extraction and creates a *new* test. Result: a manually-created test can never be verified, so the conformance gate is unsatisfiable without Force-Conform.
**Evidence:** verify gate at `backend/src/routes/testResults/workflowRoutes.ts:174` & `:271` ("Feature #883: Require certificate before verification" → throws `CERTIFICATE_REQUIRED`). `TestResult.certificateDocId` is the field; it's only set via the AI path today.
**Change:**
- Backend: add an endpoint to **attach/replace a certificate on an existing test** (upload a doc → set `certificateDocId` on that `TestResult`), reusing the existing Supabase upload + document pattern. (See how the AI path / `testResults/crudRoutes.ts` handles `certificateDocId`.)
- Frontend: add a per-test **"Attach certificate"** row action (and/or in a test detail) on the Test Results page that uploads and links the cert, then enables Verify.
**Acceptance:** Create a test manually → attach a PDF certificate → Verify succeeds → status `verified`. Conformance "passing verified test" can be satisfied without Force-Conform.

---

## T1 — Make the conformance test requirement derive from the ITP  *(change, high)*
**Problem:** Conformance blanket-requires ≥1 passing **verified** test on **every** lot, so a lot whose ITP has no test points can never conform. Research confirms testing is tied to specific ITP points/frequencies, **not** every lot.
**Evidence:** `backend/src/lib/conformancePrerequisites.ts:150-153` (`hasPassingTest = testResults.some(pass && verified)`) and `:170` (`canConform = … && hasPassingTest && …`). The model already supports per-item tests: `ITPChecklistItem.testType` / `evidenceRequired`, and `TestResult.itpChecklistItemId`.
**Change:** Derive the requirement from the ITP. Compute the set of checklist items that **require a test** (e.g. `evidenceRequired === 'test'` or `testType` set). If there are none → **don't block on tests**. If there are → require a passing verified test for those items (or, minimally, at least one passing verified test only when the ITP has ≥1 test point). Update `blockingReasons` text accordingly (e.g. list which items still need a verified test).
**Acceptance:** A lot whose ITP has no test points conforms with **no** test. A lot whose ITP has test points still blocks until those are covered by a passing verified test. Update `conformancePrerequisites` unit tests.

---

## T2 — Simplify test submission  *(change, high)*
**Problem:** The lifecycle is `Requested → At Lab → Results Received → Entered → Verify` — three of those are clicks that **capture no data**; "Enter Results" opens **no form** (a test reaches `Entered`/verifiable with a blank result and `pending` pass/fail). Real practice = attach cert → record pass/fail → QM verify.
**Evidence:** `backend/src/routes/testResults/workflowRoutes.ts` (status transitions) + the Test Results page in `frontend/src/pages/tests/` (or `frontend/src/pages/...` test results UI).
**Change:** Collapse the flow toward **create test → attach NATA cert (B2) → record result value + pass/fail vs acceptance criteria → QM verify**. Make the "At Lab / Results Received / Enter Results" intermediate states optional (or remove). **Require an actual result + pass/fail before a test can be `Entered`/verified** (don't allow verifying a blank result). Capture **NATA status** on the certificate.
**Acceptance:** You cannot verify a test that has no result/pass-fail. The number of mandatory clicks from "have a cert" to "verified" is ≤2. (Coordinate with B2.)

---

## C2 — Claim a percentage of a lot's total  *(feature, high)*
**Problem:** The create-claim modal only claims 100% of a lot; you can't claim, say, 30% this month.
**Evidence:** Backend already supports cumulative claiming (`ClaimedLot.percentageComplete` / `amountClaimed`, cumulative ≤100% enforcement in `backend/src/routes/claims/`). The gap is the **UI** — `frontend/src/pages/claims/components/CreateClaimModal.tsx` selects lots at full value with no % input.
**Change:** Add a per-lot **% (or $) input** in the claim modal; show **previously claimed / this claim / cumulative** per lot; pass `percentageComplete` per lot to the create endpoint. Lot only flips to `claimed` (terminal) at 100% cumulative (existing backend behaviour).
**Acceptance:** Claim 30% of a $50k lot → claim line = $15k, lot stays `conformed` (not `claimed`); a later claim can take the rest; cumulative can't exceed 100%.

---

## N1 — Make NCRs assignable to a subcontractor (or a person)  *(feature/bug, high)*
**Problem:** Every NCR is created **Unassigned**; there's no assignee picker. Assigning to a **person** is half-built (backend accepts it, UI doesn't expose it); assigning to a **subcontractor** is **not implemented on the write side at all** — yet the read side (subbie's "my NCRs", access control, analytics) expects it, so a subcontractor never sees NCRs assigned to them.
**Evidence:**
- Person assign: `backend/src/routes/ncrs/ncrCore.ts` already accepts/validates `responsibleUserId` — but the Raise NCR form (`frontend/src/pages/ncr/...`) doesn't expose it.
- Subcontractor assign: `responsibleSubcontractorId` is **read** in `ncrAccess.ts`, `ncrListRoute.ts`, `ncrAnalytics.ts`, but the only **write** sets it to `null` (`backend/src/routes/subcontractors/adminRoutes.ts` on removal). Nothing ever assigns it.
**Change:**
- Backend: accept & validate `responsibleSubcontractorId` on NCR **create** (`ncrCore.ts`) and add an **assign/reassign** action (extend `ncrWorkflow.ts`) for both `responsibleUserId` and `responsibleSubcontractorId` (mutually exclusive). Notify the assignee.
- Frontend: add a **responsible-party picker (subcontractor *or* project user)** to the Raise NCR form + an Assign/reassign control on the NCR detail.
**Acceptance:** Raise an NCR assigned to subcontractor "ryox" → that subcontractor sees it in their portal NCR list; reassign to a user works; analytics counts it.

---

## C1 — Make progress claims direction-aware; drop "superintendent certifies in-app"  *(change, medium-high — design)*
**Problem:** The claim flow assumes an external superintendent certifies inside the app. Research confirms certification is the **paying side's** act (the payment schedule the contractor *receives*). For an **outbound HC→Principal** claim, the contractor should **record the certification received**, not certify it themselves; for an **inbound subbie→HC** claim, the HC *is* the certifier (in-app certify is correct).
**Evidence:** `backend/src/routes/claims/` (claim status workflow), `frontend/src/pages/claims/` (the Certify modal etc.).
**Change:** Introduce claim **direction** (outbound to Principal vs inbound from subcontractor). For outbound: relabel/repurpose "Certify Claim" → **"Record certification received"** capturing **certified/scheduled amount (can be < claimed), date, reasons/notes, attached certificate/payment-schedule PDF, who certified**. For inbound subbie claims: keep in-app certify. Do **not** add a client login. (Optional, later: a tokenised superintendent review/sign link, like hold-point release.)
**Acceptance:** An outbound claim's "certify" step is framed as recording an external certificate (with attribution + attachment); a subbie claim keeps contractor-side certify. Keep the existing SOPA date tracking (service/schedule-due/payment-due).
**Note:** Real claim **output** should be a SOPA-style payment-claim PDF + schedule (this-claim/previous/total, retention, GST, NSW supporting statement) + evidence pack — bigger piece; scope separately. The current 5-field CSV is not client-ready.

---

## I1 — One source of truth for superintendent / hold-point sign-off  *(change, medium)*
**Problem:** A superintendent-tagged ITP item can be satisfied two ways — the proper **tokenised email release link** *or* the contractor just ticking "Complete Anyway" with no attribution — undermining the evidence. Research confirms hold-point release is a **written Principal act**; the right model is contractor-records-**with-attribution**.
**Evidence:** ITP completion (`backend/src/routes/itp/completions.ts`) vs hold-point release (`backend/src/routes/holdpoints/...`). A superintendent/hold-point checklist item currently accepts a plain contractor completion.
**Change:** For superintendent / hold-point / witness ITP items, require the sign-off to carry the **external party's attribution** (name/date/method/evidence) — ideally driven by the existing **tokenised release link** — and **reconcile** the ITP-item state and the hold-point release into one source of truth (completing the item should reflect, or require, the hold-point release rather than a bare tick).
**Acceptance:** A superintendent hold point can't be silently self-completed with no attribution; releasing the hold point (via the link) satisfies the ITP item, and the record shows who/when/how.

---

_End of handoff. Items are independent except: T2 depends on B2; C1's full "claim output" is a separate larger piece._
