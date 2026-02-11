# Priority 1 Drainage ITP Templates -- QLD TMR MRTS Specifications

**Research Date:** 2026-02-10
**Author:** Claude Code (automated research)
**Status:** DRAFT -- Clause numbers flagged [VERIFY] require manual confirmation against latest MRTS PDF editions

---

## Key Specification References

| Spec | Title | Edition | Scope |
|------|-------|---------|-------|
| MRTS03 | Drainage Structures, Retaining Structures and Slope Protections | March 2025 | Primary drainage spec: pipe culverts, pits, chambers, headwalls, subsoil drains |
| MRTS24 | Manufacture of Precast Concrete Culverts | July 2025 | Manufacturing QA for precast RCBCs and pipe culverts |
| MRTS70 | Concrete | July 2022 | Structural concrete for cast-in-place drainage structures |
| MRTS50 | Quality System Requirements | Current | Overarching quality system, hold point/witness point definitions |
| MRTS04 | General Earthworks | March 2025 | Backfill and compaction requirements around drainage structures |

### Key Australian Standards Referenced

| Standard | Title |
|----------|-------|
| AS/NZS 3725:2007 | Design for Installation of Buried Concrete Pipes |
| AS 4058:2007 | Precast Concrete Pipes (Pressure and Non-Pressure) |
| AS 1597.1 | Precast Reinforced Concrete Box Culverts -- Small |
| AS 1597.2 | Precast Reinforced Concrete Box Culverts -- Large |
| AS 3600 | Concrete Structures |
| AS 3610 | Formwork for Concrete |
| AS/NZS 2032 | Installation of PVC Pipe Systems |
| AS 1289 (series) | Methods of Testing Soils for Engineering Purposes |
| AS 1012 (series) | Methods of Testing Concrete |

### Key TMR Test Methods

| Method | Description |
|--------|-------------|
| TMR Q142A | Moisture-Density Relationship (Standard Compaction) |
| TMR Q141A/B | Insitu Dry Density (Sand Replacement / Nuclear Gauge) |
| TMR Q143A | Moisture-Density Relationship (Modified Compaction) |
| TMR Q145A | Compaction Control (Hilf Rapid Method) |
| TMR Q250 | Degree of Saturation Calculation |
| TMR Q458 | Concrete Trial Mix Assessment |
| TMR Q723 | Proof Rolling Test |

---

## Template 8: Drainage -- Pipe Installation

```
Template Name: Drainage -- Pipe Installation
Activity Type: drainage
Specification Reference: TMR MRTS03 (March 2025), AS/NZS 3725:2007
Edition/Revision Date: March 2025
```

### Checklist Items

#### Pre-Work Submissions & Planning

```
Item #: 1
Description: Submit Drainage Construction Procedures including pipe laying sequence, equipment, bedding/backfill methodology, joint sealing method, and testing plan
Acceptance Criteria: Procedures approved by Administrator prior to any drainage works commencing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS03 [VERIFY] -- No drainage works to commence until construction procedures accepted by Administrator
```

```
Item #: 2
Description: Submit Inspection and Test Plan (ITP) for drainage pipe installation covering all hold points, witness points, test methods, and frequencies
Acceptance Criteria: ITP accepted by Administrator; aligned with MRTS50 quality system requirements
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.1 MRTS50 -- Separate ITP required for structures/drainage as per MRTS50
```

```
Item #: 3
Description: Submit shop drawings and pipe schedule showing pipe types, classes, sizes, lengths, joint types, and invert levels
Acceptance Criteria: Shop drawings reviewed and accepted; pipe classes match design loads per AS/NZS 3725
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6 MRTS03 [VERIFY] -- Submit minimum 14 days prior to pipe procurement
```

#### Material Verification

```
Item #: 4
Description: Verify pipe supply from TMR Registered Supplier (for RCP) or approved manufacturer (PVC/other)
Acceptance Criteria: Supplier holds current TMR Registration Certificate for precast concrete products; or material certificates for non-concrete pipes
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS24 Clause 4 [VERIFY] -- Precast concrete pipe must be from Registered Supplier per TMR Registration Scheme
```

```
Item #: 5
Description: Inspect pipes on delivery for damage, dimensional compliance, and marking (class, size, date of manufacture)
Acceptance Criteria: No visible cracks, chips, or damage; dimensions within AS 4058 / AS 1597 tolerances; pipes clearly marked with class and date
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 MRTS03 [VERIFY] -- Reject any damaged or non-compliant pipes; record batch numbers
```

```
Item #: 6
Description: Verify pipe strength class matches design requirements per AS/NZS 3725 load analysis and specified support type (HS1/HS2/HS3)
Acceptance Criteria: Pipe class certified to meet or exceed design loads for the specified installation condition and support type
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS/NZS 3725 Clause 3 -- Support type typically HS2 within road reserves; HS3 for high embankments
```

```
Item #: 7
Description: Verify bedding material complies with specification requirements (grading, plasticity, particle size)
Acceptance Criteria: Material compliant with MRTS03 bedding requirements; grading within specified envelope; PI within limits; free of organic matter and oversized particles
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.3.6.1 (particle size), AS 1289.3.3.1 (plasticity index)
Notes: Clause 12.2 MRTS03 [VERIFY] -- Bedding material must be tested and approved before use
```

```
Item #: 8
Description: Verify joint sealing materials (rubber rings, sealants, lubricant) comply with specifications and are within shelf life
Acceptance Criteria: Materials comply with AS 4058 joint requirements; rubber rings to manufacturer specification; lubricant compatible with rubber ring material
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 12.3.4.1 MRTS03 [VERIFY] -- Joint materials must be stored and handled per manufacturer requirements
```

#### Trench Excavation

```
Item #: 9
Description: Verify set-out of pipe alignment and invert levels from survey datum
Acceptance Criteria: Pipe centreline set out within +/-50 mm horizontal and invert levels within +/-10 mm of design
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- Tolerances section; survey by licensed surveyor or competent person under direction
```

```
Item #: 10
Description: Inspect trench excavation for correct width, depth, side slope stability, and removal of unsuitable material
Acceptance Criteria: Trench width provides minimum clearance per AS/NZS 3725 (typically 300 mm each side of pipe); trench base free of rock, debris, and soft material; sides stable and supported where required
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.1 MRTS03 [VERIFY] -- Trench to be excavated in accordance with approved construction procedures
```

```
Item #: 11
Description: Address groundwater/dewatering if encountered -- confirm dewatering system adequate and does not undermine trench stability
Acceptance Criteria: Trench base dry and stable at time of pipe laying; dewatering does not cause settlement of adjacent structures; discharge compliant with environmental approvals
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.1 MRTS03 [VERIFY] -- Dewatering to be addressed in construction procedures
```

#### Foundation & Bedding

```
Item #: 12
Description: Inspect foundation/trench base prior to bedding placement -- confirm no unsuitable material, correct level, and adequate bearing capacity
Acceptance Criteria: Foundation base firm and uniform; no soft spots, standing water, or organic material; level within +/-25 mm of design subgrade level
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.1 MRTS03 [VERIFY] -- Administrator to be notified 1 working day prior to inspection
```

```
Item #: 13
Description: Place and compact bedding material to specified depth and compaction standard
Acceptance Criteria: Bedding depth as specified on drawings (typically 100-150 mm); compacted to minimum 95% Standard Compaction (cohesive) or Density Index >= 65 (non-cohesive) per AS/NZS 3725; uniform support across full pipe width
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q142A (MDD), TMR Q141A/B (insitu density)
Notes: Clause 12.3.2 MRTS03 [VERIFY] -- Hold Point: bedding must be inspected and accepted before pipe placement. Compaction 95% for HS3, 90% for HS2 per AS/NZS 3725
```

