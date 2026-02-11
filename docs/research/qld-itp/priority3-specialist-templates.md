# Priority 3 Specialist ITP Templates - QLD TMR/MRTS

## Research Summary

**Date:** 2026-02-10
**Researcher:** Claude Opus 4.6 (AI-assisted)
**Status:** Research complete - specifications verified against TMR published documents

### Critical Corrections from Brief

The original brief referenced incorrect MRTS spec numbers for several templates. The corrected mappings are:

| Template | Brief Said | Actual MRTS |
|----------|-----------|-------------|
| 27. Structural Steelwork | MRTS68 | **MRTS78** (MRTS68 = Dynamic Testing of Piles) |
| 28. Bridge Bearings | MRTS65 | **MRTS81** (MRTS65 = Precast Prestressed Concrete Piles) |
| 29. Precast Concrete Elements | MRTS70 (precast clauses) | **MRTS72** + MRTS70 Section 16 |
| 30. Post-Tensioning | MRTS63 | **MRTS89** (MRTS63 = Cast-In-Place Piles) |
| 31. Stone Mastic Asphalt | MRTS24 | **MRTS30** (SMA clauses within Asphalt Pavements) |
| 32. Warm Mix / Recycled Asphalt | MRTS32, MRTS35 | **MRTS30** (WMA now mandatory for all mixes) + MRTS32 (EME2) + MRTS102 (RAP) |

### Key Questions Answered

**Q1: Are warm mix asphalt (WMA) and recycled asphalt (RAP) commonly used on QLD TMR projects?**

**YES - WMA is now MANDATORY.** As of March 2024, MRTS30 mandates the inclusion of a warm mix asphalt (WMA) additive in ALL asphalt mixes. Maximum manufacturing temperatures were reduced by 20 degrees C compared to pre-March 2024 specifications. This applies to DGA, OGA, and SMA mixes. RAP is permitted up to 15% by mass in EME2 mixes (MRTS32) and in DGA mixes per MRTS102. RAP usage is growing but is not yet mandatory. MRTS102 (Reclaimed Asphalt Pavement Material) was updated November 2025. MRTS35 (Recycled Material Blends for Pavements) was superseded in November 2018 and is no longer a current specification.

**Recommendation for Template 32:** Because WMA is now embedded in MRTS30 (mandatory for all mixes) rather than a separate specification, Template 32 should be restructured as "High Modulus Asphalt (EME2)" per MRTS32, which is the only separate asphalt specification that covers both WMA additives and RAP incorporation. Alternatively, WMA/RAP requirements can be incorporated as supplementary items within existing asphalt templates.

**Q2: Does TMR have specific requirements for SMA beyond standard MRTS30?**

YES. Within MRTS30, SMA has distinct requirements:
- Cellulose fibre mandatory, minimum 0.3% by mass of mix
- SMA10 and SMA14 nominal sizes specified
- Recycled glass fine aggregate prohibited in SMA
- Fine aggregates for SMA must be crushed
- Different air void targets (3-5% lab compacted vs 4-6% for AC)
- Drain-down testing required (Schellenberg method)
- Different binder requirements (PMB typically required)

**Q3: What NDE methods does TMR specify for structural steelwork welding?**

MRTS78 references AS/NZS 5131 for NDE requirements. For CC3 (major infrastructure - bridges):
- 100% visual inspection of all welds
- Magnetic Particle Testing (MT) or Liquid Penetrant Testing (PT) for surface defects
- Ultrasonic Testing (UT) or Radiographic Testing (RT) for volumetric defects in butt welds
- Inspection levels are in addition to 100% visual scanning
- NDE percentages scale with construction category per AS/NZS 5131 tables
- For CC2 (minor infrastructure): reduced NDE percentages apply
- Weld categories per AS/NZS 1554.1 (general) and AS/NZS 1554.5 (fatigue-loaded structures)

---

## Template 27: Structural Steelwork (Bridge Beams, Sign Gantries)

### Template Header
```
Template Name: Structural Steelwork - Fabrication, Coating & Erection
Activity Type: structures
Specification Reference: TMR MRTS78 Fabrication of Structural Steelwork
Edition/Revision Date: November 2020
Related Standards: AS/NZS 5131 (Structural Steelwork Fabrication), AS/NZS 1554.1 (Welding), AS/NZS 1554.5 (Fatigue Welding), AS 4100 (Steel Structures), AS/NZS 2312 (Protective Coatings)
```

### Checklist Items

**PHASE 1: PRE-FABRICATION**

```
Item #: 1
Description: Submit Fabricator's registration certificate (AS/NZS 5131 CC2 or CC3 as specified) to Administrator for acceptance
Acceptance Criteria: Valid registration certificate for required Construction Category provided minimum 10 business days before fabrication starts
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 Clause 5 — Fabricator must be registered to AS/NZS 5131 for the applicable CC level. CC2 = minor infrastructure; CC3 = major infrastructure (bridges). All clauses in AS/NZS 5131 using 'should' are replaced with 'shall' per MRTS78.
```

```
Item #: 2
Description: Submit fabrication Quality Plan including welding procedures, NDE plan, surface treatment plan, and inspection and test plan
Acceptance Criteria: Quality Plan addresses all requirements of AS/NZS 5131 and MRTS78; accepted by Administrator prior to fabrication
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 Clause 5.2 — Quality Plan shall include WPS, welder qualifications, NDE procedures, coating system details, and hold/witness points
```

```
Item #: 3
Description: Provide material test certificates for all steel to be used in fabrication, minimum 5 business days prior to fabrication start
Acceptance Criteria: Mill certificates provided for each heat/grade; minimum 2% of each size and grade tested (minimum 1 sample per size/grade); compliance with AS/NZS 3678 (plate) or AS/NZS 3679 (sections)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS/NZS 3678 / AS/NZS 3679 material testing
Notes: MRTS78 Clause 6 & TN60 — Material test certificates must be accepted before incorporating steel. Check Charpy impact values if specified for fracture-critical members.
```

```
Item #: 4
Description: Verify Welding Procedure Specifications (WPS) are qualified and welders hold current qualifications
Acceptance Criteria: WPS qualified per AS/NZS 1554.1 (or AS/NZS 1554.5 for fatigue-loaded); all welders hold current qualifications for the applicable welding process and position
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS/NZS 1554.1 / AS/NZS 1554.5 welder qualification
Notes: MRTS78 Clause 7 — MMA and FCA welding per AS/NZS 1554.1; submerged arc per AS/NZS 1554.1; FP (fatigue purpose) welding per AS/NZS 1554.5. Welder qualification records must be current.
```

**PHASE 2: CUTTING AND PREPARATION**

```
Item #: 5
Description: Verify material cutting is carried out in accordance with AS/NZS 5131 Clause 6.5.1
Acceptance Criteria: Cut surfaces free from notches, tears, or heat-affected defects; thermal cut edges ground smooth; cutting compliant with CC requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 Clause 6 — All butt weld preparation shall be prepared by machining, grinding, or thermal cutting followed by grinding
```

```
Item #: 6
Description: Inspect weld joint preparation (bevel angles, root gaps, root faces, cleanliness) prior to welding
Acceptance Criteria: Joint preparation matches WPS requirements; surfaces clean, dry, free of mill scale, rust, oil, or moisture within 50mm of weld zone
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual inspection per AS/NZS 5131
Notes: MRTS78 Clause 7 — Preparation by machining, grinding, or thermal cutting followed by grinding required for all butt weld preparation
```

```
Item #: 7
Description: Verify bolt holes are drilled (not punched) for CC3 applications, or punched and reamed for CC2 where permitted
Acceptance Criteria: Hole diameter within tolerance per AS 4100; no ovality > 1mm; burrs removed; match-marking verified for site connections
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 / AS/NZS 5131 Clause 6.6 — Bolt hole requirements per construction category
```

**PHASE 3: WELDING**

```
Item #: 8
Description: Perform pre-heat verification before welding (where required by WPS or for thick sections)
Acceptance Criteria: Preheat temperature meets WPS minimum; measured by contact thermometer or thermocouple at specified distance from weld zone
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature measurement per WPS
Notes: MRTS78 Clause 7 — Preheat per AS/NZS 1554 and WPS. Critical for sections > 25mm thick or high-strength steels.
```

```
Item #: 9
Description: Perform in-process welding inspection (visual) during fabrication
Acceptance Criteria: 100% visual inspection of all welds during fabrication; no visible cracks, undercut > 1mm, porosity, slag inclusions, or excessive spatter
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual inspection per AS/NZS 1554.1
Notes: MRTS78 Clause 7 — 100% visual scanning is baseline for all construction categories
```

```
Item #: 10
Description: Perform Non-Destructive Examination (NDE) of completed welds per approved NDE plan
Acceptance Criteria: NDE type and extent per AS/NZS 5131 for applicable CC level. CC3: 100% visual + MT/PT of fillet welds + UT/RT of butt welds at specified percentages. All NDE results meet acceptance criteria of AS/NZS 1554.1 Category SP (structural purpose)
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 1554.1 NDE (UT per AS 2207, RT per AS 2177, MT per AS 2177 [VERIFY])
Notes: MRTS78 Clause 7 — NDE levels are in ADDITION to 100% visual scanning. For CC3 bridges, expect: 100% UT or RT on full-penetration butt welds, 20-50% MT on critical fillet welds. Exact percentages per AS/NZS 5131 Tables. [VERIFY exact CC3 NDE percentages against project-specific AS/NZS 5131 requirements]
```

```
Item #: 11
Description: Record and report all weld NDE results; obtain acceptance of weld quality before proceeding to surface treatment
Acceptance Criteria: All welds pass NDE acceptance criteria; any non-conforming welds repaired and re-tested; complete NDE report submitted and accepted
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: NDE results compilation
Notes: MRTS78 — No surface treatment to commence until all welding is complete and accepted. Weld repairs must use approved repair procedure.
```

**PHASE 4: FABRICATION DIMENSIONAL CHECK**

```
Item #: 12
Description: Perform dimensional survey of fabricated steelwork (lengths, widths, bolt hole patterns, camber, alignment)
Acceptance Criteria: Dimensions within tolerances per Engineering Drawings and AS 4100 (typically +/-3mm on lengths, +/-2mm on bolt holes, camber within +/-L/1000 or as specified)
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Dimensional survey
Notes: MRTS78 — Fabricated steelwork must conform to specified drawings. Check match-marking for site assembly.
```

```
Item #: 13
Description: Verify trial assembly (shop fit-up) of major connections before dispatch (where specified)
Acceptance Criteria: All connection components align correctly; bolt holes match; bearing surfaces achieve specified contact area; no forced fit required
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 / AS/NZS 5131 — Trial assembly may be required for CC3 bridge components. Administrator to witness.
```

