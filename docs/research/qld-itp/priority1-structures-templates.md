# Priority 1 Structural ITP Templates - Queensland TMR/MRTS

## Research Summary

**Date:** 2026-02-10
**Researcher:** Claude (automated research)
**Status:** Complete - ready for database seeding with [VERIFY] flags where clause numbers require confirmation against full PDF specifications

### Specification Identification Note

During research it was confirmed that **MRTS78 is "Fabrication of Structural Steelwork"** (not piling). The correct TMR piling specifications are:

- **MRTS63** - Cast-In-Place Piles (bored/lined piles in rock) - November 2020
- **MRTS63A** - Piles for Ancillary Structures (bored piles for sign gantries, barriers, etc.) - November 2020
- **MRTS64** - Driven Tubular Steel Piles (with reinforced concrete pile shaft) - November 2020
- **MRTS65** - Precast Prestressed Concrete Piles - November 2020
- **MRTS66** - Driven Steel Piles (H-piles, sheet piles) - July 2017
- **MRTS68** - Dynamic Testing of Piles - July 2017
- **MRTS71** - Reinforcing Steel (June 2020, updated through July 2025)

The reinforcement specification is **MRTS71** (not MRTS59). MRTS59 is "Manufacture of Fibre Reinforced Polymer (FRP) Composite Girders".

### Sources

