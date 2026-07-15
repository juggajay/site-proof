# Wave 2 spec — canonical activity taxonomy + lot→ITP matching

**Date:** 2026-07-15 · **Status:** APPROVED — Jay accepted both recommended
calls same day ("I'm happy to go with what your rec is"): kerb_channel stays
in `drainage`; `Concrete` retired as an activity value (existing Concrete
lots flagged for one-time re-classification). §4 records the evidence. This
spec is build-ready for Wave 2; remaining Jay input is the foreman-naming
gut check on display names during W2-PR1 review.
**Inputs:** two Opus research passes run 2026-07-15 (A: taxonomy from
published spec structures; B: matching rules from QA practice + the seeded
library), both grounded in repo state at `9235d084`. Full agent reports in
session transcript; this is the synthesis. Jay has explicitly delegated these
domain calls to published evidence (TfNSW/MRTS/VicRoads/DIT/Austroads/WSA) —
this doc cites sources for every load-bearing claim so review = checking
evidence, not making blind judgment calls.

---

## 0. The two bugs that make Wave 2 impossible today (must-fix first)

1. **Case/vocabulary mismatch.** Lot forms write Title-Case activities
   (`Earthworks`, `Pavement`); seeders write lowercase (`earthworks`,
   `pavements`, `structural`). A naive `lot.activityType ===
   template.activityType` returns **zero matches for every lot in the
   system**. Today's "suggested first" sort in the ITP attach panel
   (`frontend/src/pages/lots/components/ITPChecklistTab.tsx` ~L639) is likely
   never boosting for the same reason.
2. **`ITPTemplate.activityType` is dead.** Template selection
   (`backend/src/routes/itp/templates.ts` L114–145) filters on
   `{projectId: null, stateSpec: project.specificationSet}` only. activityType
   is stored, cloned, and never queried. The taxonomy below is not cosmetic
   cleanup — it is the missing match key.

## 1. Canonical taxonomy (research pass A)

**Structure: 10 families (foreman dropdown) → 38 activity slugs (template
key).** Activity and layer stay separate fields (already separate in
`bulkCreateLots.ts`). Granularity rationale: the sub-activity level is where
one slug ≈ one template — the resolution the seeded library already sits at
(`pavement_unbound`, `asphalt_prep`, …) and matches AGPT Part 8's
construction-chapter structure. Coarser can't key a template ("Pavement"
spans unbound/bound/concrete — different hold points); finer (per spec
clause) is not a dropdown a foreman uses.

Families: `earthworks` · `pavements` · `surfacing` · `drainage` ·
`structures` · `road_furniture` · `environmental` · `concrete_flatwork` ·
`utilities` · `rail` (hedge, parked).

### Level-2 slugs (38)

| Family | Slug | Display name | Layer/material variants |
|---|---|---|---|
| earthworks | `earthworks_general` | Earthworks (general) | subgrade, fill, cut, select fill |
| earthworks | `earthworks_subgrade_prep` | Subgrade preparation | subgrade |
| earthworks | `geosynthetics` | Geosynthetics | separation, reinforcement |
| pavements | `pavement_unbound` | Unbound granular pavement | subbase, base |
| pavements | `pavement_bound` | Bound/stabilised pavement | CTB, in-situ, plant-mixed |
| pavements | `pavement_concrete` | Concrete pavement | base |
| pavements | `pavement_stabilisation` | In-situ stabilisation | lime, cement |
| surfacing | `asphalt_dga` | Dense graded asphalt | wearing, intermediate |
| surfacing | `asphalt_sma` | Stone mastic asphalt | wearing |
| surfacing | `asphalt_oga` | Open graded asphalt | wearing |
| surfacing | `asphalt_eme` | High-modulus asphalt (EME2) | intermediate |
| surfacing | `sprayed_seal` | Sprayed bituminous surfacing | seal, primerseal |
| surfacing | `prime_primerseal` | Prime & primerseal | prime |
| drainage | `pipe_drainage` | Pipe drainage (stormwater) | — |
| drainage | `drainage_pits` | Pits & chambers | — |
| drainage | `culverts` | Culverts (box/pipe) | — |
| drainage | `subsoil_drainage` | Subsoil/subsurface drainage | — |
| drainage | `kerb_channel` | Kerb & channel | — |
| structures | `structural_concrete` | Structural concrete | — |
| structures | `reinforcement` | Reinforcement placement | — |
| structures | `piling` | Piling | bored, CFA, driven |
| structures | `structural_steelwork` | Structural steelwork | — |
| structures | `bridge_bearings` | Bridge bearings | — |
| structures | `precast_elements` | Precast concrete elements | — |
| structures | `post_tensioning` | Post-tensioning | — |
| structures | `reinforced_soil_walls` | Reinforced soil / MSE walls | — |
| structures | `bridge_deck_waterproofing` | Bridge deck waterproofing | — |
| road_furniture | `wire_rope_barrier` | Wire rope safety barrier | — |
| road_furniture | `w_beam_guardrail` | W-beam guard fence | — |
| road_furniture | `concrete_barrier` | Concrete road safety barrier | — |
| road_furniture | `pavement_marking` | Pavement marking | — |
| road_furniture | `fencing_noise_walls` | Fencing & noise walls | — |
| environmental | `erosion_sediment_control` | Erosion & sediment control | — |
| environmental | `landscaping` | Landscaping & revegetation | — |
| concrete_flatwork | `footpaths_flatwork` | Footpaths & concrete flatwork | — |
| utilities | `water_reticulation` | Water supply reticulation (WSA 03) | — |
| utilities | `sewer_reticulation` | Sewer/pressure sewer (WSA 02/04/07) | gravity, pressure |
| utilities | `conduit_trenching` | Conduit & trenching | — |
| rail | `rail_trackwork` | Rail trackwork (parked hedge) | — |