**PHASE 5: SURFACE PREPARATION**

```
Item #: 14
Description: Perform surface preparation (abrasive blast cleaning) to required standard prior to coating
Acceptance Criteria: Surface preparation to Treatment Grade P3 per AS/NZS 5131. Blast cleaning to AS 1627.4 Class Sa 2.5 (near-white metal); surface profile 50-75 microns (or as specified); surfaces dry and free of contamination
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1627.4 (blast cleaning), surface profile measurement
Notes: MRTS78 Clause 8 — Surface treatment in accordance with AS/NZS 5131 shall be Treatment Grade P3. Coating must be applied within 4 hours of blasting (or before flash rust appears).
```

```
Item #: 15
Description: Verify environmental conditions are suitable for coating application (temperature, humidity, dew point)
Acceptance Criteria: Steel temperature > 3 degrees C above dew point; relative humidity < 85%; ambient temperature within coating manufacturer's range; no rain or condensation
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature/humidity measurement per AS/NZS 2312
Notes: AS/NZS 2312 — Environmental conditions critical for coating adhesion and performance
```

**PHASE 6: PROTECTIVE COATINGS**

```
Item #: 16
Description: Verify coating system is as specified (paint system or hot-dip galvanizing)
Acceptance Criteria: Coating system matches specification (e.g., inorganic zinc silicate primer + epoxy intermediate + polyurethane topcoat, or hot-dip galvanizing per AS/NZS 4680); product data sheets and batch certificates provided
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 Clause 8 — Coating system per Engineering Drawings and project specification. Galvanizing per AS/NZS 4680 if specified.
```

```
Item #: 17
Description: Apply primer coat and verify dry film thickness (DFT)
Acceptance Criteria: Primer DFT within specified range (typically 75-100 microns for inorganic zinc silicate); minimum 5 DFT readings per member; no readings below 80% of specified DFT
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: DFT measurement per AS/NZS 2312 (magnetic gauge)
Notes: MRTS78 / AS/NZS 2312 — DFT testing per AS 3894.3 (non-destructive)
```

```
Item #: 18
Description: Apply intermediate and topcoat layers; verify DFT at each stage
Acceptance Criteria: Each coat DFT within specified range; total system DFT meets minimum specification; colour and finish as specified; no visible defects (runs, sags, pinholes, dry spray)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: DFT measurement per AS/NZS 2312
Notes: MRTS78 — Inter-coat adhesion shall be verified by cross-cut test (AS 3894.9) if required
```

```
Item #: 19
Description: Perform adhesion testing of completed coating system
Acceptance Criteria: Pull-off adhesion >= 2.5 MPa (or as specified); cross-hatch adhesion rating 0-2 per AS 3894.9; no delamination between coats
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 3894.6 (pull-off adhesion), AS 3894.9 (cross-cut)
Notes: MRTS78 / AS/NZS 2312 — Adhesion testing at frequency specified in coating plan
```

```
Item #: 20
Description: For galvanized steelwork: verify coating thickness and quality of hot-dip galvanizing
Acceptance Criteria: Minimum coating thickness per AS/NZS 4680 (e.g., 85 microns for steel >= 6mm thick); no bare spots, blisters, or dross inclusions; zinc coating uniform and adherent
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 4680 (galvanizing), coating thickness per AS 2331
Notes: MRTS78 — Galvanizing certificate required. Touch-up of damaged areas per AS/NZS 4680 Appendix.
```

```
Item #: 21
Description: Complete final inspection of all coated/galvanized steelwork in factory before dispatch
Acceptance Criteria: All coating defects repaired; DFT records complete; colour matches approved sample; packaging/protection plan approved for transport
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 — Administrator release required before dispatch from fabrication workshop
```

**PHASE 7: TRANSPORT AND DELIVERY**

```
Item #: 22
Description: Prepare and submit transport plan for steelwork delivery to site
Acceptance Criteria: Transport plan addresses load securing, protection of coated surfaces, route assessment for oversize loads, traffic management; accepted by Administrator
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 — Transport plan to prevent damage to coated surfaces and connections during transit
```

```
Item #: 23
Description: Inspect steelwork on delivery for transport damage
Acceptance Criteria: No damage to structural members, coatings, or connections; any damage documented and repair method approved before incorporation
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 — All damage must be repaired to original specification standard
```

**PHASE 8: SITE STORAGE**

```
Item #: 24
Description: Verify site storage arrangements for steelwork (supports, drainage, separation, protection)
Acceptance Criteria: Members stored off ground on timber dunnage; adequate drainage; no contact between dissimilar metals; coating protection maintained; identification markings visible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 / AS/NZS 5131 — Prevent ponding of water on members; galvanized items to allow air circulation to prevent white rust
```

**PHASE 9: ERECTION**

```
Item #: 25
Description: Submit erection methodology and sequence for Administrator acceptance
Acceptance Criteria: Erection plan includes crane lifts, temporary bracing, bolt-up sequence, safety provisions; accepted by Administrator and structural engineer before erection commences
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 — Erection methodology must address stability at all stages of erection
```

```
Item #: 26
Description: Verify crane capacity and rigging plan for steelwork lifts
Acceptance Criteria: Crane capacity >= lift weight x safety factor (typically 1.25); rigging plan shows attachment points, sling angles, load distribution; crane inspection current
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS78 / WHS requirements — Lifting points must be as designed; no field-drilled holes without engineer approval
```

```
Item #: 27
Description: Check temporary bracing and stability during erection sequence
Acceptance Criteria: Temporary bracing installed per erection engineer's design; member stability verified at each stage; no unbraced members left overnight
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS78 — Temporary works must be designed by a RPEQ (Registered Professional Engineer of Queensland)
```

```
Item #: 28
Description: Verify bearing and seating surfaces at abutments/piers before steelwork placement
Acceptance Criteria: Bearing surfaces level within +/-2mm; bearing pads correctly positioned; grouted seats cured to specified strength; dimensions match shop drawings
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Level survey
Notes: MRTS78 — Bearing surfaces must be prepared and accepted before placing steelwork
```

```
Item #: 29
Description: Perform alignment survey of erected steelwork
Acceptance Criteria: Steelwork alignment within tolerances per Engineering Drawings: vertical plumb +/-H/1000, horizontal alignment +/-3mm at connections, overall geometry within +/-10mm
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Dimensional survey
Notes: MRTS78 / AS 4100 — Survey before permanent bolting to allow adjustment
```

```
Item #: 30
Description: Install and tension permanent bolts (high-strength friction-grip or bearing type as specified)
Acceptance Criteria: Bolt grade and size per drawings; HSFG bolts tensioned to minimum bolt tension per AS 4100 Table 15.2.5.1; snug-tight for bearing bolts; bolt tension verified by turn-of-nut, direct tension indicator, or calibrated wrench
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 4100 bolt tensioning verification
Notes: MRTS78 — Bolt tension inspection per AS/NZS 5131. For HSFG, faying surfaces must meet specified slip factor (Class C minimum for galvanized surfaces).
```

```
Item #: 31
Description: Perform site welding (if required) with NDE verification
Acceptance Criteria: Site welding per approved WPS; NDE as per factory requirements (same CC level); environmental conditions suitable; all site welds pass NDE acceptance criteria
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: NDE per AS/NZS 1554.1
Notes: MRTS78 — Site welding requires same level of quality as shop welding. Weather protection (windshield, preheating) may be required.
```

**PHASE 10: COATING REPAIR AND FINAL INSPECTION**

```
Item #: 32
Description: Repair all coating damage from transport and erection
Acceptance Criteria: Damaged areas prepared to original standard; touch-up coating compatible with original system; repaired areas achieve specified DFT; overlap onto existing coating minimum 50mm
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: DFT measurement
Notes: MRTS78 — All coating repairs must use approved touch-up system
```

```
Item #: 33
Description: Perform final dimensional survey of completed steelwork assembly
Acceptance Criteria: Final as-built dimensions within specified tolerances; geometry matches design intent; survey report submitted for as-built records
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: As-built survey
Notes: MRTS78 — Final survey records form part of handover documentation
```

```
Item #: 34
Description: Complete final inspection and issue completion certificate for structural steelwork
Acceptance Criteria: All hold points released; all NDE records complete; coating records complete; as-built survey accepted; no outstanding non-conformances; quality records compiled
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: MRTS78 — Final acceptance by Administrator. All quality records to be included in handover documentation.
```

### Test Methods & Frequencies Summary (Template 27)

| Test | Standard | Frequency |
|------|----------|-----------|
| Material certificates | AS/NZS 3678/3679 | 100% heats, 2% each size/grade |
| Visual weld inspection | AS/NZS 1554.1 | 100% all welds |
| Magnetic Particle Testing (MT) | AS 2177 [VERIFY] | Per AS/NZS 5131 CC level (20-100% critical welds) |
| Ultrasonic Testing (UT) | AS 2207 | Per AS/NZS 5131 CC level (butt welds) |
| Radiographic Testing (RT) | AS 2177 [VERIFY] | Alternative to UT for butt welds |
| Bolt tension verification | AS 4100 | 10% of HSFG bolts per connection group |
| DFT measurement | AS 3894.3 | Minimum 5 readings per member per coat |
| Adhesion testing | AS 3894.6 / .9 | 1 per batch or as per coating plan |
| Galvanizing thickness | AS 2331 | Per AS/NZS 4680 |
| Dimensional survey | - | Each member in shop; as-built on site |

---

## Template 28: Bridge Bearings

### Template Header
```
Template Name: Bridge Bearings - Supply, Testing & Installation
Activity Type: structures
Specification Reference: TMR MRTS81 Bridge Bearings
Edition/Revision Date: November 2020 [VERIFY - check if updated since]
Related Standards: AS 5100.4 (Bridge Design - Bearings), AS 1523 (Elastomeric Bearings), AS/NZS 3582 (Structural Steel)
```

### Checklist Items

**PHASE 1: BEARING SUPPLY AND DOCUMENTATION**

```
Item #: 1
Description: Submit bearing design calculations, shop drawings, and material specifications for Administrator acceptance
Acceptance Criteria: Design calculations demonstrate bearing capacity for specified loads and movements; shop drawings show dimensions, layup, and tolerances; material specifications comply with MRTS81
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS81 Clause 5 — All bearing documentation must be accepted before manufacture commences. Bearings must be from TMR-approved product list.
```

```
Item #: 2
Description: Verify bearing manufacturer is on TMR Approved Products list and holds current quality certification
Acceptance Criteria: Manufacturer on TMR Product Index for Bridges and Other Structures; current ISO 9001 (or equivalent) quality system certification; manufacturing facility approved
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS81 — Bearings must be sourced from approved manufacturers per TMR Product Index
```