```
Item #: 14
Description: Shape bedding cradle to provide uniform support under pipe barrel (not bell/socket)
Acceptance Criteria: Cradle shaped to provide contact over minimum 50% of pipe circumference (per support type); bell/socket holes excavated to prevent point loading; no hard spots or voids under pipe
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.2 MRTS03 [VERIFY] -- Bedding must be shaped immediately before pipe laying to prevent disturbance
```

#### Pipe Laying & Jointing

```
Item #: 15
Description: Inspect pipe laying sequence -- confirm pipes laid to correct line and grade, with spigot end pointing downstream
Acceptance Criteria: Pipes laid from downstream to upstream (unless otherwise specified); spigot pointing downstream; invert level within +/-10 mm of design at each pipe joint; horizontal alignment within +/-50 mm
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- Administrator to be notified to witness pipe laying; 1 working day notice
```

```
Item #: 16
Description: Verify concrete pipe joints are properly assembled -- rubber ring seated, spigot fully home, joint gap uniform
Acceptance Criteria: Rubber ring correctly seated in groove without twisting or displacement; spigot pushed fully home (assembly mark aligned); joint gap uniform around circumference (+/-3 mm variation); no visible gap or misalignment
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4.1 MRTS03 [VERIFY] -- Concrete pipe jointing per AS 4058; use appropriate lubricant on rubber ring
```

```
Item #: 17
Description: Verify PVC pipe joints are properly assembled (if PVC pipes specified) -- solvent cement or rubber ring joints as designed
Acceptance Criteria: Joints assembled per AS/NZS 2032; solvent cement fully cured before backfilling; rubber ring joints pushed fully home; no visible gaps or angular deflection beyond manufacturer limits
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- PVC installation to comply with AS/NZS 2032
```

```
Item #: 18
Description: Check angular deflection at joints does not exceed manufacturer allowable limits
Acceptance Criteria: Angular deflection at each joint within manufacturer specified limits (typically max 1-2 degrees per joint for RCP; varies by pipe size and joint type)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS/NZS 3725 Clause 5 [VERIFY] -- Maximum deflection must not cause joint leakage or structural distress
```

```
Item #: 19
Description: Verify pipe alignment (horizontal and vertical) does not exhibit noticeable irregularities; confirm positive drainage slope along entire length
Acceptance Criteria: No abrupt changes in alignment; horizontal alignment within +/-50 mm; vertical alignment (invert) within +/-10 mm of design grade; positive drainage slope maintained -- no flat spots or adverse falls
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- Culverts shall have a positive drainage slope along the whole of their length. Survey required.
```

#### Haunch Zone

```
Item #: 20
Description: Place and compact haunch zone material symmetrically on both sides of pipe from bedding level to pipe springline
Acceptance Criteria: Haunch zone material placed in layers not exceeding 150 mm loose thickness; compacted to specified density (HS2: 90% Standard; HS3: 95% Standard); material placed evenly on both sides to prevent pipe displacement
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q142A (MDD), TMR Q141A/B (insitu density)
Notes: Clause 12.3.5 MRTS03 [VERIFY] -- Critical zone for pipe structural performance. Hold Point: haunch compaction must be verified before proceeding to side zone. HS2 bedding factor = 2.5 (per TN187)
```

```
Item #: 21
Description: Verify haunch material is placed carefully to avoid pipe displacement -- hand-placed and compacted using light mechanical equipment only
Acceptance Criteria: No displacement of pipe from line or grade during haunch placement; compaction by hand tamper, vibrating plate, or light mechanical means only -- no heavy rollers within 300 mm of pipe
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.5 MRTS03 [VERIFY] -- Care required to avoid disturbing pipe position per AS/NZS 3725
```

#### Side Zone & Overlay Zone

```
Item #: 22
Description: Place and compact side zone material from springline to top of pipe (overlay zone) in uniform layers
Acceptance Criteria: Side zone material placed in layers not exceeding 150 mm loose thickness; compacted to specified density (typically 95% Standard Compaction); overlay zone extends minimum 300 mm above pipe crown
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q142A (MDD), TMR Q141A/B (insitu density)
Notes: Clause 12.3.5 MRTS03 [VERIFY] -- Side and overlay zone compaction per AS/NZS 3725 support type requirements
```

```
Item #: 23
Description: Verify minimum cover above pipe crown is maintained before allowing construction traffic
Acceptance Criteria: Minimum 300 mm compacted cover above pipe crown (or as specified) before any construction traffic crosses trench; minimum 600 mm for heavy construction traffic unless protection measures in place
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.5 MRTS03 [VERIFY] -- No construction traffic over pipes until minimum cover achieved. Hold Point.
```

#### Trench Backfill

```
Item #: 24
Description: Place and compact trench backfill above overlay zone in uniform layers to finished surface level
Acceptance Criteria: Backfill placed in layers not exceeding 200 mm compacted thickness (or 300 mm for cohesionless material); compaction to minimum 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); compaction testing at specified frequency
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q142A (MDD), TMR Q141A/B (insitu density), AS 1289.5.4.1
Notes: Clause 12.3.5 MRTS03 / Clause 19 MRTS04 [VERIFY] -- Backfill compaction requirements as per MRTS04 General Earthworks. Administrator to be given opportunity to witness.
```

```
Item #: 25
Description: Perform compaction testing of trench backfill at specified frequency and locations
Acceptance Criteria: Minimum 1 density test per drainage line per compacted layer (or per 50 lineal metres, whichever is more frequent); all results >= 95% Standard MDD; moisture content within OMC +0% to +3% range
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD reference), AS 1289.2.1.1 (moisture)
Notes: Testing frequency per MRTS04 Table [VERIFY] and MRTS50 quality system requirements
```

#### Post-Installation Testing

```
Item #: 26
Description: Perform CCTV inspection of completed pipeline prior to acceptance
Acceptance Criteria: CCTV inspection conducted by qualified operator; continuous recording of entire pipeline; no structural defects (cracks, displaced joints, infiltration); joint gaps within tolerance; no debris or obstructions; pipe profile smooth and continuous
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: CCTV inspection per WSA 05 / council requirements
Notes: Clause [VERIFY] MRTS03 -- CCTV required prior to on-maintenance acceptance. All pipework to be CCTV inspected. Report to be submitted to Administrator.
```

```
Item #: 27
Description: Perform mandrel testing of flexible pipes (PVC, HDPE) to verify pipe has not deflected beyond limits
Acceptance Criteria: Mandrel passes through full length of each pipe run without obstruction; mandrel diameter = 95% of internal pipe diameter (i.e., max 5% deflection); no blockages or restrictions
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Mandrel test per AS/NZS 2032 or project specification
Notes: Typically required for PVC/HDPE pipes only. Mandrel size to be approved by Administrator. Test after backfill compaction complete.
```

```
Item #: 28
Description: Perform water tightness/infiltration test if specified in contract
Acceptance Criteria: No visible leakage at joints under test conditions; infiltration rate not exceeding specified limit (typically 0.05 L/mm diameter/km/hour for gravity pipes); test duration minimum 30 minutes
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Water tightness test per AS/NZS 3725 Supplement 1 or project specification
Notes: Not always required for stormwater drainage -- confirm with project specification. More common for sewer/pressure pipes.
```

#### Final Verification

```
Item #: 29
Description: Conduct as-built survey of completed pipeline -- inverts, obvert levels, pit locations, pipe sizes
Acceptance Criteria: As-built survey completed by licensed surveyor; invert levels within +/-10 mm of design; horizontal alignment within +/-50 mm; all pipe sizes, classes, and joint types recorded; survey certified and signed
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- As-built survey required for all drainage works
```

