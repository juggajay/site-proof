# Research Brief: Victoria VicRoads ITP Templates — Complete Library

## Objective

We are building the Victorian ITP template library for SiteProof. These templates will be used by civil contractors working on Department of Transport and Planning (DTP, formerly VicRoads) projects in Victoria. They must be **accurate to the current VicRoads Section specifications**, reference the **correct clause numbers**, and cover **every activity type** a civil contractor would encounter on a Victorian road/bridge project.

We have **no existing Victorian templates** — this is a from-scratch build. We need complete data for every template listed below.

---

## Context

### Our Existing Libraries (For Reference)
We already have template libraries for:
- **NSW (TfNSW)**: 14 templates, 594 checklist items — based on TfNSW R-series and B-series specs
- **QLD (TMR/MRTS)**: In progress — based on MRTS specifications
- **Austroads (National)**: 6 baseline templates, 420 checklist items

The Victorian library must achieve **parity with NSW** at minimum, plus any VIC-specific requirements.

### Victorian Specification System
Victoria uses **VicRoads Section specifications** (e.g., Section 204, Section 407). These are published by the Department of Transport and Planning (DTP) and are available at:
- https://www.roads.vic.gov.au/design-and-technical/technical-publications

Key differences from other states:
- Specifications are numbered by "Section" (e.g., Section 204 — Earthworks)
- The authority is called the **"Superintendent"**
- Victoria has its own test methods (VicRoads RC series, e.g., RC 500.01) alongside AS standards
- VicRoads has a distinct approach to contract administration and quality assurance

---

## Templates Required

### Priority 1 — Core Civil Templates (Must Have for Launch)

| # | Template Name | Likely VicRoads Spec(s) | Notes |
|---|--------------|------------------------|-------|
| 1 | **Earthworks** (clearing, excavation, fill placement, compaction, subgrade prep) | Section 173 (Clearing), Section 204 (Earthworks) | Cover stripping, foundation prep, fill placement, compaction control, subgrade treatment, proof rolling |
| 2 | **Unbound Granular Pavements** (crushed rock base & subbase) | Section 401 (Unbound Flexible Pavement), Section 812 (Crushed Rock) | Material compliance, placement, compaction, level tolerance, proof rolling |
| 3 | **Cement Treated Crushed Rock (CTCR)** | Section 402 (Cement Treated Crushed Rock) | Mix design, placement, compaction, strength testing (UCS), curing |
| 4 | **Stabilised Pavements** (lime, cement, other binders — in-situ) | Section 404 (Stabilised Pavements) | Binder spread rate, mixing depth, compaction, UCS/CBR, curing |
| 5 | **Dense Graded Asphalt (DGA)** | Section 407 (Dense Graded Asphalt) | Mix design, placement temperature, compaction, air voids, thickness, ride quality |
| 6 | **Open Graded Asphalt (OGA)** | Section 410 (Open Graded Asphalt) or relevant section | Permeability, binder drain-down, compaction, texture depth |
| 7 | **Stone Mastic Asphalt (SMA)** | Section 409 (Stone Mastic Asphalt) or relevant section | If VicRoads has a separate SMA spec — fibre content, drain-down, compaction |
| 8 | **Sprayed Bituminous Surfacing** (seals, priming, primersealing) | Section 408 (Sprayed Bituminous Surfacing) | Primer application, binder spraying, aggregate spreading, embedment, texture |
| 9 | **Structural Concrete** (bridges, culverts, retaining walls, barriers) | Section 610 (Structural Concrete) | Mix design, pre-pour inspection, placement, curing, strength testing, crack assessment |
| 10 | **Reinforcement Placement** (for structural concrete) | Section 611 (Steel Reinforcement) | Scheduling, fixing, cover, lapping, couplers, pre-pour checklist |
| 11 | **Drainage — Pipe Installation** (stormwater, RCP, PVC, HDPE) | Section 306 (Stormwater Drainage) | Bedding, laying, jointing, backfill, mandrel/CCTV testing |
| 12 | **Drainage — Pits & Chambers** (junction pits, inlet/outlet structures) | Section 307 (Drainage Pits and Access Chambers) | Excavation, formwork, concrete, covers, connections, invert channels |
| 13 | **Drainage — Culverts** (box culverts, pipe culverts, headwalls) | Section 306/610 or specific culvert section | Foundation, placement/casting, jointing, waterproofing, backfill |
| 14 | **Drainage — Subsoil/Subsurface** (ag drains, filter drains) | Section 306 or relevant section | Trench, filter material, pipe grade, geotextile, outlet |
| 15 | **Piling** (bored, CFA, driven — bridge/structure foundations) | Section 620 (Piling) or relevant section | Installation, integrity testing (PDA/PIT/CSL), concrete, cutoff, load testing |