```
Item #: 3
Description: Verify material compliance - elastomer properties (hardness, tensile strength, elongation at break, compression set, ozone resistance, ageing)
Acceptance Criteria: Elastomer meets specification requirements: hardness within +/-5 IRHD of nominal; tensile strength >= 17 MPa; elongation at break >= 300%; compression set <= 30% at 70 deg C; ozone resistance pass (no cracks); all components formulated for 100-year service life
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1523 elastomer testing / AS ISO 48 (hardness), AS ISO 37 (tensile)
Notes: MRTS81 Clause 6 — All components must be formulated for minimum 100-year service life. Material certificates required for each batch of elastomer.
```

**PHASE 2: BEARING MANUFACTURE AND TESTING**

```
Item #: 4
Description: Perform factory inspection of bearing manufacture (laminate bonding, dimensions, internal reinforcement)
Acceptance Criteria: Laminated bearings: steel shim plates correctly positioned; bond between elastomer and steel complete (no voids > 2mm); overall dimensions within tolerances per design (+/-1mm thickness, +/-2mm plan dimensions)
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual and dimensional inspection
Notes: MRTS81 Clause 7 — Factory inspection during and after manufacture
```

```
Item #: 5
Description: Perform type testing on representative bearings (minimum 1 per 10 identical bearings from same batch)
Acceptance Criteria: Shear modulus test: within +/-15% of design value; compressive stiffness: within +/-15% of design value; maximum mean compressive stress on elastomer <= 50 MPa [VERIFY]; coefficient of friction of sliding surfaces <= 0.04
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1523 bearing testing (shear, compression)
Notes: MRTS81 Clause 8 — Minimum 1 representative bearing tested per 10 identical bearings from same batch. Test costs borne by Contractor.
```

```
Item #: 6
Description: Verify each bearing is permanently marked with unique identification number, manufacturer name, batch/lot number, and orientation
Acceptance Criteria: All bearings stamped with unique number and manufacturer's name; markings permanent and legible; orientation arrows correct per design; markings do not damage bearing function
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 Clause 9 [VERIFY] — Each bearing must be uniquely identifiable and traceable to test records
```

```
Item #: 7
Description: Submit bearing test certificates and compliance documentation for Administrator acceptance before delivery to site
Acceptance Criteria: Test certificates demonstrate compliance with all specified properties; material certificates provided; manufacturing records complete; Administrator accepts documentation
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS81 — Bearings not to be delivered until test documentation is accepted
```

**PHASE 3: DELIVERY AND STORAGE**

```
Item #: 8
Description: Inspect bearings on delivery for transport damage; verify quantities and identification against delivery schedule
Acceptance Criteria: No visible damage to bearing body, laminations, or sliding surfaces; all bearings accounted for; identification numbers match delivery schedule; protective packaging intact
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 — Any damaged bearings to be rejected and replaced
```

```
Item #: 9
Description: Verify site storage conditions for bearings
Acceptance Criteria: Bearings stored flat on clean surface; protected from UV, chemicals, oil, and sharp objects; temperature controlled (5-40 deg C); no stacking that could deform bearings; storage duration within manufacturer's recommendations
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 — Elastomeric bearings degrade under prolonged UV exposure and chemical contact. PTFE surfaces must be protected from contamination.
```

**PHASE 4: BEARING SEAT PREPARATION**

```
Item #: 10
Description: Inspect bearing seat surfaces (top of pier/abutment and underside of superstructure) for level, flatness, and finish
Acceptance Criteria: Bearing seat level within +/-2mm of design; surface flatness <= 1mm under 300mm straightedge; concrete finish smooth (no protrusions > 1mm); concrete strength at bearing seat >= specified minimum
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Level survey, straightedge check
Notes: MRTS81 Clause 10 [VERIFY] — Bearing seats must be prepared and accepted before bearing installation. Surface must be clean and free of laitance.
```

```
Item #: 11
Description: Install levelling shims/packing (if required) to achieve design bearing levels
Acceptance Criteria: Shim material as specified (typically stainless steel or approved grout); level tolerance +/-1mm; shims fully supported with no rocking; adequate clearance for grouting
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Level survey
Notes: MRTS81 — Levelling arrangements must allow for specified grouting access
```

**PHASE 5: BEARING INSTALLATION**

```
Item #: 12
Description: Install bearings at correct location, orientation, and preset (thermal offset if applicable)
Acceptance Criteria: Bearing position within +/-5mm of design; orientation correct (direction arrows per design); thermal preset applied if specified (calculated from installation temperature vs mean bridge temperature); bearings seated fully on bearing surface
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Level survey, temperature measurement
Notes: MRTS81 — Bearing orientation critical for laminated bearings. Preset must account for temperature at time of installation. Minimum gap of 15mm between top of headstock and soffit of deck units per MRTS74. [VERIFY preset calculation requirements]
```

```
Item #: 13
Description: Verify bearing restraint system (hold-down bolts, keeper plates, guide bars) is correctly installed
Acceptance Criteria: Restraint type matches design; bolts torqued to specification; keeper plates positioned to allow design movements; guide bars aligned to movement direction +/-1mm
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 — Restraint system must allow specified movements while preventing bearing walk-out. Proprietary cementitious grout for hold down bolts per MRTS74 amendment.
```

**PHASE 6: GROUTING**

```
Item #: 14
Description: Prepare and approve grout material for bearing seats and surrounding areas
Acceptance Criteria: Grout type as specified (typically non-shrink cementitious grout or epoxy grout); product data sheet accepted; grout compressive strength >= specified minimum (typically >= 50 MPa at 28 days); grout tested before use
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Grout compressive strength test
Notes: MRTS81 — Grout must be non-shrink and suitable for the structural application
```

```
Item #: 15
Description: Place grout around bearings; verify complete fill and finish
Acceptance Criteria: Grout placed without disturbing bearing position; no voids under or around bearing; grout flush with surrounding concrete; surface finish as specified; grout samples taken for strength verification
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Grout strength verification
Notes: MRTS81 — Grouting to be performed in suitable weather conditions (typically 5-35 deg C). Grout must achieve design strength before loading.
```

**PHASE 7: LOAD TRANSFER AND VERIFICATION**

```
Item #: 16
Description: Verify superstructure load transfer to bearings after jacking/lowering operations
Acceptance Criteria: Superstructure correctly seated on all bearings; uniform bearing contact visible (no gaps > 0.5mm at bearing edges); measured loads within design tolerance per bearing (if load cells used)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual inspection, load measurement if specified
Notes: MRTS81 — After superstructure placement, verify load distribution. Uneven loading may indicate bearing seat irregularity.
```

```
Item #: 17
Description: Remove temporary works (jacking brackets, temporary supports) and verify bearing free to move as designed
Acceptance Criteria: All temporary restraints removed; bearing movement freedom verified in design directions; no mechanical interference with design movements; no damage to bearing during temporary works removal
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 — Bearings must be free to accommodate design thermal, creep, and shrinkage movements after temporary works removal
```

**PHASE 8: DOCUMENTATION AND ACCEPTANCE**

```
Item #: 18
Description: Record as-installed bearing positions, orientations, and presets
Acceptance Criteria: As-built survey of all bearing locations; orientation documented; preset values recorded with installation temperature; records match design requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: As-built survey
Notes: MRTS81 — As-built records essential for future bearing inspection and replacement
```

```
Item #: 19
Description: Compile and submit complete bearing quality records package
Acceptance Criteria: Package includes: material certificates, test certificates, factory inspection records, delivery inspection records, installation survey, grouting records, load transfer verification, as-built survey; all accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS81 — Complete quality records required for final acceptance. Records must be retained for design life of structure.
```

```
Item #: 20
Description: Verify bearing access provisions for future maintenance inspection
Acceptance Criteria: Access to all bearings maintained for visual inspection and potential future replacement; minimum clearances per design criteria; access hatches or platforms installed if specified
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS81 — Long-term maintenance access is a durability requirement for 100-year service life
```

### Test Methods & Frequencies Summary (Template 28)

| Test | Standard | Frequency |
|------|----------|-----------|
| Elastomer hardness | AS ISO 48 | Each batch |
| Elastomer tensile/elongation | AS ISO 37 | Each batch |
| Compression set | AS 1683.13 [VERIFY] | Each batch |
| Ozone resistance | AS 1683.19 [VERIFY] | Type test |
| Shear modulus | AS 1523 | 1 per 10 identical bearings |
| Compressive stiffness | AS 1523 | 1 per 10 identical bearings |
| Friction coefficient (sliding) | AS 1523 | 1 per 10 identical bearings |
| Bearing seat level survey | - | 100% bearing locations |
| Grout compressive strength | - | 1 set per pour |

---

## Template 29: Precast Concrete Elements (Beams, Panels, Segments)

### Template Header
```
Template Name: Precast Concrete Elements - Manufacture, Transport & Erection
Activity Type: structures
Specification Reference: TMR MRTS72 Manufacture of Precast Concrete Elements / MRTS70 Concrete (Section 16) / MRTS74 Supply and Erection of Prestressed Concrete Deck Units
Edition/Revision Date: MRTS72 July 2019 / MRTS70 July 2022 / MRTS74 November 2023
Related Standards: AS 3600 (Concrete Structures), AS 3610 (Formwork), AS/NZS 4672 (Prestressing)
```

### Checklist Items

**PHASE 1: FACTORY QUALIFICATION**

```
Item #: 1
Description: Verify precast manufacturer is on TMR Registered Precast Concrete Suppliers list
Acceptance Criteria: Manufacturer on current TMR Registered Precast Concrete Suppliers list; registration valid and not expired; scope of registration covers required element types
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS72 Clause 5 — Manufacturer must be registered with TMR. Current list published by TMR (updated periodically, most recent September 2025).
```

```
Item #: 2
Description: Submit precast quality plan covering manufacture, curing, storage, transport, and erection procedures
Acceptance Criteria: Quality plan addresses all MRTS72 requirements; includes mix design, formwork, reinforcement/prestressing, curing, dimensional control, handling, storage, transport, and erection; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS72 Clause 5.2 — Quality plan must be submitted and accepted before manufacture commences
```

```
Item #: 3
Description: Submit concrete mix design(s) for precast elements for Administrator acceptance
Acceptance Criteria: Mix design meets specified strength grade (typically >= 50 MPa at 28 days for prestressed, >= 40 MPa for reinforced); durability class meets exposure requirements; trial mix results confirm compliance
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012 concrete testing
Notes: MRTS72 / MRTS70 Clause 15.1 — Mix design must be approved before production. Trial mix required per MRTS70 Section 16.1.1.
```