```
Item #: 30
Description: Verify pipe connections to pits/chambers are properly made with flexible or rigid connectors as specified
Acceptance Criteria: Connections watertight; flexible connectors (if specified) installed with correct compression; no protrusion of pipe into pit obstructing flow; haunching around connection complete and stable
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- Pipe-to-pit connections must be inspected before backfilling
```

```
Item #: 31
Description: Verify trench reinstatement/surface restoration is complete and compliant
Acceptance Criteria: Surface restoration to match surrounding surface level (+/-10 mm); no settlement or depressions; pavement reinstatement (if applicable) to relevant pavement specification; topsoil and seeding in unpaved areas
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Reinstatement to comply with MRTS04 / pavement specifications as applicable
```

```
Item #: 32
Description: Submit conformance documentation package including all test results, CCTV reports, survey data, and material certificates
Acceptance Criteria: Complete documentation package submitted and accepted by Administrator; all hold points released; all test results conforming; CCTV report showing no defects; as-built survey certified
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5 MRTS50 [VERIFY] -- Conformance package required before acceptance of drainage works
```

```
Item #: 33
Description: Verify protection of completed pipeline from construction traffic damage until pavement/surface is constructed
Acceptance Criteria: Pipeline clearly marked on surface; adequate cover maintained; no heavy equipment operating within 1 m of pipeline without protection measures; no stockpiling directly above pipeline
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Contractor responsibility to protect completed work until final acceptance
```

```
Item #: 34
Description: Confirm all bedding and backfill materials used are free from deleterious materials (organics, sulfates, aggressive chemicals)
Acceptance Criteria: Material free from organics, sulfates > specified limit, and any material that could cause pipe degradation; pH within acceptable range for pipe material
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289 series (chemical testing if required by project)
Notes: Clause 12.2 MRTS03 [VERIFY] -- Particularly important for aggressive soil conditions
```

```
Item #: 35
Description: Verify end structures (headwalls, wingwalls, outlet protection) are constructed in accordance with drawings and MRTS03
Acceptance Criteria: End structures constructed to design dimensions; concrete grade and finish as specified; scour protection in place; no visible defects; connections to pipe watertight
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- End structures per MRTS03 and relevant standard drawings (SD1300 series)
```

### Test Methods & Frequencies Summary (Template 8)

| Test | Method | Frequency | Acceptance Value |
|------|--------|-----------|-----------------|
| Bedding compaction | TMR Q141A/B + TMR Q142A | 1 per drainage line/layer | >= 95% Std MDD (HS3) or >= 90% Std MDD (HS2) |
| Haunch zone compaction | TMR Q141A/B + TMR Q142A | 1 per drainage line/layer | >= 95% Std MDD (HS3) or >= 90% Std MDD (HS2) |
| Trench backfill compaction | TMR Q141A/B + TMR Q142A | 1 per 50 lm per layer | >= 95% Std MDD |
| Moisture content | AS 1289.2.1.1 | With each density test | OMC +0% to +3% |
| Bedding material grading | AS 1289.3.6.1 | Per source/change of material | Within specified envelope |
| CCTV inspection | WSA 05 / project spec | 100% of pipeline | No structural defects; joints within tolerance |
| Mandrel test (PVC/HDPE) | Project spec / AS/NZS 2032 | 100% of flexible pipe runs | 95% of ID passes (max 5% deflection) |
| As-built survey | Licensed survey | 100% of pipeline | Inverts +/-10 mm; alignment +/-50 mm |
| Pipe dimension check | Visual / measurement | 100% on delivery | Per AS 4058 / AS 1597 tolerances |

---

## Template 9: Drainage -- Pits & Chambers

```
Template Name: Drainage -- Pits & Chambers
Activity Type: drainage
Specification Reference: TMR MRTS03 (March 2025), MRTS70 (July 2022)
Edition/Revision Date: March 2025
```

### Checklist Items

#### Pre-Work Submissions

```
Item #: 1
Description: Submit construction procedures for pit and chamber construction including formwork, concrete, precast installation, and connection details
Acceptance Criteria: Procedures approved by Administrator; include formwork design, concrete placement method, curing regime, and quality control measures
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS03 [VERIFY] -- Construction procedures to be submitted and accepted before work commences
```

```
Item #: 2
Description: Submit concrete mix design for cast-in-situ pit/chamber construction (if applicable)
Acceptance Criteria: Mix design approved by Administrator per MRTS70; target strength >= specified f'c (typically 32 MPa for drainage structures); slump within specified range; W/C ratio within limits
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: TMR Q458 (concrete trial mix)
Notes: Clause 15.1 / 17.6.1 MRTS70 -- Hold Point 1: mix design approval before any concrete placement
```

#### Material Verification

```
Item #: 3
Description: Verify precast pit/chamber components from TMR Registered Supplier (if precast)
Acceptance Criteria: Supplier holds current TMR Registration; components comply with MRTS03 and relevant AS standards; delivery dockets and quality certificates provided
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS24 Clause 4 [VERIFY] -- Precast concrete products must be from Registered Suppliers
```

```
Item #: 4
Description: Inspect precast components on delivery for damage, dimensional compliance, and lifting point integrity
Acceptance Criteria: No visible cracks, chips, or spalling; dimensions within tolerance; lifting points intact and certified per AS 3850.3; step irons/ladders factory-installed where specified
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Inspect 100% of precast components on delivery
```

```
Item #: 5
Description: Verify reinforcement steel, formwork materials, and concrete constituents for cast-in-situ construction
Acceptance Criteria: Reinforcement compliant with AS/NZS 4671; mill certificates provided; formwork materials adequate for class of finish required; concrete materials per approved mix design
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6 MRTS70 [VERIFY] / MRTS59 -- Material compliance before use
```

#### Foundation & Excavation

```
Item #: 6
Description: Inspect pit/chamber excavation for correct dimensions, depth, and founding conditions
Acceptance Criteria: Excavation dimensions match design with adequate working space; founding level firm and stable; no soft spots or standing water; no undermining of adjacent structures
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Administrator to be given opportunity to inspect excavation
```

```
Item #: 7
Description: Place and compact foundation bedding for pit/chamber base
Acceptance Criteria: Bedding material placed to specified depth (typically 150 mm minimum); compacted to 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); level within +/-10 mm; smooth surface free from irregularities
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD)
Notes: Clause 18 MRTS03 [VERIFY] -- Foundation bedding shall be compacted to not less than 95% Standard Compaction. Hold Point before placement of structure.
```

#### Construction -- Precast Pits

```
Item #: 8
Description: Set precast base/well sections on prepared bedding -- verify level, plumb, and orientation
Acceptance Criteria: Base section level within +/-5 mm; plumb within H/200; orientation correct for pipe connections; seating even on bedding -- no rocking
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18.2 MRTS03 [VERIFY] -- Administrator notified to witness placement of precast sections
```

```
Item #: 9
Description: Verify jointing between precast sections -- mortar or sealant applied as specified
Acceptance Criteria: Joint material applied to full contact surface; mortar joints minimum 10 mm thick, tooled smooth; rubber gasket joints compressed per manufacturer specification; no voids or gaps visible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18.2 MRTS03 [VERIFY] -- Joint treatment per MRTS03 and manufacturer requirements
```

#### Construction -- Cast-in-Situ Pits

```
Item #: 10
Description: Inspect formwork prior to concrete placement -- dimensions, bracing, cleanliness, release agent
Acceptance Criteria: Formwork dimensions match drawings +/-5 mm; formwork rigid, braced, and watertight; clean and release agent applied; blockouts for pipe connections correctly positioned
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 11.3 / 17.2 MRTS70 [VERIFY] -- Hold Point 12 MRTS70: formwork and reinforcement inspection before concrete placement
```

