# Research Brief: South Australia DIT ITP Templates — Complete Library

## Objective

We are building the South Australian ITP template library for SiteProof. These templates will be used by civil contractors working on Department for Infrastructure and Transport (DIT, formerly DPTI) projects in South Australia. They must be **accurate to the current DIT standard specifications**, reference the **correct clause numbers**, and cover **every activity type** a civil contractor would encounter on an SA road/bridge project.

We have **no existing South Australian templates** — this is a from-scratch build. We need complete data for every template listed below.

---

## Context

### Our Existing Libraries (For Reference)
We already have template libraries for:
- **NSW (TfNSW)**: 14 templates, 594 checklist items — based on TfNSW R-series and B-series specs
- **QLD (TMR/MRTS)**: 32 templates — based on MRTS specifications
- **VIC (VicRoads)**: 32 templates — based on VicRoads Section specifications
- **Austroads (National)**: 6 baseline templates, 420 checklist items

The SA library must achieve **parity with NSW/VIC/QLD** at minimum, plus any SA-specific requirements.

### South Australian Specification System
South Australia uses **DIT standard specifications** (formerly DPTI). These are published by the Department for Infrastructure and Transport and are typically available at:
- https://dit.sa.gov.au/standards_and_specifications
- https://www.dpti.sa.gov.au/standards (legacy URL, may redirect)

Key things we need to confirm:
- **Specification numbering system** — Does SA use "Part" numbering (e.g., Part R15, Part R27), a numbered section system (like VicRoads), or an MRTS-style system?
- **Authority terminology** — Is the authority called the **"Superintendent"**, **"Principal"**, **"Principal's Representative"**, or something else?
- **Test methods** — Does SA have its own state-specific test method series (like VicRoads RC or TMR Q series), or does it rely primarily on AS/NZS and Austroads methods?
- **Relationship to Austroads** — How closely do DIT specs follow Austroads guidance? Are they supplements/amendments to Austroads, or standalone documents?

---

## Templates Required

### Priority 1 — Core Civil Templates (Must Have for Launch)

| # | Template Name | Likely DIT Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 1 | **Earthworks** (clearing, excavation, fill placement, compaction, subgrade prep) | [IDENTIFY] Earthworks spec | Cover stripping, foundation prep, fill placement, compaction control, subgrade treatment, proof rolling |
| 2 | **Unbound Granular Pavements** (crushed rock base & subbase) | [IDENTIFY] Unbound pavement spec | Material compliance, placement, compaction, level tolerance, proof rolling |
| 3 | **Cement Treated Crushed Rock / Bound Pavements** (cement or lime stabilised base) | [IDENTIFY] Bound pavement spec | Mix design, placement, compaction, strength testing (UCS), curing |
| 4 | **Stabilised Pavements** (lime, cement, other binders — in-situ) | [IDENTIFY] Stabilisation spec | Binder spread rate, mixing depth, compaction, UCS/CBR, curing |
| 5 | **Dense Graded Asphalt (DGA)** | [IDENTIFY] DGA spec | Mix design, placement temperature, compaction, air voids, thickness, ride quality |
| 6 | **Open Graded Asphalt (OGA)** | [IDENTIFY] OGA spec (may be within DGA spec) | Permeability, binder drain-down, compaction, texture depth |
| 7 | **Stone Mastic Asphalt (SMA)** | [IDENTIFY] SMA spec (may be within DGA spec or separate) | Fibre content, drain-down, compaction |
| 8 | **Sprayed Bituminous Surfacing** (seals, priming, primersealing) | [IDENTIFY] Sprayed seal spec | Primer application, binder spraying, aggregate spreading, embedment, texture |
| 9 | **Structural Concrete** (bridges, culverts, retaining walls, barriers) | [IDENTIFY] Structural concrete spec | Mix design, pre-pour inspection, placement, curing, strength testing, crack assessment |
| 10 | **Reinforcement Placement** (for structural concrete) | [IDENTIFY] Reinforcement spec | Scheduling, fixing, cover, lapping, couplers, pre-pour checklist |
| 11 | **Drainage — Pipe Installation** (stormwater, RCP, PVC, HDPE) | [IDENTIFY] Drainage pipe spec | Bedding, laying, jointing, backfill, mandrel/CCTV testing |
| 12 | **Drainage — Pits & Chambers** (junction pits, inlet/outlet structures) | [IDENTIFY] Drainage pits spec | Excavation, formwork, concrete, covers, connections, invert channels |
| 13 | **Drainage — Culverts** (box culverts, pipe culverts, headwalls) | [IDENTIFY] Culvert spec | Foundation, placement/casting, jointing, waterproofing, backfill |
| 14 | **Drainage — Subsoil/Subsurface** (ag drains, filter drains) | [IDENTIFY] Subsurface drainage spec | Trench, filter material, pipe grade, geotextile, outlet |
| 15 | **Piling** (bored, CFA, driven — bridge/structure foundations) | [IDENTIFY] Piling spec | Installation, integrity testing (PDA/PIT/CSL), concrete, cutoff, load testing |