**PHASE 2: FACTORY PRODUCTION SETUP**

```
Item #: 4
Description: Inspect formwork/moulds for dimensions, condition, and surface finish
Acceptance Criteria: Mould dimensions within +/-2mm of design; mould surfaces clean, smooth, undamaged; release agent applied uniformly; mould joints sealed (no grout leakage); alignment jigs correctly positioned
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Dimensional check
Notes: MRTS72 Clause 7 — Formwork must comply with AS 3610. Check for wear and distortion in reusable moulds.
```

```
Item #: 5
Description: Inspect reinforcement/prestressing strand placement before concrete pour
Acceptance Criteria: Reinforcement: bar sizes, spacing, and laps per design; concrete cover >= specified minimum (typically >= 40mm precast); chairs and spacers at required intervals. Prestressing: strand profile matches design; strand spacing correct; anchorages positioned correctly
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS72 / MRTS70 Clause 11.3 — Hold Point: No concrete to be placed until reinforcement/prestressing inspected and accepted. Administrator 3 days notice for pre-pour inspection.
```

```
Item #: 6
Description: Accept quality benchmark sample for production run (first element or designated sample)
Acceptance Criteria: Benchmark sample meets all dimensional, surface finish, and strength requirements; accepted by Administrator as reference standard for production run; sample preserved until production completion
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS72 Clause 8 [VERIFY] — Hold Point 3: The accepted sample shall be preserved as a quality benchmark until completion of production.
```

**PHASE 3: CONCRETE PLACEMENT AND CURING**

```
Item #: 7
Description: Monitor concrete placement in moulds (slump, temperature, vibration, placement time)
Acceptance Criteria: Slump within +/-15mm of nominated value; concrete temperature 10-32 deg C; placement within 90 minutes of batching; vibration achieves full compaction without segregation; no cold joints
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (slump), AS 1012.8.4 (temperature)
Notes: MRTS70 Clause 12 — Standard concrete placement requirements apply to precast
```

```
Item #: 8
Description: Cast concrete test specimens for compressive strength verification
Acceptance Criteria: Minimum 1 set of 3 cylinders per 50 m3 or per pour (whichever more frequent); minimum 1 set per day per grade; specimens made and cured per AS 1012.8.1
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength), AS 1012.8.1 (specimen making)
Notes: MRTS70 — Test frequency per MRTS70 normal or reduced rate as applicable
```

```
Item #: 9
Description: Verify curing method and duration
Acceptance Criteria: Curing method per approved quality plan (steam, water, or membrane); minimum curing period as specified (typically 7 days equivalent moist cure); temperature during steam curing not to exceed 70 deg C; rate of temperature change <= 20 deg C/hour [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature monitoring
Notes: MRTS72 Clause 9 [VERIFY] — Curing records must be maintained. Steam curing requires temperature monitoring throughout cycle.
```

**PHASE 4: DEMOULDING AND PRESTRESS TRANSFER**

```
Item #: 10
Description: Verify concrete has achieved minimum strength before formwork removal or lifting
Acceptance Criteria: Concrete strength >= 60% of specified 28-day characteristic strength before formwork removal or product lifting. Early stripping to minimum 40% (but not less than 16 MPa) only with Administrator permission.
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength - early age or maturity method)
Notes: MRTS72 Clause 10 [VERIFY] — Strength verified by test cylinders or maturity method. Curing shall continue no later than 1 hour after formwork removal.
```

```
Item #: 11
Description: For prestressed elements: verify concrete strength at prestress transfer
Acceptance Criteria: Concrete strength >= specified transfer strength (typically >= 0.75 f'c or as specified on drawings) before strand release; no cracking or damage during transfer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength)
Notes: MRTS72 / MRTS70 Clause 17.14 — Transfer strength must be confirmed by cylinder tests. Record actual transfer strength and age.
```

```
Item #: 12
Description: Inspect element immediately after demoulding for defects (surface finish, dimensions, cracking, damage)
Acceptance Criteria: Surface finish meets specified class; no structural cracks; honeycombing/voids: none > 25mm depth or 150mm extent; dimensions within tolerance per AS 3610 (+/-5mm length, +/-3mm width/depth); no reinforcement visible
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Dimensional check
Notes: MRTS72 Clause 11 [VERIFY] — Witness Point 1 for products with 50-year design life manufactured to TMR Standard Drawing. Defective elements must be reported and disposition agreed.
```

**PHASE 5: QUALITY TESTING**

```
Item #: 13
Description: Verify 28-day compressive strength results
Acceptance Criteria: Mean of lot >= f'c + margin per statistical criteria; no individual cylinder < 0.85 f'c; results comply with MRTS70 acceptance criteria
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength)
Notes: MRTS70 Clause 15 — Statistical acceptance criteria per MRTS70 Appendix A
```

```
Item #: 14
Description: Perform dimensional survey of completed elements
Acceptance Criteria: All dimensions within design tolerances; prestressed beam camber within specified range (+/-5mm or as specified); bearing surfaces flat and level; connection details match shop drawings
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Dimensional survey
Notes: MRTS72 — Dimensional records form part of quality documentation for each element
```

```
Item #: 15
Description: Perform cover meter survey on completed elements
Acceptance Criteria: Reinforcement cover >= specified minimum at all measured points (minimum 5 points per element or as per MRTS70); no areas with cover less than (specified minimum - 5mm)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Covermeter per AS 1012 / electromagnetic method
Notes: MRTS70 Clause 5.5 — Cover survey for 10% of members as audit, or more if issues detected
```

**PHASE 6: STORAGE**

```
Item #: 16
Description: Verify storage arrangements at factory and site
Acceptance Criteria: Elements stored on timber bearers at designated support points (per design or manufacturer recommendations); no overstressing from self-weight; elements stable against overturning; identification markings visible; protected from damage and weather if required
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS72 Clause 12 [VERIFY] — Support points must match lifting/storage design. Stack heights limited per manufacturer's recommendations. Do not support at mid-span unless designed for it.
```

```
Item #: 17
Description: Verify minimum curing age before transport/erection
Acceptance Criteria: Elements not transported or erected until 28-day strength confirmed OR minimum 14 days age AND transfer strength requirements met (whichever governs); all test results available and compliant
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: MRTS72 — Elements must achieve specified strength before transport loads are applied
```

**PHASE 7: TRANSPORT**

```
Item #: 18
Description: Submit transport plan and verify transport method for precast elements
Acceptance Criteria: Transport plan addresses: element orientation during transport (typically vertical for beams); support/tie-down locations per design; route assessment for oversize loads; protection of bearing surfaces and connection details; accepted by Administrator
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS72 / MRTS74 — Transport-induced stresses must not exceed element design capacity. Route clearances verified for oversize elements.
```

```
Item #: 19
Description: Inspect elements on delivery for transport damage
Acceptance Criteria: No cracking, chipping, or spalling; bearing surfaces undamaged; connection details intact; prestressing strand exposure within limits; any damage documented and repair method approved
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS72 — Damaged elements must be reported; repair method per MRTS70 concrete repair requirements
```

**PHASE 8: ERECTION**

```
Item #: 20
Description: Submit erection methodology and sequence for Administrator acceptance
Acceptance Criteria: Erection plan includes: crane lifts, rigging, temporary bracing, placement sequence, joint grouting, safety provisions; accepted by Administrator and structural engineer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS74 Clause 7 [VERIFY] — Erection methodology must address stability at all stages
```

```
Item #: 21
Description: Verify bearing surfaces/seats are prepared and accepted before element placement
Acceptance Criteria: Bearing surfaces level within +/-2mm; mortar pads or bearing strips correctly positioned; headstock/crosshead dimensions verified; minimum 15mm gap between top of headstock and soffit of deck units/winged planks per MRTS74
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Level survey
Notes: MRTS74 — Bearing seats must be prepared and inspected. 15mm minimum gap requirement per November 2023 amendment.
```

```
Item #: 22
Description: Place precast elements and verify alignment
Acceptance Criteria: Elements placed at correct location (+/-5mm horizontal, +/-3mm vertical); correct orientation; bearing contact verified; gaps between adjacent elements within design tolerance
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Alignment survey
Notes: MRTS74 — Administrator to witness placement of major bridge elements (deck units, beams, segments)
```

```
Item #: 23
Description: Install temporary bracing and verify element stability
Acceptance Criteria: Temporary bracing per engineer's design; all elements stable before releasing crane; no unbraced elements left overnight; bracing does not damage precast surfaces
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS74 — Temporary works must be designed by RPEQ
```

**PHASE 9: CONNECTIONS AND GROUTING**

```
Item #: 24
Description: Inspect joint preparation between precast elements before grouting
Acceptance Criteria: Joint surfaces clean and prepared per specification; shear keys (if any) properly formed; reinforcement correctly positioned across joints; formwork/seals preventing grout loss installed
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS74 — Joint preparation is critical for structural continuity between elements
```

```
Item #: 25
Description: Place grout in joints between precast elements (deck units, segments)
Acceptance Criteria: Grout material as specified (proprietary cementitious grout per MRTS74); grout completely fills joint with no voids; grout compressive strength >= specified minimum; grout samples taken for verification
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Grout compressive strength test
Notes: MRTS74 — Grouting between deck units per November 2023 amendment. Grout must achieve design strength before loading.
```

```
Item #: 26
Description: Install and grout hold-down bolts for precast elements
Acceptance Criteria: Hold-down bolt type and size per design; bolt embedment depth achieved; proprietary cementitious grout per MRTS74; grout strength achieved before tensioning bolts
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS74 — Proprietary cementitious grout for hold down bolts per November 2023 amendment
```

**PHASE 10: TRANSVERSE STRESSING (IF APPLICABLE)**

```
Item #: 27
Description: Install transverse stressing system (if specified for deck unit bridges)
Acceptance Criteria: Stressing bars/strands correctly positioned per design; duct alignment verified; anchorage systems per approved product list; stressing calculations prepared and submitted
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS74 — Transverse stressing for deck unit bridges per design. Related to MRTS89 post-tensioning requirements.
```

```
Item #: 28
Description: Perform transverse stressing and verify elongation
Acceptance Criteria: Jacking force within +/-5% of design; measured elongation within +/-7% of calculated theoretical elongation; no strand slip at anchorage; stressing records submitted
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Elongation measurement
Notes: MRTS74 / MRTS89 — Stressing is a Critical Activity. All elongation records must be submitted for acceptance.
```

**PHASE 11: DOCUMENTATION AND ACCEPTANCE**

```
Item #: 29
Description: Submit as-built survey of completed precast assembly
Acceptance Criteria: As-built survey shows final geometry within design tolerances; bearing locations recorded; joint widths recorded; camber/deflection profile recorded; survey accepted by Administrator
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: As-built survey
Notes: MRTS72 / MRTS74 — As-built records form part of handover documentation
```