### Mapping of today's 5 app vocabularies → canonical

Every existing value maps. Family-level values (`Pavement`, `Drainage`,
`Structures`, seeder `asphalt`/`drainage`/`environmental`/`road_furniture`)
resolve to a family and need a sub-activity pick (user or AI). Direct
one-to-one: `Earthworks`→`earthworks_general`, `Landscaping`→`landscaping`,
seeder `asphalt_prep`→`prime_primerseal`, seeder
`pavement_unbound`/`_bound`/`_concrete`→same, austroads `concrete`→
`structural_concrete`, `Services`→`utilities` (synonym, collapse).
Inconsistencies to normalise: QLD/VIC `structural` vs NSW/SA `structures` →
`structures`; austroads bare `pavement` → `pavement_unbound`.

**Highest-leverage mechanical fix:** re-tag every seeded template from its
family-level activityType to its Level-2 slug (name-driven — e.g. the NSW
drainage seeder's "Box Culvert Construction" template → `culverts`). Without
this, activityType matching can only resolve to a family and the whole
matching stage degrades to a shortlist-everything experience.

### Spec-reference metadata

Per-slug spec references per state (TfNSW R/B-series, MRTS numbers, VicRoads
sections, DIT codes, Austroads/WSA) are compiled in the research transcript
and partially verified (✓ = primary source fetched this session; † = from the
seeders' own citations, consistent with the verified authority category
structures but individual PDFs not re-fetched — TMR index 403s). Key verified
anchors: TfNSW R44 earthworks / R11 stormwater / 3051 granular base; MRTS04 /
MRTS05 / MRTS70 / MRTS14; VicRoads 204 / 304 / 407 / 610 / 701; AGPT Part 8.
These become `specificationReference`-style matching metadata and audit-log
citations.

## 2. Matching rules (research pass B)

**Ground truth:** `(stateSpec, activityType)` is NOT unique — NSW drainage
alone has 4 legitimate templates (pipe, pits, box culvert, subsoil). Most
families (earthworks, environmental) are one-to-one. So:

**Algorithm — deterministic-first, AI bounded to ambiguity:**
1. HARD FILTER: active templates, `projectId == project` OR
   (`projectId == null` AND `stateSpec == project.specificationSet`).
   Project-scoped wins name collisions. Wrong-state template = audit failure;
   this boundary is never AI-negotiable.
2. ACTIVITY FILTER: canonical-slug equality (post-taxonomy; fold legacy
   values through the §1 mapping during transition).
3. ROUTE by candidate count:
   - **Tier A (green)** exactly 1 → auto-fill, still reviewable, batch-approvable.
   - **Tier B (amber)** >1 → AI ranks the real candidates using sub-activity/
     material/layer tokens from the lot description + drawing text; returns
     ranked shortlist + why-matched citation. Reviewer must affirm — never
     pre-committed.
   - **Tier C (red)** 0 → honest library-gap flag; offer clone / create /
     cross-project import (route exists, `templates.ts` L34). Never guess.

AI never invents a template and never edits checklist items. Conservatism is
calibrated by failure cost: wrong ITP = wrong hold points/test frequencies
signed off → NCR/uncovering/rework (rework ≈9% of project cost in cited
industry data).

**Custom templates (Jay's question, 2026-07-15).** User-created templates
are first-class in matching, with these rules:
- The hard filter already includes project-scoped templates, and
  **project-scoped beats global on the same activity** — a contractor's
  job-approved ITP always outranks the library default.
- Post-W2-PR1, the template creation/edit form uses the SAME canonical
  family→slug picker as the lot forms, so new custom templates are matchable
  from birth.
- Existing custom templates with legacy/free-text activity values: fold
  through the §1 normalization map where clean; anything unmappable becomes
  **"unclassified"** with a one-time classification prompt (same mechanism as
  the Concrete-lot reclassification). Unclassified templates are never
  invisible — they surface in the Tier-B shortlist for their own project
  (name-similarity ranked) but can never Tier-A auto-fill.
- Genuinely novel activities (no slug fits): manual attach always remains;
  matching reports the gap honestly rather than forcing a fit. If the same
  custom activity keeps appearing, that's a signal to extend the taxonomy —
  a deliberate, evidenced change, not an ad-hoc string.

**Insertion point (already built):** #1475's `BulkActivity { activityType,
itpTemplateId? }` — Wave 2 populates `itpTemplateId` per activity row. No
schema change.

**Audit-log citation per match** (goes in the AiProposal, #1479):
templateId+name, project-vs-global, stateSpec, activity slug, match tier,
signals used, confidence, runner-up id(s), model + ruleset version, human
confirm/override.

**Review UX per matched lot:** template name + global/project badge;
why-matched chips (Spec ✓ / Activity ✓ / +disambiguator for Tier B);
checklist-item + hold-point + witness counts; spec reference; Tier B shows
runner-up + one-line delta; bulk triage header ("N matched, M need review").

## 3. Library gap list (feeds the seeding wave — needs Jay's domain review)

- **Whole families with zero templates anywhere:** `utilities` (WSA 02/03/
  04/07 exist and are stable), `concrete_flatwork` (council/IPWEA/AUS-SPEC
  territory), `rail` (parked deliberately).
- **NSW/TfNSW is the thinnest state:** missing `environmental` and
  `road_furniture` seeders entirely (QLD/SA/VIC have both).
- **Austroads baseline:** 6 templates only — missing most surfacing,
  drainage sub-activities, all road furniture/environmental/structures
  beyond structural concrete.

## 4. Contested calls for Jay (the only two real decisions)

1. **Kerb & channel: drainage or flatwork?** Authorities spec it under
   drainage (R11/MRTS03/Sec 703) — where our templates already sit; councils
   file it with footpath flatwork. **Rec: keep in `drainage`** (no retagging,
   matches the specs the library keys to).
2. **Retire `Concrete` as an activity value?** It's a material, not an
   activity (structural concrete vs concrete pavement vs flatwork are
   different jobs). It is today's most ambiguous value. **Rec: retire it**;
   existing `Concrete` lots get flagged for one-time re-classification.

Also sanity-check (foreman-naming gut check, not spec knowledge): the 38
display names in §1 — do they read like what a crew calls the job?

## 5. Wave 2 build order (implied by the above)

1. **W2-PR1 taxonomy foundation:** canonical slug module (shared const),
   normalization/fold map for every legacy value, re-tag seeders to Level-2
   slugs, align the 3 lot forms + ITP template form to family→slug pickers.
   No behaviour change to matching yet.
2. **W2-PR2 deterministic matcher + Tier A/C:** server-side match service
   keyed on (stateSpec, slug); wire into bulk-generator activity rows and the
   ITP attach panel ("suggested" becomes real).
3. **W2-PR3 Tier B ranking + citations:** AI ranking of multi-candidate
   sets, AiProposal integration, review UX.
4. **Seeding wave (separate, Jay-reviewed):** NSW environmental +
   road_furniture; utilities (WSA) family; flatwork; Austroads fill-out.

Sources: full URL-cited list in both research reports (session transcript,
2026-07-15). Primary anchors verified this session are listed in §1;
UNVERIFIED items are marked there and must be re-verified before any template
content is authored against them.
