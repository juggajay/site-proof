# Spatial Lot Map — Full Build Spec

Date: 2026-07-13. Status: awaiting Jay approval.
Basis: CivilPro spatial module deep-dive (`docs/research/feature-gap-research-2026-07-13.md`
+ agent report), full read of our existing `LinearMapView`, schema, and storage patterns.

## Goal

A spatial lot QA engine better than CivilPro's: every lot has real geometry, renders on
(1) the linear strip, (2) a real satellite basemap, and (3) the actual construction
drawings — colour-coded by conformance, queryable by area, and flowing into conformance
packs and claims. CivilPro's weakness is setup burden (manual CSV wrangling, per-sheet
registration, "ask ChatGPT to convert your coordinates" in their own docs). Ours will be
AI-assisted setup measured in minutes, on a modern web UX.

## What CivilPro has (parity targets)

| # | Capability | Their implementation |
|---|---|---|
| 1 | Control lines | ≥2 (chainage, easting, northing) points, CSV import, local grid → WGS84 |
| 2 | Lot geometry | chainage+offset → polygon/line/point; drawn on plan; coordinates; multiple geometries per lot |
| 3 | Strip view | multi-layer cross-section schematic (we have this) |
| 4 | Basemap view | lots projected onto Google Maps |
| 5 | Plan view | georeferenced PDF drawings, lots as vector overlay, perimeter clipping, GeoPDF auto-registration |
| 6 | Spatial search | draw box → lots/test requests/photos within |
| 7 | AVL | area/volume/length auto-computed from geometry, user override |
| 8 | Outputs | plan snapshots pinned into reports/handover; TR location snapshots for testers |

## Where we beat them (differentiators)

1. **AI setup** — upload the Geometric Setout PDF, Gemini extracts the control-line table
   (same muscle as our test-cert AI extraction); upload a drawing, AI reads the title block
   to detect the coordinate system (MGA zone) and suggests registration points. CivilPro
   makes users do this by hand in Excel.
2. **Computed coverage, not just visual** — per work type: % of alignment lotted, % conformed,
   with explicit gap list ("Ch 1240–1380 has no subbase lot"). CivilPro only shows blank
   stretches visually.
3. **Time scrubber** — lot status is event-sourced in our audit log; scrub a date slider and
   watch conformance progress across the job. No evidence CivilPro has this.
4. **One status vocabulary** — colours driven by the canonical 8-status model
   (`lib/lotStatusOverview.ts`), same everywhere: strip, basemap, plan, register, reports.
5. **Web-modern UX** — drag-pan, wheel-zoom, mobile-usable viewer (view-only on phone,
   editing on desktop).

## Architecture decisions (recommendations — flag disagreement before build)

| Decision | Choice | Why |
|---|---|---|
| Geometry storage | **GeoJSON (WGS84) in Postgres `jsonb` + turf.js in app code. No PostGIS.** | Railway Postgres PostGIS support is uncertain and a prod-DB extension is a deploy risk; project-scale data (10²–10⁴ lots) is trivial for in-app turf. Revisit only if a real perf wall appears. |
| Coordinate transforms | **proj4js**, presets for GDA2020 + GDA94 MGA zones 49–56 + WGS84 | AU civil drawings are MGA; proj4 is the boring proven choice. Canonical storage = local grid coords as entered; WGS84 derived + cached. |
| Map rendering | **Leaflet + react-leaflet** (lazy-loaded route) | Boring, proven, huge plugin ecosystem (draw tools, rotated image overlay). MapLibre is prettier but adds complexity we don't need for raster satellite + polygons. |
| Basemap tiles | OSM default; **satellite = MapTiler free tier** (key in env, graceful fallback to OSM) | No Google Maps billing/ToS trap. Needs a MapTiler account — Jay signup, 5 min. |
| Plan rendering | **pdf.js → PNG per sheet at upload (backend), stored in Supabase** `documents` bucket; Leaflet ImageOverlay.Rotated positioned by affine transform | Pre-rastering makes the viewer dumb-simple and mobile-fast; reuses our entire secure-storage pipeline. |
| Plan registration | 2-point similarity transform (min) or 3+-point least-squares affine; points = click pixel + enter grid coords OR click a control-line chainage | Matches CivilPro's flow but in one guided modal. GeoPDF auto-registration = later phase (JS parsing of ISO 32000 geospatial is niche; manual is the reliable baseline). |
| Geometry authoring | chainage+offset generator (control line + turf lineSliceAlong/lineOffset → polygon) AND freehand draw on plan/basemap (leaflet-geoman) | Both CivilPro modes, one geometry model. |

## Data model (new Prisma models — all additive, reviewed migrations)

```prisma
model ControlLine {
  id               String   @id @default(uuid())
  projectId        String
  name             String                    // "MC00 Mainline", "Drainage Line A"
  coordinateSystem String                    // EPSG code, e.g. "EPSG:7856" (GDA2020 MGA56)
  points           Json                      // ordered [{chainage, easting, northing}]
  geometryWgs84    Json?                     // derived LineString cache
  // + timestamps, createdById
}

model LotGeometry {
  id            String  @id @default(uuid())
  lotId         String
  kind          String  // 'chainage_offset' | 'drawn' | 'point'
  controlLineId String?                     // for chainage_offset
  chainageStart Decimal?
  chainageEnd   Decimal?
  offsetLeft    Decimal?                    // metres left of control line
  offsetRight   Decimal?
  planSheetId   String?                     // if drawn on a plan
  geometryWgs84 Json                        // GeoJSON Feature (Polygon/LineString/Point)
  areaM2        Decimal?                    // computed; user-overridable
  lengthM       Decimal?
  // multiple rows per lot = CivilPro's "multiple geometries per lot"
}

model PlanSheet {
  id               String  @id @default(uuid())
  projectId        String
  documentId       String                   // source PDF lives in existing documents
  pageNumber       Int
  name             String                   // "C-101 Rev D"
  imageRef         String                   // supabase://documents/... rendered PNG
  imageWidth       Int
  imageHeight      Int
  coordinateSystem String?
  registration     Json?                    // {points:[{px,py,easting,northing}], transform:[6]}
  perimeter        Json?                    // clip polygon in image space
}
```