```
Item #: 30
Description: Compile and submit complete precast quality records package
Acceptance Criteria: Package includes: factory registration, mix design, concrete test results, curing records, dimensional surveys, cover surveys, delivery inspections, erection records, grouting records, stressing records (if applicable), as-built survey; all accepted
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS72 — Complete quality records required for final acceptance
```

### Test Methods & Frequencies Summary (Template 29)

| Test | Standard | Frequency |
|------|----------|-----------|
| Concrete slump | AS 1012.3.1 | Every pour |
| Concrete temperature | AS 1012.8.4 | Every pour |
| Compressive strength | AS 1012.9 | 1 set (3 cylinders) per 50 m3 or per pour, minimum 1 per day per grade |
| Transfer strength | AS 1012.9 | 1 set per strand release event |
| Dimensional survey | - | Every element |
| Cover meter | Electromagnetic | 10% of elements (more if issues) |
| Grout strength | - | 1 set per joint grouting event |
| Elongation (if stressing) | Measurement | Every tendon |

---

## Template 30: Post-Tensioning (Bridges, Slabs)

### Template Header
```
Template Name: Post-Tensioning - Duct Installation, Stressing, and Grouting
Activity Type: structures
Specification Reference: TMR MRTS89 Post-Tensioned Concrete
Edition/Revision Date: July 2017 [VERIFY - check if updated since]
Related Standards: MRTS70 Concrete, AS 5100 (Bridge Design), AS/NZS 4672 (Prestressing Steel), TN25 (Post Tensioning Anchorage Approval)
```

### Checklist Items

**PHASE 1: SYSTEM APPROVAL AND MATERIALS**

```
Item #: 1
Description: Submit post-tensioning system details for Administrator acceptance (anchorage system, duct type, strand type, grout)
Acceptance Criteria: Post-tensioning system from TMR Approved Products list (per TN25); anchorage system approved per TN25 Post Tensioning Anchorage Approval process; system documentation complete
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 Clause 5 — All post-tensioning systems must be approved per TMR Product Index for Bridges and Other Structures and TN25.
```

```
Item #: 2
Description: Submit post-tensioning construction procedures including stressing sequence, elongation calculations, grouting procedure, and quality plan
Acceptance Criteria: Procedures address: installation, stressing sequence and forces, theoretical elongation calculations, grouting methodology, quality hold/witness points; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 Clause 5.2 — Detailed construction procedures must be accepted before any post-tensioning work commences
```

```
Item #: 3
Description: Verify prestressing strand material compliance - mill certificates and check testing
Acceptance Criteria: Strand complies with AS/NZS 4672; mill certificates provided for each coil; modulus of elasticity at stressing load confirmed; elongation at rupture on 600mm gauge length meets specification; samples stored for potential check testing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 4672 (prestressing steel testing)
Notes: MRTS89 Clause 6 — Hold Point 2: Store samples of strand from each coil before use. Samples used for check testing if considered necessary by Administrator.
```

```
Item #: 4
Description: Verify anchorage components comply with approved system and are undamaged
Acceptance Criteria: Anchorage plates, wedges, grips, and trumpets match approved system; components undamaged; correct quantities for specified tendon configuration; certificates of compliance provided
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 Clause 6 — Anchorage tolerances: positioned within +/-6mm across and vertically, +/-15mm along tendon. Face of anchorage square to within 0.5 deg to tendon line.
```

```
Item #: 5
Description: Verify grout material compliance and submit certificate of uniformity testing
Acceptance Criteria: Grout complies with approved grout specification; manufacturer's quality management system accredited; certificate of uniformity testing submitted for each batch delivered; grout properties meet MRTS89 requirements
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: Grout testing per MRTS89
Notes: MRTS89 Clause 11 [VERIFY] — Each batch of grout must be verified by uniformity testing certificate
```

**PHASE 2: DUCT INSTALLATION**

```
Item #: 6
Description: Inspect duct installation for profile, support spacing, and joint integrity before concrete placement
Acceptance Criteria: Duct profile matches design within +/-5mm vertically and +/-10mm horizontally [VERIFY]; support chairs at maximum 1m centres (or as specified); duct joints taped and sealed to prevent grout ingress during concreting; vent/drain locations correct
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 Clause 7 [VERIFY] — Duct profile is critical for tendon force calculations. Inspect as part of pre-pour reinforcement check per MRTS70.
```

```
Item #: 7
Description: Verify duct is free from damage, blockage, and contamination before concrete placement
Acceptance Criteria: Ducts inspected for: no kinks, no punctures, no contamination (cement, water, debris); mandrel or ball passed through duct to confirm clear bore; inlet/outlet connections secure
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Mandrel/ball test
Notes: MRTS89 — Blocked ducts prevent strand installation and grouting. Test all ducts before pour.
```

```
Item #: 8
Description: Verify anchorage positions are correct before concrete placement
Acceptance Criteria: Anchorage positioned within tolerances: +/-6mm across and vertically, +/-15mm along tendon; face of anchorage square to within 0.5 deg to line of tendon; any anchorage outside tolerance deemed non-conforming
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Dimensional check
Notes: MRTS89 — Anchorages outside tolerance are non-conforming. Correction may require formwork/reinforcement adjustment.
```

**PHASE 3: CONCRETE PLACEMENT (PT SPECIFIC)**

```
Item #: 9
Description: Verify concrete has achieved specified transfer strength before stressing operations commence
Acceptance Criteria: Concrete compressive strength >= specified transfer strength (typically >= 0.85 f'c or as specified on drawings); strength verified by cylinder tests at location of stressing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength)
Notes: MRTS89 / MRTS70 Clause 17.14 — No stressing until transfer strength confirmed. This is a Critical Post-Tensioning Activity.
```

**PHASE 4: STRAND INSTALLATION**

```
Item #: 10
Description: Thread/push strands through ducts and verify correct number and configuration at each anchorage
Acceptance Criteria: Correct number of strands per tendon per design; strands identified by coil number for traceability; no strand damage during installation; strands not to lie in duct longer than 5 weeks before stressing
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 Clause 8 [VERIFY] — Unstressed tendons shall not lie in a duct longer than 5 weeks prior to stressing. This prevents corrosion and strand relaxation issues.
```

```
Item #: 11
Description: Verify jack calibration certificate is current and jacking system compatible with approved PT system
Acceptance Criteria: Jack calibrated within previous 6 months by NATA-accredited laboratory; calibration certificate provided; jack capacity suitable for specified stressing force; pressure gauge readable to +/-1% of stressing force
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 Clause 9 [VERIFY] — Jack calibration is a prerequisite for stressing. Recalibrate if jack is damaged or repaired.
```

**PHASE 5: STRESSING**

```
Item #: 12
Description: Perform stressing in approved sequence with Administrator notification
Acceptance Criteria: Stressing sequence per approved procedure; Administrator notified 24 hours prior; stressing records maintained for each tendon in real time
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Elongation and force measurement
Notes: MRTS89 Clause 9 — Stressing is a Critical Post-Tensioning Activity. Administrator must be given opportunity to witness.
```

```
Item #: 13
Description: Verify jacking force for each tendon
Acceptance Criteria: Jacking force within +/-5% of specified design force; lock-off force accounts for seating loss per system manufacturer's data; force measured by calibrated jack pressure gauge
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Force measurement (calibrated jack)
Notes: MRTS89 — Record actual jacking force, pressure gauge reading, and jack calibration reference for each tendon
```

```
Item #: 14
Description: Verify elongation of each tendon against theoretical calculation
Acceptance Criteria: Measured elongation within +/-7% of calculated theoretical elongation; if outside tolerance, hold stressing and investigate (friction, duct misalignment, strand slip, calculation error)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Elongation measurement
Notes: MRTS89 — Elongation is the primary independent check on stressing force. Discrepancies > 7% require investigation and Administrator approval before continuing.
```

```
Item #: 15
Description: Check for strand slip at anchorage after lock-off
Acceptance Criteria: No visible strand slip at wedge anchorage after lock-off; wedge seating within manufacturer's specified range (typically 6-8mm); any slip > specified limit requires re-stressing
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Slip measurement
Notes: MRTS89 — Record strand draw-in/slip at lock-off for each tendon. Compare to expected seating loss.
```

```
Item #: 16
Description: Submit complete stressing records for Administrator acceptance
Acceptance Criteria: Stressing records include: tendon ID, stressing date/time, concrete strength at stressing, jack ID and calibration reference, jacking force, elongation (theoretical and actual), strand slip, stressing sequence confirmation; all results within tolerance; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 — Stressing records must be submitted and accepted before grouting can commence. Records are permanent quality documents.
```

**PHASE 6: DUCT AIR TESTING (PRE-GROUTING)**

```
Item #: 17
Description: Perform air pressure test on all ducts before grouting
Acceptance Criteria: Each duct pressurised to specified pressure (typically 50 kPa [VERIFY]) and hold for specified duration; pressure drop within acceptable limits indicating duct integrity; all water blown out with compressed oil-free air before testing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Air pressure test per MRTS89
Notes: MRTS89 Clause 10 [VERIFY] — Air testing of ducts is a Critical Post-Tensioning Activity. Any water in duct must be blown out with compressed oil-free air before testing. Failed ducts must be repaired and retested.
```

```
Item #: 18
Description: Verify all vent and drain tubes are clear and accessible for grouting
Acceptance Criteria: All vents and drains unblocked; vent locations match grouting plan; caps/valves functional; high points have vents to allow air escape during grouting
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 — Blocked vents prevent complete duct filling and lead to voids
```

**PHASE 7: GROUTING**

```
Item #: 19
Description: Perform grout trial/qualification test before production grouting
Acceptance Criteria: Trial grout demonstrates: fluidity per specification, bleed <= 0.3% at 3 hours [VERIFY], volume change within limits, compressive strength >= specified minimum at 7 and 28 days; trial results accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Grout fluidity (flow cone), bleed, strength per MRTS89
Notes: MRTS89 Clause 11 [VERIFY] — Grout trial must demonstrate grout meets all property requirements before production grouting
```

```
Item #: 20
Description: Perform production grouting of ducts per approved procedure with Administrator notification
Acceptance Criteria: Grouting performed in approved sequence; grout pumped from low point; continuous pumping until grout of consistent quality emerges from all vents/drains; grouting completed in one continuous operation per duct; grout temperature 5-30 deg C [VERIFY]
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Grout fluidity test during grouting
Notes: MRTS89 Clause 11 — Grouting is a Critical Post-Tensioning Activity. Administrator must be given opportunity to witness. Record pump pressure, grout fluidity, and duration.
```