- [TMR Specifications Index](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/specifications-index)
- [Category 2 - Bridges, Marine and Structures](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/2-bridges-marine-and-structures)
- [MRTS64 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS64.pdf?la=en)
- [MRTS63 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS63.pdf?la=en)
- [MRTS63A PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS63A.pdf?la=en)
- [MRTS65 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS65.pdf?la=en)
- [MRTS66 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS66.pdf?la=en)
- [MRTS68 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS68.pdf?la=en)
- [MRTS71 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS71.pdf?la=en)
- [MRTS70 PDF](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS70.pdf)
- [TMR Amendment Register](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/AmendmentRegister.pdf?la=en)
- [AS 2159-2009 Piling Design and Installation](https://store.standards.org.au/product/as-2159-2009)
- Existing project data: `docs/tmr-mrts-itp-raw.txt` (MRTS70 structural concrete hold points)

---

## Template 12: Piling (Bored, CFA, Driven - Bridge/Structure Foundations)

### Template Header
```
Template Name: Piling (Bored, CFA, Driven - Bridge/Structure Foundations)
Activity Type: structures
Specification Reference: TMR MRTS63 / MRTS64 / MRTS65 / MRTS66 / MRTS68 / MRTS70 / MRTS71 / AS 2159
Edition/Revision Date: November 2020 (MRTS63/64/65), July 2017 (MRTS66/68)
```

### Checklist Items

---

#### Section A: Pre-Work Submissions & Approvals

```
Item #: 1
Description: Submit Piling Construction Procedure including pile type, equipment, installation sequence, concrete mix, and contingency plans for the Administrator's acceptance
Acceptance Criteria: Procedure addresses all specification requirements; submitted minimum 28 days prior to commencement; accepted by Administrator in writing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS63 / Clause 5.2 MRTS64 [VERIFY] - Hold Point 1 in all piling specs. No piling work to commence until procedure is accepted. Must include details of plant, liner/casing material, excavation method, concreting method (dry/tremie), and pile integrity testing program.
```

```
Item #: 2
Description: Submit Concrete Mix Design for pile shaft concrete to the Administrator for acceptance
Acceptance Criteria: Mix design meets MRTS70 requirements for specified concrete class (typically S40 or S50); f'c >= specified strength; w/c ratio within limits; submitted with trial mix results
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 15.1 MRTS70 - Hold Point 1 (Concrete). No concrete to be placed until mix design approved. For tremie placement, mix must have high workability (typically 180-220mm slump or self-compacting) and be designed for underwater placement per CIA Z17.
```

```
Item #: 3
Description: Submit Weld Procedure Specification (WPS) for liner/casing fabrication and field splice welding
Acceptance Criteria: WPS compliant with AS/NZS 1554.1; qualified by testing per AS/NZS 1554; all welders hold current qualifications; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63 / MRTS64 - Hold Point 2. All spiral, longitudinal, transverse and field splice welds shall be full penetration butt welds. WPS must be qualified prior to any welding on site.
```

```
Item #: 4
Description: Submit Geotechnical Investigation Report and confirm design founding levels with geotechnical assessor
Acceptance Criteria: Borehole data at or adjacent to each pile location; founding level confirmed as reaching competent material; report endorsed by qualified geotechnical engineer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 2159 Clause 4 [VERIFY] - Design assumptions must be confirmed by site investigation. Geotechnical Assessor must review ground conditions against design assumptions per AS 5100.3.
```

```
Item #: 5
Description: Submit Pile Integrity Testing program (PIT/PDA) including testing contractor qualifications and proposed test methodology
Acceptance Criteria: Testing program covers 100% of piles for low-strain PIT and nominated percentage for dynamic/static load testing; testing contractor qualifications accepted; methodology compliant with MRTS68
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS68 [VERIFY] - Program must detail PDA (high-strain) and PIT (low-strain) testing methodology, equipment calibration, and reporting format. MRTS65/66/68 require 100% monitoring of driven piles at end of drive.
```

```
Item #: 6
Description: Submit Reinforcing Steel supplier acceptance documentation
Acceptance Criteria: Steel reinforcement supplier is TMR-registered; certified by ACRS or equivalent TMR-approved product certification body; mill certificates provided for all bar sizes
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6.1 MRTS71 - Hold Point 1 (Reinforcing Steel). Steel reinforcement manufacture and processing shall be certified by independent product certification body (e.g. ACRS). Reinforcement supplied by TMR-registered supplier only.
```

```
Item #: 7
Description: Verify survey set-out of pile locations against design drawings
Acceptance Criteria: Pile positions set out within +/-25mm of design coordinates; reference markers established for each pile; survey report prepared
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS56 Construction Surveying. Set-out to be checked by independent surveyor prior to commencing piling. Reference points to be maintained throughout construction for post-installation verification.
```

```
Item #: 8
Description: Verify piling plant and equipment compliance with submitted construction procedure
Acceptance Criteria: Piling rig, crane, hammer (if driven), oscillator/rotator (if bored) match the approved procedure; equipment in serviceable condition; operator qualifications current
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS63/64. Equipment must be capable of achieving the design founding level and pile capacity. For driven piles, hammer energy rating must be adequate for the pile type and ground conditions.
```

---

#### Section B: Material Verification

```
Item #: 9
Description: Verify steel liner/casing material certificates and dimensions
Acceptance Criteria: Steel grade compliant with AS/NZS 3678 or AS/NZS 1163 as specified; wall thickness >= design minimum (>20mm for MRTS64); diameter within tolerance; mill certificates provided
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6 MRTS64 [VERIFY]. For MRTS64 driven tubular piles, liners are large diameter thick-walled (>20mm) steel tubes. Verify wall thickness, grade and freedom from defects. Each liner must be individually identified.
```

```
Item #: 10
Description: Verify precast concrete pile material certificates and quality (if precast prestressed piles)
Acceptance Criteria: Piles manufactured by TMR-registered precaster; concrete strength >= specified f'c; prestressing force verified; pile dimensions within tolerance; no visible defects (cracks, spalling)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS65. Each pile must have unique identification. Check for damage during transport. Manufacturing QA records must be provided including concrete strength at transfer and at 28 days.
```

```
Item #: 11
Description: Verify reinforcement cage fabrication against bar schedule and drawings
Acceptance Criteria: Bar sizes, spacing, lap lengths, and cage dimensions match approved drawings; cage rigidity adequate for handling and installation; spacer/centraliser locations correct; cover to liner/bore wall achieved
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 10 MRTS71 / MRTS63 [VERIFY]. Cage must be fabricated to tolerance and maintain concentricity during concrete placement. Centralisers at maximum 3m spacing (or as specified). Minimum concrete cover to liner typically 75mm; to ground (bored piles without liner) typically 75-100mm per AS 2159.
```

```
Item #: 12
Description: Verify concrete supply arrangements including batching plant approval and delivery logistics
Acceptance Criteria: Batching plant has current TMR approval or NATA-accredited; delivery time from plant to site <= 90 minutes (or approved extended time per TN125); contingency supply arranged for continuous pours
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS70 / TMR Technical Note TN125. Pile concrete must be placed continuously without interruption. Adequate supply capacity must be demonstrated to complete each pile in a single pour.
```

---

#### Section C: Pile Installation - Bored/Cast-In-Place (MRTS63)

```
Item #: 13
Description: Verify bore/liner installation verticality and position at commencement of each pile
Acceptance Criteria: Pile position within 75mm of design in plan; verticality within 1:100 (bored) or 1:75 (driven) unless otherwise specified; bore collar/guide in correct position
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 2159 Clause 7.2 [VERIFY]. Position tolerance of 75mm in any horizontal direction at commencing level. Verticality tolerance as specified on drawings (typically 1:75 for driven piles, 1:100 for bored piles). Record actual position of each pile.
```

```
Item #: 14
Description: Monitor boring/excavation operations and record ground conditions encountered
Acceptance Criteria: Continuous log of ground conditions maintained for each pile; material changes recorded with depth; groundwater levels recorded; bore stability maintained throughout excavation
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63. Boring log must clearly identify pile number, location, date, depth, ground conditions, water levels. Compare with design assumptions. Notify Geotechnical Assessor of any unexpected conditions.
```

```
Item #: 15
Description: Verify adjacent pile spacing and timing requirements before boring near recently cast piles
Acceptance Criteria: Pile within 2.5m clear distance of newly concreted pile not bored or driven until minimum 18 hours after completion of concreting in adjacent pile
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63. This prevents disturbance to fresh concrete in adjacent piles from vibration or ground displacement.
```

```
Item #: 16
Description: Conduct test drilling at pile base to verify founding conditions extend to adequate depth below pile base
Acceptance Criteria: Test hole minimum 24mm diameter drilled to depth >= 2.4m or two pile diameters below pile base (whichever greater); material competence confirmed; results supervised by Geotechnical Assessor
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Rotary or percussion test drilling
Notes: Clause [VERIFY] MRTS63 - Hold Point 3. Required where borelogs in close proximity have not reached minimum 3m or two pile diameters below pile base level. At least one test hole at each abutment and pier location. Written record signed by Geotechnical Assessor.
```

```
Item #: 17
Description: Dewater pile excavation and clean pile base of all foreign and loose material prior to inspection
Acceptance Criteria: Pile base dewatered to allow dry inspection if practicable; bearing surface thoroughly cleaned; no debris, loose rock or sediment on base; base dressed to level
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS63. Dewatering and cleaning is the fundamental process which must occur prior to the Geotechnical Assessor attempting to certify the pile. Bearing surface quality is critical.
```

```
Item #: 18
Description: Geotechnical certification of pile base (socket) and founding level - inspection and acceptance of excavation
Acceptance Criteria: Geotechnical Assessor certifies ground conditions match design assumptions; factored geotechnical strength >= design loads per AS 5100.3; actual foundation levels and bell/socket dimensions recorded and meet or exceed drawing requirements
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: Visual inspection / geotechnical assessment
Notes: Clause [VERIFY] MRTS63 - Hold Point 3/4. Critical quality gate. Base and socket inspected in dry conditions if practicable. If not inspectable dry, special conditions apply. Geotechnical Assessor must sign certification. Actual vs design depth recorded. No concrete placement until Hold Point released.
```

```
Item #: 19
Description: Geotechnical re-certification after delay or reclean of pile base
Acceptance Criteria: If delay between initial certification and concrete placement (typically >4 hours), or if base has been re-cleaned, Geotechnical Assessor must re-inspect and re-certify; no deterioration of founding conditions
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: Visual inspection / geotechnical assessment
Notes: Clause [VERIFY] MRTS63 - Hold Point 4. Addresses risk of groundwater seepage, soil relaxation or contamination during delay between excavation acceptance and concrete placement.
```

---

#### Section D: Pile Installation - Driven Piles (MRTS64/65/66)

```
Item #: 20
Description: Verify pile driving hammer selection and energy rating against approved procedure
Acceptance Criteria: Hammer type, weight and energy rating match approved procedure; hammer energy adequate to achieve design founding level and set criteria; hammer cushion in serviceable condition
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS64/65/66. Hammer must be appropriate for pile type and ground conditions. For MRTS64 (tubular steel), large diameter piles require significant energy.
```

```
Item #: 21
Description: Monitor pile driving with continuous PDA (Pile Driving Analyzer) monitoring at end of drive
Acceptance Criteria: 100% of driven piles monitored at end of drive; PDA data recorded for all blows in final set; force and velocity traces recorded; results correlated with dynamic pile testing
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: PDA / High-Strain Dynamic Testing per MRTS68
Notes: Clause [VERIFY] MRTS68. TMR specifications require 100% monitoring at end of drive. Results used to determine input parameters for Hiley Formula capacity estimation. CAPWAP signal matching analysis required for nominated test piles.
```

```
Item #: 22
Description: Verify pile driving set criteria achieved at founding level
Acceptance Criteria: Pile driven to predetermined Founding Level; set (penetration per blow) within specified criteria (typically 2-10mm per blow at refusal depending on pile type); no pile damage indicators in PDA traces
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: PDA monitoring / Set measurement
Notes: Clause [VERIFY] MRTS64/65/66. For MRTS64 driven tubular piles, founding level is predetermined. Pile must be driven to Founding Level and capacity checked. Set criteria vary by pile type and ground conditions - refer to project specification.
```

```
Item #: 23
Description: Check driven pile head condition for damage after driving
Acceptance Criteria: No crushing, splitting, or spalling of pile head; steel pile: no buckling, tearing or distortion of pile shell; concrete pile: no cracking exceeding 0.3mm width; pile head suitable for cutoff
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: Visual inspection
Notes: Clause [VERIFY] MRTS64/65/66. Driving damage can compromise pile integrity. Any damage must be reported and assessed before continuing. Damaged piles may require remedial measures or replacement.
```

```
Item #: 24
Description: Verify pile position and verticality after installation (as-driven survey)
Acceptance Criteria: Final pile position within 75mm of design in plan at cutoff level; verticality within 1:75 or as specified; no lateral displacement; rake (if battered pile) within 1:25 of specified rake
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey
Notes: AS 2159 Clause 7.2. Survey each pile immediately after driving. Record actual position versus design position. Out-of-position piles must be assessed by the designer for structural adequacy - may require additional piles or revised pile cap design.
```

---

#### Section E: Excavation & Concrete Placement for Driven Tubular Piles (MRTS64)

```
Item #: 25
Description: Excavate interior of driven tubular pile to Plug Level and verify excavation depth
Acceptance Criteria: Excavation to Plug Level as shown on drawings; no disturbance to soil below founding level; excavation depth measured and recorded; bore walls stable
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS64. After driving to founding level, the pile interior is partially excavated. Plug Level is the base level of the mass concrete plug.
```

```
Item #: 26
Description: Cast mass concrete plug at base of driven tubular pile
Acceptance Criteria: Plug concrete placed from Plug Level to design height; concrete class as specified (typically S32 minimum); plug cast without interruption; plug concrete achieves required strength before shaft concrete placement
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS64. The concrete plug provides the bearing surface for the reinforced concrete pile shaft. Must be cast in dry conditions or by approved tremie method.
```

---

#### Section F: Reinforcement and Concrete for All Pile Types

```
Item #: 27
Description: Inspect reinforcement cage prior to installation in bore/liner
Acceptance Criteria: All bars, stirrups and ligatures per approved drawings; correct bar sizes and spacing; lap lengths achieved; cage dimensions within tolerance; centralisers/spacers fitted; cage clean and free from loose rust/contamination
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 10 MRTS71 - Hold Point 3 (Inspection of reinforcement before placement of concrete) / MRTS63 [VERIFY]. This is a formal hold - concrete must not be placed until reinforcement is inspected and accepted by the Administrator. Check cage for rigidity, centraliser condition and spacing.
```

```
Item #: 28
Description: Install reinforcement cage into pile bore/liner and verify final position
Acceptance Criteria: Cage installed without damage; cage centrally located in bore/liner; top of cage at correct level relative to cutoff level; no displacement during lowering; minimum 75mm cover to liner/ground maintained
Point Type: witness
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause [VERIFY] MRTS63/64. Cage installation must be supervised. Any cage displacement or damage during installation must be rectified. Cage must be suspended at correct level, not resting on pile base. Check plumbness.
```

```
Item #: 29
Description: Pre-pour inspection: verify formwork, reinforcement, cleanliness and readiness for concrete placement
Acceptance Criteria: Reinforcement accepted (Hold Point 27 released); bore/liner clean and free of debris/standing water (or tremie approved); all embedded items correctly positioned; tremie pipe/pump line ready if wet pour; concrete supply confirmed available
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 11.3 MRTS70 / Clause [VERIFY] MRTS63 - Hold Point. No concrete shall be placed until formwork and reinforcement are inspected and accepted as correct. This is the critical quality gate immediately before concreting. Administrator (or delegate) must release.
```

```
Item #: 30
Description: Approve tremie concrete placement method for wet pours (if applicable)
Acceptance Criteria: Tremie pipe diameter adequate (typically >= 150mm); tremie pipe reaches pile base; approved procedure for establishing and maintaining seal; continuous pour procedure confirmed; compliant with CIA Z17 Recommended Practice
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63 - Hold Point 5 (Placement of concrete with a tremie). If pile cannot be dewatered, tremie placement requires specific approval. Tremie must not be lifted off the concrete surface during placement. Tremie pipe minimum embedment in fresh concrete typically 1.5-3m.
```

```
Item #: 31
Description: Conduct concrete slump/flow test and temperature check prior to placement
Acceptance Criteria: Slump within +/-15mm of nominated value (or flow spread 500-600mm for SCC); concrete temperature 10-32 degrees C; time since batching <= 90 minutes; air content within range (if specified)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (Slump) / AS 1012.8.4 (Temperature)
Notes: MRTS70. Test every truck initially. For pile concrete, high workability is essential. Reject loads not meeting specification. Record batch ticket details for each load.
```

```
Item #: 32
Description: Cast concrete test cylinders during pile concrete placement
Acceptance Criteria: Minimum 1 set of 3 cylinders per pile or per 50m3 (whichever gives more frequency); cylinders 100x200mm or 150x300mm per AS 1012.8.1; samples taken from representative loads
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.8.1 (Making) / AS 1012.9 (Compressive Strength)
Notes: MRTS70. Cylinders for 7-day and 28-day strength testing. Cured in accordance with AS 1012.8. Results to be provided to Administrator within 3 days of testing.
```

```
Item #: 33
Description: Monitor concrete placement operations - verify continuous pour, vibration (if applicable), and concrete level
Acceptance Criteria: Concrete placed in continuous operation without interruption; concrete level rises uniformly; no segregation; no contamination from groundwater or debris; tremie pipe embedded minimum depth maintained; final concrete level at or above design cutoff level + 600mm minimum
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63/64. Administrator should be given 24 hours notice of pour start. Concrete must be cast to minimum 600mm above cutoff level to allow for contaminated/laitance concrete at top to be removed during pile cutoff. Record start/finish times, truck numbers, volumes.
```

```
Item #: 34
Description: Record pile concreting log with volumes, times, truck details and any incidents
Acceptance Criteria: Complete concreting log maintained for each pile; actual concrete volume within +/-10% of theoretical volume (flagged if exceeds +20% indicating over-break); no interruptions exceeding approved time limits
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63/64. Over-consumption of concrete may indicate over-break, voids or ground loss. Under-consumption may indicate obstruction or cage displacement. Both require investigation.
```

---

#### Section G: Pile Cutoff and Head Treatment

```
Item #: 35
Description: Verify concrete has achieved minimum strength before pile cutoff operations
Acceptance Criteria: Concrete compressive strength >= 10 MPa (or as specified) before breaking down pile head; strength confirmed by cylinder test results or maturity method
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause [VERIFY] MRTS63/64. Premature pile cutoff can damage the pile shaft. Allow adequate curing time.
```

```
Item #: 36
Description: Cut off pile head to design level and prepare pile head for pile cap/headstock connection
Acceptance Criteria: Cutoff level within +/-25mm of design elevation; pile head surface perpendicular to pile axis; reinforcement protruding to correct length for connection; no damage to reinforcement or pile shaft below cutoff level; concrete surface clean and prepared for bonding
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Survey
Notes: Clause [VERIFY] MRTS63/64. Pile cutoff must be by approved method (typically hydraulic breaking, not drop weight). Protruding reinforcement must have correct embedment length for pile cap connection.
```

```
Item #: 37
Description: Survey pile head position and level after cutoff
Acceptance Criteria: Pile head position confirmed within 75mm of design in plan; cutoff level within +/-25mm of design; pile head square and level; protruding reinforcement lengths correct
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey
Notes: AS 2159 Clause 7.2 [VERIFY]. Final as-built survey of all pile heads. This forms part of the pile schedule and as-built documentation.
```

---

#### Section H: Pile Integrity Testing

```
Item #: 38
Description: Conduct Low-Strain Pile Integrity Testing (PIT) on cast-in-place piles after concrete achieves adequate strength
Acceptance Criteria: PIT conducted on 100% of cast-in-place piles (unless otherwise approved); testing performed when concrete >= 70% f'c (typically 7-14 days after casting); Pile Integrity Factor >= 0.7; no significant shaft defects indicated
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Low-Strain Impact Integrity Testing (PIT) per ASTM D5882 / AS 2159
Notes: Clause [VERIFY] MRTS63/68. Low-strain PIT uses accelerometer and hand-held hammer to check pile continuity. Any anomalous results (major reflections, velocity changes) trigger further investigation - may require cross-hole sonic logging or coring.
```

```
Item #: 39
Description: Conduct High-Strain Dynamic Testing (PDA) on driven piles during driving
Acceptance Criteria: PDA monitoring on 100% of driven piles at end of drive; CAPWAP signal matching analysis performed on nominated test piles (typically minimum 5% or as specified); measured capacity >= required design ultimate capacity
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: PDA per MRTS68 / ASTM D4945
Notes: Clause [VERIFY] MRTS68. Results correlated with Hiley Formula. CAPWAP analysis provides shaft friction and end bearing distribution. Any pile not achieving required capacity must be redriven or additional piles installed.
```

```
Item #: 40
Description: Submit Pile Integrity Test reports and obtain acceptance from Administrator
Acceptance Criteria: All PIT/PDA reports submitted within 14 days of testing; reports include pile identification, test data, analysis, interpretation and recommendations; all piles achieving satisfactory results; any anomalous piles addressed
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63/68 - Hold Point (Submission and approval of Pile Integrity Test Reports). Administrator must accept integrity test reports before subsequent work on pile caps/headstocks can proceed.
```

```
Item #: 41
Description: Conduct static load testing on nominated piles (if specified)
Acceptance Criteria: Static load test conducted per AS 2159; pile sustains test load (typically 1.5x to 2.0x design working load) without exceeding settlement criteria; load-settlement curve within acceptable parameters; test report submitted and accepted
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Static Load Test per AS 2159
Notes: Clause [VERIFY] MRTS63/64. Static load testing is the definitive pile capacity verification. Typically required on preliminary/test piles and a percentage of working piles. Settlement criteria per AS 2159 (typically <25mm at working load, <50mm at 1.5x working load).
```

---

#### Section I: Post-Installation Verification & Documentation

```
Item #: 42
Description: Verify 28-day concrete compressive strength results for pile shaft concrete
Acceptance Criteria: All cylinder results meet MRTS70 acceptance criteria; no sample < 0.9 f'c; batch mean - 0.5 x standard deviation >= f'c; any non-conforming results investigated and dispositioned
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: MRTS70 Appendix A [VERIFY]. Strength acceptance is statistical. For 40 MPa concrete, no cylinder below 36 MPa. Non-conforming lots require investigation - may require core testing of actual pile.
```

```
Item #: 43
Description: Prepare and submit complete Pile Schedule (as-built record for each pile)
Acceptance Criteria: Record for each pile includes: pile number, date installed, design vs actual position, design vs actual founding level, verticality, concrete mix used, volume placed, strength results, integrity test results, any incidents or deviations
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS63/64. The pile schedule is the primary as-built record. Must be maintained progressively during construction and completed before pile cap work commences.
```

```
Item #: 44
Description: Submit conformance report for completed piling works
Acceptance Criteria: Report confirms all piles installed in accordance with specification; all hold points released; all test results compliant; any non-conformances addressed; report accepted by Administrator
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 Quality System Requirements. Conformance report is the summary document that demonstrates all quality requirements have been met.
```

```
Item #: 45
Description: Conduct down-the-hole inspection of each bored pile before concrete placement (for piles >= 750mm diameter in dry conditions)
Acceptance Criteria: Base cleanliness confirmed (no debris >50mm); socket dimensions verified; rock quality at base matches design assumptions; inspection recorded by camera or inspector's log
Point Type: hold_point
Responsible Party: contractor
Evidence Required: photo
Test Type: Visual inspection (DTI camera for wet/small diameter piles)
Notes: Clause [VERIFY] MRTS63. For every bored pile, a down-the-hole inspection (DTI) is conducted prior to placing concrete. Personnel entry if diameter >750mm and dry. Camera inspection for smaller or wet holes. Part of Hold Point 3/4 (geotechnical certification).
```

```
Item #: 46
Description: Verify pile cap/headstock construction joint preparation before subsequent structural works
Acceptance Criteria: Pile heads properly prepared for pile cap connection; exposed reinforcement clean and undamaged; concrete surface roughened to 5mm amplitude; no laitance or loose material; pile positions and levels within tolerance for pile cap construction
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS70 construction joint requirements [VERIFY]. The interface between pile and pile cap is a critical structural joint. Surface preparation must ensure full bond and shear transfer.
```

```
Item #: 47
Description: Verify CFA (Continuous Flight Auger) pile auger withdrawal rate and concrete pressure during installation (if CFA piles used)
Acceptance Criteria: Auger withdrawal rate controlled to maintain positive concrete pressure at all times; concrete pressure monitored continuously; volume of concrete placed >= theoretical pile volume; no soil inclusions or necking
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Automated CFA monitoring system
Notes: CFA-specific requirement [VERIFY]. CFA piles require continuous monitoring of concrete pressure versus auger depth to ensure pile integrity. Any drop in pressure or over-extraction rate is non-conforming.
```

```
Item #: 48
Description: Verify ground vibration and noise monitoring compliance during driven pile installation (where required)
Acceptance Criteria: Vibration levels at nearest sensitive receiver within specified limits (typically 5-10 mm/s PPV for residential); noise levels comply with environmental approval conditions; monitoring records maintained
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Vibration monitoring (AS 2187.2)
Notes: Environmental approval conditions and project specification. May be required near existing structures, utilities or sensitive receptors. Continuous monitoring during driving operations.
```

---

### Test Methods & Frequencies Summary (Piling)

| Test / Property | Test Method | Typical Frequency | Key Acceptance Value |
|----------------|-------------|-------------------|---------------------|
| Pile position (plan) | Survey | 100% of piles | Within 75mm of design |
| Pile verticality | Survey / inclinometer | 100% of piles | Within 1:75 (driven) or 1:100 (bored) |
| Cutoff level | Survey | 100% of piles | Within +/-25mm of design |
| Concrete slump | AS 1012.3.1 | Every truck | +/-15mm of nominated (or flow spread 500-600mm) |
| Concrete temperature | AS 1012.8.4 | Every truck | 10-32 deg C |
| Concrete cylinders (7 & 28 day) | AS 1012.8.1 / AS 1012.9 | 1 set of 3 per pile or per 50m3 | f'c >= specified; no sample < 0.9 f'c |
| PDA - High-strain dynamic | MRTS68 / ASTM D4945 | 100% of driven piles at end of drive | Capacity >= design ultimate |
| CAPWAP analysis | MRTS68 | Min 5% of piles (or as specified) | Capacity confirmed by signal matching |
| PIT - Low-strain integrity | ASTM D5882 / AS 2159 | 100% of cast-in-place piles | Integrity Factor >= 0.7; no major defects |
| Static load test | AS 2159 | As specified (typically 1-2% of piles) | Settlement < 25mm at working load |
| Test drilling at base | Rotary/percussion drilling | At least 1 per abutment/pier location | Competent material to 2.4m or 2D below base |
| Down-the-hole inspection | Visual / camera | 100% of bored piles | Clean base, correct socket dimensions |
| Concrete volume check | Batch ticket summation | 100% of piles | Actual within +/-10% of theoretical |
| Steel reinforcement | Mill certificates + visual | 100% batches, random tensile per 30t | Compliant with AS/NZS 4671 / MRTS71 |
| Weld quality (liner splices) | Visual + NDE per WPS | 100% welds visual; NDE as per WPS | Full penetration butt welds per AS/NZS 1554.1 |

---

## Template 13: Reinforcement Placement (for All Structural Concrete)

### Template Header
```
Template Name: Reinforcement Placement (All Structural Concrete)
Activity Type: structures
Specification Reference: TMR MRTS71 / MRTS70 / AS 3600 / AS/NZS 4671
Edition/Revision Date: June 2020 (MRTS71, updated through July 2025)
```

### Checklist Items

---

#### Section A: Pre-Work Submissions & Material Acceptance

```
Item #: 1
Description: Submit proposed steel reinforcement supplier for Administrator acceptance
Acceptance Criteria: Supplier is TMR-registered; manufacture and processing certified by independent product certification body (ACRS or equivalent TMR-approved); supplier registration documentation submitted minimum 3 days prior to supply
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6.1 MRTS71 - Hold Point 1 (Acceptance of Supplier). Steel reinforcement shall only be supplied by a TMR-registered supplier. This hold applies before any reinforcement is delivered to site. 3 day notification period.
```

```
Item #: 2
Description: Verify reinforcement material compliance certificates (mill certificates) for each batch/delivery
Acceptance Criteria: Mill certificates confirm compliance with AS/NZS 4671 (grade 500N, 500L, or 500E as specified); chemical composition and mechanical properties within limits; certificates traceable to heat/cast numbers; each bar size covered
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6.1.1 MRTS71 [VERIFY]. Mill certificates must accompany every delivery. Verify steel grade matches specification requirements. Bar identification marks must be legible and match certificates.
```

```
Item #: 3
Description: Conduct random tensile testing of reinforcement samples
Acceptance Criteria: Tensile test results comply with AS/NZS 4671; yield strength, ultimate tensile strength, elongation, and UTS/yield ratio within specification limits; testing at minimum 1 sample per 30 tonnes per bar size
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS/NZS 4671 / AS 1391 (Tensile testing of metals)
Notes: Clause 6 MRTS71 [VERIFY]. Random verification testing of reinforcement mechanical properties. Frequency may be reduced if supplier has established quality record with TMR.
```

```
Item #: 4
Description: Submit bar schedule and check against structural drawings
Acceptance Criteria: Bar schedule matches current structural drawings including all amendments; bar marks, sizes, shapes, lengths, quantities all correct; schedule prepared in accordance with TMR Volume 3 Chapter 4 (Computer Preparation of Steel Schedules)
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: TMR Volume 3, Chapter 4 - Drafting and Design Presentation Standards. Bar schedules are the primary communication between design and fabrication. Must be checked by an independent person before fabrication commences.
```

```
Item #: 5
Description: Verify bar chair and spacer materials and supplier registration
Acceptance Criteria: Bar chairs and spacers comply with MRTS70 Concrete requirements; plastic chairs/spacers suitable for exposure class; concrete bar chairs for ground-contact applications; supplier registered where required
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS71/MRTS70. Bar chairs must be appropriate for the exposure class. Plastic chairs generally not permitted in marine or severe exposure zones - concrete or stainless steel chairs required.
```

```
Item #: 6
Description: Submit mechanical coupler (splice) product registration and test certificates
Acceptance Criteria: Mechanical couplers registered with TMR for the bar sizes and types being used; product certification current (re-tested every 3 years); coupler type appropriate for application (standard, ductile, or stressable as required)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS71 - Hold Point 4 (Installation of mechanical reinforcing bar splices). Couplers must be TMR-registered product. Registration must be re-tested for conformance every 3 years. Types include mechanically gripped, threaded, and friction-welded connections.
```

```
Item #: 7
Description: Submit Weld Procedure Specification (WPS) and welder qualifications for any site welding of reinforcement
Acceptance Criteria: WPS compliant with AS/NZS 1554.3 (Welding of reinforcing steel) or AS/NZS 1554.1 as applicable; all welders hold current AS/NZS 1554 qualifications for the weld type; pre-heat requirements specified where applicable
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS71. Welding of reinforcement requires specific qualifications and procedures. Not all bar grades are weldable - check AS/NZS 4671 weldability designation. Flash butt welding, arc welding, and friction welding each have different procedure requirements.
```

```
Item #: 8
Description: Submit hot bending procedure for Administrator acceptance (if hot bending of reinforcement required)
Acceptance Criteria: Hot bending procedure specifies temperature range (typically 600-800 deg C, never exceeding 850 deg C), heating method, quenching prohibition, and affected bar properties; accepted by Administrator
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 8.2 MRTS71 - Hold Point 2 (Hot Bending). Cold bending is preferred and standard. Hot bending requires specific approval as it can alter steel properties. Do not quench (water cool) hot-bent bars.
```

---

#### Section B: Storage and Handling

```
Item #: 9
Description: Verify reinforcement storage conditions on site
Acceptance Criteria: Reinforcement stored off ground on bearers; protected from contamination (oil, grease, concrete splatter); separated by bar size and mark; covered if extended storage; no excessive rust beyond normal surface oxidation; identification marks legible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS71. Reinforcement must be stored to prevent deterioration, contamination and mixing of bar sizes/types. Light surface rust is acceptable; heavy flaking rust, pitting or section loss is not.
```

```
Item #: 10
Description: Verify reinforcement is free from deleterious materials before fixing
Acceptance Criteria: Bars free from loose rust, mill scale, oil, grease, paint, mud, concrete splatter, and any coating that would impair bond; surface condition acceptable per AS 3600 Clause 13.1
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 Clause 13.1 [VERIFY]. Surface condition of reinforcement directly affects bond with concrete. Light surface rust improves bond. Heavy contamination must be cleaned.
```

---

#### Section C: Fabrication and Bending

```
Item #: 11
Description: Verify bar bending dimensions and shapes against bar schedule
Acceptance Criteria: Bent bar dimensions within tolerance (length +/-25mm for bars up to 12m, +/-50mm for longer; bend angle +/-2.5 degrees); minimum bend diameters as per AS 3600 Table 13.2.1 (typically 5db for fitments, 5db-8db for main bars depending on grade)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 Clause 13.2 [VERIFY]. Minimum bend diameter varies by bar diameter and grade. For D500N bars: min pin diameter = 5db for db <= 20mm, 8db for db > 20mm. Bars must not be re-bent without approval.
```

```
Item #: 12
Description: Verify cutting lengths and mark bars for identification
Acceptance Criteria: Cut lengths match bar schedule; bars identified by mark number tied to schedule; cut ends square (no flame cutting unless approved); each bar or bundle identifiable
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS71. Flame cutting may affect steel properties in heat-affected zone. Mechanical cutting (shearing or sawing) preferred.
```

---

#### Section D: Fixing and Placement

```
Item #: 13
Description: Verify formwork dimensions and cleanliness before reinforcement fixing commences
Acceptance Criteria: Formwork dimensions within tolerance per AS 3610; formwork clean, free of debris, release agent applied; kickers/starters from previous pour clean and correctly positioned; construction joint surface properly prepared
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS70 / AS 3610 [VERIFY]. Formwork must be checked before reinforcement fixing as it determines cover and position. Construction joint surfaces must be roughened to 5mm amplitude and free of laitance.
```

```
Item #: 14
Description: Verify reinforcement bar sizes, spacings and arrangement against structural drawings for each element
Acceptance Criteria: Bar sizes match drawings; spacing within +/-10mm of specified; layer arrangement correct (which bars top/bottom, inner/outer); bar orientation correct; number of bars per element correct
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 10 MRTS71 / AS 3600 [VERIFY]. Critical dimensional check. Bar spacing controls structural capacity and crack control. Wrong bar arrangement is difficult and costly to rectify after concrete placement.
```

```
Item #: 15
Description: Verify concrete cover to all reinforcement using cover measurement and spacer inspection
Acceptance Criteria: Cover complies with design drawings and exposure class per AS 3600 Table 4.10.3; cover tolerance for girders/beams/slabs/deck units: -5mm/+10mm; for slabs on ground: -10mm/+20mm; for footings cast in ground (>=500mm depth): -10mm/+40mm; bar chairs at maximum spacing to maintain cover
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Cover meter survey (post-pour verification)
Notes: Clause [VERIFY] MRTS71 Table [VERIFY]. Cover is critical for durability. TMR MRTS71 specifies tighter tolerances than some general standards. Positive tolerance = increased cover. Negative tolerance = reduced cover (less acceptable). Typical minimum covers: 40mm (sheltered), 50mm (exterior), 65mm (marine), 75mm (piles cast in ground).
```

```
Item #: 16
Description: Verify lap splice lengths, positions and stagger pattern
Acceptance Criteria: Lap lengths >= design requirement per AS 3600 Clause 13.1.2 (typically 40db to 60db depending on bar size, grade and stress level); laps staggered as shown on drawings (typically no more than 50% of bars lapped at same section); lap positions as specified (not in regions of maximum moment unless designed)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 Clause 13.1.2 / Structural drawings [VERIFY]. Lap lengths calculated by designer based on concrete strength, cover, bar spacing and stress conditions. Verify against drawing details, not just a generic formula.
```

```
Item #: 17
Description: Verify mechanical coupler installation and torque (if couplers used)
Acceptance Criteria: Couplers installed per manufacturer's instructions; correct type for application; bar fully inserted to marked insertion depth; threaded couplers torqued to specified value; visual confirmation of engagement indicator (where provided); pull-out resistance achieved
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Torque wrench / visual per manufacturer specification
Notes: Clause [VERIFY] MRTS71 - Hold Point 4 (Mechanical splices). Each coupler installation must be individually verified. Record coupler type, bar sizes connected, location in structure. Random pull testing may be specified for some coupler types.
```

```
Item #: 18
Description: Verify welded splice quality (if site welding of reinforcement)
Acceptance Criteria: Welds comply with WPS and AS/NZS 1554.3; visual inspection 100% of welds (no cracks, porosity, undercut); NDE testing as specified in WPS; weld throat/leg dimensions meet design; heat-affected zone acceptable
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Visual + NDE per AS/NZS 1554.3
Notes: Clause [VERIFY] MRTS71. All welds must be visually inspected. Non-destructive examination (magnetic particle, ultrasonic) as specified in the qualified WPS. Welder qualification must be current.
```

```
Item #: 19
Description: Verify tie wire and fixing system rigidity
Acceptance Criteria: System of fixing forms rigid cage maintaining specified tolerances under all loads applied before and during concrete placement; no movement of bars during placement; tie wire at every second intersection minimum (or as specified); wire tails bent away from forms
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS71. The system of fixing must form a rigid cage which maintains tolerances under all loads applied before and during concrete placement without the need for further adjustment. Inadequate fixing leads to bar displacement during concrete vibration.
```

```
Item #: 20
Description: Verify bar chair types, spacing and positioning for correct cover maintenance
Acceptance Criteria: Chairs appropriate type for exposure class (plastic, concrete, stainless steel); chair height correct for specified cover; maximum chair spacing to prevent bar sag (typically 800-1000mm for bottom bars, 600-800mm for top bars); continuous bar support for top reinforcement in slabs
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS71/MRTS70. Top mat support in slabs is critical - use 'chairs' or 'horses' at adequate spacing. Chair capacity must support all reinforcement above it. No plastic chairs in aggressive exposure zones.
```

```
Item #: 21
Description: Verify reinforcement position around embedded items, penetrations and build-outs
Acceptance Criteria: Reinforcement displaced around penetrations replaced with equivalent area nearby; trimmer bars provided at all openings as shown on drawings; adequate clearance for embedded items (bolts, ducts, pipes); no cutting of bars without engineer approval
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 [VERIFY]. Any cutting or displacement of reinforcement from design position requires engineer approval. Additional trimmer bars must be provided at penetrations exceeding specified size.
```

```
Item #: 22
Description: Verify post-tensioning duct installation and alignment (if applicable)
Acceptance Criteria: PT ducts installed at correct profile per drawings; duct supports at maximum 1m spacing; duct free from kinks, blockages or damage; grout vents and anchorage zones correctly positioned; duct joints sealed; trial tendon pull-through successful
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS70 / MRTS71 [VERIFY]. Post-tensioning ducts form part of the reinforcement system. Duct profile directly affects prestress losses and structural behaviour. Blocked ducts cannot be rectified after concreting.
```

---

#### Section E: Pre-Pour Inspection

```
Item #: 23
Description: Conduct formal pre-pour inspection of all reinforcement, formwork and embedded items
Acceptance Criteria: All reinforcement matches approved drawings; cover correct and maintained by adequate chairs/spacers; laps correct length and staggered; couplers verified; formwork dimensions correct; all embedded items positioned; no debris in formwork; construction joints prepared; reinforcement clean
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 10 MRTS71 - Hold Point 3 (Inspection of steel reinforcement before placement of concrete) / Clause 11.3 MRTS70 - Hold Point 12. This is the primary quality gate. NO CONCRETE SHALL BE PLACED until formwork and reinforcement are inspected and accepted by the Administrator. Comprehensive checklist must be completed and signed off.
```

```
Item #: 24
Description: Verify reinforcement position tolerances using systematic measurement
Acceptance Criteria: Deviation from specified position does not exceed MRTS71 tolerances: position controlled by spacing: +/-10mm; position controlled by cover in girders/beams/slabs/deck: -5mm/+10mm; in columns and walls: -5mm/+10mm; in slabs on ground/footings of walls and culverts: -10mm/+20mm; in footings cast in ground >= 500mm deep: -10mm/+40mm
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Measurement (tape measure, cover meter)
Notes: Clause [VERIFY] MRTS71. Systematic measurement at representative locations. Document measurements on pre-pour checklist. Any out-of-tolerance locations must be rectified before concreting.
```

```
Item #: 25
Description: Verify electrical continuity connection for reinforcement (where specified for cathodic protection or earthing)
Acceptance Criteria: Electrical continuity connections installed at specified locations; connection method per drawings (typically copper conductor welded or clamped to reinforcement); resistance test passed where specified
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Resistance testing (if specified)
Notes: Clause [VERIFY] MRTS71. Required where cathodic protection system is designed or where reinforcement is used as earthing conductor. Connection method must not damage bar.
```

---

#### Section F: During and After Concrete Placement

```
Item #: 26
Description: Monitor reinforcement position during concrete placement for any displacement
Acceptance Criteria: No visible displacement of reinforcement during concrete placement or vibration; top mat maintained at correct level; cover not compromised; any displacement identified and rectified immediately (pour stopped if necessary)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS70 [VERIFY]. Concrete placement forces (particularly vibrator contact and concrete flow) can displace inadequately fixed reinforcement. Continuous monitoring during pour. Workers must not stand on or bend reinforcement.
```

```
Item #: 27
Description: Conduct post-pour cover survey using covermeter on exposed surfaces after formwork removal
Acceptance Criteria: Cover depth at minimum 5 points per member (or every 3m for long members) measured by electromagnetic cover meter; cover within specified tolerances; any deficient cover reported and remedial measures proposed
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Electromagnetic cover meter survey
Notes: MRTS70 [VERIFY]. Post-pour verification that reinforcement has maintained design cover. Typically done on 10% of members as audit, or more frequently if issues identified. Non-compliant cover may require protective coating or additional cover.
```

```
Item #: 28
Description: Inspect exposed reinforcement at construction joints before resuming concrete placement
Acceptance Criteria: Protruding reinforcement at construction joints clean, undamaged and correctly positioned; no contamination from form oil, concrete splatter or corrosion products that would impair bond; laitance removed from joint surface; dowels/starters at correct spacing and projection
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS70 / AS 3600 [VERIFY]. Construction joints are potential weak points. Reinforcement continuity across joints is critical. Starter bars must have adequate development length on each side of joint.
```

---

#### Section G: Stainless Steel Reinforcement (if specified)

```
Item #: 29
Description: Verify stainless steel reinforcement grade and separation from carbon steel reinforcement
Acceptance Criteria: Stainless steel grade matches specification (typically Grade 316 or duplex 2205); stainless bars physically separated from carbon steel during storage and handling; no contamination from carbon steel tools (wire brushes, cutting discs) that could cause galvanic corrosion initiation
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause [VERIFY] MRTS71. MRTS71 covers stainless steel reinforcement. Stainless and carbon steel must not be mixed. Dedicated tools and storage areas required. Typically used in marine environments or high-durability structures.
```

---

#### Section H: Documentation & Records

```
Item #: 30
Description: Compile and submit reinforcement conformance records for each structural element
Acceptance Criteria: Records include: material certificates (mill certs, ACRS), bar schedule verification, pre-pour inspection checklists (signed by Administrator), coupler records, weld records, cover survey results, and any non-conformance reports; complete set for each pour/element
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 Quality System Requirements / MRTS71 [VERIFY]. Conformance records form part of the project quality documentation. Must be maintained progressively and available for Administrator review at any time. Records are required for handover and defects liability period.
```

```
Item #: 31
Description: Record and report any non-conformances related to reinforcement (wrong bar, missing bars, cover deficiency, failed coupler, weld defect)
Acceptance Criteria: Non-conformance report (NCR) raised for any departure from specification; root cause identified; corrective action proposed and accepted by Administrator; rectification completed and verified; NCR closed out
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 [VERIFY]. Non-conformances must be reported promptly. Do not conceal defects by proceeding with concreting. Any reinforcement non-conformance discovered after concreting is significantly more costly to rectify.
```

```
Item #: 32
Description: Submit as-built reinforcement records where reinforcement deviates from original design drawings
Acceptance Criteria: As-built drawings or marked-up design drawings showing any approved variations to reinforcement layout; all variations supported by engineer approval documentation; as-built records submitted before project completion
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 / Project requirements [VERIFY]. As-built records essential for future maintenance, assessment and modification of the structure. Must accurately reflect what was actually installed.
```

```
Item #: 33
Description: Verify reinforcement continuity and development lengths at member interfaces (e.g., column to footing, beam to column, slab to wall)
Acceptance Criteria: Development lengths per AS 3600 Clause 13.1 achieved at all member interfaces; hooks and cogs where shown on drawings; continuity reinforcement through joints as designed; no short bars at critical sections
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 Clause 13.1 [VERIFY]. Development length is the minimum length of bar embedded in concrete to develop full tensile capacity. Insufficient development length is a structural deficiency. Check particularly at beam-column joints and column-footing interfaces.
```

```
Item #: 34
Description: Verify reinforcement for crack control (skin reinforcement, shrinkage/temperature reinforcement) in walls, slabs and large members
Acceptance Criteria: Crack control reinforcement provided as shown on drawings; spacing does not exceed AS 3600 maximum (typically 300mm or as calculated); bar area meets minimum requirements for exposure class; reinforcement continuous through construction joints
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 3600 Clause 8.6 [VERIFY]. Crack control reinforcement is often overlooked but is essential for durability. Missing or inadequate crack control reinforcement leads to wide cracks and accelerated corrosion.
```

```
Item #: 35
Description: Verify GFRP (Glass Fibre Reinforced Polymer) reinforcement placement (if specified as alternative to steel)
Acceptance Criteria: GFRP bars from TMR-registered supplier; correct grade and diameter; cover per design (may differ from steel cover requirements); no sharp bends (minimum bend radius per manufacturer); handling without damage to fibres; tied with compatible tie material (not steel wire)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause [VERIFY] MRTS71. MRTS71 references GFRP reinforcement as an alternative. GFRP has different cover, development length and bending requirements compared to steel. Manufacturer's installation instructions must be followed. Only applicable where specifically designed and specified.
```

---

### Test Methods & Frequencies Summary (Reinforcement Placement)

| Test / Property | Test Method | Typical Frequency | Key Acceptance Value |
|----------------|-------------|-------------------|---------------------|
| Tensile strength of reinforcement | AS 1391 / AS/NZS 4671 | 1 sample per 30 tonnes per bar size | Yield >= 500 MPa (grade 500); UTS/Yield ratio >= 1.08 (D500N) |
| Mill certificates verification | AS/NZS 4671 | 100% of deliveries | Compliant with grade designation |
| Bar dimensions (length, bend) | Measurement | Sample per batch fabricated | Length +/-25mm; bend angle +/-2.5 deg |
| Cover measurement (pre-pour) | Tape measure / spacer check | Every bar chair / representative sample | Per MRTS71 tolerances: -5/+10mm typical |
| Cover measurement (post-pour) | Electromagnetic cover meter | Min 5 points per member, 10% of members | Within specified tolerances |
| Coupler installation verification | Visual / torque wrench | 100% of couplers | Full bar insertion; specified torque |
| Weld visual inspection | AS/NZS 1554.3 | 100% of welds | No cracks, porosity, undercut |
| Weld NDE (if specified) | Magnetic particle / ultrasonic | Per qualified WPS (typically 10-100%) | No rejectable defects per AS/NZS 1554 |
| Pre-pour inspection checklist | MRTS71/MRTS70 | 100% of pours | All items verified and signed off |
| Reinforcement position | Measurement | Representative check at pre-pour | +/-10mm of specified position |
| Lap length verification | Measurement | Sample per element type | >= specified development/lap length |
| Electrical continuity (if specified) | Resistance testing | As specified | Continuity confirmed |

---

## Cross-Reference: Related MRTS Specifications

The following specifications are referenced by or interact with the piling and reinforcement templates:

| Spec | Title | Relationship |
|------|-------|-------------|
| MRTS01 | Introduction to Technical Specifications | General requirements for Hold Points, Witness Points, Milestones (Clause 5.2) |
| MRTS50 | Specific Quality System Requirements | Quality Plan framework, Hold Point release procedures (Clause 8.3) |
| MRTS56 | Construction Surveying | Survey set-out and as-built requirements |
| MRTS59 | Manufacture of FRP Composite Girders | NOT reinforcing steel - corrected in this research |
| MRTS63 | Cast-In-Place Piles | Primary spec for bored/lined piles in rock for bridges |
| MRTS63A | Piles for Ancillary Structures | Bored piles for sign gantries, barriers, retaining walls |
| MRTS64 | Driven Tubular Steel Piles | Large diameter driven steel tubes with RC pile shaft |
| MRTS65 | Precast Prestressed Concrete Piles | Precast driven piles |
| MRTS66 | Driven Steel Piles | H-piles, sheet piles |
| MRTS68 | Dynamic Testing of Piles | PDA and CAPWAP requirements, 100% end-of-drive monitoring |
| MRTS70 | Concrete | Concrete mix design, placement, testing, strength acceptance |
| MRTS71 | Reinforcing Steel | Supply, fabrication, placement of steel reinforcement (incl. stainless steel and GFRP) |
| MRTS78 | Fabrication of Structural Steelwork | NOT piling - corrected in this research |
| AS 2159 | Piling - Design and Installation | Australian Standard for pile design and construction tolerances |
| AS 3600 | Concrete Structures | Design standard with reinforcement detailing requirements |
| AS/NZS 4671 | Steel Reinforcing Materials | Material standard for reinforcing steel |
| AS/NZS 1554.1 | Structural Steel Welding (Steel structures) | Welding of liner/casing steel |
| AS/NZS 1554.3 | Structural Steel Welding (Reinforcing steel) | Welding of reinforcing bars |
| AS 3610 | Formwork for Concrete | Formwork tolerances and requirements |
| CIA Z17 | Recommended Practice: Tremie Concrete for Deep Foundations | Tremie concrete guidance for pile placement |
| TMR TN125 | Long Distance Transport and Extended Placement Times | Extended concrete delivery time provisions |

---

## Verification Notes and Flags

### Items Requiring Verification Against Full PDF Specifications

The following items contain [VERIFY] flags indicating that specific clause numbers or values should be confirmed by reviewing the actual MRTS PDF documents. The PDFs are accessible at the TMR website but could not be programmatically extracted during this research:

1. **MRTS63 Hold Point numbering** - Confirmed as HP1 (Construction procedure), HP2 (WPS for welding), HP3 (Geotechnical certification), HP4 (Re-certification after delay), HP5 (Tremie concrete), HP6 (PIT reports) - but exact clause numbers need verification
2. **MRTS64 Hold Point numbering** - Structure similar to MRTS63 but with driven pile-specific items; exact clause numbers need verification
3. **MRTS71 Hold Point numbering** - Confirmed as HP1 (Supplier acceptance, Cl 6.1), HP2 (Hot bending, Cl 8.2), HP3 (Pre-pour inspection, Cl 10), HP4 (Mechanical splices, Cl [VERIFY]) - recent updates introduced friction-welded connections with renumbered hold points
4. **MRTS68 specific clause references** - Dynamic testing requirements referenced but clause numbers not confirmed
5. **Verticality tolerances** - 1:75 for driven piles and 1:100 for bored piles are industry standard per AS 2159, but project-specific values in TMR specs should be confirmed
6. **Cover tolerance table** - MRTS71 values confirmed from search results but exact table number needs verification
7. **Minimum cover values** - Typical TMR values cited (40mm/50mm/65mm/75mm) should be confirmed against project specification and MRTS70 exposure class requirements

### Specification Edition Dates Confirmed

| Spec | Edition Date | Confirmed Source |
|------|-------------|-----------------|
| MRTS63 | November 2020 | TMR website listing |
| MRTS63A | November 2020 | TMR website listing |
| MRTS64 | November 2020 | TMR website listing / NLA catalogue |
| MRTS65 | November 2020 | TMR website listing |
| MRTS66 | July 2017 | TMR website listing |
| MRTS68 | July 2017 | TMR website listing |
| MRTS70 | July 2022 | TMR website listing |
| MRTS71 | June 2020 (updated through July 2025) | TMR website / Amendment Register |

### Key Corrections from Original Research Brief

1. **MRTS78 is NOT piling** - It is "Fabrication of Structural Steelwork". The piling specs are MRTS63/63A/64/65/66
2. **MRTS59 is NOT reinforcing steel** - It is "Manufacture of FRP Composite Girders". The reinforcing steel spec is MRTS71
3. **MRTS68 is Dynamic Testing of Piles** (not Structural Steelwork as listed in Priority 3 of the research brief)
4. **MRTS65 is Precast Prestressed Concrete Piles** (not Bridge Bearings as listed in Priority 3)
5. The original research brief's mapping at row 27 (Structural Steelwork = MRTS68) and row 28 (Bridge Bearings = MRTS65) are incorrect and should be updated

---

## Summary

### Template 12: Piling
- **48 items** covering full lifecycle from pre-work submissions through post-installation verification
- Covers bored (MRTS63), driven tubular (MRTS64), precast prestressed (MRTS65), driven steel (MRTS66), and CFA pile types
- **10 hold points** (construction procedure, mix design, WPS, geotechnical certification, re-certification, supplier acceptance, pre-pour, tremie approval, PIT reports, static load test)
- **5 witness points** (PDA monitoring, concrete plug, cage installation, concrete placement, PIT testing)
- **33 standard items** (surveys, material checks, monitoring, documentation)
- Cross-references MRTS68 dynamic testing, MRTS70 concrete, MRTS71 reinforcing steel, AS 2159

### Template 13: Reinforcement Placement
- **35 items** covering full lifecycle from material acceptance through documentation
- Covers standard reinforcement, stainless steel, mechanical couplers, welding, and GFRP alternatives
- **7 hold points** (supplier acceptance, coupler registration, WPS, hot bending, pre-pour inspection, GFRP, cover verification)
- **1 witness point** (weld inspection)
- **27 standard items** (material verification, fabrication checks, fixing, placement monitoring, documentation)
- Cross-references MRTS70 concrete, AS 3600, AS/NZS 4671, AS/NZS 1554.3
