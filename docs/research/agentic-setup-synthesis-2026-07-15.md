# Agentic project setup — research synthesis and proposed direction

**Date:** 2026-07-15 · **Status:** research synthesis, decisions pending Jay
**Inputs:** three Opus research passes run 2026-07-15 — (A) codebase flow audit at
`origin/master` `2d944893`, (B) AU civil domain practice (specs + competitor
data models), (C) agentic/document-driven setup landscape + HITL UX + liability.
Full agent reports live in the session transcript; this doc is the synthesis.

Trigger: the AI setout-sheet import (#1469) shipped and live-verified 61/61
points exact on prod, proving the shape "AI reads a document → structured
candidate → human reviews → existing validated save path commits it". Question
from Jay: can that shape become an agentic layer over the whole
new-project → field-ready flow, and what do multi-subbie / multi-ITP need to
look like before users arrive.

---

## 1. The two data-model questions — answered

### Multiple subcontractors per job/lot: ALREADY BUILT, ahead of the market

`LotSubcontractorAssignment` (join table, `@@unique([lotId,
subcontractorCompanyId])`) supports many companies per lot TODAY, each row
carrying independent `canCompleteITP` / `itpRequiresVerification` permissions,
with server-side isolation (each subbie sees only their own lots) enforced in
`lots/readRoutes.ts` / `access.ts`. Domain research found **no documented
competitor with a first-class multi-subbie-per-lot segregation model** —
CivilPro/CONQA/Dalux/Procore all scope responsibility per checklist line at
best. We are ahead here by accident; the remaining work is cleanup, not
modelling:

- The legacy single-FK path (`Lot.assignedSubcontractorId` +
  `LegacyAssignSubcontractorModal`) still coexists and leaks into the UI
  ("Legacy assignment" amber banner). Retire/hide it.
- Domain facts to respect (already true in our model, keep it that way):
  hold-point release authority is the Principal/Superintendent's regardless of
  who did the work (a subbie never self-releases); ITP ownership is
  contractual — some jobs the subbie signs lines on the HC's ITP, some run
  their own that rolls up. Our per-assignment `canCompleteITP` +
  `itpRequiresVerification` flags map to exactly this split.

### Multiple ITPs per lot: NOT supported — and mostly shouldn't be (yet)

Schema: `ITPInstance.lotId @unique`, `Lot.itpTemplateId` single FK — one ITP
per lot, single-select everywhere in the UI. **The domain says this matches
the industry norm**: an AU civil lot is deliberately *thin* — one
activity/process/layer (TfNSW Q6 lot-register model; CivilPro's reference
model; testing frequencies are defined per lot and only make sense per
layer/material). An area spanning earthworks + select fill + pavement is
many thin lots, not one lot with three ITPs.

The real exception: **QLD MRTS50 generally requires a separate ITP for
structures**, so a mixed roadworks+structure lot legitimately carries two.
Rigid 1:1 will eventually break on a real QLD job.

**Recommendation (pending Jay):** don't do the schema migration now. Instead:

1. Near term — lean into thin lots: make the bulk chainage generator
   **activity-aware** (generate lots per activity per interval — e.g. 3
   activities × 8 intervals = 24 lots, each with the right ITP template),
   which is both industry-correct and zero schema change.
2. Later — do the `ITPInstance` 1→N migration as its own considered PR wave
   when the agentic ITP stage is built or when a QLD structures user needs it,
   whichever first. It threads through readiness counts, conformance PDFs,
   claims, and hold points, so it must not be rushed in as a side effect.

---

## 2. The current flow and its friction (codebase audit)

Journey as built: create project (modal on ProjectsPage) → land on project page
blind → Settings tabs (Control Lines, Plan Sheets buried 4–5 tabs deep, no
sequence) → lots (single / bulk chainage wizard / draw) → ITP attach → subbie
invites+assignments. Full detail with file refs in the audit report.

Top friction, ranked (all pre-AI, all cheap to fix):

1. **No spatial step anywhere in first-run guidance** — the dashboard setup
   checklist (`DashboardSetupChecklist.tsx`) has 4 steps, none spatial, and
   its ITP/Team steps never tick (`done:false` hardcoded).
2. **Silent `state → 'NSW'` default** on project create
   (`projects/writeRoutes.ts:265`) — drives specSet → which global ITP
   templates match. Non-NSW users silently get NSW templates.
3. **CRS is hand-picked, defaults EPSG:7856 (zone 56) everywhere** — never
   derived from state; wrong zone silently misplaces all geometry.
4. Registration "From chainage" hint appears even when no control line exists
   (the toggle it references only renders when `controlLines.length>0`).
5. AI setout button renders even when AI is unconfigured (503 after file pick).
6. Implicit orderings never stated (control line before chainage registration
   / bulk-lot offsets); spatial tabs interleaved with unrelated admin tabs.
7. Smaller: projectNumber required frontend-only; manual point entry
   discoverability; legacy subbie banner.

**Recommendation: ship a "dialled-in flow" fix wave before any agentic work.**
State→CRS+specSet derivation (kill the silent NSW default), a real setup
sequence (checklist gains spatial steps that actually tick, ordered), the
conditional hints, and legacy-assign retirement. This makes the manual flow
coherent — which the agentic layer then *accelerates* rather than papers over.

---

## 3. The agentic layer — what it is and why now

### Landscape (research pass C)

- Spec→ITP extraction is commercial today (Anyset: acceptance criteria,
  witness reqs, per-paragraph citations; exports INTO Procore/Autodesk).
  Drawings→registers at scale shipped June 2026 (Trunk Tools Cortex).
  AU civil: Civils.ai does human-reviewed takeoffs + subbie scope
  cross-checks with mandatory QA review. Dalux has chainage-aware quantities.
- **Nobody stitches document-driven setup into one staged flow tied to a
  spatial/chainage model.** Visibuild (closest AU QA competitor) spends its
  AI budget on risk detection, not setup. The lane is open.
- **Liability finding that shapes everything:** Verisk professional-liability
  AI exclusions (effective 2026-01-01) mean un-validated AI work can void PI
  cover. For audited conformance records, the immutable log of *AI-proposed
  vs human-confirmed (who/when/what-edited)* is what keeps a customer's QA
  pack insurable. Trunk/Anyset publish speed claims with no review UX and no
  accuracy posture — the trust layer is undefended and is our differentiator.
- Current setup state of the art everywhere else: CSV import + bulk-apply a
  master template. Nobody infers lots or ITP scope from documents.

### Shape: staged pipeline, one review gate per stage

Each stage = existing deterministic machinery + AI orchestration + the proven
review-candidate pattern (`isAnthropicConfigured` gate → candidate → server-side
Zod cleaning trust boundary → review UI → existing validated create endpoint).
The agent orchestrates parsers we already have (`landxmlParser`, `dxfParser`,
`geoPdf.ts`, `computeRegistration`, bulk lot generator, seeded ITP library) —
it does not replace them.

0. **Intake** — upload the drawing set / docs (multi-file).
1. **Project facts** — title-block read: name, number, client, state (→ derived
   CRS + specSet, surfaced for confirmation). New extraction, small.
2. **Control line** — agent classifies pages; setout tables → existing setout
   AI (#1469); GeoPDF georefs → existing detector; LandXML/DXF if present in
   the set. Proposes the control line with per-page citations.
3. **Plan sheets** — classify GA sheets; auto-register via GeoPDF where
   possible; else NEW corner-table/grid-coordinate extraction (same AI shape
   as setout); else propose chainage registrations for review.
4. **Lot breakdown** — propose chainage intervals × activities (thin lots per
   §1) feeding the existing bulk generator; map preview is the review UI.
5. **ITP matching** — map each proposed lot's activity to the seeded template
   library (state-filtered), confidence-routed review. (Spec→ITP *extraction*
   à la Anyset is a later wave; matching to our curated library first is
   safer and uses an asset competitors don't have.)
6. **Subbie scoping** — propose `LotSubcontractorAssignment` rows per
   trade/activity once subbie companies exist.

### Non-negotiable UX/trust rules (from the research)

- **Never auto-apply to live QA records.** Candidate → review → explicit save,
  every stage. (Insurance + our existing pattern.)
- **Citations on every proposal** — link each proposed value to the exact spec
  clause / drawing region it came from; review happens in-place.
- **Confidence routing** — auto-fill high-confidence rows, surface only
  uncertain/consequential ones; per-row accept/edit/reject; bulk-approve only
  for low-risk batches. (The proven defence against both review fatigue and
  rubber-stamping.)
- **Immutable audit log from day one**: user request → AI proposal → sources →
  human action (accept/edit/reject, by whom, when) → final record. First-class
  schema, not console logs.
- **Stage rollback** — a confirmed stage can be reverted before the next
  builds on it.
- **One decision per stage** — never a mega-wizard (documented 40–60%
  abandonment for front-loaded config).

---

## 4. Proposed sequencing (pending Jay's calls)

- **Wave 0 — dialled-in manual flow** (no AI): state→CRS/specSet derivation,
  setup checklist with real spatial steps that tick, ordering surfaced,
  conditional hints, legacy subbie assign retired, activity-aware bulk lot
  generator. Small PRs, high user-facing value, de-risks everything after.
- **Wave 1 — agentic stages 1–4** (project facts → control line → sheets →
  lots): all machinery exists; the new AI surface is title-block reading and
  corner-table extraction — both the same shape as the proven setout import.
  Plus the audit-log schema (additive migration).
- **Wave 2 — stage 5 ITP matching** (library matching, confidence-routed) and
  stage 6 subbie scoping.
- **Wave 3 — spec→ITP extraction** (Anyset territory: read TfNSW/MRTS spec
  sections → propose checklist items with clause citations) and the
  multi-ITP-per-lot migration if demand has materialised.

## 5. Decisions for Jay

1. **Multi-ITP per lot:** defer the schema change; do activity-aware thin-lot
   generation now (recommended) — or migrate now?
2. **Legacy single-subbie assign path:** retire/hide it (recommended)?
3. **Wave 0 first** (recommended) — or straight to agentic Wave 1?
4. **Wave 1 scope** as proposed (stages 1–4 + audit log)?
5. **Audit log as first-class schema from Wave 1** (recommended — the
   insurance/trust moat).