```
Item #: 21
Description: Verify grout fills entire duct volume (no voids)
Acceptance Criteria: Grout emerging from all vents is of consistent quality; vents capped under pressure in sequence from inlet end; no air pockets indicated by pressure drops; grout level maintained at high points
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 — 100% of ducts must be fully filled. Subsequent inspection by coring or non-destructive means may be required if voids suspected.
```

```
Item #: 22
Description: Take grout samples during production grouting for strength verification
Acceptance Criteria: Minimum 1 set of grout cubes per duct (or per grouting session); grout strength >= specified minimum (typically >= 27 MPa at 28 days [VERIFY]); results submitted to Administrator
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Grout compressive strength per MRTS89
Notes: MRTS89 — Grout samples taken from representative points during grouting operation
```

**PHASE 8: ANCHORAGE PROTECTION**

```
Item #: 23
Description: Cut and cap exposed strand tails at anchorages
Acceptance Criteria: Strands cut at specified distance from anchorage (typically 30-40mm beyond wedge [VERIFY]); cutting method does not damage adjacent strands or anchorage; strand tails capped if specified
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 — Do not cut strand tails until grouting is complete and verified. Cutting before grouting would prevent re-stressing if needed.
```

```
Item #: 24
Description: Apply permanent corrosion protection to anchorage zone
Acceptance Criteria: Anchorage zone sealed with: mortar cap/patch (minimum 25mm cover over anchorage [VERIFY]), or approved proprietary cap system; protective material bonds to surrounding concrete; no voids or gaps
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS89 Clause 12 [VERIFY] — Anchorage protection is the final critical step. Corrosion of anchorages is the primary durability risk for PT structures.
```

**PHASE 9: DOCUMENTATION AND ACCEPTANCE**

```
Item #: 25
Description: Compile and submit complete post-tensioning quality records package
Acceptance Criteria: Package includes: system approval, material certificates, strand samples register, jack calibration, duct installation records, stressing records (force and elongation for every tendon), duct air test results, grout trial results, grouting records, grout strength results, anchorage protection records; all accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS89 — Complete post-tensioning records are permanent structural documents required for bridge maintenance and assessment throughout design life
```

### Test Methods & Frequencies Summary (Template 30)

| Test | Standard | Frequency |
|------|----------|-----------|
| Strand tensile properties | AS/NZS 4672 | Each coil (mill cert) + samples stored |
| Concrete transfer strength | AS 1012.9 | Each stressing event |
| Jack calibration | NATA-accredited | Within 6 months, per jack |
| Elongation measurement | Measurement | Every tendon |
| Jacking force | Calibrated gauge | Every tendon |
| Duct air pressure test | MRTS89 procedure | Every duct |
| Grout fluidity | Flow cone per MRTS89 | Every grouting session |
| Grout bleed | Per MRTS89 | Trial + periodic production |
| Grout compressive strength | Per MRTS89 | 1 set per duct or per session |

---

## Template 31: Stone Mastic Asphalt (SMA)

### Template Header
```
Template Name: Stone Mastic Asphalt (SMA) - Mix Design, Production & Placement
Activity Type: asphalt
Specification Reference: TMR MRTS30 Asphalt Pavements (SMA clauses)
Edition/Revision Date: March 2024
Related Standards: MRTS17 Bitumen and Multigrade Bitumen, MRTS18 Polymer Modified Binder, MRTS101 Aggregates for Asphalt, MRTS102 Reclaimed Asphalt Pavement Material (November 2025)
```

**Note:** Stone Mastic Asphalt is covered within MRTS30 Asphalt Pavements, not as a separate specification. SMA has distinct requirements within MRTS30 that differentiate it from Dense Graded Asphalt (DGA) and Open Graded Asphalt (OGA). This template covers the SMA-specific requirements in addition to general asphalt requirements.

### Checklist Items

**PHASE 1: MIX DESIGN**

```
Item #: 1
Description: Submit SMA mix design for registration per MRTS30 and TN148 requirements
Acceptance Criteria: Mix design registered per TN148 (Asphalt Mix Design Registration); SMA10 or SMA14 nominal size as specified; binder type complies with MRTS17/MRTS18 (PMB typically required for SMA); cellulose fibre content >= 0.3% by mass of mix
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: Mix design per AS/NZS 2891
Notes: MRTS30 Clause 7 / TN148 — SMA mix design must be registered before production. Mix design registration identifies WMA additive type (wax-based or surfactant-based). Recycled glass fine aggregate prohibited in SMA.
```

```
Item #: 2
Description: Verify SMA mix design includes mandatory WMA (Warm Mix Asphalt) additive
Acceptance Criteria: WMA additive included in mix design; additive type (wax-based or surfactant-based) identified; additive dosage per manufacturer recommendation; WMA additive does not adversely affect binder or mix properties
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 March 2024 amendment — ALL asphalt mixes must now contain WMA additive. Manufacturing temperature reduced by 20 deg C from pre-March 2024 specifications. Mix design will not be registered if WMA additive information is not provided.
```

```
Item #: 3
Description: Perform drain-down test on SMA mix design (Schellenberg method)
Acceptance Criteria: Drain-down <= 0.3% by mass [VERIFY exact limit] at elevated temperatures comparable to production, storage, transport, and placement; cellulose fibre content adequate to prevent binder drainage
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Schellenberg drain-down test (AS/NZS 2891 [VERIFY])
Notes: MRTS30 — Drain-down testing is critical for SMA. Elevated fibre content may be needed if drain-down exceeds limit. Test at maximum production temperature.
```

```
Item #: 4
Description: Verify laboratory air voids of SMA mix design specimens
Acceptance Criteria: Laboratory compacted air voids 3-5% for SMA (differs from DGA target of 4-6%); volumetric properties within SMA envelope per MRTS30
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 2891.8 (bulk density), AS/NZS 2891.7 (max theoretical density)
Notes: MRTS30 — SMA has tighter air void range than DGA due to stone-on-stone contact requirements
```

```
Item #: 5
Description: Perform moisture sensitivity test (TSR) on SMA mix
Acceptance Criteria: Tensile Strength Ratio (TSR) >= 80% per TMR Q314; if TSR fails, production must not commence until cause addressed and Administrator approves restart
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q314 (Tensile Strength Ratio)
Notes: MRTS30 Clause 7.2.5 — Hold Point 1: Production Re-start after TSR Failure. Cannot recommence manufacturing until cause addressed.
```

**PHASE 2: MATERIAL VERIFICATION**

```
Item #: 6
Description: Verify coarse aggregate for SMA meets TMR requirements (source, quality, grading)
Acceptance Criteria: Aggregate from registered quarry; complies with MRTS101; crushed, angular, with high resistance to polishing (PSV >= specified minimum [VERIFY]); grading within SMA envelope; no rounded or water-worn particles
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141 series (aggregate testing)
Notes: MRTS30 / MRTS101 — SMA relies on stone-on-stone contact; aggregate quality is critical for rut resistance
```

```
Item #: 7
Description: Verify fine aggregate for SMA is manufactured (crushed), not natural sand
Acceptance Criteria: Fine aggregate for SMA must be crushed; no natural sand permitted; fines comply with MRTS101 requirements; no recycled glass fine aggregate in SMA
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 — SMA-specific requirement: fine aggregate must be crushed. Recycled glass fines prohibited in SMA.
```

```
Item #: 8
Description: Verify cellulose fibre material compliance and supply
Acceptance Criteria: Cellulose fibre content >= 0.3% by mass of mix; fibre compliant with specification; adequate supply secured for production run; fibre dosing system calibrated
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 — Cellulose fibre is mandatory for SMA to prevent binder drain-down during transport and placement
```

```
Item #: 9
Description: Verify binder compliance (PMB for SMA as specified)
Acceptance Criteria: Binder type and grade per MRTS17 or MRTS18 as specified; binder test certificates provided; binder compliant with grade requirements (viscosity, elasticity per AS 2008); WMA additive incorporated
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Binder testing per AS 2008
Notes: MRTS30 / MRTS18 — PMB (Polymer Modified Binder) typically specified for SMA for improved performance
```

**PHASE 3: PRODUCTION SETUP**

```
Item #: 10
Description: Submit Asphalt Quality Plan (AQP) for SMA production
Acceptance Criteria: AQP includes: sampling locations, frequencies, test methods; production monitoring plan; temperature control plan (reduced by 20 deg C per March 2024 amendment); fibre dosing verification; drain-down control measures; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 Clause 5.2 — AQP must be accepted before production. AQP addresses all SMA-specific quality requirements.
```

```
Item #: 11
Description: Verify asphalt plant setup for SMA production (fibre dosing, temperature control, mixing time)
Acceptance Criteria: Fibre dosing system calibrated and verified; plant temperature controls set for reduced WMA temperatures; mixing time adequate for fibre distribution (typically longer than DGA); no contamination from previous mix
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS30 — SMA requires longer mixing time to ensure uniform fibre distribution. Plant changeover must prevent contamination.
```

**PHASE 4: PLACEMENT TRIAL**

```
Item #: 12
Description: Construct SMA placement trial section
Acceptance Criteria: Trial section of sufficient length (typically >= 200m or as specified); demonstrates: compaction achievement (roller pattern), joint construction, surface texture, no drain-down visible; trial section accepted before full-scale paving
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core testing per AS/NZS 2891
Notes: MRTS30 Clause 8.11 — Hold Point 7: Placement trial required for new mix. Trial must demonstrate achievement of specified properties. Administrator witnesses trial.
```

**PHASE 5: SURFACE PREPARATION**

```
Item #: 13
Description: Verify existing surface is prepared and accepted for SMA overlay
Acceptance Criteria: Surface clean, dry, free of loose material; crack treatment complete (all cracks >= 3mm sealed); profile corrections done where required; proof rolling passed (no deflection); tack coat applied at correct rate
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS30 Clause 8.2 — Hold Point 4: No paving over weak substrate without corrective measures. Proof roll underlying surface.
```

```
Item #: 14
Description: Apply tack coat at specified rate and verify coverage
Acceptance Criteria: Tack coat type and rate per MRTS30; uniform coverage with no bare spots or pooling; adequate curing time before SMA placement (surface tacky, not wet)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Application rate check
Notes: MRTS30 — Tack coat critical for bond between layers. SMA relies on inter-layer bond for structural capacity.
```

**PHASE 6: SMA PRODUCTION AND PLACEMENT**

```
Item #: 15
Description: Monitor SMA production temperature at plant
Acceptance Criteria: Mix temperature within specified range (reduced by 20 deg C per March 2024 WMA mandate; typically 130-150 deg C for PMB SMA [VERIFY]); temperature recorded for each batch/truck; no overheating
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature measurement (plant thermometer)
Notes: MRTS30 — WMA mandate reduces maximum temperature. Overheating degrades PMB and fibre. Record temperatures for every truck.
```