### Priority 2 — Common Activity Templates (Needed for Complete Coverage)

| # | Template Name | Likely VicRoads Spec(s) | Notes |
|---|--------------|------------------------|-------|
| 16 | **Concrete Pavement** (rigid pavement, if used in VIC) | Section 403 (Concrete Pavement) | Subbase prep, formwork/slipform, dowels, placement, texturing, curing, joint sawing |
| 17 | **Road Furniture — Wire Rope Safety Barrier** | Section 710 or relevant section | Post installation, cable tensioning, anchor blocks, end terminals |
| 18 | **Road Furniture — W-Beam Guard Fence** | Section 710 or relevant section | Post embedment depth, rail fixing, end treatments, delineation |
| 19 | **Road Furniture — Concrete Barrier** (F-type, New Jersey) | Section 701 or relevant section | Foundation, formwork, concrete, steel, joints, reflectors |
| 20 | **Pavement Marking** (linemarking, thermoplastic, raised pavement markers) | Section 702 (Pavement Marking) | Surface prep, application rates, retroreflectivity (RC 500.01), adhesion, RPM alignment |
| 21 | **Kerb & Channel** (barrier, semi-mountable, mountable) | Section 703 (Kerb and Channel) or relevant section | Subgrade prep, formwork/extrusion, concrete, joints, finish, curing |
| 22 | **Fencing** (boundary, fauna, noise walls) | Section 701 or relevant section | Post installation, wire tensioning, gates, noise wall panels |
| 23 | **Erosion & Sediment Control** | Section 160 (ESC) or relevant section | Silt fences, sediment basins, rock check dams, stabilised entries, maintenance & monitoring |
| 24 | **Landscaping & Revegetation** | Section 801 (Landscaping) or relevant section | Topsoil, seeding, planting, mulching, watering, establishment period |
| 25 | **Geosynthetics** (geotextiles, geogrids, geomembranes) | Section 204 Annexure or relevant section | Material verification, overlap, seaming, cover placement |
| 26 | **Reinforced Soil Structures** (MSE walls, reinforced slopes) | Relevant section or project-specific | Foundation, reinforcement layers, facing, compaction, drainage |

### Priority 3 — Specialist Templates (Include If Applicable)

| # | Template Name | Likely VicRoads Spec(s) | Notes |
|---|--------------|------------------------|-------|
| 27 | **Structural Steelwork** (bridge beams, sign gantries) | Section 630 (Structural Steelwork) or relevant | Fabrication QA, welding NDE, surface prep, protective coatings, erection |
| 28 | **Bridge Bearings** | Section 620 or relevant section | Bearing pad, levelling, grouting, load transfer |
| 29 | **Precast Concrete Elements** (beams, panels, segments) | Section 610 (precast clauses) | Factory QA, storage, transport, erection, grouting |
| 30 | **Post-Tensioning** (bridges, slabs) | Section 610/relevant section | Duct installation, stressing, elongation checks, grouting |
| 31 | **Bridge Deck Waterproofing** | Relevant section | Surface prep, membrane application, adhesion testing, protection layer |
| 32 | **Warm Mix Asphalt / Recycled Asphalt** | If VicRoads has separate specs | Temperature requirements, RAP content verification |

