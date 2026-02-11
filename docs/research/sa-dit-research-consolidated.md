# SA DIT ITP Template Research — Consolidated Summary

> 5 parallel research agents completed. All findings saved in `docs/research/sa-dit-*.md`.

---

## Phase 1: Framework Answers

| Question | Answer |
|----------|--------|
| **Spec numbering system** | Alphanumeric: `Category-Discipline-Type+Number` (e.g., `RD-EW-C1`). Legacy format was `Part R15`, `Part R27` etc. |
| **Authority terminology** | **Principal's Authorised Person** (NOT Superintendent). SA uses GC21 Edition 2 contract. |
| **Test methods** | SA has its own **TP series** (TP060–TP999, ~99 documents) alongside AS/NZS + Austroads. |
| **Relationship to Austroads** | Standalone documents that function as jurisdictional supplements to Austroads guides. |
| **Department name** | Department for Infrastructure and Transport (**DIT**), formed 7 Aug 2020, succeeding DPTI. |
| **`stateSpec` value** | **`'DIT'`** |
| **Quality system / Lots** | Lot = continuous section, uniform appearance, homogeneous materials, max 1 day's production. Governed by PC-QA1A/B and PC-QA2. |
| **Spec access URL** | https://www.dit.sa.gov.au/contractor-documents/master-specifications |
| **Current edition** | September 2024, with updates through March 2025. |
| **Spec count** | 130+ parts across 9 categories (Roads ~65, Structures ~30, Project Controls ~35). |

---

## Complete Template-to-Spec Mapping (All 32 Templates)

### Priority 1 — Core Civil Templates

| # | Template Name | SA DIT Spec(s) | Activity Type | Cross-State Equivalents |
|---|--------------|----------------|---------------|------------------------|
| 1 | **Earthworks** | **RD-EW-C1** (Construction of Earthworks) | `earthworks` | NSW R44 / QLD MRTS04 / VIC Sec 204 |
| 2 | **Unbound Granular Pavements** | **RD-PV-C1** (Construction) + **RD-PV-S1** (Supply) | `pavements` | NSW R71 / QLD MRTS05 / VIC Sec 304 |
| 3 | **Cement Treated Crushed Rock** | **RD-PV-S2** (Supply of Stabilised Material) | `pavements` | NSW R73 / QLD MRTS07B / VIC Sec 306 |
| 4 | **Stabilised Pavements (In-situ)** | **RD-PV-C3** (In-situ Stabilisation) | `pavements` | QLD MRTS07A / VIC Sec 307 |
| 5 | **Dense Graded Asphalt (DGA)** | **RD-BP-S2** (Supply) + **RD-BP-C3** (Construction) | `asphalt` | NSW R116 / QLD MRTS30 / VIC Sec 407 |
| 6 | **Open Graded Asphalt (OGA)** | **RD-BP-S2** + **RD-BP-C3** (within DGA specs) | `asphalt` | VIC Sec 417 |
| 7 | **Stone Mastic Asphalt (SMA)** | **RD-BP-S2** + **RD-BP-C3** (within DGA specs) | `asphalt` | QLD MRTS24 / VIC Sec 404 |
| 8 | **Sprayed Bituminous Surfacing** | **RD-BP-D2** (Design & Application) + **RD-BP-S1** (Binder Supply) | `asphalt` | NSW R106 / QLD MRTS11 / VIC Sec 408 |
| 9 | **Structural Concrete** | **ST-SC-S7** (Supply) + **ST-SC-C7** (Placement) + **ST-SC-C6** (Formwork) | `structural` | NSW B80 / QLD MRTS70 / VIC Sec 610/614 |
| 10 | **Reinforcement Placement** | **ST-SC-S6** (Steel Reinforcement) | `structural` | NSW B80 / QLD MRTS59/71 / VIC Sec 611 |
| 11 | **Drainage — Pipe Installation** | **RD-DK-C1** (Stormwater Drainage) + **RD-DK-S1** (Supply) + **RD-EW-C2** (Trench) | `drainage` | NSW R11 / QLD MRTS03/33 / VIC Sec 701 |
| 12 | **Drainage — Pits & Chambers** | **RD-DK-C1** (within stormwater drainage) | `drainage` | NSW R11 / QLD MRTS03 / VIC Sec 705 |
| 13 | **Drainage — Culverts** | **RD-DK-C1** + **RD-DK-S1** | `drainage` | NSW R11/B80 / QLD MRTS33/70 / VIC Sec 610 |
| 14 | **Drainage — Subsoil/Subsurface** | **RD-DK-C1** + **RD-DK-D1** (Road Drainage Design) | `drainage` | NSW R11/R44 / QLD MRTS03 / VIC Sec 702 |
| 15 | **Piling** | **ST-PI-C1** (Driven) / **ST-PI-C2** (Bored) / **ST-PI-C3** (CFA) / **ST-PI-C4** (D-walls) | `structural` | NSW B51 / QLD MRTS78 / VIC Sec 605-608 |