```
Item #: 11
Description: Inspect reinforcement fixing prior to concrete placement -- bar size, spacing, cover, laps, and tie wire
Acceptance Criteria: Bar sizes and spacing per drawings; cover spacers in place providing minimum specified cover (typically 40-50 mm for drainage structures); lap lengths per AS 3600; all intersections tied; no displaced or missing bars
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 11.3 / 17.2 MRTS70 [VERIFY] -- Hold Point: reinforcement must be inspected and approved by Administrator before concrete pour
```

```
Item #: 12
Description: Place concrete in pit/chamber walls and base -- monitor slump, placement method, and vibration
Acceptance Criteria: Concrete slump within approved range (+/-15 mm of nominated slump per MRTS70); concrete vibrated to full compaction; no honeycombing or cold joints; concrete placed within allowable time from batching (typically 90 min)
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (slump), AS 1012.9 (compressive strength cylinders)
Notes: Clause 17.7 / 17.8 MRTS70 [VERIFY] -- Administrator notified 24 hours prior to concrete placement
```

```
Item #: 13
Description: Cast and cure test cylinders from concrete used in pit/chamber construction
Acceptance Criteria: Minimum 1 set of 3 cylinders per pour (or per 50 m3); cylinders made per AS 1012.8.1; cured at 23+/-2 degC; 28-day compressive strength >= f'c characteristic strength
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.8.1 (making cylinders), AS 1012.9 (compressive strength)
Notes: Clause 12 MRTS70 [VERIFY] -- Strength acceptance per MRTS70 statistical criteria
```

```
Item #: 14
Description: Cure concrete in accordance with specification requirements
Acceptance Criteria: Concrete kept moist for minimum 7 days (or equivalent curing compound applied immediately after finishing); no visible drying or surface dusting during curing period
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 13 MRTS70 [VERIFY] -- Curing per MRTS70 requirements
```

#### Cover Slabs & Grates

```
Item #: 15
Description: Install cover slabs (precast or cast-in-situ) -- verify level flush with surrounding surface
Acceptance Criteria: Cover slab seated firmly on pit walls; mortar bed even; top surface flush with surrounding pavement/kerb within +/-5 mm; no rocking; load rating matches design (Class D for road, Class C for footpath)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Cover slab level critical for traffic safety
```

```
Item #: 16
Description: Install grates (where specified) -- verify correct grate type, orientation, and secure fixing
Acceptance Criteria: Grate type, size, and load class as per drawings; orientation correct (bars perpendicular to traffic flow for bicycle safety where required); grate seated firmly; locking mechanism engaged
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Standard drawing reference SD1307 series [VERIFY] -- Grate installation per TMR standard drawings
```

#### Pipe Connections

```
Item #: 17
Description: Verify pipe connections through pit walls -- correct invert levels, proper sealing, no protrusion obstructing flow
Acceptance Criteria: Pipe inverts at correct level per design (+/-10 mm); flexible connector or mortar seal watertight; pipe not protruding into pit more than 25 mm (or flush as specified); benching directs flow smoothly through pit
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Hold Point: pipe connections must be inspected before backfilling around pit
```

```
Item #: 18
Description: Construct internal benching/channelling to direct flow through pit
Acceptance Criteria: Benching smooth and uniform; channel shape matches pipe diameter; benching slopes at minimum 1:10 (10%) toward channel; surface finished smooth with steel trowel; concrete grade as specified
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Benching to provide smooth hydraulic transition
```

#### Step Irons & Safety

```
Item #: 19
Description: Install step irons (where specified) at correct spacing and alignment
Acceptance Criteria: Step irons installed at uniform vertical spacing (typically 300 mm centres); alternating left/right pattern; securely fixed (grouted or cast-in); step irons corrosion resistant (galvanised or polypropylene coated); protruding minimum 100 mm from wall face
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] / TMR standard drawing SD1307 series -- Step irons for chambers >= 1.2 m deep
```

#### Backfill & Completion

```
Item #: 20
Description: Backfill around pit/chamber in uniform layers with approved material
Acceptance Criteria: Backfill placed in layers not exceeding 200 mm compacted thickness; compacted to 95% Standard MDD; material placed evenly around structure to prevent lateral displacement; no heavy equipment operating within 1 m of structure during backfill
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD)
Notes: Clause 18 MRTS03 / Clause 19 MRTS04 [VERIFY] -- Backfill compaction per MRTS04 requirements
```

```
Item #: 21
Description: Perform formwork stripping at appropriate time (cast-in-situ pits)
Acceptance Criteria: Formwork not stripped until concrete achieves minimum strength (typically >= 40% f'c or 24 hours, whichever is later); surfaces inspected immediately after stripping for defects; any honeycombing or defects repaired per MRTS70
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 13.3 / 17.18 MRTS70 [VERIFY] -- Hold Point on stripping load-bearing formwork; witness point for side forms
```

#### Final Verification

```
Item #: 22
Description: Conduct as-built survey of completed pits/chambers
Acceptance Criteria: Survey confirms pit locations, invert levels, lid levels, and connection details match design (within tolerances); survey certified by licensed surveyor
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- As-built records required for all drainage structures
```

```
Item #: 23
Description: Visual inspection of completed pit/chamber interior -- cleanliness, finish, structural integrity
Acceptance Criteria: Interior clean and free of debris; no visible cracks, honeycombing, or structural defects; joints sealed; step irons secure; benching smooth; no standing water (drains freely)
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Final inspection before acceptance
```

```
Item #: 24
Description: Verify pit identification marking as required (pit number, invert levels on lid)
Acceptance Criteria: Pit identification marked as per project requirements; lid type and load rating visible
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Project-specific requirement -- confirm marking standard with Administrator
```

```
Item #: 25
Description: Submit conformance documentation package for pit/chamber construction
Acceptance Criteria: Complete package including: concrete test results, material certificates, formwork inspection records, reinforcement inspection records, as-built survey, photographs, and conformance statement
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5 MRTS50 [VERIFY] -- Documentation required for final acceptance
```

### Test Methods & Frequencies Summary (Template 9)