---

## Exact Data Required Per Template

For each template, provide the following in a structured format. **This is critical** — we are converting these directly into database records.

### Template Header
```
Template Name: [e.g., "Drainage — Pipe Installation"]
Activity Type: [one of: earthworks, pavement_unbound, pavement_bound, pavement_concrete, asphalt, asphalt_prep, drainage, structures, road_furniture, landscaping, erosion_control, geosynthetics, other]
Specification Reference: [e.g., "VicRoads Section 306"]
Edition/Revision Date: [e.g., "July 2023"]
```

### Checklist Items (For Each Item)
```
Item #: [sequential]
Description: [What the contractor must do or demonstrate — written as an action/verification statement]
Acceptance Criteria: [Measurable pass/fail criteria — include specific values, tolerances, percentages]
Point Type: [one of: "hold_point", "witness", "standard"]
Responsible Party: [one of: "contractor", "superintendent", "client", "subcontractor"]
Evidence Required: [one of: "document", "photo", "test_result", "inspection"]
Test Type: [The specific test standard if applicable, e.g., "AS 1289.5.4.1" or "RC 500.01" or null if not a test]
Notes: [Clause reference and any additional context, e.g., "Clause 204.07 — Superintendent approval required"]
```

### Definitions for Point Types
- **hold_point**: Work MUST STOP and cannot proceed until the Superintendent formally releases the hold. These are the most critical quality gates. Examples: foundation acceptance before covering, mix design approval before placement, formwork/rebar inspection before pour.
- **witness**: The Superintendent must be NOTIFIED and given the opportunity to attend/observe, but work CAN proceed if they don't attend (after the notification period expires). Examples: proof rolling, trial sections, sampling operations.
- **standard**: Routine verification by the Contractor's own QA team. No formal notification or hold required, but records must be kept. Examples: daily compaction testing, moisture checks, visual inspections, survey checks.

---

## Important Requirements

### 1. Clause Accuracy
Every hold point and witness point **must reference the exact VicRoads Section clause number** from the current edition. Do not guess — if a clause number cannot be confirmed, flag it as "[VERIFY]".

### 2. Current Editions Only
Use the **latest published edition** of each VicRoads Section specification. Check:
- https://www.roads.vic.gov.au/design-and-technical/technical-publications
- VicRoads Standard Specifications for Roadworks and Bridgeworks

### 3. VIC-Specific Terminology & Test Methods
- The authority is called **"Superintendent"** in Victoria
- Use **VicRoads RC test method numbers** where they exist (e.g., RC 500.01 Retroreflectivity, RC T144 Setting Time)
- Also reference AS/NZS standards where VicRoads specs call them out
- Reference VicRoads standard drawings where applicable (e.g., SD series)
- Note where VicRoads specs differ from Austroads guidance

### 4. Complete Item Coverage Per Template
Each template should cover the **full lifecycle** of that activity:
1. **Pre-work submissions** (construction procedures, quality plans, mix designs, method statements)
2. **Material verification** (source approval, compliance testing, certificates, quarry registration)
3. **Pre-placement checks** (foundation/substrate inspection, set-out survey, formwork/rebar)
4. **During construction** (layer-by-layer testing, temperature monitoring, placement checks)
5. **Post-construction verification** (final testing, proof rolling, level surveys, CCTV, cores)
6. **Documentation** (as-built records, test certificates, conformance reports)

### 5. Realistic Item Count
Based on our existing template libraries as a benchmark:
- Simple templates (subsoil drainage, fencing, ESC): 15–25 items
- Medium templates (pavements, asphalt, drainage pipes): 30–45 items
- Complex templates (structural concrete, piling, box culverts): 45–65 items

Do not pad with trivial items, but do not under-represent either. Every real-world quality gate should be captured.