### Priority 2 — Common Activity Templates

| # | Template Name | SA DIT Spec(s) | Activity Type | Cross-State Equivalents |
|---|--------------|----------------|---------------|------------------------|
| 16 | **Concrete Pavement** | **RD-PV-D3** (Concrete Road Pavements) | `pavements` | NSW R83 / VIC Sec 503 |
| 17 | **Wire Rope Safety Barrier** | **RD-BF-C2** (WRSB Systems) | `road_furniture` | QLD MRTS16 / VIC Sec 711 |
| 18 | **W-Beam Guard Fence** | **RD-BF-C1** (Steel Beam Safety Barrier) | `road_furniture` | QLD MRTS18 / VIC Sec 708 |
| 19 | **Concrete Barrier** | **RD-BF-C3** (Concrete Safety Barrier) | `road_furniture` | QLD MRTS17 / VIC Sec 610 |
| 20 | **Pavement Marking** | **RD-LM-C1** (Application) + **RD-LM-S1** (Materials) | `road_furniture` | QLD MRTS15 / VIC Sec 721/722 |
| 21 | **Kerb & Channel** | **RD-DK-C2** (Kerbing) | `drainage` | QLD MRTS03 / VIC Sec 703 |
| 22 | **Fencing** | **RD-BF-C4** (Fencing and Gates) | `road_furniture` | QLD MRTS14 / VIC Sec 707/765 |
| 23 | **Erosion & Sediment Control** | **EHTM** + **EPA SA** + **PR-LS-C5** (Erosion Control Matting) | `environmental` | QLD MRTS51/52 / VIC Sec 176/177 |
| 24 | **Landscaping & Revegetation** | **PR-LS-C2** (Planting) + **PR-LS-C6** (Seeding) + **PR-LS-C7** (Topsoil) + 9 more | `environmental` | QLD MRTS34 / VIC Sec 720 |
| 25 | **Geosynthetics** | **RD-EW-S1** (Supply of Geotextiles) | `environmental` | QLD MRTS04 Ann / VIC Sec 210 |
| 26 | **Reinforced Soil Structures** | **ST-RE-C1** (Reinforced Soil Structures) | `environmental` | QLD MRTS06 / VIC Sec 682 |

### Priority 3 — Specialist Templates

| # | Template Name | SA DIT Spec(s) | Activity Type | Cross-State Equivalents |
|---|--------------|----------------|---------------|------------------------|
| 27 | **Structural Steelwork** | **ST-SS-S1** (Fabrication) + **ST-SS-S2** (Protective Treatment) + **ST-SS-C1** (Erection) | `structural` | QLD MRTS68 / VIC Sec 630 |
| 28 | **Bridge Bearings** | **ST-SD-D1** (Design of Structures) + project-specific | `structural` | QLD MRTS65 / VIC Sec 656 |
| 29 | **Precast Concrete Elements** | **ST-SC-S3** (Precast Units) + **ST-SC-C1** (Pre-Tensioned) + **ST-SS-C1** (Erection) | `structural` | QLD MRTS70 / VIC Sec 620 |
| 30 | **Post-Tensioning** | **ST-SC-C2** (Post-Tensioned Concrete) | `structural` | QLD MRTS63 / VIC Sec 612 |
| 31 | **Bridge Deck Waterproofing** | **ST-SD-D1** + project-specific (no standalone spec) | `structural` | VIC Sec 691 |
| 32 | **Warm Mix / Recycled Asphalt** | **RD-BP-S2** (within DGA supply spec) | `asphalt` | QLD MRTS32/35 / VIC Sec 407/TN107 |