```
Item #: 16
Description: Perform production sampling for grading and binder content verification
Acceptance Criteria: Sampling per AQP: minimum 1 set per lot (~400t or 1 day's production); grading within SMA design envelope; binder content within +/-0.3% of design; fibre content verified
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 2891.3.1 (extraction/grading), AS/NZS 2891.1 (binder content)
Notes: MRTS30 — Production sampling critical for SMA to maintain stone-on-stone contact and prevent drain-down
```

```
Item #: 17
Description: Verify mix temperature on arrival at paving site
Acceptance Criteria: Mix temperature >= minimum placement temperature (typically >= 120 deg C for PMB SMA [VERIFY]); temperature measured for each truck; reject loads below minimum temperature
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature measurement (IR gun)
Notes: MRTS30 Clause 8.7 — Hold Point 6: Non-conforming temperature. Do not place SMA outside specified temperature range without Administrator approval.
```

```
Item #: 18
Description: Monitor SMA placement (paver operation, layer thickness, surface appearance)
Acceptance Criteria: Layer thickness per design (no more than 5mm below design); surface uniform with rich mortar appearance; no visible drain-down (binder running to surface ahead of paver); no tearing, dragging, or segregation; joints hot-lapped where possible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS30 — SMA surface should have a uniform, rich appearance. Visible drain-down during placement indicates fibre/temperature problem.
```

```
Item #: 19
Description: Verify compaction (rolling pattern, passes, and temperature window)
Acceptance Criteria: Compaction per approved rolling pattern from trial; steel-wheeled roller (no pneumatic tyres on SMA due to pick-up risk [VERIFY]); compaction completed while mat temperature > 80 deg C [VERIFY]; no over-rolling
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS30 — SMA compaction window is typically narrower than DGA. Pneumatic tyres may pick up binder from SMA surface. [VERIFY roller type restrictions]
```

**PHASE 7: TESTING AND COMPLIANCE**

```
Item #: 20
Description: Extract cores for in-situ air voids and thickness verification
Acceptance Criteria: Minimum 3 cores per lot; in-situ air voids within 3-7% (SMA-specific range [VERIFY]); layer thickness not more than 5mm below design; core results within conformance limits per MRTS30 pay schedule
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q311 (core bulk density), AS/NZS 2891.8 (voids calculation)
Notes: MRTS30 Clause 9 — Lot length typically 100m. Administrator may approve reduced testing frequency of 1 per 50m in mid-block applications.
```

```
Item #: 21
Description: Verify surface texture of completed SMA layer
Acceptance Criteria: Surface texture depth meets specified minimum (typically >= 0.5mm for SMA14, >= 0.4mm for SMA10 [VERIFY]); uniform macrotexture across lane width; no flushing or fat spots
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Sand patch test (Austroads AG:PT/T250)
Notes: MRTS30 — SMA texture should be uniform with visible stone matrix pattern. Flushing indicates excess binder or over-compaction.
```

```
Item #: 22
Description: Verify completed SMA surface for defects (segregation, cracking, drain-down, joint quality)
Acceptance Criteria: No segregation exposing coarse aggregate clusters; no longitudinal or transverse cracking; no binder drain-down visible on surface; joints smooth with no bump or depression > 3mm; no loose stone
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual inspection, straightedge check
Notes: MRTS30 — Any segregated or defective areas must be cut out and replaced
```

```
Item #: 23
Description: Verify longitudinal profile and ride quality of completed SMA surface
Acceptance Criteria: Surface level tolerance +/-5mm (individual), +/-3mm mean deviation; 3m straightedge tolerance <= 5mm for base course; no ponding areas; crossfall per design; IRI per specification if required
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Level survey, straightedge, IRI measurement
Notes: MRTS30 — Surface regularity check every 20m with straightedge, 3 points across lane
```

**PHASE 8: COMPLIANCE ASSESSMENT AND ACCEPTANCE**

```
Item #: 24
Description: Submit lot compliance assessment for each SMA lot
Acceptance Criteria: All lot test results compiled; non-conformances identified with proposed disposition; compliance with MRTS30 pay schedule demonstrated; lot accepted by Administrator or pay adjustment applied
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 — Deductions apply to non-conformances in air voids per specification tables (different deduction rates for PMB mixes vs conventional binder)
```

```
Item #: 25
Description: Verify bond between SMA layer and underlying surface
Acceptance Criteria: Cores show SMA fully adhered to base (>= 90% bond area); no delamination or clean separation visible; any debonded areas cut out and replaced
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core visual inspection
Notes: MRTS30 — Bond failure typically caused by inadequate tack coat or contaminated surface
```

```
Item #: 26
Description: Submit complete SMA lot records package for final acceptance
Acceptance Criteria: Package includes: mix design registration, AQP, material certificates, production records, temperature records, placement records, core results, surface texture results, profile results, compliance assessment; all accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS30 — Complete asphalt quality records required for final acceptance
```

### Test Methods & Frequencies Summary (Template 31)

| Test | Standard | Frequency |
|------|----------|-----------|
| SMA mix design (volumetrics) | AS/NZS 2891 series | Per mix registration |
| Drain-down (Schellenberg) | AS/NZS 2891 [VERIFY] | Mix design + periodic production |
| TSR (moisture sensitivity) | TMR Q314 | Mix design + if non-conforming |
| Production grading & binder | AS/NZS 2891.3.1 / 2891.1 | 1 per lot (~400t or daily) |
| Temperature (plant) | Thermometer | Every batch/truck |
| Temperature (site) | IR gun | Every truck |
| In-situ air voids (cores) | TMR Q311 / AS/NZS 2891.8 | 3 cores per 100m lot |
| Thickness (cores) | Direct measurement | 3 cores per 100m lot |
| Surface texture | Austroads AG:PT/T250 | 3 locations per lane-km |
| Level/profile | Survey/straightedge | Every 20m, 3 points across |

---

## Template 32: High Modulus Asphalt (EME2) with WMA and RAP

### Template Header
```
Template Name: High Modulus Asphalt (EME2) - Including Warm Mix Asphalt and Recycled Asphalt Pavement
Activity Type: asphalt
Specification Reference: TMR MRTS32 High Modulus Asphalt (EME2) / TMR MRTS102 Reclaimed Asphalt Pavement Material
Edition/Revision Date: MRTS32 March 2024 [VERIFY] / MRTS102 November 2025
Related Standards: MRTS30 Asphalt Pavements (general requirements), MRTS17/MRTS18 (binders), MRTS101 (aggregates), TN148 (mix design registration), TN190 (Construction and Trafficking of EME2)
```

**Note on Template Scope:** The original brief requested "Warm Mix / Recycled Asphalt" as a separate template. However:
1. **WMA is now mandatory for ALL asphalt mixes** (MRTS30 March 2024) - it is not a separate product type
2. **MRTS35 (Recycled Material Blends for Pavements) was superseded November 2018** - no longer current
3. **MRTS32 (High Modulus Asphalt EME2)** is the only separate asphalt specification that incorporates both WMA additives and RAP material (up to 15%)

This template therefore covers EME2 as the specialist asphalt type, with WMA and RAP provisions highlighted.

**KEY QUESTION ANSWER:** Warm mix asphalt is commonly used (now mandatory) on ALL QLD TMR projects. Recycled asphalt pavement (RAP) is permitted and increasingly used, governed by MRTS102 (November 2025). EME2 is used on heavy-duty pavement projects and is project-specific (not on every project).

### Checklist Items

**PHASE 1: MIX DESIGN**

```
Item #: 1
Description: Submit EME2 mix design for registration per MRTS32 and TN148
Acceptance Criteria: EME2 mix design registered per TN148; nominal aggregate size 14mm; binder type complies with MRTS17 (hard grade bitumen); WMA additive (wax-based or surfactant-based) identified; mix design registration will not be accepted if WMA additive information not provided
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: Mix design per MRTS32
Notes: MRTS32 Clause 7 / TN148 — EME2 is high modulus asphalt EME Class 2 with 14mm nominal aggregate. Binder can contain wax-based or surfactant-based WMA additives.
```

```
Item #: 2
Description: If RAP is proposed, submit RAP material compliance documentation per MRTS102
Acceptance Criteria: RAP material complies with MRTS102 (November 2025); RAP sourced entirely from asphalt (no foreign materials); aggregates hard, sound, durable per MRTS101 Tables 7.1/7.2; particle size distribution determined after binder removal; RAP content <= 15% by mass of total mix
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: RAP testing per MRTS102
Notes: MRTS32 Clause 7.1.4 — Up to 15% RAP permitted. RAP must be free from: road base, concrete, coal tar, plastics, brick, timber, scrap rubber, dust, clay, dirt, and other deleterious matter. Must comply with MRTS102.
```

```
Item #: 3
Description: Verify EME2 mix design with RAP meets performance requirements (if RAP included)
Acceptance Criteria: EME2 mix designs containing up to 15% RAP can be registered based on 0% RAP mix design test results, provided binder content and particle size distribution are same as 0% RAP design; otherwise separate verification required
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: MRTS32 performance testing
Notes: MRTS32 — Simplified registration path for RAP mixes based on corresponding 0% RAP design
```

```
Item #: 4
Description: Perform Tensile Strength Ratio (TSR) test on EME2 mix
Acceptance Criteria: TSR >= 80%; if fails, halt production until cause addressed and Administrator approves restart
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q314
Notes: MRTS32 / MRTS30 — Hold Point: TSR failure halts production per MRTS30 Clause 7.2.5
```

**PHASE 2: MATERIAL VERIFICATION**

```
Item #: 5
Description: Verify aggregate compliance for EME2
Acceptance Criteria: Aggregate from registered quarry; complies with MRTS101; hard grade suitable for high modulus application; grading within EME2 envelope per MRTS32
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141 series (aggregate testing)
Notes: MRTS32 Clause 7 — EME2 aggregate quality requirements may be more stringent than standard DGA
```

```
Item #: 6
Description: Verify binder compliance for EME2 (hard grade bitumen with WMA additive)
Acceptance Criteria: Binder grade as specified per MRTS17; hard grade bitumen suitable for high modulus application; WMA additive incorporated at recommended dosage; binder test certificates provided
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Binder testing per AS 2008
Notes: MRTS32 / MRTS17 — Hard grade bitumen typically used for EME2 to achieve high modulus
```