### 6. Test Methods & Frequencies
For each template, include a summary section listing:
- All referenced test methods (VicRoads RC series, AS/NZS standards)
- Typical test frequencies (per lot, per m², per day, per pour)
- Key acceptance values (compaction %, strength values, tolerances, air voids)

This helps us populate the `acceptanceCriteria` and `notes` fields accurately.

### 7. VicRoads-Specific Quality System
Victoria's contract administration may have specific requirements around:
- **Conformance reports** — format and timing
- **Lot-based acceptance** — how lots are defined for each activity
- **Reduced testing levels** — when contractors can move from normal to reduced frequency
- **Non-conformance procedures** — how NCRs are raised and closed

Note any such requirements that should be reflected in checklist items.

---

## Deliverable Format

Please return one document per template (or one consolidated document), structured exactly as above. Group by priority:

1. **Priority 1** (Templates 1–15): Core civil — needed immediately
2. **Priority 2** (Templates 16–26): Common activities — needed for complete coverage
3. **Priority 3** (Templates 27–32): Specialist — include if confirmed relevant

---

## NSW Parity Reference

Our NSW template library currently includes these templates. The VIC library should cover equivalent activities:

| NSW Template | Activity Type | Items | VIC Equivalent Needed |
|-------------|---------------|-------|----------------------|
| Earthworks (TfNSW R44) | earthworks | 38 | Section 204 |
| Unbound Granular Pavement (R71/3051) | pavement_unbound | 28 | Section 401 |
| Cement Treated Base (R73) | pavement_bound | 42 | Section 402 |
| Lean Mix Concrete Subbase (R82) | pavement_bound | 39 | Check VIC equivalent |
| Concrete Pavement Base (R83) | pavement_concrete | 52 | Section 403 |
| Dense Graded Asphalt (R116) | asphalt | 60 | Section 407 |
| Prime and Primerseal | asphalt_prep | 22 | Section 408 (priming) |
| Pipe Installation (R11) | drainage | 40 | Section 306 |
| Drainage Pits & Chambers (R11) | drainage | 26 | Section 307 |
| Box Culvert Construction (R11/B80) | drainage | 51 | Section 306/610 |
| Subsoil Drainage (R11/R44) | drainage | 18 | Section 306 |
| Piling (B51) | structures | 45 | Section 620 |
| Structural Concrete (B80) | structures | 65 | Section 610 |
| Reinforcement Placement (B80/AS3600) | structures | 35 | Section 611 |

**Plus VIC-specific additions:** OGA (Section 410), SMA (Section 409), road furniture, pavement marking, kerb & channel, ESC, landscaping, geosynthetics, reinforced soil.

---

## Questions to Resolve

1. What is the current VicRoads specification numbering — has the "Section XXX" format been retained under DTP, or has it changed?
2. Does VicRoads have a separate specification for Open Graded Asphalt (OGA) and Stone Mastic Asphalt (SMA), or are these covered within Section 407?
3. What VicRoads RC test methods are commonly referenced in ITPs? Please provide a complete list of RC methods relevant to civil construction.
4. How does VicRoads define "Lots" for acceptance testing purposes — is it per-activity or is there a standard lot size guide?
5. Are there VicRoads Technical Notes or Interim Advice Notes that modify standard ITP requirements?
6. Does VicRoads have specific requirements for geotechnical investigation ITPs (pre-construction)?
7. For bridge works, does VicRoads use its own bridge spec or reference AS 5100 primarily?
8. Is there a VicRoads-specific erosion and sediment control specification, or do VIC projects use EPA Victoria guidelines?
9. Are noise wall specifications covered under a general road furniture section, or do they have a dedicated spec?

---

## Timeline

We need this data to build the VIC template library alongside our QLD library. Please prioritise:
1. **Priority 1 templates** (earthworks, pavements, asphalt, drainage, structures) — needed for launch
2. **Priority 2 templates** (road furniture, marking, ESC, landscaping) — needed for complete coverage
3. **Priority 3 templates** (specialist structural) — can follow in a subsequent release