---

## SA-Specific Highlights (vs Other States)

### Unique to SA
1. **Authority = "Principal's Authorised Person"** — all other states use "Superintendent"
2. **Contract form = GC21 Edition 2** — originally NSW contract, not AS4000/AS2124
3. **SA Test Procedures (TP series)** — 99 documents, e.g., TP 320 (compaction), TP 913 (DFT)
4. **Granular spec numbering** — specs split into Supply (S), Construction (C), Design (D), Maintenance (M)
5. **Most granular landscaping specs** — 12+ separate parts vs single specs in other states
6. **Piling split into 4 separate specs** — ST-PI-C1 through C4 by pile type

### Gaps vs Other States
1. **No standalone pits specification** — pits covered within RD-DK-C1
2. **No standalone OGA/SMA specs** — within RD-BP-S2/C3
3. **No standalone bridge bearings construction spec** — design only in ST-SD-D1
4. **No standalone waterproofing spec** — project-specific
5. **No standalone noise wall spec** — project-specific
6. **No single ESC document** — multi-document approach (EHTM + EPA SA)

### Key SA Test Methods Referenced
| TP Number | Description | Equivalent |
|-----------|-------------|------------|
| TP 320 | Dry Density Ratio, Moisture Variation and Moisture Ratio | AS 1289.5.4.1 + SA-specific |
| TP 913 | Dry Film Thickness measurement | SA-specific |
| TP 060–999 | Full series (~99 documents) | Mix of AS/NZS supplements and SA-specific |

---

## Questions from Brief — Resolved

| # | Question | Answer |
|---|----------|--------|
| 1 | DIT specification numbering system? | `Category-Discipline-Type+Number` (e.g., RD-EW-C1) |
| 2 | Authority title? | **Principal's Authorised Person** |
| 3 | SA test method series? | **Yes — TP series** (TP060–TP999, ~99 documents) |
| 4 | Standalone or Austroads supplements? | **Standalone** documents that reference Austroads |
| 5 | Separate OGA/SMA specs? | **No** — within RD-BP-S2/C3 |
| 6 | Lot definition? | Continuous section, uniform, homogeneous, max 1 day's production |
| 7 | Geotech investigation ITP? | Not a standard spec — project-specific |
| 8 | Bridge spec or AS 5100? | DIT structural specs (ST-series) + references AS 5100 |
| 9 | ESC specification? | Multi-document: EHTM + EPA SA + PR-LS-C5 |
| 10 | Noise wall spec? | No dedicated spec — project-specific |
| 11 | `stateSpec` value? | **`'DIT'`** |

---

## Research Documents

| File | Content | Lines |
|------|---------|-------|
| `sa-dit-phase1-framework.md` | Spec system, authority, test methods, quality system | ~586 |
| `sa-dit-earthworks-pavements.md` | Templates 1-4, 16 — earthworks & pavements | ~583 |
| `sa-dit-asphalt-surfacing.md` | Templates 5-8, 32 — asphalt & seals | ~400+ |
| `sa-dit-drainage-structures.md` | Templates 9-15, 27-31 — drainage & structures | ~808 |
| `sa-dit-furniture-environmental.md` | Templates 17-26 — road furniture & environmental | ~500+ |

---

## Next Steps

1. **Download actual DIT PDFs** to verify exact clause numbers (website blocked direct scraping — browser download required)
2. **Build seed scripts** — convert each template's checklist items into database records (follow pattern of existing QLD/VIC seed scripts)
3. **Confirm TP series test method numbers** — cross-reference with DIT test procedure catalogue
4. **Handle spec gaps** — for templates 28 (bearings), 31 (waterproofing), and noise walls, decide whether to build from AS 5100 / project-typical requirements or omit
