# Research Brief: Queensland TMR/MRTS ITP Templates — Complete Library

## Objective

We are building the Queensland ITP template library for SiteProof. These templates will be used by civil contractors working on TMR (Transport and Main Roads) projects in Queensland. They must be **accurate to the current MRTS specifications**, reference the **correct clause numbers**, and cover **every activity type** a civil contractor would encounter on a QLD road/bridge project.

We already have a partial dataset covering 5 specs (MRTS04, MRTS05, MRTS07A/B, MRTS30/MRTS11, MRTS70). This brief requests the **remaining templates** plus verification of what we have.

---

## What We Already Have (Verify & Correct Only)

The following were extracted from an initial research pass. **Please verify** clause numbers, point types, and descriptions are current against the latest published MRTS editions. Flag any errors or missing items.

| # | Template Name | MRTS Spec | Status |
|---|--------------|-----------|--------|
| 1 | Earthworks (Fill, Compaction, Subgrade) | MRTS04 (March 2025) | Have — verify |
| 2 | Unbound Granular Pavements (Base & Subbase) | MRTS05 (July 2022) | Have — verify |
| 3 | Stabilised Pavements — Lime | MRTS07A (July 2024) | Have — verify |
| 4 | Stabilised Pavements — Cement | MRTS07B (July 2024) | Have — verify |
| 5 | Asphalt Pavements (Dense & Open Graded) | MRTS30 (March 2024) | Have — verify |
| 6 | Sprayed Bituminous Treatments (Seals) | MRTS11 (July 2025) | Have — verify |
| 7 | Structural Concrete (Bridges, Culverts, Retaining) | MRTS70 (July 2022) | Have — verify |

---

## What We Need (New Research Required)

### Priority 1 — Core Civil Templates (Must Have for Launch)

These are the activity types that appear on virtually every QLD road/bridge project. We need **complete ITP data** for each.

| # | Template Name | Likely MRTS Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 8 | **Drainage — Pipe Installation** (stormwater, culvert pipes, RCP/RRJ/PVC) | MRTS03, MRTS33 | Cover pipe bedding, laying, jointing, backfill, CCTV inspection, pressure/mandrel testing |
| 9 | **Drainage — Pits & Chambers** (junction boxes, inlet/outlet structures, headwalls) | MRTS03, MRTS70 | Formwork, concrete, cover slabs, step irons, connections |
| 10 | **Drainage — Box Culverts** (precast & cast-in-place) | MRTS33, MRTS70 | Foundation prep, placement/casting, jointing, backfill, waterproofing |
| 11 | **Drainage — Subsoil/Subsurface Drainage** (ag drains, filter drains, geotextile wrapped) | MRTS03 | Trench excavation, filter material, pipe grade, geotextile wrap, outlet connections |
| 12 | **Piling** (bored, CFA, driven — bridge/structure foundations) | MRTS78 (or MRTS70 piling clauses), MRTS59 | Pile installation, integrity testing (PDA/PIT), concrete placement, pile cutoff, load testing |
| 13 | **Reinforcement Placement** (for all structural concrete) | MRTS59, MRTS71 | Bar scheduling, fixing, cover, laps, couplers, welding, pre-pour inspection |
| 14 | **Concrete Pavement** (if TMR uses rigid pavement — check if applicable) | Check MRTS or Austroads | Subbase prep, forms, dowels/tie bars, concrete placement, texturing, curing, joint sawing |
| 15 | **Plant-Mixed Stabilised Pavements** | MRTS08 | Different from in-situ (MRTS07) — plant mixed, transported, placed, compacted |
| 16 | **Priming & Primersealing** (surface preparation before asphalt/seal) | MRTS11 (priming clauses) or separate | Prime coat application, curing, primerseal application rates |

### Priority 2 — Common Activity Templates (Needed for Complete Coverage)

| # | Template Name | Likely MRTS Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 17 | **Road Furniture — Steel Wire Rope Barrier** | MRTS16 | Post installation, cable tensioning, anchor blocks, end terminals |
| 18 | **Road Furniture — W-Beam Guard Fence** | MRTS18 | Post embedment, rail fixing, end treatments, delineation |
| 19 | **Road Furniture — Concrete Barrier** (Jersey barrier, F-type) | MRTS17 | Foundation, formwork, concrete, steel fixing, joint sealant, reflectors |
| 20 | **Pavement Marking** (linemarking, raised pavement markers) | MRTS15 | Surface prep, application rates, retroreflectivity testing, adhesion |
| 21 | **Fencing** (boundary, fauna, noise walls if applicable) | MRTS14 or project-specific | Post installation, wire tensioning, gates, fauna exclusion verification |
| 22 | **Erosion & Sediment Control** | MRTS51, MRTS52 | Silt fences, sediment basins, rock check dams, stabilised entries, monitoring |
| 23 | **Landscaping & Revegetation** | MRTS34 | Topsoil placement, seeding/planting, mulching, watering, establishment monitoring |
| 24 | **Kerb & Channel** (concrete kerb, mountable, barrier) | MRTS03 or MRTS70 / standard drawings | Subgrade prep, formwork, concrete placement, joint spacing, finish, curing |
| 25 | **Geosynthetics** (geotextiles, geogrids, geomembranes) | MRTS04 Annexure / MRTS06 | Material verification, overlap/anchoring, seam testing, cover placement |
| 26 | **Reinforced Soil Structures** (MSE walls, reinforced slopes) | MRTS06 | Foundation prep, reinforcement layers, facing panels, compaction, drainage behind wall |