### Priority 2 — Common Activity Templates (Needed for Complete Coverage)

| # | Template Name | Likely DIT Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 16 | **Concrete Pavement** (rigid pavement, if used in SA) | [IDENTIFY] Concrete pavement spec | Subbase prep, formwork/slipform, dowels, placement, texturing, curing, joint sawing |
| 17 | **Road Furniture — Wire Rope Safety Barrier** | [IDENTIFY] WRSB spec | Post installation, cable tensioning, anchor blocks, end terminals |
| 18 | **Road Furniture — W-Beam Guard Fence** | [IDENTIFY] Guard fence spec | Post embedment depth, rail fixing, end treatments, delineation |
| 19 | **Road Furniture — Concrete Barrier** (F-type, New Jersey) | [IDENTIFY] Concrete barrier spec | Foundation, formwork, concrete, steel, joints, reflectors |
| 20 | **Pavement Marking** (linemarking, thermoplastic, raised pavement markers) | [IDENTIFY] Pavement marking spec | Surface prep, application rates, retroreflectivity, adhesion, RPM alignment |
| 21 | **Kerb & Channel** (barrier, semi-mountable, mountable) | [IDENTIFY] Kerb and channel spec | Subgrade prep, formwork/extrusion, concrete, joints, finish, curing |
| 22 | **Fencing** (boundary, fauna, noise walls) | [IDENTIFY] Fencing spec | Post installation, wire tensioning, gates, noise wall panels |
| 23 | **Erosion & Sediment Control** | [IDENTIFY] ESC spec (may be EPA SA guidelines) | Silt fences, sediment basins, rock check dams, stabilised entries, maintenance & monitoring |
| 24 | **Landscaping & Revegetation** | [IDENTIFY] Landscaping spec | Topsoil, seeding, planting, mulching, watering, establishment period |
| 25 | **Geosynthetics** (geotextiles, geogrids, geomembranes) | [IDENTIFY] Geosynthetics spec | Material verification, overlap, seaming, cover placement |
| 26 | **Reinforced Soil Structures** (MSE walls, reinforced slopes) | [IDENTIFY] RSS/MSE spec (may be project-specific) | Foundation, reinforcement layers, facing, compaction, drainage |

### Priority 3 — Specialist Templates (Include If Applicable)