Existing `Lot.chainageStart/End/offset` stay as the quick-entry fields; a
`chainage_offset` LotGeometry is auto-created from them when a control line exists
(backfill + on-save hook), so **every existing lot with chainage appears on the new views
with zero re-entry** — a migration story CivilPro can't offer its own customers.

## Phases (each independently shippable, each behind its own PR chain)

### Phase 0 — Strip view correctness (in flight, worktree ready)
Fix the defects found in review: canonical 8-status colours (Okabe-Ito, colour-blind safe)
+ legend from `LOT_STATUS_OVERVIEW_ITEMS`; lane-stacking for overlapping lots; nice-number
axis ticks (small jobs); "N lots without chainage" indicator; delete dead `statusColors`
prop + stale `LOT_STATUS_COLORS`. **1 PR. No migration.**

### Phase 1 — Control lines + coordinate engine
- Schema: `ControlLine`. CRUD routes + role gates (project_manager+; viewer read).
- proj4 service (backend `lib/spatial/`): local↔WGS84, EPSG presets, unit tests against
  known GDA2020 survey marks.
- UI: project settings → Control Lines tab; manual point grid; CSV/paste import.
- **AI import**: upload setout PDF → Gemini extracts (chainage, E, N) table + detects MGA
  zone from title block → user reviews table → save. Reuses cert-AI patterns.
- Chainage+offset → geometry generator (turf): lineSliceAlong + perpendicular offsets →
  polygon; auto AVL (area/length).
- Backfill: for projects with a control line, generate LotGeometry from existing lot
  chainage fields (default offsets from a per-project setting, e.g. ±6 m).
**~3 PRs (schema+engine, routes+UI, AI import). 1 migration.**

### Phase 2 — Basemap Lot Map
- New "Map" view toggle on Lot Register (list | card | linear | map).
- Lazy-loaded Leaflet: satellite/OSM switcher, lot polygons coloured by canonical status,
  same legend as strip, click → existing lot popup → drill-in, filters shared with the
  register (status/activity/chainage/subbie — already in `useLotFilters`).
- Project areas as tinted overlays (parity with strip).
- PNG export of current map view (html-to-image, already a dependency).
**~2-3 PRs. No migration.**

### Phase 3 — Plan sheets (the CivilPro headline)
- Schema: `PlanSheet`. Upload flow: pick existing document (or upload) → backend renders
  pages via pdf.js → PNGs to Supabase → sheet picker.
- Registration modal: click 2-3 points on sheet, enter grid coords or pick control-line
  chainages; least-squares affine; live residual error shown (better than CivilPro:
  they don't show registration error). AI-suggested coordinate system from title block.
- Perimeter clip tool (draw once per sheet).
- Plan viewer: sheet as base layer, lot polygons + status colours on top; draw-new-lot
  geometry directly on the sheet (leaflet-geoman) saved as `drawn` LotGeometry.
**~4 PRs. 1 migration.**

### Phase 4 — Spatial search, coverage, outputs
- Find-by-area: draw box on map/plan → lots, test results, photos (GPS-tagged uploads
  already store lat/long) within — results panel reusing register row components.
- **Coverage report**: per work type × control line: % lotted, % conformed, explicit gap
  ranges. Surfaced on map (hatched gaps) + as a PDF section in conformance packs.
- Map/plan snapshot → stored image attachable to conformance packs + claims ("Set as
  report default" parity).
- Test-result spatial context: lot geometry thumbnail on test request/cert detail.
**~3 PRs. No migration (snapshots reuse documents).**

### Phase 5 — Better-than extras (post pilot feedback)
Time scrubber (status-by-date from audit events); GeoPDF auto-registration; DXF/LandXML
control-line import; offline map tiles. Explicitly parked until a real user pulls.

## Test & verification strategy
- proj4 transforms: unit tests against published GDA2020 MGA survey-mark coordinates
  (Geoscience Australia known points) — exactness is the trust boundary of the whole module.
- Geometry generator: golden-file tests (chainage+offset in → GeoJSON out).
- Registration math: synthetic affine round-trip tests + residual assertions.
- Each phase: Playwright E2E on the new view with seeded fixture project ("SYD-roads"
  demo project already has chainage data).
- Every PR: type-check, scoped vitest, `fallow:audit`, guardrail suites
  (`productionReadiness`, route-auth coverage when backend routes added).

## Risks / constraints
- **Prod migrations** ×2 (Phases 1, 3): additive only, reviewed, applied via the
  established migration workflow — never `db push`.
- **Bundle size**: Leaflet + proj4 + turf lazy-loaded on map routes only; keep out of the
  core bundle (perf audit precedent).
- **PDF rendering load**: raster at upload time (async job), not view time; page-count cap.
- **Tile provider**: MapTiler free tier = 100k tiles/mo — fine for pilot scale; env-keyed.
- **Pilot collision**: Phases land behind the existing view-toggle pattern; the pilot
  user's core flows (diary/ITP/dockets) are untouched by any of this until Phase 2's new
  toggle appears.

## Sequencing vs the pilot (recommendation)
Phase 0 this weekend (pure fixes, de-risks the demo). Phase 1–2 build during pilot weeks 1–2
— control lines + basemap are additive and demo beautifully at the first check-in. Phase 3–4
follow. If pilot feedback screams elsewhere, phases are independently pausable.