### Priority 3 — Specialist Templates (Include If Applicable to QLD Civil)

| # | Template Name | Likely MRTS Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 27 | **Structural Steelwork** (bridge beams, sign gantries) | MRTS68 | Fabrication inspection, welding (NDE), surface prep, protective coatings, erection |
| 28 | **Bridge Bearings** | MRTS65 | Bearing pad placement, levelling, grouting, load transfer verification |
| 29 | **Precast Concrete Elements** (precast beams, panels, segments) | MRTS70 (precast clauses) | Factory QA, storage, transport, erection, grouting connections |
| 30 | **Post-Tensioning** (bridges, slabs) | MRTS63, MRTS70 | Duct installation, stressing sequence, elongation checks, grouting |
| 31 | **Stone Mastic Asphalt (SMA)** | MRTS24 | Separate from DGA — different mix design, placement, drain-down testing |
| 32 | **Warm Mix / Recycled Asphalt** | MRTS32, MRTS35 | If QLD TMR projects use these — different temperature requirements |

---

## Exact Data Required Per Template

For each template above, provide the following in a structured format. **This is critical** — we are converting these directly into database records.

### Template Header
```
Template Name: [e.g., "Drainage — Pipe Installation"]
Activity Type: [one of: earthworks, pavement_unbound, pavement_bound, pavement_concrete, asphalt, asphalt_prep, drainage, structures, road_furniture, landscaping, erosion_control, geosynthetics, other]
Specification Reference: [e.g., "TMR MRTS03 Rev X / MRTS33"]
Edition/Revision Date: [e.g., "July 2022"]
```

### Checklist Items (For Each Item)
```
Item #: [sequential]
Description: [What the contractor must do or demonstrate — written as an action/verification statement]
Acceptance Criteria: [Measurable pass/fail criteria — include specific values, tolerances, percentages]
Point Type: [one of: "hold_point", "witness", "standard"]
Responsible Party: [one of: "contractor", "superintendent", "client", "subcontractor"]
Evidence Required: [one of: "document", "photo", "test_result", "inspection"]
Test Type: [The specific test standard if applicable, e.g., "AS 1289.5.4.1" or null if not a test]
Notes: [Clause reference and any additional context, e.g., "Clause 9.4 MRTS04 — Administrator release required"]
```

### Definitions for Point Types
- **hold_point**: Work MUST STOP and cannot proceed until the Administrator (or Superintendent) formally releases the hold. These are the most critical quality gates. Examples: foundation acceptance before covering, mix design approval before placement.
- **witness**: The Administrator must be NOTIFIED and given the opportunity to attend/observe, but work CAN proceed if they don't attend (after the notification period). Examples: proof rolling, trial sections, sampling.
- **standard**: Routine verification by the Contractor's own QA team. No formal notification or hold required, but records must be kept. Examples: daily compaction testing, moisture checks, visual inspections.

---

## Important Requirements

### 1. Clause Accuracy
Every hold point and witness point **must reference the exact MRTS clause number** from the current edition. Do not guess — if a clause number cannot be confirmed, flag it as "[VERIFY]".

### 2. Current Editions Only
Use the **latest published edition** of each MRTS specification. TMR regularly updates these. Check:
- https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Specifications
- Category 2: Bridges and Structures
- Category 3: Roadworks, Drainage, Culverts and Geotechnical
- Category 5: Pavements, Subgrade and Surfacing

### 3. QLD-Specific Terminology
- The authority is called **"Administrator"** (not "Superintendent" as in NSW)
- Use TMR test method numbers where they exist (e.g., TMR Q115, TMR Q252, TMR Q723) rather than just AS numbers
- Reference TMR standard drawings where applicable
- Include Annexure references if the spec has project-specific annexures that modify hold/witness points

### 4. Complete Item Coverage Per Template
Each template should cover the **full lifecycle** of that activity:
1. **Pre-work submissions** (construction procedures, quality plans, mix designs)
2. **Material verification** (source approval, compliance testing, certificates)
3. **Pre-placement checks** (foundation/substrate inspection, set-out survey, formwork)
4. **During construction** (layer-by-layer testing, temperature monitoring, placement checks)
5. **Post-construction verification** (final testing, proof rolling, level surveys, CCTV)
6. **Documentation** (as-built records, test certificates, conformance reports)