| # | Template Name | Likely DIT Spec(s) | Notes |
|---|--------------|-------------------|-------|
| 27 | **Structural Steelwork** (bridge beams, sign gantries) | [IDENTIFY] Steelwork spec | Fabrication QA, welding NDE, surface prep, protective coatings, erection |
| 28 | **Bridge Bearings** | [IDENTIFY] Bearings spec | Bearing pad, levelling, grouting, load transfer |
| 29 | **Precast Concrete Elements** (beams, panels, segments) | [IDENTIFY] Precast spec | Factory QA, storage, transport, erection, grouting |
| 30 | **Post-Tensioning** (bridges, slabs) | [IDENTIFY] PT spec | Duct installation, stressing, elongation checks, grouting |
| 31 | **Bridge Deck Waterproofing** | [IDENTIFY] Waterproofing spec | Surface prep, membrane application, adhesion testing, protection layer |
| 32 | **Warm Mix Asphalt / Recycled Asphalt** | [IDENTIFY] WMA/RAP spec (if separate from DGA) | Temperature requirements, RAP content verification |

---

## Exact Data Required Per Template

For each template, provide the following in a structured format. **This is critical** — we are converting these directly into database records.

### Template Header
```
Template Name: [e.g., "Drainage — Pipe Installation"]
Activity Type: [one of: earthworks, pavements, asphalt, drainage, structural, road_furniture, environmental]
Specification Reference: [e.g., "DIT Part R15" or whatever SA's format is]
Edition/Revision Date: [e.g., "July 2023"]
```

**Important — Activity Type Mapping:**
Use these exact `activityType` values (they match our database schema):

| activityType | Covers |
|-------------|--------|
| `earthworks` | Clearing, excavation, fill, compaction, subgrade |
| `pavements` | Unbound, bound, stabilised, concrete pavements |
| `asphalt` | DGA, OGA, SMA, sprayed seals, WMA |
| `drainage` | Pipes, pits, culverts, subsoil, kerb & channel |
| `structural` | Concrete, reinforcement, piling, steelwork, bearings, precast, post-tensioning, waterproofing |
| `road_furniture` | Barriers, guard fence, marking, fencing |
| `environmental` | ESC, landscaping, geosynthetics, reinforced soil |

### Checklist Items (For Each Item)
```
Item #: [sequential]
Description: [What the contractor must do or demonstrate — written as an action/verification statement]
Acceptance Criteria: [Measurable pass/fail criteria — include specific values, tolerances, percentages]
Point Type: [one of: "hold_point", "witness", "standard"]
Responsible Party: [one of: "contractor", "superintendent", "client", "subcontractor"]
Evidence Required: [one of: "document", "photo", "test", "inspection", "signature"]
Test Type: [The specific test standard if applicable, e.g., "AS 1289.5.4.1" or null if not a test]
Notes: [Clause reference and any additional context]
```