```
Item #: 7
Description: If using RAP: verify RAP stockpile management and processing per MRTS102
Acceptance Criteria: RAP stockpile: separated by source/grade; protected from contamination; processed to uniform size; sampling and testing per MRTS102 (grading after binder removal, aggregate quality); traceability maintained
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: RAP testing per MRTS102
Notes: MRTS102 — RAP must be processed, stockpiled, and tested per MRTS102 requirements. Harmonised with Austroads ATS3135.
```

**PHASE 3: PRODUCTION SETUP**

```
Item #: 8
Description: Submit Asphalt Quality Plan (AQP) for EME2 production
Acceptance Criteria: AQP includes: EME2-specific production parameters, reduced manufacturing temperature (WMA mandate), RAP dosing system (if applicable), sampling plan, test methods, compliance assessment; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS32 / MRTS30 — AQP must address all EME2-specific requirements including WMA and RAP provisions
```

```
Item #: 9
Description: Verify asphalt plant setup for EME2 production (including RAP feed system if applicable)
Acceptance Criteria: Plant configured for EME2 production; temperature controls set for WMA-reduced temperatures (reduced by 20 deg C from pre-March 2024); RAP feed calibrated if applicable; no contamination from previous mix
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS32 / TN190 — Plant setup verification per TN190 Construction and Trafficking of High Modulus Asphalt
```

**PHASE 4: PLACEMENT TRIAL**

```
Item #: 10
Description: Construct EME2 placement trial section
Acceptance Criteria: Trial section demonstrates: compaction achievement, layer thickness, joint construction, temperature management; trial accepted by Administrator before full-scale production; results demonstrate EME2 performance requirements achievable
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core testing per MRTS32
Notes: MRTS32 / MRTS30 Clause 8.11 — Hold Point: Placement trial required. TN190 provides guidance on construction and trafficking of EME2.
```

**PHASE 5: SURFACE PREPARATION**

```
Item #: 11
Description: Verify substrate is prepared and accepted for EME2 placement
Acceptance Criteria: Substrate clean, stable, profiled as required; proof rolling passed; tack coat applied at correct rate; no weak areas; surface temperature suitable for paving
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS30 Clause 8.2 — Substrate acceptance required before paving
```

**PHASE 6: EME2 PRODUCTION AND PLACEMENT**

```
Item #: 12
Description: Monitor EME2 production temperature (WMA-reduced temperatures)
Acceptance Criteria: Manufacturing temperature within WMA-mandated range (reduced by 20 deg C from traditional hot mix); temperature recorded for each batch; no overheating that could degrade binder or WMA additive
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature measurement
Notes: MRTS32 / MRTS30 — WMA mandate applies. Manufacturing at lower temperatures reduces emissions by approximately 4800 tonnes CO2 annually across QLD if applied to all 3 million tonnes of asphalt produced.
```

```
Item #: 13
Description: Perform production sampling for grading, binder content, and RAP content verification
Acceptance Criteria: Sampling per AQP: minimum 1 set per lot; grading within EME2 envelope; binder content within +/-0.3% of design; RAP content within design limits (<= 15%)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 2891.3.1, AS/NZS 2891.1
Notes: MRTS32 — Production monitoring ensures mix consistency for high modulus performance
```

```
Item #: 14
Description: Verify mix temperature on arrival at paving site
Acceptance Criteria: Temperature >= minimum placement temperature; temperature recorded for each truck; reject loads below minimum
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Temperature measurement (IR gun)
Notes: MRTS32 / MRTS30 — EME2 typically requires higher compaction effort; adequate temperature essential
```

```
Item #: 15
Description: Monitor EME2 placement and compaction
Acceptance Criteria: Layer thickness per design; compaction per approved rolling pattern; surface uniform; no segregation, tearing, or dragging; joints properly constructed
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS32 / TN190 — EME2 typically placed in thick layers (50-100mm [VERIFY]) as base/binder course
```

**PHASE 7: TESTING AND COMPLIANCE**

```
Item #: 16
Description: Extract cores for in-situ air voids and thickness
Acceptance Criteria: Minimum 3 cores per lot; in-situ air voids within specified range per MRTS32; layer thickness not more than 5mm below design
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q311, AS/NZS 2891.8
Notes: MRTS32 — EME2 compaction requirements may differ from standard DGA
```

```
Item #: 17
Description: Verify modulus of EME2 layer (if site modulus testing specified)
Acceptance Criteria: Modulus meets EME2 design requirements (high modulus performance); testing method and acceptance criteria per project specification or MRTS32
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Modulus testing per MRTS32 [VERIFY specific test method]
Notes: MRTS32 — High modulus is the defining characteristic of EME2. Verification may be by laboratory testing of cores or deflection testing.
```

```
Item #: 18
Description: Verify surface profile and level of completed EME2 layer
Acceptance Criteria: Level tolerance per MRTS30; surface smooth and true; suitable for receiving subsequent layers; no ponding areas
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Level survey, straightedge
Notes: MRTS32 — EME2 typically used as structural layer under wearing course
```

**PHASE 8: COMPLIANCE AND ACCEPTANCE**

```
Item #: 19
Description: Submit lot compliance assessment for each EME2 lot
Acceptance Criteria: All lot test results compiled; compliance demonstrated; non-conformances identified; lot accepted or pay adjustment applied per MRTS30/MRTS32 pay schedule
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS32 — Compliance assessment per MRTS32 specific requirements
```

```
Item #: 20
Description: Submit complete EME2 production records including RAP and WMA documentation
Acceptance Criteria: Records include: mix design registration, AQP, material certificates (including RAP testing per MRTS102 and WMA additive documentation), production records, temperature records, core results, compliance assessment; all accepted
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS32 / MRTS102 — Complete records required including RAP traceability and WMA additive compliance
```

### Test Methods & Frequencies Summary (Template 32)

| Test | Standard | Frequency |
|------|----------|-----------|
| EME2 mix design | MRTS32 / AS/NZS 2891 | Per mix registration |
| TSR | TMR Q314 | Mix design + if non-conforming |
| RAP material testing | MRTS102 | Per stockpile/source |
| Production grading & binder | AS/NZS 2891.3.1 / 2891.1 | 1 per lot |
| Temperature (plant) | Thermometer | Every batch |
| Temperature (site) | IR gun | Every truck |
| In-situ air voids (cores) | TMR Q311 / AS/NZS 2891.8 | 3 cores per lot |
| Thickness (cores) | Direct measurement | 3 cores per lot |
| Modulus verification | Per MRTS32 [VERIFY] | Per project specification |
| Level/profile | Survey/straightedge | Per MRTS30 frequency |

---

## Summary of All Templates

| Template | MRTS Spec | Edition | Items | Hold Points | Witness Points | Standard |
|----------|-----------|---------|-------|------------|----------------|----------|
| 27. Structural Steelwork | MRTS78 | Nov 2020 | 34 | 9 | 7 | 18 |
| 28. Bridge Bearings | MRTS81 | Nov 2020 [VERIFY] | 20 | 7 | 3 | 10 |
| 29. Precast Concrete Elements | MRTS72/MRTS70/MRTS74 | Jul 2019/Jul 2022/Nov 2023 | 30 | 10 | 5 | 15 |
| 30. Post-Tensioning | MRTS89 | Jul 2017 [VERIFY] | 25 | 11 | 3 | 11 |
| 31. Stone Mastic Asphalt | MRTS30 (SMA clauses) | Mar 2024 | 26 | 7 | 0 | 19 |
| 32. High Modulus Asphalt (EME2) | MRTS32/MRTS102 | Mar 2024/Nov 2025 | 20 | 6 | 0 | 14 |

**Total items across all 6 templates: 155**

---

## Items Requiring Verification

The following items are flagged with [VERIFY] and should be checked against the actual TMR specification PDFs when access is available:

### MRTS78 (Structural Steelwork)
- Exact NDE percentages for CC2 and CC3 per AS/NZS 5131 tables
- MT/PT test standard references (listed as AS 2177 but may be different)
- Specific DFT requirements per coating system type

### MRTS81 (Bridge Bearings)
- Current edition date (listed as November 2020 but may have been updated)
- Maximum mean compressive stress value (50 MPa cited from search results)
- Specific clause numbers for hold points
- Elastomer test standard references for compression set and ozone resistance

### MRTS89 (Post-Tensioning)
- Current edition date (listed as July 2017 but may have been updated)
- Air pressure test pressure value (50 kPa listed as typical)
- Grout bleed limit (0.3% listed as typical)
- Grout strength requirement (27 MPa listed as typical)
- Specific clause numbers for each hold point
- Strand tail cutting distance specification

### MRTS72 (Precast Concrete)
- Specific clause numbers for several hold points
- Steam curing temperature limits (70 deg C and 20 deg C/hour rate)
- Factory benchmark sample requirements

### MRTS30 SMA Clauses
- Drain-down test limit (0.3% listed as typical)
- Specific air void ranges for SMA in-situ vs lab
- Roller type restrictions for SMA
- Surface texture depth minimums for SMA10 and SMA14

### MRTS32 (EME2)
- Current edition date
- Specific modulus test method
- Layer thickness ranges

---

## Research Sources

1. [TMR Specifications Index](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/specifications-index)
2. [TMR Category 2 - Bridges, Marine and Structures](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/2-bridges-marine-and-structures)
3. [TMR Category 5 - Pavements, Subgrade and Surfacing](https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Specifications/5-Pavements-Subgrade-and-Surfacing)
4. [TMR Specifications Amendment Register 2014-2025](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/AmendmentRegister.pdf)
5. [TMR Technical Note 148 - Asphalt Mix Design Registration (June 2025)](https://www.tmr.qld.gov.au/_/media/busind/techstdpubs/technical-notes/pavements-materials-geotechnical/tn148.pdf)
6. [TMR Technical Note 190 - Construction and Trafficking of High Modulus Asphalt EME2](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Pavements-materials-geotechnical/TN190ConstructionandTraffickingofHighModulusAsphaltEME2.pdf)
7. [TMR Product Index for Bridges and Other Structures](https://www.tmr.qld.gov.au/-/media/busind/businesswithus/Approved-products-and-suppliers/Bridges-and-other-structures/ProductIndexBridgesOtherStructures.pdf)
8. [TMR Registered Precast Concrete Suppliers (September 2025)](https://www.tmr.qld.gov.au/-/media/busind/businesswithus/Approved-products-and-suppliers/Bridges-and-other-structures/PrecastConcreteApprovedSuppliers.pdf)
9. [AS/NZS 5131:2016 Structural Steelwork Fabrication - ASI Brochure](https://www.steel.org.au/ASI/media/Australian-Steel-Institute/Banners/media_File_ASNZS_5131_Brochure.pdf)
10. [TMR Technical Note 60 - Materials Test Certificates Acceptance](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Bridges-other-structures/TN60.pdf)