| Test | Method | Frequency | Acceptance Value |
|------|--------|-----------|-----------------|
| Foundation compaction | TMR Q141A/B + TMR Q142A | 1 per pit/chamber | >= 95% Std MDD |
| Backfill compaction | TMR Q141A/B + TMR Q142A | 1 per pit/layer | >= 95% Std MDD |
| Concrete slump | AS 1012.3.1 | Every truck/batch | Nominated slump +/-15 mm |
| Concrete cylinders (28-day f'c) | AS 1012.8.1 + AS 1012.9 | 1 set (3 cylinders) per pour | >= f'c (typically 32 MPa) |
| Reinforcement cover | Cover meter post-strip | 5 points per pit | >= specified minimum cover |
| As-built survey | Licensed survey | 100% of pits | Inverts +/-10 mm, location +/-50 mm |

---

## Template 10: Drainage -- Box Culverts

```
Template Name: Drainage -- Box Culverts
Activity Type: drainage
Specification Reference: TMR MRTS03 (March 2025), MRTS24 (July 2025), MRTS70 (July 2022)
Edition/Revision Date: March 2025 / July 2025
```

### Checklist Items

#### Pre-Work Submissions & Planning

```
Item #: 1
Description: Submit Box Culvert Construction Procedures including foundation preparation, placement/casting sequence, jointing method, backfill methodology, and waterproofing plan
Acceptance Criteria: Procedures approved by Administrator; includes lifting plan for precast units, crane capacity verification, and traffic management during installation
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS03 / MRTS50 [VERIFY] -- No box culvert works to commence until procedures accepted
```

```
Item #: 2
Description: Submit ITP for box culvert works covering all hold points, witness points, test methods, and frequencies
Acceptance Criteria: ITP accepted by Administrator; aligned with MRTS50; covers foundation, placement, jointing, backfill, and waterproofing phases
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.1 MRTS50 -- Separate ITP required for structures
```

```
Item #: 3
Description: Submit concrete mix design for cast-in-situ box culvert construction (if applicable)
Acceptance Criteria: Mix design approved per MRTS70; target strength >= specified f'c (typically 40 MPa for box culverts); W/C ratio, cement content, and admixtures within specification limits
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: TMR Q458
Notes: Clause 15.1 / 17.6.1 MRTS70 -- Hold Point: concrete mix approval required before placement
```

```
Item #: 4
Description: Submit design drawings and calculations (if design-and-construct) or confirm shop drawings match design intent
Acceptance Criteria: Drawings reviewed and accepted by Administrator; structural adequacy confirmed; dimensions, reinforcement, joint details, and waterproofing specified
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Submit minimum 28 days prior to construction; RPEQ certification required for design-and-construct
```

#### Material Verification -- Precast

```
Item #: 5
Description: Verify precast box culvert units supplied by TMR Registered Supplier
Acceptance Criteria: Supplier holds current TMR Registration Certificate for precast concrete box culverts per MRTS24; manufacturing QA records available on request
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS24 Clause 4 [VERIFY] -- Precast concrete culvert components shall be manufactured only by a Registered Supplier
```

```
Item #: 6
Description: Inspect precast box culvert units on delivery -- dimensional check, surface condition, lifting points
Acceptance Criteria: Internal dimensions not less than 95% of nominal dimensions specified on drawings; no visible cracks, chips, or structural damage; lifting points certified per AS 3850.3; units clearly marked with batch/date
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS24 Hold Point 1 [VERIFY] -- Internal dimensions and effective cross-sectional waterway area verification
```

```
Item #: 7
Description: Verify concrete strength of precast units meets specification via manufacturer test certificates
Acceptance Criteria: 28-day compressive strength certificates confirm f'c >= specified characteristic strength (typically 40-50 MPa); no individual result < 0.85 f'c
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: AS 1012.9 (compressive strength -- manufacturer records)
Notes: MRTS24 / MRTS70 -- Manufacturer responsible for strength compliance; certificates required per unit
```

```
Item #: 8
Description: Verify joint sealing materials -- mortar, grout, gaskets, and sealant comply with specifications
Acceptance Criteria: Cementitious grout for staple joints >= 50 MPa at 28 days; rubber gaskets to manufacturer specification; sealant compatible with concrete surface
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS24 [VERIFY] -- Staple joint grout must achieve minimum 50 MPa
```

#### Material Verification -- Cast-in-Situ

```
Item #: 9
Description: Verify reinforcement steel for cast-in-situ box culvert -- bar scheduling, quantity, grade
Acceptance Criteria: Reinforcement compliant with AS/NZS 4671; mill certificates for each batch; bar sizes and quantities match bar schedule; bars free from excessive rust, oil, or contaminants
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS59 / MRTS71 [VERIFY] -- Material compliance before use
```

```
Item #: 10
Description: Verify formwork system for cast-in-situ box culvert construction
Acceptance Criteria: Formwork design adequate for concrete loads (check against AS 3610); formwork clean, dimensionally accurate, and watertight; release agent applied; sufficient bracing and support
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 11 MRTS70 [VERIFY] -- Formwork per AS 3610 and MRTS70
```

#### Foundation Preparation

```
Item #: 11
Description: Strip and prepare culvert foundation -- remove unsuitable material, confirm natural ground bearing capacity
Acceptance Criteria: Foundation excavated to design level; all topsoil, organic material, and soft ground removed; founding material has adequate bearing capacity (confirm by visual inspection or testing if required); no standing water
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.1 MRTS03 [VERIFY] -- Administrator notified to inspect foundation excavation; 3 working days notice
```

```
Item #: 12
Description: Inspect foundation excavation at design level -- verify soil conditions match geotechnical report
Acceptance Criteria: Foundation soil conditions consistent with geotechnical investigation; no unexpected soft zones, voids, or groundwater; founding level as per design; any variations reported to Administrator for direction
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 13.3.4.1 MRTS04 [VERIFY] -- Hold Point: No culvert foundation to be covered until Administrator inspects and accepts (3 days notice). Cross-reference with MRTS04 earthworks foundation hold point.
```

```
Item #: 13
Description: Place and compact foundation bedding to design level and grade
Acceptance Criteria: Bedding material placed to specified depth (typically 150-200 mm); compacted to 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); level within +/-10 mm; surface smooth and free of irregularities; provides continuous even support
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD)
Notes: Clause 12.3.2 MRTS03 / Clause 18 [VERIFY] -- Foundation bedding is a Hold Point. Bedding tolerance +/-10 mm level, +/-50 mm line.
```

```
Item #: 14
Description: Construct concrete blinding/levelling pad if specified on drawings
Acceptance Criteria: Blinding concrete placed to correct thickness and level; concrete grade as specified (typically 20 MPa lean mix); surface finished level +/-5 mm; cured adequately before culvert placement
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Blinding not always required -- check drawings. If specified, must be cured before placing culvert units.
```

#### Precast Box Culvert Placement

```
Item #: 15
Description: Verify crane capacity and lifting plan for precast unit placement
Acceptance Criteria: Crane capacity verified for maximum unit weight at maximum radius; lifting plan approved; lifting points on culvert units inspected before each lift; tag lines and safety exclusion zone established
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 3850.3 -- Lifting design for precast elements; crane to have current certification
```

```
Item #: 16
Description: Place first precast box culvert unit -- verify alignment, level, and orientation
Acceptance Criteria: Unit placed on prepared bedding without damage; unit level within +/-5 mm (transverse) and +/-10 mm (longitudinal); aligned to survey marks; orientation correct (flow direction)
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- Hold Point: first unit placement; Administrator inspection required before continuing
```

```
Item #: 17
Description: Place subsequent precast units -- verify joint alignment and culvert continuity
Acceptance Criteria: Units placed in sequence from downstream to upstream (unless otherwise directed); joint faces clean and aligned; horizontal and vertical alignment within tolerances per MRTS03 (no noticeable irregularities); positive drainage slope maintained throughout
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- Culverts shall have positive drainage slope along whole length
```

```
Item #: 18
Description: Verify overall culvert alignment (horizontal and vertical) after all units placed
Acceptance Criteria: Horizontal alignment within +/-50 mm; vertical (invert) alignment within +/-10 mm at each joint; no abrupt changes in alignment; internal waterway profile smooth and continuous
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- Hold Point: alignment survey before jointing is completed
```

#### Jointing

```
Item #: 19
Description: Construct staple joints between precast box culvert units
Acceptance Criteria: Galvanised bar anchors placed in aligned preformed recesses; bar anchors grouted with approved cementitious grout (>= 50 MPa at 28 days); mortar seatings for link slabs placed; four bar anchors per 1.2 m slab section
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS24 [VERIFY] -- Staple joints with galvanised bars and cementitious grout; link slabs simply supported on mortar seatings
```

```
Item #: 20
Description: Seal joints between culvert units -- apply external joint sealant/waterproof membrane if specified
Acceptance Criteria: Joint sealant or membrane applied per manufacturer instructions; full coverage across joint width; no gaps, bubbles, or disbonded areas; sealant compatible with concrete and groundwater conditions
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 12.3.4 MRTS03 [VERIFY] -- External joint treatment to prevent water ingress; check project specification for membrane requirements
```

```
Item #: 21
Description: Verify internal joint finish -- no protrusions or steps that could obstruct flow or catch debris
Acceptance Criteria: Internal joint faces flush within 5 mm step; no mortar or sealant protruding into waterway; internal surface smooth and continuous
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Internal joint quality affects hydraulic performance and maintenance access
```

#### Cast-in-Situ Box Culvert Construction

```
Item #: 22
Description: Inspect base slab formwork and reinforcement prior to base concrete pour
Acceptance Criteria: Formwork level, dimensionally accurate, and watertight; reinforcement per drawings -- bar size, spacing, cover, and laps correct; cover spacers at maximum 1.0 m centres; starter bars for walls correctly positioned; waterstops installed at construction joints
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 11.3 / 17.2 MRTS70 -- Hold Point: formwork and reinforcement inspection before concrete
```

```
Item #: 23
Description: Place and finish base slab concrete
Acceptance Criteria: Concrete slump within approved range; concrete vibrated to full compaction; surface finished to specified level (+/-5 mm); no honeycombing or cold joints; construction joint treatment prepared for wall pour; curing commenced immediately
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (slump), AS 1012.8.1/9 (strength cylinders)
Notes: Clause 17.7 MRTS70 -- Witness Point: 24 hours notice for major pours
```

```
Item #: 24
Description: Inspect wall and soffit formwork and reinforcement prior to wall/roof pour
Acceptance Criteria: All formwork dimensionally accurate, braced, and clean; reinforcement per drawings; cover correct; waterstops at construction joints; haunch/chamfer formwork in place; ties/spacers not compromising cover; blockouts for pipes in correct positions
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 11.3 / 17.2 MRTS70 -- Hold Point: formwork and reo inspection for each pour stage
```

```
Item #: 25
Description: Place wall and roof slab concrete
Acceptance Criteria: Concrete placed in continuous operation; slump within range; vibrated to full compaction; no cold joints; roof slab finished to correct level and crossfall; curing commenced immediately
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (slump), AS 1012.8.1/9 (strength cylinders)
Notes: Clause 17.7 MRTS70 -- Witness Point: 24 hours notice
```

```
Item #: 26
Description: Strip formwork at appropriate time
Acceptance Criteria: Formwork not stripped until concrete achieves minimum strength (typically >= 40% f'c for non-load-bearing forms, >= 75% f'c for load-bearing soffits); surfaces inspected for defects; any honeycombing repaired per MRTS70
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (early age strength from site-cured cylinders)
Notes: Clause 13.3 / 17.18 MRTS70 -- Hold Point: structural formwork stripping requires strength confirmation
```

#### Waterproofing

```
Item #: 27
Description: Apply waterproofing membrane to external surfaces if specified on drawings
Acceptance Criteria: Membrane applied to clean, dry concrete surface; full coverage with correct overlap at joints and edges; membrane type and application per manufacturer specification; no punctures, tears, or disbonded areas
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Project-specific requirement -- check drawings for waterproofing extent and type
```

```
Item #: 28
Description: Install protection board over waterproofing membrane before backfilling
Acceptance Criteria: Protection board installed full height of waterproofed surface; no exposed membrane areas; board securely held in place until backfill placed
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Protection board prevents backfill from damaging waterproofing membrane
```

#### End Structures

```
Item #: 29
Description: Construct headwalls, wingwalls, and apron slabs per drawings and MRTS03
Acceptance Criteria: End structures constructed to design dimensions; concrete grade as specified; reinforcement per drawings; scour protection and energy dissipation measures in place; transitions to embankment smooth
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- End structures per MRTS03 and TMR standard drawings (SD1300 series)
```

```
Item #: 30
Description: Install scour protection (rock, concrete, or geotextile) at inlet and outlet as specified
Acceptance Criteria: Scour protection type, extent, and thickness per drawings; rock size and grading per specification; geotextile underlayer installed (if specified); extends to design limits upstream and downstream
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 18 MRTS03 [VERIFY] -- Scour protection critical for culvert longevity
```

#### Backfill

```
Item #: 31
Description: Place and compact structural backfill around and over box culvert in uniform layers
Acceptance Criteria: Backfill placed symmetrically on both sides to prevent lateral displacement; layers not exceeding 200 mm compacted thickness; compacted to 95% Standard MDD; no heavy rollers within 1.0 m of culvert walls until cover >= 600 mm
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD)
Notes: Clause 12.3.5 MRTS03 / Clause 19 MRTS04 [VERIFY] -- Hold Point: backfill compaction around structures. Symmetrical placement essential.
```

```
Item #: 32
Description: Verify minimum cover over culvert before allowing construction traffic
Acceptance Criteria: Minimum cover as specified on drawings (typically 600 mm minimum, or greater for heavy construction traffic); compaction confirmed by testing; surface level recorded
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B
Notes: Clause 12.3.5 MRTS03 [VERIFY] -- Hold Point: no construction traffic until minimum cover achieved and compacted
```

```
Item #: 33
Description: Complete embankment fill over culvert to subgrade level
Acceptance Criteria: Fill placed in layers per MRTS04; compaction to 95% Standard MDD (general fill) or 97% MDD (subgrade zone); no differential settlement; level surveys confirm design profile
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B, TMR Q142A, AS 1289.5.4.1
Notes: Clause 15 MRTS04 [VERIFY] -- Embankment fill compaction per MRTS04 General Earthworks
```

#### Post-Construction Verification

```
Item #: 34
Description: Conduct internal inspection of completed box culvert -- cleanliness, alignment, joint integrity
Acceptance Criteria: Interior clean and free of debris; no visible cracks wider than 0.2 mm; joints sealed and watertight; no evidence of ground water infiltration; alignment smooth and continuous; invert clean and free-draining
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Walk-through inspection for culverts large enough to enter safely; CCTV for smaller culverts
```

```
Item #: 35
Description: Conduct CCTV inspection if culvert size precludes safe personnel entry
Acceptance Criteria: Continuous CCTV recording of entire culvert length; no structural defects; joints intact; no infiltration; clear waterway maintained
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: CCTV inspection per WSA 05 or project specification
Notes: Required for culverts where personnel entry is not safe; recording submitted to Administrator
```

```
Item #: 36
Description: Conduct as-built survey of completed box culvert installation
Acceptance Criteria: Survey confirms: invert levels +/-10 mm, horizontal alignment +/-50 mm, internal dimensions >= 95% of nominal, cover depth matches design; survey certified by licensed surveyor
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- As-built survey required; MRTS24 requires effective waterway area >= 95% of nominal
```

```
Item #: 37
Description: Verify culvert hydraulic performance -- confirm no ponding at inlet, free flow through culvert
Acceptance Criteria: Water drains freely through culvert under normal conditions; no ponding at inlet beyond design tailwater; no scour or erosion visible at outlet; no debris accumulation
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Visual check during first rainfall event if possible; otherwise verify by grade and alignment survey
```

#### Concrete Testing & Quality Records

```
Item #: 38
Description: Verify all concrete test results (28-day cylinders) meet specification requirements
Acceptance Criteria: All cylinder strengths >= f'c characteristic strength; no individual result < 0.85 f'c (or per MRTS70 statistical criteria); mean strength per lot >= target strength
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 12 MRTS70 [VERIFY] -- Results must be reviewed and accepted before final acceptance of structure
```

```
Item #: 39
Description: Verify all compaction test results for foundation, bedding, and backfill
Acceptance Criteria: All density test results >= specified minimum (95% Std MDD for general, 97% for subgrade zone); no individual test below 93% Std MDD; moisture content within specified range
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B, TMR Q142A
Notes: Compile all compaction results for conformance report
```

#### Documentation

```
Item #: 40
Description: Submit complete conformance documentation package for box culvert construction
Acceptance Criteria: Package includes: concrete test results, compaction test results, material certificates (precast or reinforcement), formwork inspection records, reinforcement inspection records, waterproofing records, as-built survey, CCTV report, photographs, and conformance statement signed by Contractor's representative
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5 MRTS50 [VERIFY] -- Complete documentation package required before final acceptance
```

```
Item #: 41
Description: Submit maintenance requirements and access provisions for completed culvert
Acceptance Criteria: Maintenance access points identified; debris management plan if applicable; safety requirements for personnel entry documented
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Typically required for culverts with maintenance access chambers
```

### Test Methods & Frequencies Summary (Template 10)

| Test | Method | Frequency | Acceptance Value |
|------|--------|-----------|-----------------|
| Foundation compaction | TMR Q141A/B + TMR Q142A | 1 per culvert foundation | >= 95% Std MDD |
| Bedding compaction | TMR Q141A/B + TMR Q142A | 1 per culvert | >= 95% Std MDD |
| Backfill compaction | TMR Q141A/B + TMR Q142A | 1 per layer per side | >= 95% Std MDD |
| Embankment compaction | TMR Q141A/B + TMR Q142A | 1 per 500 m2 per layer | >= 95% (fill), 97% (subgrade) |
| Concrete slump | AS 1012.3.1 | Every truck for CIS | Nominated slump +/-15 mm |
| Concrete 28-day strength | AS 1012.8.1 + AS 1012.9 | 1 set (3 cyl) per 50 m3 or per pour | >= f'c (typ. 40 MPa) |
| Precast unit dimensions | Physical measurement | 100% on delivery | Internal dims >= 95% of nominal |
| Staple joint grout strength | AS 1012.9 | 1 set per culvert | >= 50 MPa at 28 days |
| CCTV/walk-through inspection | Visual / CCTV | 100% of culvert length | No structural defects |
| As-built survey | Licensed survey | 100% of culvert | Inverts +/-10 mm, alignment +/-50 mm |
| Waterproofing adhesion | Pull test (if specified) | Per manufacturer spec | Per product data sheet |

---

## Template 11: Drainage -- Subsoil/Subsurface Drainage

```
Template Name: Drainage -- Subsoil/Subsurface Drainage
Activity Type: drainage
Specification Reference: TMR MRTS03 (March 2025), Clauses 27-29
Edition/Revision Date: March 2025
```

### Checklist Items

#### Pre-Work Submissions

```
Item #: 1
Description: Submit construction procedures for subsoil drainage installation including trench excavation, filter material placement, pipe grade control, and geotextile wrapping methodology
Acceptance Criteria: Procedures approved by Administrator; include equipment, material handling, and quality control measures
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS03 / MRTS50 [VERIFY] -- Procedures to be accepted before commencing subsoil drainage works
```

```
Item #: 2
Description: Submit ITP for subsoil drainage works
Acceptance Criteria: ITP accepted by Administrator; covers material verification, trench excavation, pipe laying, filter placement, geotextile wrapping, and outlet connections
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.1 MRTS50 -- ITP required for drainage works
```

#### Material Verification

```
Item #: 3
Description: Verify subsoil drainage pipe material, size, and perforation pattern comply with specification
Acceptance Criteria: Pipe type as specified (typically slotted PVC, corrugated polyethylene, or ag pipe); diameter as per drawings; perforations/slots in correct pattern; material certificates provided; pipe undamaged
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 27.2.1 MRTS03 [VERIFY] -- Drainage pipe material and type per specification
```

```
Item #: 4
Description: Verify filter/drainage aggregate material complies with grading requirements
Acceptance Criteria: Filter material grading within specified envelope (per MRTS03 or project specification); free from fines, clay, organic material; typically single-sized gravel or crushed rock; particle size distribution tested
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.3.6.1 (particle size distribution)
Notes: Clause 27.2.4 MRTS03 [VERIFY] -- Filter aggregate must be tested and approved before use. Hold Point for material compliance.
```

```
Item #: 5
Description: Verify geotextile material complies with specification (if geotextile-wrapped drain specified)
Acceptance Criteria: Geotextile type, grade, and properties per specification (typically nonwoven, grab tensile strength, apparent opening size, and permittivity within specified ranges); manufacturer test certificates provided; material undamaged and within shelf life
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 27.2.3 MRTS03 [VERIFY] -- Geotextile to comply with MRTS03 requirements and manufacturer specification
```

```
Item #: 6
Description: Verify strip filter drain material if used in lieu of or supplementary to aggregate filter
Acceptance Criteria: Strip filter drain material type and grade as specified; manufacturer certificates provided; drainage capacity meets design requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 27.2.2 MRTS03 [VERIFY] -- Strip filter drains as alternative to granular filter
```

#### Trench Excavation

```
Item #: 7
Description: Set out trench alignment from survey datum -- confirm line, grade, and outlet location
Acceptance Criteria: Trench centreline set out from design alignment; invert grade confirmed; outlet location and connection point identified; minimum cover to subgrade surface maintained
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Set-out by survey
```

```
Item #: 8
Description: Excavate trench to specified width and depth -- maintain grade and side stability
Acceptance Criteria: Trench width as specified (typically 300-450 mm for standard subsoil drain); depth provides correct pipe invert level with positive grade to outlet; trench base firm and even; sides stable; no slumping or caving
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Administrator may witness trench excavation; typically notified 1 working day prior
```

```
Item #: 9
Description: Confirm trench invert grade provides continuous positive fall to outlet -- no flat spots or adverse grades
Acceptance Criteria: Minimum grade as specified on drawings (typically >= 0.5% or 1:200 minimum); verified by level survey or laser grade; no ponding points; grade confirmed at maximum 10 m intervals
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Hold Point: pipe grade verification before pipe placement. Correct grade is critical for subsoil drain function.
```

#### Geotextile & Filter Placement

```
Item #: 10
Description: Install geotextile lining in trench (if geotextile-wrapped drain specified) before placing pipe and aggregate
Acceptance Criteria: Geotextile placed with sufficient width to wrap around aggregate envelope with minimum 300 mm overlap at top; no tears, holes, or contamination; geotextile held against trench sides during placement
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27.2.3 MRTS03 [VERIFY] -- Geotextile overlap at top must be secured before backfilling
```

```
Item #: 11
Description: Place initial layer of filter aggregate in trench bottom before pipe placement
Acceptance Criteria: Minimum 50-75 mm depth of filter aggregate placed on geotextile (or trench base if no geotextile); aggregate graded to specification; provides even support for pipe
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Aggregate bedding under pipe for uniform support
```

#### Pipe Installation

```
Item #: 12
Description: Lay subsoil drainage pipe on aggregate bedding to correct alignment and grade
Acceptance Criteria: Pipe laid to grade with perforations/slots facing down (unless otherwise specified); joints properly connected (push-fit or manufacturer connection); no kinks, bends beyond minimum radius, or damage; pipe supported continuously on aggregate
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Witness Point: Administrator may inspect pipe laying and grade
```

```
Item #: 13
Description: Place remaining filter aggregate around and over pipe to specified depth
Acceptance Criteria: Aggregate placed to surround pipe with minimum 75 mm on sides and 150 mm above pipe crown (or as specified); aggregate carefully placed to avoid displacing pipe; no voids or bridging
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Aggregate envelope must provide full surround drainage
```

```
Item #: 14
Description: Fold geotextile over aggregate envelope and secure overlap (if geotextile-wrapped drain)
Acceptance Criteria: Geotextile folded over with minimum 300 mm overlap (or as specified); overlap facing upstream/uphill to prevent soil migration into overlap; geotextile in full contact with aggregate; no tears or gaps
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27.2.3 MRTS03 [VERIFY] -- Overlap direction critical to prevent soil intrusion
```

#### Outlet Connections

```
Item #: 15
Description: Construct outlet connection from subsoil drain to stormwater pit, open drain, or daylight outlet
Acceptance Criteria: Outlet connection complete and watertight; invert level correct to allow free drainage; flap valve or vermin screen installed (if specified); outlet protected from erosion and damage; no backflow path from stormwater system into subsoil drain
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 27 MRTS03 [VERIFY] -- Hold Point: outlet connection must be inspected and approved. Critical for drain function.
```

#### Backfill & Completion

```
Item #: 16
Description: Backfill trench above filter envelope with approved material
Acceptance Criteria: Backfill material as specified (may be selected fill or site-won material); placed in layers; compacted to 95% Standard MDD (cohesive) or specified density; no damage to geotextile or pipe during compaction; compaction equipment appropriate for trench width
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q141A/B (insitu density), TMR Q142A (MDD)
Notes: Clause 27 MRTS03 / Clause 19 MRTS04 [VERIFY] -- Backfill compaction per MRTS04
```

#### Final Verification

```
Item #: 17
Description: Conduct functional test of completed subsoil drain -- verify water flows freely to outlet
Acceptance Criteria: Water introduced at upstream end of drain discharges at outlet within reasonable time; flow rate consistent with drain capacity; no ponding or blockages; outlet functioning correctly
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Simple functional flow test to confirm drain operates as designed
```

```
Item #: 18
Description: Conduct as-built survey of subsoil drain alignment, grades, and outlet locations
Acceptance Criteria: Survey confirms pipe alignment, invert levels, aggregate envelope extents, and outlet location match design; survey certified
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 54 MRTS03 [VERIFY] -- As-built records for subsoil drainage
```

```
Item #: 19
Description: Submit conformance documentation package for subsoil drainage works
Acceptance Criteria: Package includes: material test certificates (aggregate grading, geotextile properties), pipe certificates, compaction test results, as-built survey, photographs, and conformance statement
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5 MRTS50 [VERIFY] -- Documentation package for acceptance
```

### Test Methods & Frequencies Summary (Template 11)

| Test | Method | Frequency | Acceptance Value |
|------|--------|-----------|-----------------|
| Filter aggregate grading | AS 1289.3.6.1 | Per source / per 200 m3 | Within specified envelope |
| Geotextile properties | Manufacturer certificate | Per delivery batch | Per MRTS03 specification |
| Trench backfill compaction | TMR Q141A/B + TMR Q142A | 1 per 50 lm per layer | >= 95% Std MDD |
| Pipe grade verification | Level survey or laser | Every 10 m maximum | >= minimum design grade (typ. 0.5%) |
| Flow test | Visual observation | 1 per drain run | Water discharges freely at outlet |
| As-built survey | Licensed survey | 100% of drain runs | Per design alignment and grade |

---

## Key Research Notes and Caveats

### Specification Naming Changes
The current March 2025 edition of MRTS03 has been retitled to **"Drainage Structures, Retaining Structures and Slope Protections"** (previously "Drainage, Retaining Structures and Protective Treatments"). The clause structure may have changed from the 2019 superseded edition.

### MRTS33 Does Not Exist
Research confirmed that **MRTS33 does not exist as a separate TMR specification**. The relevant specifications for box culverts are:
- **MRTS24** (July 2025) -- Manufacture of Precast Concrete Culverts (manufacturing QA)
- **MRTS03** (March 2025) -- Installation requirements for all drainage structures including box culverts
- **MRTS70** (July 2022) -- Concrete requirements for cast-in-situ box culverts

### TMR Technical Note 27
TMR Technical Note 27 provides guidelines for design of precast concrete box culverts and should be referenced for design aspects of Template 10.

### TMR Technical Note 187
TMR Technical Note 187 provides guidance on Controlled Low-Strength Material (CLSM) as an alternative to granular bedding/backfill for pipe installation. Where CLSM is used:
- Bedding factor = 2.5 (equivalent to HS2)
- Replaces standard backfill in haunch and side zones
- Optionally used in overlay zone

### Clause Number Verification Required
All clause numbers flagged with [VERIFY] were derived from the 2019 superseded edition of MRTS03 or from partial web extracts. The March 2025 current edition may have renumbered clauses. **Manual verification against the current PDF is required before these templates are seeded into the production database.**

### AS/NZS 3725 Support Types (Used in Template 8)

| Support Type | Compaction Standard | Typical Application |
|-------------|-------------------|-------------------|
| HS1 | Standard trench conditions | Light-duty / rural areas |
| HS2 | 90% Standard Compaction | Standard road reserve installations |
| HS3 | 95% Standard Compaction | High embankment / heavy traffic areas |
| HS4 | Concrete encasement | Extreme loading / shallow cover |

### TMR Standard Drawings Referenced

| Drawing | Description |
|---------|-------------|
| SD1300 series | Culvert end structures, headwalls, wingwalls |
| SD1307 series | Access chambers -- cast-in-situ and precast details |
| SD1311 | Gully pit and inlet details |
| SD1359 | Precast concrete box culvert standard details |

### Sources and References

- [TMR Category 3 Specifications](https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Specifications/3-Roadworks-Drainage-Culverts-and-Geotechnical)
- [MRTS03 Drainage Structures, Retaining Structures and Slope Protections (March 2025)](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/3-Roadworks-Drainage-Culverts-and-Geotechnical/MRTS03.pdf)
- [MRTS24 Manufacture of Precast Concrete Culverts (July 2025)](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/3-Roadworks-Drainage-Culverts-and-Geotechnical/MRTS24.pdf)
- [MRTS70 Concrete (July 2022)](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/2-Bridges-and-Structures/MRTS70.pdf)
- [TMR Technical Note 27 -- Box Culvert Design](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Bridges-other-structures/TN27.pdf)
- [TMR Technical Note 187 -- CLSM for Pipe Installation](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Bridges-other-structures/TN187.pdf)
- [TMR Materials Testing Manual Edition 6, Amendment 3 (June 2025)](https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Materials-testing-manual)
- [TMR Standard Drawings -- Roadworks, Drainage, Culverts and Geotechnical](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/standard-drawings-roads/roadworks-drainage-culverts-and-geotechnical)
- [FNQROC Stormwater Drainage Specification S4](https://www.fnqroc.qld.gov.au/files/media/original/004/fc7/029/245/S4-Stormwater-Drainage-Specifications---FNQROC-Development-Manual-11_19-Issue-8.pdf)
- [FNQROC Construction Procedures CP1](https://www.fnqroc.qld.gov.au/files/media/original/005/21e/fa8/84c/LIVE--1063076-v41-CP1_Construction_Procedures__-_11_19-_Issue_8.pdf)
- AS/NZS 3725:2007 -- Design for Installation of Buried Concrete Pipes
- AS 4058:2007 -- Precast Concrete Pipes (Pressure and Non-Pressure)
- AS 1597.1/2 -- Precast Reinforced Concrete Box Culverts
- [CQA Guide to ITPs](https://www.cqa.org.au/post/guide-how-to-create-an-inspection-and-test-plan-itp)

---

## Item Count Summary

| Template | Items | Target Range | Status |
|----------|-------|-------------|--------|
| Template 8: Pipe Installation | 35 | 35-40 | Within range |
| Template 9: Pits & Chambers | 25 | 25-30 | Within range |
| Template 10: Box Culverts | 41 | 45-55 | Slightly below -- consider adding concrete testing items if CIS construction is common |
| Template 11: Subsoil Drainage | 19 | 15-20 | Within range |
| **Total** | **120** | **120-145** | |