### Definitions for Point Types
- **hold_point**: Work MUST STOP and cannot proceed until the authority (Superintendent/Principal/Principal's Representative) formally releases the hold. These are the most critical quality gates. Examples: foundation acceptance before covering, mix design approval before placement, formwork/rebar inspection before pour.
- **witness**: The authority must be NOTIFIED and given the opportunity to attend/observe, but work CAN proceed if they don't attend (after the notification period expires). Examples: proof rolling, trial sections, sampling operations.
- **standard**: Routine verification by the Contractor's own QA team. No formal notification or hold required, but records must be kept. Examples: daily compaction testing, moisture checks, visual inspections, survey checks.

---

## Important Requirements

### 1. FIRST PRIORITY — Identify the SA Specification System
Before extracting template data, we need to **map out the SA specification landscape**. Please provide:

1. **Complete list of DIT standard specifications** relevant to civil road/bridge construction
2. **Specification numbering format** (e.g., "Part R15", "Section 204", "Spec 1234")
3. **Where to access** current editions (URLs)
4. **Amendment/revision history** — how often are they updated?
5. **Relationship to Austroads** — are DIT specs standalone, or supplements to Austroads?
6. **Authority terminology** — who signs off hold points? ("Superintendent", "Principal", "Principal's Representative"?)
7. **SA-specific test methods** — does SA have its own test method series, or rely on AS/NZS + Austroads?
8. **Quality system** — how does SA define lots, acceptance criteria, and reduced testing levels?

### 2. Clause Accuracy
Every hold point and witness point **must reference the exact DIT specification clause number** from the current edition. Do not guess — if a clause number cannot be confirmed, flag it as "[VERIFY]".

### 3. Current Editions Only
Use the **latest published edition** of each DIT specification. Check the DIT website for current versions.

### 4. SA-Specific Terminology & Test Methods
- Confirm and use the correct **authority title** consistently
- Use any **SA-specific test method numbers** if they exist, alongside AS/NZS standards
- Reference DIT standard drawings where applicable
- Note where DIT specs differ from Austroads guidance or from other states (QLD/VIC/NSW)

### 5. Complete Item Coverage Per Template
Each template should cover the **full lifecycle** of that activity:
1. **Pre-work submissions** (construction procedures, quality plans, mix designs, method statements)
2. **Material verification** (source approval, compliance testing, certificates)
3. **Pre-placement checks** (foundation/substrate inspection, set-out survey, formwork/rebar)
4. **During construction** (layer-by-layer testing, temperature monitoring, placement checks)
5. **Post-construction verification** (final testing, proof rolling, level surveys, CCTV, cores)
6. **Documentation** (as-built records, test certificates, conformance reports)

### 6. Realistic Item Count
Based on our existing template libraries as a benchmark:
- Simple templates (subsoil drainage, fencing, ESC): 15–25 items
- Medium templates (pavements, asphalt, drainage pipes): 30–45 items
- Complex templates (structural concrete, piling, box culverts): 45–65 items

Do not pad with trivial items, but do not under-represent either. Every real-world quality gate should be captured.

### 7. Test Methods & Frequencies
For each template, include a summary section listing:
- All referenced test methods (SA-specific if any, AS/NZS standards, Austroads methods)
- Typical test frequencies (per lot, per m², per day, per pour)
- Key acceptance values (compaction %, strength values, tolerances, air voids)

This helps us populate the `acceptanceCriteria` and `notes` fields accurately.

---

## Deliverable Format

Please deliver the research in **two phases**:

### Phase 1: Framework Document (Deliver First)
Answer all questions from Section "1. FIRST PRIORITY" above. This gives us the specification map before diving into individual templates. Structure as:
- Complete spec list with numbers, titles, and current edition dates
- SA test method catalogue (if any)
- Authority terminology confirmation
- Quality system overview
- Corrections to any assumed spec numbers in the template table above

### Phase 2: Template Data (One Document Per Activity Group)
Group templates by activity type and deliver one research document per group:
1. **Earthworks** (Template 1)
2. **Pavements** (Templates 2, 3, 4, 16)
3. **Asphalt** (Templates 5, 6, 7, 8, 32)
4. **Drainage** (Templates 11, 12, 13, 14, 21)
5. **Structures** (Templates 9, 10, 15, 27, 28, 29, 30, 31)
6. **Road Furniture** (Templates 17, 18, 19, 20, 22)
7. **Environmental** (Templates 23, 24, 25, 26)

Each document should contain all templates for that group with complete checklist items in the format specified above.

---

## Cross-State Parity Reference

Our other state libraries currently include these templates. The SA library should cover equivalent activities:

| Activity | NSW (TfNSW) | QLD (MRTS) | VIC (VicRoads) | SA (DIT) — Needed |
|----------|------------|------------|----------------|-------------------|
| Earthworks | R44 | MRTS04 | Sec 204 | [IDENTIFY] |
| Unbound Pavements | R71/3051 | MRTS05 | Sec 304 | [IDENTIFY] |
| Bound Pavements | R73 | MRTS07B | Sec 306 | [IDENTIFY] |
| Stabilised Pavements | — | MRTS07A | Sec 307 | [IDENTIFY] |
| Concrete Pavement | R83 | — | Sec 503 | [IDENTIFY] |
| Dense Graded Asphalt | R116 | MRTS30 | Sec 407 | [IDENTIFY] |
| OGA | — | — | Sec 417 | [IDENTIFY] |
| SMA | — | MRTS24 | Sec 404 | [IDENTIFY] |
| Sprayed Seals | R106 | MRTS11 | Sec 408 | [IDENTIFY] |
| Structural Concrete | B80 | MRTS70 | Sec 610/614 | [IDENTIFY] |
| Reinforcement | B80 | MRTS59/71 | Sec 611 | [IDENTIFY] |
| Drainage — Pipes | R11 | MRTS03/33 | Sec 701 | [IDENTIFY] |
| Drainage — Pits | R11 | MRTS03 | Sec 705 | [IDENTIFY] |
| Drainage — Culverts | R11/B80 | MRTS33/70 | Sec 610/BTN016 | [IDENTIFY] |
| Drainage — Subsoil | R11/R44 | MRTS03 | Sec 702 | [IDENTIFY] |
| Piling | B51 | MRTS78 | Sec 605-608 | [IDENTIFY] |
| WRSB | — | MRTS16 | Sec 711 | [IDENTIFY] |
| W-Beam | — | MRTS18 | Sec 708 | [IDENTIFY] |
| Concrete Barrier | — | MRTS17 | Sec 610/BTN001 | [IDENTIFY] |
| Pavement Marking | — | MRTS15 | Sec 721/722 | [IDENTIFY] |
| Kerb & Channel | — | MRTS03 | Sec 703 | [IDENTIFY] |
| Fencing/Noise Walls | — | MRTS14 | Sec 707/765 | [IDENTIFY] |
| ESC | — | MRTS51/52 | Sec 176/177 | [IDENTIFY] |
| Landscaping | — | MRTS34 | Sec 720 | [IDENTIFY] |
| Geosynthetics | — | MRTS04 Ann | Sec 210 | [IDENTIFY] |
| Reinforced Soil | — | MRTS06 | Sec 682 | [IDENTIFY] |
| Structural Steelwork | — | MRTS68 | Sec 630 | [IDENTIFY] |
| Bridge Bearings | — | MRTS65 | Sec 656 | [IDENTIFY] |
| Precast | — | MRTS70 | Sec 620 | [IDENTIFY] |
| Post-Tensioning | — | MRTS63 | Sec 612 | [IDENTIFY] |
| Waterproofing | — | — | Sec 691 | [IDENTIFY] |
| WMA/Recycled | — | MRTS32/35 | Sec 407/TN107 | [IDENTIFY] |

**Goal: Full parity with VIC/QLD (32 templates), adapted for SA DIT specifications.**

---

## Questions to Resolve

1. What is the DIT specification numbering system? (e.g., "Part R15", "Section XXX", "Spec XXXX")
2. What is the correct authority title in SA contracts? ("Superintendent", "Principal", "Principal's Representative"?)
3. Does DIT have its own test method series (like VicRoads RC or TMR Q), or does SA rely purely on AS/NZS + Austroads?
4. Are DIT specs standalone documents or supplements/amendments to Austroads specifications?
5. Does SA have separate specs for OGA and SMA, or are all asphalt types within one specification?
6. How does DIT define "Lots" for acceptance testing purposes?
7. Does SA have specific requirements for geotechnical investigation ITPs (pre-construction)?
8. For bridge works, does DIT use its own bridge spec or reference AS 5100 primarily?
9. Is there a DIT-specific ESC specification, or do SA projects use EPA SA guidelines?
10. Are noise wall specifications covered under a general road furniture section, or do they have a dedicated spec?
11. What `stateSpec` value should we use in our database for SA? (We need a short identifier like 'DPTI', 'DIT', or 'SA_DIT')

---

## Timeline

We need this data to build the SA template library. Please prioritise:
1. **Phase 1 Framework Document** — needed first to map the spec landscape and answer the foundational questions
2. **Priority 1 templates** (earthworks, pavements, asphalt, drainage, structures) — needed for launch
3. **Priority 2 templates** (road furniture, marking, ESC, landscaping) — needed for complete coverage
4. **Priority 3 templates** (specialist structural) — can follow in a subsequent release
