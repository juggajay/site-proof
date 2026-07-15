# Agentic setup — pre-build research: eval corpus, activity taxonomy, cost model

**Date:** 2026-07-15 · **Status:** research complete; blocks nothing but Wave 2 depends on §2
**Companion to:** `agentic-setup-synthesis-2026-07-15.md` (the plan this de-risks).
Jay's brief: "before you wire it up, is there anything else you would research to
make sure we have the perfect implementation?" Three answers: a real-world
document corpus, an activity-taxonomy audit, and a cost model.

---

## 1. Real-world drawing-set evaluation corpus (vetted URLs)

Everything proven so far ran against the synthetic test kit. Real IFC sets are
scanned pages, varied title blocks, and setout tables on page 23 of 40. The
corpus below was vetted by an agent (search-snippet or byte-fetch confirmed);
files are NOT downloaded yet — download pending Jay's approval, then run the
live setout extraction against the confirmed setout tables for an accuracy
baseline, and keep the folder as the regression set every future executor is
tested against.

Target folder: `C:\Users\jayso\siteproof-test-plans\corpus\` (outside the repo).

| # | URL | What | Why it matters |
|---|-----|------|----------------|
| 1 | https://www.hornsby.nsw.gov.au/files/assets/public/v/1/council/noticeboard/infrastructure-works-and-projects/infrastructure-works/current-works/documents/chandler-ave-civil-design-plans.pdf | Hornsby NSW road reconstruction civil design plans | **Confirmed real setout table** (point/chainage/E/N/level/radius+spiral) — primary extraction target |
| 2 | https://www.hornsby.nsw.gov.au/__data/assets/pdf_file/0009/280890/Pennant-Hills-to-Epping-shared-pathway-Beecroft-Design-drawings.pdf | Shared-path design drawings | **Confirmed setout table**; path/cycleway alignment variety |
| 3 | https://apps.planningportal.nsw.gov.au/prweb/PRRestService/DocMgmt/v1/PublicDocuments/DATA-WORKATTACH-FILE%20PEC-DPE-EP-WORK%20PAN-477392!20241009T033545.210%20GMT | NSW Planning Portal civil+stormwater set (fetch-confirmed 1.7 MB) | **Token URL — may expire, download first** |
| 4 | https://www.blacktown.nsw.gov.au/files/assets/public/v/1/public-exhibitions/da-19-00934/appendix-c-engineering-plans.pdf | Riverstone Ponds subdivision engineering plans | Subdivision road+drainage GA archetype |
| 5 | https://www.blacktown.nsw.gov.au/files/assets/public/v/1/planning-neighbour-notifications/da-21-00409/appendix-c-engineering-plans-16-001995_ud_da_rev01_sigened_pan-74143.pdf | Kings Langley engineering plans (signed DA rev) | Roadworks/drainage + DA-ref title block |
| 6 | https://www.blacktown.nsw.gov.au/files/assets/public/v/1/public-exhibitions/da-19-01603/s18339-rpt-c-001_b_with_appendices.pdf | Schofields subdivision report + drawing appendices | Mixed report+drawings (classifier stress) |
| 7 | https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/05/DA-2025-26-Civil-SW-Swept-Paths.pdf | 2025 civil + stormwater + swept paths | Recent vector era; swept-path overlays |
| 8 | https://edqdad.dsdip.qld.gov.au/documents/1328/19390/CivilPlans.pdf | Weinam Creek QLD civil plans (fetch-confirmed, ~162 pages, 6.6 MB) | **Scanned/raster-heavy** — the OCR stress case |
| 9 | https://os-data-2.s3-ap-southeast-2.amazonaws.com/hsc/bundle359/annexure_part_d_-_civil_plans.pdf | Hinchinbrook QLD civil plans | QLD title block/datum |
| 10 | https://websync.msc.qld.gov.au/development_applications/files/432/OPW250002%20-%20Development%20Application.pdf | Mareeba QLD operational-works application (RPEQ-signed) | Real received OPW set, zone 55 |
| 11 | https://douglas.qld.gov.au/download/planning-services/development_applications/24011-Andrew-Close-Submission_op-2024_5711.pdf | Douglas Shire QLD OPW submission | Tropical-north council variety |
| 12 | https://www.basscoast.vic.gov.au/assets/planning-applications/220321/REDUCED-ECM_10099889_v1_Planning-Permit-Application-Combined-plans-60-pages-of-civil-drawings-Stanley-Rd-GLEN-FORBES.pdf | 60-page VIC civil set (fetch-confirmed >10 MB) | Biggest set; VIC zone 55 datum |
| 13 | https://www.wa.gov.au/system/files/2023-07/appendix-n-civil-road-drawings.pdf | WA civil road drawings | Non-east-coast datum (zone 50) |

Known gap: a private-developer IFC subdivision set (the Cedarwoods Ellendale
Stage 3F set is the right archetype; its CMS link is session-bound and 404s —
re-navigate from the Ellendale documents page if wanted). Tender portals
(TenderLink/VendorPanel) are login-walled — don't chase. Standard-drawing
libraries (TMR SD, VicRoads, Sydney Water) contain no real project coordinates
and were deliberately excluded, but define setout-table field formats.

## 2. Activity taxonomy audit — MUST FIX BEFORE WAVE 2 (ITP matching)

Audited at `origin/master` (116 global templates, 28 seeders). Verdict: the
"match ITP templates to activity-generated lots" plan has **no machine-usable
key today**.

1. **`ITPTemplate.activityType` is nullable free text, never queried.** The
   only matching filter in `backend/src/routes/itp/templates.ts` is
   `{ projectId: null, stateSpec: project.specificationSet }`. `activityType`
   is written by seeders and echoed in responses; nothing filters on it.
2. **The activity vocabulary is inconsistent across states.** Pavement is
   written 5 ways (`pavement`, `pavements`, `pavement_unbound`,
   `pavement_bound`, `pavement_concrete`), structures 3 ways (`structures`,
   `structural`, `concrete`). Only `earthworks` and `drainage` (and mostly
   `asphalt`) are consistent everywhere.
3. **Five separate activity vocabularies exist app-wide, none shared:**
   template records (lowercase), the bulk lot generator's `ACTIVITY_TYPES`
   (Title Case, has Rail), the ITP-template form (has General), the create-lot
   form (adds Utilities/Landscaping/Services/Other), the edit-lot form.
   `Lot.activityType` stores Title-Case UI strings; templates store lowercase —
   no shared key on either side of the intended match.
4. **Library gaps that break "typical subdivision":** NO templates anywhere for
   sewer reticulation, water reticulation, electrical/NBN conduit, footpaths,
   detention basins. NSW (TfNSW) and Austroads lack the entire environmental +
   road_furniture families that QLD/SA/VIC have (ESC, landscaping, linemarking,
   barriers). `MRWA` (WA) and `custom` are selectable specification sets with
   ZERO seeded templates.
5. `DiaryActivity` carries no activity taxonomy at all (free text).

**Required work item (schedule inside Wave 0 or as Wave 2's first PR):**
one canonical activity enum; a normalization map from the 14 template
activityType strings + 4 UI lists onto it; migrate/backfill
`itp_templates.activity_type` (+ index); align the UI lists. Separately (domain
content, needs Jay's review): seed the subdivision-gap templates (WSA-based
sewer/water, electrical conduit, footpaths) and fill NSW/Austroads
environmental + road_furniture. Without this, Wave 2's ITP matching would be
built on strings that don't join.

## 3. Cost model (Sonnet 5 @ $3/M in, $15/M out; intro ~33% less to 2026-08-31)

- Setout table extraction: ~5¢/sheet (live-verified: 61 points, 15.6 s).
- Page classification of a 40-sheet set: ~$0.40 (the largest line item).
- Corner-table/title-block reads: ~3–5¢/sheet.
- Lot breakdown + ITP matching proposals: pennies (deterministic maths + one
  proposal call each).

**Full agentic setup ≈ $0.50–$1.50 per project; a 100-sheet package < $3.**
Consequences: standardise on Sonnet 5 everywhere (mixing in a cheaper model for
classification saves ~25¢ and adds a second behaviour profile — not worth it);
the real budget is latency (15–60 s per vision call, 2–5 min per pipeline
pass), which the staged review-queue copilot shape absorbs by design.

## Next actions

1. Jay approves corpus download → pull the 13 sets (token URL #3 first) →
   run live setout extraction on the two confirmed tables → record the
   accuracy baseline in this doc's companion eval notes.
2. Taxonomy unification PR(s) precede or open Wave 2.
3. Subdivision template gap-filling scheduled as its own reviewed seeding wave.