### 5. Realistic Item Count
Based on our NSW templates as reference:
- Simple templates (subsoil drainage, fencing): 15–25 items
- Medium templates (pavements, asphalt, drainage pipes): 30–45 items
- Complex templates (structural concrete, piling, box culverts): 45–65 items

Do not pad with trivial items, but do not under-represent either. Every real-world quality gate should be captured.

### 6. Test Methods & Frequencies
For each template, include a summary section listing:
- All referenced test methods (TMR Q-series, AS/NZS standards)
- Typical test frequencies (per lot, per m², per day, per pour)
- Key acceptance values (compaction %, strength values, tolerances)

This helps us populate the `acceptanceCriteria` and `notes` fields accurately.

---

## Deliverable Format

Please return one document per template (or one consolidated document), structured exactly as above. Group by priority:

1. **Priority 1** (Templates 8–16): Core civil — needed immediately
2. **Priority 2** (Templates 17–26): Common activities — needed for complete coverage
3. **Priority 3** (Templates 27–32): Specialist — include if confirmed as TMR ITP requirements

For the **7 templates we already have** (1–7), provide a verification/corrections document noting any errors, missing items, or outdated clause references.

---

## Reference Material Provided

We have already extracted the ITP requirements from the following MRTS specs. This file is available at `docs/tmr-mrts-itp-raw.txt`:
- MRTS04 General Earthworks (March 2025)
- MRTS05 Unbound Pavements (July 2022)
- MRTS07A Insitu Stabilised Subgrades — Lime (July 2024)
- MRTS07B Insitu Stabilised Pavements — Cement (July 2024)
- MRTS30 Asphalt Pavements (March 2024)
- MRTS11 Sprayed Bituminous Treatments (July 2025)
- MRTS70 Concrete (July 2022)

**Use this as a starting point but cross-reference against the full published specs** for completeness. The extracted data may have formatting issues or truncated content.

---

## QLD vs NSW Template Parity Check

For reference, our NSW template library currently includes:

| NSW Template | Activity Type | Items | QLD Equivalent Needed |
|-------------|---------------|-------|----------------------|
| Earthworks (TfNSW R44) | earthworks | 38 | MRTS04 ✓ Have |
| Unbound Granular Pavement (R71/3051) | pavement_unbound | 28 | MRTS05 ✓ Have |
| Cement Treated Base (R73) | pavement_bound | 42 | MRTS07B ✓ Have |
| Lean Mix Concrete Subbase (R82) | pavement_bound | 39 | Check if QLD equivalent exists |
| Concrete Pavement Base (R83) | pavement_concrete | 52 | Check if QLD equivalent exists |
| Dense Graded Asphalt (R116) | asphalt | 60 | MRTS30 ✓ Have |
| Prime and Primerseal | asphalt_prep | 22 | MRTS11 partial ✓ |
| Pipe Installation (R11) | drainage | 40 | MRTS03/MRTS33 — NEED |
| Drainage Pits & Chambers (R11) | drainage | 26 | MRTS03 — NEED |
| Box Culvert Construction (R11/B80) | drainage | 51 | MRTS33/MRTS70 — NEED |
| Subsoil Drainage (R11/R44) | drainage | 18 | MRTS03 — NEED |
| Piling — Bored/CFA/Driven (B51) | structures | 45 | MRTS78/MRTS59 — NEED |
| Structural Concrete (B80) | structures | 65 | MRTS70 ✓ Have |
| Reinforcement Placement (B80/AS3600) | structures | 35 | MRTS59/MRTS71 — NEED |

**Goal: Full parity with NSW, plus QLD-specific additions (road furniture, marking, ESC, landscaping, etc.)**

---

## Timeline

We need this data to build and ship the QLD template library. Please prioritise:
1. **Priority 1 templates** (drainage, piling, reinforcement, etc.) — these are blocking launch
2. **Verification of existing 7 templates** — ensure accuracy before we seed them
3. **Priority 2 & 3** — can be added in a follow-up release

## Questions to Resolve

1. Does TMR have a rigid (concrete) pavement specification, or do QLD projects use Austroads for concrete pavement?
2. Is MRTS08 (Plant-Mixed Stabilised) commonly used on QLD TMR projects, or is in-situ stabilisation (MRTS07) the standard?
3. Are there any QLD-specific ITP requirements not covered by MRTS (e.g., TMR Technical Notes, project-specific Annexures that are standard practice)?
4. Does TMR require specific ITP formats or checklists that we should align with?
5. For drainage, does MRTS03 cover all pipe/pit/culvert work, or is MRTS33 the primary culvert spec?
