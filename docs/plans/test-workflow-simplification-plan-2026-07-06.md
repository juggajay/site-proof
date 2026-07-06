# Test Workflow Simplification Plan — 2026-07-06

Owner-approved after a three-way investigation (workflow map, Add-Test form
deep-dive, competitor UX research). Goal: recording a test result becomes a
short, requirement-driven action instead of a 21-field form, and the
test→ITP linkage stops depending on exact free-text string matching.

## Root cause (drives everything)

`TestResult.itpChecklistItemId` exists in the schema (schema.prisma:711)
and is the FIRST match the conformance gate checks
(backend/src/lib/conformancePrerequisites.ts:252) — but **nothing ever
writes it**: POST body (backend/src/routes/testResults/crudRoutes.ts:93-109),
PATCH body (:241-256), and the AI-extraction mapper
(testResultMapping.ts:51-79) all omit it. Every test-to-ITP association
falls back to case-insensitive EXACT equality of free-text `testType`
(conformancePrerequisites.ts:255-256). Consequences:
- Mismatched-but-valid passing tests leave lots "Blocked" forever; the
  #1336 outstanding-tests message classifies them as `no_result` ("no
  result yet") — actively misleading.
- Claim creation re-runs the gate → CONFORMANCE_STALE
  (claims/workflowRoutes.ts:184-208): a typo blocks money.
- Hold-point evidence packages silently drop null-linked tests
  (holdpoints/evidencePackage.ts:107-116) — today that is ALL app-created
  tests.

## Form diagnosis (CreateTestModal.tsx, 511 lines)

21 flat fields, only `testType` required (backend requires projectId +
testType only). The result block (value/unit/spec min/max/pass-fail) is
re-collected later by EnterResultsModal — create always lands status
`requested`. No date defaults, no prefill from the linked lot, no ITP item
picker. The AI cert-upload flow (which auto-fills nearly everything) is a
secondary button. Competitor pattern (CONQA/Visibuild/Novade):
requirement-first capture; no competitor documents AI cert extraction —
ours is a differentiator to promote.

## Constraints / trust boundaries

- Server-side validation of any submitted `itpChecklistItemId`: the item
  must belong to the ITP of the test's linked lot (and that lot to the
  project). Reject item links when no lot is linked. Never trust client.
- Do NOT touch cert-AI access control, verification role logic, or the
  hold-point release trust boundary.
- Conformance gate behavior unchanged except that link-based matching
  finally becomes reachable; string matching stays as fallback
  (back-compat for existing rows).
- EnterResultsModal / verify / reject flows unchanged in this batch.

## PR 1 — backend: wire `itpChecklistItemId` + readiness honesty

1. Accept optional `itpChecklistItemId` on POST /api/test-results and
   PATCH /:id (allow explicit null to clear). Validate per constraints;
   AppError.badRequest on mismatch. Persist it.
2. Accept it on the cert confirm-extraction route(s)
   (testResults.ts:281 confirm-extraction, :331 batch-confirm) so the
   review screen can link during confirmation (frontend wiring comes in
   PR 3; backend ready now).
3. Readiness honesty: in conformancePrerequisites
   `buildOutstandingTestItems` (:280-304), add state
   `unmatched_result_exists` when the item is unsatisfied AND the lot has
   ≥1 test result that matches no required item. evidenceReadiness detail
   phrase: "a test result exists for this lot but isn't linked to this
   requirement — open the test and link it." Presentation-only; gate
   unchanged.
4. Tests: link validation (wrong project / wrong lot / no lot), gate
   satisfied via link with NON-matching testType (proves path A live),
   new outstanding state, DB-backed via local test DB.

## PR 2 — requirement-first entry points (frontend)

1. Lot detail ITP checklist: each test-required, unsatisfied item gets an
   "Add test result" action (TEST_CREATORS roles = owner, admin, PM,
   site_engineer, quality_manager, foreman — mirror backend
   accessControl.ts:31-42). Opens CreateTestModal prefilled: lotId,
   testType from the item, itpChecklistItemId, spec limits where the item
   carries them.
2. Evidence Readiness card: the named outstanding tests (from #1336) each
   get the same "Add result" affordance (or deep-link to the checklist
   item).
3. CreateTestModal: accept `initialValues` + carry a (non-editable,
   visible as context: "Satisfies: <item description>") itpChecklistItemId
   through submit. No layout redesign yet — that's PR 3.
4. Lot Tests tab (TestsTabContent.tsx): stop being a dead-end — surface
   the same Add action with lot context instead of bouncing to the global
   page (keep the "view all" link).
5. Tests: prefill plumbing, role gating, submit body includes the item id.

## PR 3 — slim the modal + promote the cert path

1. CreateTestModal redesign (keep RHF+Zod, switch container to
   ResponsiveSheet):
   - Essentials always visible: Test Type (when a lot is linked, a picker
     listing that lot's ITP test-required items — selecting one sets
     itpChecklistItemId + specs; free-text fallback stays for ad-hoc),
     Link to Lot, Sample Location, Sample Date (default today).
   - "Add lab & sample details" collapsible (existing Accordion /
     foreman-sheet showMore pattern): lab name, NATA site, request/report
     numbers, material type, depth, layer/lift, sampled by, test/result
     dates, spec reference.
   - DROP the result block (result value, unit, spec min/max, pass/fail)
     from create — results belong to EnterResultsModal. Spec min/max may
     still be set invisibly from the picked ITP item.
2. Promote "Upload Certificate" to the primary action on TestResultsPage
   (visual hierarchy: cert-first, "Add manually" secondary). In the
   requirement-first flow (PR 2 entry points), offer the same choice.
3. Cert review screens (single + batch): when a suggested/selected lot has
   ITP test-required items, offer an item picker so confirmation writes
   itpChecklistItemId (backend from PR 1).
4. Register row action "Link to ITP item" for existing tests (select from
   the linked lot's test-required items → PATCH). This is the migration
   path for old rows.
5. Tests: characterization for the modal (fields present/absent,
   defaults), cert-confirm link plumbing.

## Deferred (explicitly out of scope, discussed with owner)

- Verification review UI / segregation of duties (same user can enter and
  verify) — ties into the queued QM verify/reject work.
- Evidence-package inclusion of unlinked lot tests (PDF content change —
  after PR 1-3 land, most new tests will be linked anyway; revisit).
- Status-pill unification (workflow status vs passFail axes).
- Reports/CSV testType normalization.
- Notification for the requested→entered short path.

## Sequencing

PR 1 → PR 2 → PR 3, one builder, each branched off origin/master, CI
green + orchestrator QA before merge. Same git hygiene rules as the
2026-07-06 bug batch (no stash -u/clean/checkout ref -- ., explicit-path
staging only).
