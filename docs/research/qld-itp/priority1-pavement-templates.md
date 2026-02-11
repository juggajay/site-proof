# Priority 1 Pavement Templates: QLD TMR ITP Research

## Research Date: February 2026
## Researcher: Claude Code (AI-assisted research)
## Status: RESEARCH COMPLETE -- Clause numbers require verification against full PDF specs

---

## Key Questions Answered

### 1. Does TMR have a rigid (concrete) pavement specification?

**YES.** TMR has **MRTS40 Concrete Pavement Base** (November 2018 edition). This is a comprehensive specification covering:
- Plain Concrete Pavements (PCP)
- Jointed Reinforced Concrete Pavements (JRCP)
- Continuously Reinforced Concrete Pavements (CRCP)
- Steel Fibre Reinforced Concrete Pavements (SFCP)

MRTS40 is substantially derived from the NSW RMS QA Specification R83 Concrete Pavement Base (2013) and is intended for heavy-duty road pavements carrying substantial volumes of heavy vehicles. There is also a companion specification **MRTS41 Concrete Pavement Base (Ancillary Works)** (July 2023 draft) covering dowel baskets, tie bars, joint forming, and texturing.

TMR concrete pavements are used on major Queensland highways (e.g., Bruce Highway, Gateway Motorway) but are less common than flexible pavements. They are typically specified for high-traffic intersections, heavy vehicle routes, and motorway projects.

### 2. Is MRTS08 (Plant-Mixed Stabilised) commonly used on QLD TMR projects?

**YES, MRTS08 is commonly used.** The specification has been updated to "Plant-Mixed Heavily Bound (Cemented) Pavements" (November 2022 edition). It is used alongside MRTS10 (Plant-Mixed Lightly Bound Pavements) for different strength categories:

- **MRTS08** (Heavily Bound): UCS > 4 MPa at 28 days (Category 1) or > 2 MPa at 28 days (Category 2)
- **MRTS10** (Lightly Bound): UCS 1.0-2.0 MPa target

Plant-mixed is increasingly preferred over in-situ (MRTS07) for major projects because it provides better quality control, more uniform mixing, and consistent binder distribution. In-situ stabilisation (MRTS07A/B) remains the standard for lower-traffic roads, rehabilitation works, and where plant access is impractical.

Mix design registration is now managed through **Technical Note TN204** rather than within MRTS08 itself.

### 3. Are priming/primersealing requirements fully within MRTS11?

**YES, priming and primersealing are covered within MRTS11** (Sprayed Bituminous Treatments, Excluding Emulsion, July 2025). The scope of MRTS11 explicitly includes "primes, primerseals, seals, reseals and enrichments." There is no separate specification for priming.

Additional design guidance is provided in:
- **TMR Technical Note TN175** (Selection and Design of Sprayed Bituminous Treatments)
- **Austroads AGPT04K** (Guide to Pavement Technology Part 4K: Selection and Design of Sprayed Seals)
- **TMR Technical Note TN186** (Sealing in Cold Weather Conditions)

MRTS11 uses the term "initial seal" to describe primerseals on new pavement surfaces.

---

## Template 14: Concrete Pavement (MRTS40)

### Template Header
```
Template Name: Concrete Pavement Base
Activity Type: pavement_concrete
Specification Reference: TMR MRTS40 Concrete Pavement Base / MRTS41 Concrete Pavement Base (Ancillary Works)
Edition/Revision Date: November 2018 (MRTS40) / July 2023 (MRTS41)
```

### Checklist Items

#### Pre-Work Submissions & Approvals

**Item 1:**
```
Item #: 1
Description: Submit Construction Procedures for concrete pavement works including plant details, equipment, placement methods, curing procedures, and contingency plans
Acceptance Criteria: Procedures accepted by Administrator at least 14 calendar days before work commences; must comply with Clause 6 of MRTS50
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 MRTS40 — Quality Plan submission per MRTS50. No paving to commence until procedures accepted.
```

**Item 2:**
```
Item #: 2
Description: Submit nominated concrete mix design for approval including cement type, admixtures, water/cement ratio, and target 28-day flexural strength
Acceptance Criteria: Mix design meets requirements of Table 7.3 (minimum compressive and flexural strength at 28 days); mix design certificate provided at least 4 weeks prior to placement
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS 1012.9 (compressive), AS 1012.11 (flexural)
Notes: Hold Point 1 — Clause 7.3 [VERIFY] MRTS40. No concrete to be placed until mix design approved by Administrator.
```

**Item 3:**
```
Item #: 3
Description: Submit Construction Procedure for aggregate production including quarry details and conformity of particle size distribution of combined aggregates
Acceptance Criteria: Aggregate complies with AS 2758.1 and Table 6.1.5 of MRTS40; quarry source approved
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS 1141.11 (particle size distribution)
Notes: Clause 6 MRTS40 / MRTS50 Clause 6. Aggregate source to be registered.
```

**Item 4:**
```
Item #: 4
Description: Submit details of proposed dowel support system and method of debonding dowels (for JRCP/PCP with dowelled joints)
Acceptance Criteria: Dowel system suitable for pavement type; debonding method prevents concrete bond to dowels on one side of joint
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 8 [VERIFY] MRTS40/MRTS41. Dowel details form part of Construction Procedures.
```

**Item 5:**
```
Item #: 5
Description: Submit details of tie bar installation method (drilled and grouted or inserted during paving) with demonstration trial if using inserted tie bars
Acceptance Criteria: Tie bar system demonstrates adequate pull-out resistance; demonstration trial acceptable to Administrator
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: Pull-out test per MRTS41 [VERIFY]
Notes: MRTS41 Clause [VERIFY]. Inserted tiebars usually require a demonstration trial plus pull-out testing.
```

#### Subbase Preparation

**Item 6:**
```
Item #: 6
Description: Verify subbase layer compliance (unbound or bound) is complete with all conformance testing passed before concrete pavement placement
Acceptance Criteria: Subbase compaction, level, and thickness meet design requirements per MRTS05/MRTS08 as applicable; proof rolling complete
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.5.4.1 (density), Survey (levels)
Notes: Clause 8.2 [VERIFY] MRTS40. Concrete not to be placed on nonconforming subbase. Cross-reference to MRTS05 or MRTS08 ITP.
```

**Item 7:**
```
Item #: 7
Description: Inspect subbase surface for cleanliness, correct profile, and absence of loose material or damage prior to paving
Acceptance Criteria: Surface free of debris, standing water, and damage; profile within specified tolerances; no high invert levels
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8.2 [VERIFY] MRTS40. Hold Point 2 applied if any high invert levels exist.
```

**Item 8:**
```
Item #: 8
Description: Verify set-out of pavement edges, joints, and alignment prior to formwork or slipform paving
Acceptance Criteria: Set-out matches design drawings within survey tolerances; all joint locations marked
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey check
Notes: MRTS56 Construction Surveying requirements apply.
```

#### Formwork & Reinforcement (Fixed Form Paving)

**Item 9:**
```
Item #: 9
Description: Inspect formwork alignment, grade, and rigidity prior to concrete placement (fixed form paving)
Acceptance Criteria: Forms set to correct line and level; forms rigid enough to resist concrete pressure without deflection; clean and oiled; expansion joint filler correctly positioned
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Survey check (line and level)
Notes: Clause 8 [VERIFY] MRTS40. Applicable to fixed form paving only, not slipform.
```

**Item 10:**
```
Item #: 10
Description: Inspect reinforcement placement including bar size, spacing, cover, lap lengths, and chair spacing (JRCP/CRCP)
Acceptance Criteria: Reinforcement complies with drawings; cover as specified; lap lengths per design; chairs stable and correctly spaced; no displaced bars
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Cover meter verification
Notes: Clause 8 [VERIFY] MRTS40. No concrete to be placed until reinforcement inspected and accepted. For CRCP, longitudinal reinforcement is critical.
```

**Item 11:**
```
Item #: 11
Description: Verify dowel bar assembly placement at transverse joints including alignment, spacing, and debonding (JRCP/PCP)
Acceptance Criteria: Dowels aligned within +/- 2 mm tolerance in finished slab; spacing per design; debonding material intact on withdrawal side; dowels parallel to pavement surface and centreline
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Metal detector survey post-pour
Notes: MRTS40 — alignment tolerance on dowel location is +/- 2 mm. Dowel alignment verified by metal detector after placement.
```

**Item 12:**
```
Item #: 12
Description: Verify tie bar placement at longitudinal joints including spacing, length, and embedment depth
Acceptance Criteria: Tie bars at specified spacing, length, and embedment; bars perpendicular to joint face; correctly debonded if required
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS41 [VERIFY]. Tie bars connect longitudinal joint faces to prevent lane separation.
```

#### Slipform Paving Equipment Check

**Item 13:**
```
Item #: 13
Description: Inspect slipform paver setup including string line, machine calibration, vibrator condition, and automatic grade/steering sensors
Acceptance Criteria: Paver calibrated; string line set to correct grade; vibrators operational and at correct frequency; grade sensors functional
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS40. Equipment check before each paving session.
```

#### Trial Paving Section

**Item 14:**
```
Item #: 14
Description: Construct trial paving section to demonstrate equipment capability, placement methods, finishing, and texturing
Acceptance Criteria: Trial section placed in continuous operation without intermediate construction joints; surface finish, ride quality, joint formation, compaction, and texturing demonstrated to meet specification requirements
Point Type: hold_point
Responsible Party: contractor
Evidence Required: inspection
Test Type: Surface regularity, core testing
Notes: Clause 8.4 [VERIFY] MRTS40. Hold Point 3 [VERIFY] — No full-scale paving until trial section results accepted by Administrator.
```

**Item 15:**
```
Item #: 15
Description: Administrator to witness trial paving section construction including concrete supply, placement, consolidation, finishing, texturing, and curing
Acceptance Criteria: All operations demonstrated satisfactorily; ride quality, surface texture, edge slump, and joint formation acceptable
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 8.4 [VERIFY] MRTS40. Administrator witnesses full trial paving operation.
```

#### Concrete Supply & Placement

**Item 16:**
```
Item #: 16
Description: Verify concrete slump at point of discharge for each delivery
Acceptance Criteria: Slump within +/- 15 mm (or +/- 25%) of nominated slump; consistence suitable for equipment and placement method
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (slump test)
Notes: Clause 7 [VERIFY] MRTS40. Slump determined per AS 1012.3.1. Nominated slump to best suit equipment and methods.
```

**Item 17:**
```
Item #: 17
Description: Record concrete temperature at discharge and verify placement time from batching
Acceptance Criteria: Concrete temperature within specified limits (typically 10-32 degrees C); placement completed within maximum time from batching (typically 90 min unless retarder used)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.8.4 (temperature)
Notes: Clause 7 [VERIFY] MRTS40. Record temperature and batch time for every load. Reject loads exceeding limits.
```

**Item 18:**
```
Item #: 18
Description: Cast flexural strength test beams and compressive strength cylinders during paving for each lot
Acceptance Criteria: Minimum 1 set of beams per lot (or per day's paving); specimens made in accordance with AS 1012.8.1; stored and cured at 23 +/- 2 degrees C
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.8.1 (making specimens), AS 1012.11 (flexural), AS 1012.9 (compressive)
Notes: Clause 9 [VERIFY] MRTS40 / Appendix P3. Flexural strength is the primary acceptance criterion for concrete pavement.
```

**Item 19:**
```
Item #: 19
Description: Monitor concrete placement to ensure continuous supply, proper consolidation by internal vibrators, and no segregation or cold joints
Acceptance Criteria: No interruption to supply causing cold joints; concrete fully consolidated with no honeycombing; vibrators operating at correct frequency; no segregation at edges
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8.4 [VERIFY] MRTS40. Continuous supply essential to avoid construction joints.
```

**Item 20:**
```
Item #: 20
Description: Verify concrete placement does not occur when surface temperature of subbase is below minimum or during rain
Acceptance Criteria: No placement when subbase surface temperature below 5 degrees C [VERIFY]; no placement during rain or when rain imminent and protection unavailable
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Thermometer (surface temperature)
Notes: Clause 8 [VERIFY] MRTS40. Weather conditions must be suitable for placement and finishing.
```

#### Finishing & Texturing

**Item 21:**
```
Item #: 21
Description: Inspect surface finish after strike-off and floating to verify correct cross-fall, smoothness, and absence of surface defects
Acceptance Criteria: Surface profile within tolerances; no surface tears, dragging, or laitance accumulation; correct cross-fall achieved
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Straightedge check (3 m)
Notes: Clause 8.5 [VERIFY] MRTS40. Surface finishing must be completed within the concrete's workability window.
```

**Item 22:**
```
Item #: 22
Description: Apply surface texture (tining, broom drag, or exposed aggregate) within specified time window after finishing
Acceptance Criteria: Texture applied uniformly; texture depth meets minimum specified value (typically >= 0.7 mm Sand Patch); tine spacing and depth per design; no damage to slab edges
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: Austroads AG:PT/T250 (Sand Patch texture depth)
Notes: Clause 8.5 [VERIFY] MRTS40. Texturing must occur before concrete sets but after surface moisture has dissipated.
```

#### Curing

**Item 23:**
```
Item #: 23
Description: Apply curing compound immediately after texturing to prevent moisture loss
Acceptance Criteria: Curing compound registered product complying with AS 3799; Type 3 (black) and Class C (chlorinated rubber) compounds NOT to be used; applied at manufacturer's recommended rate with uniform coverage; no bare patches
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 8.6 [VERIFY] MRTS40. Curing compound must comply with AS 3799. Type 3 and Class C excluded.
```

**Item 24:**
```
Item #: 24
Description: Maintain curing regime for the specified duration (minimum 7 days or as specified)
Acceptance Criteria: Curing compound intact for minimum period; any damage to curing membrane repaired by re-application; wet curing maintained if used as alternative
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 8.6 [VERIFY] MRTS40. Continuous curing critical for concrete pavement durability and crack prevention.
```

#### Joint Sawing

**Item 25:**
```
Item #: 25
Description: Saw contraction joints within the specified time window after placement (for PCP/JRCP)
Acceptance Criteria: Joints sawn to design depth (typically 1/4 to 1/3 of slab thickness); sawn within time window before random cracking occurs (typically 4-12 hours depending on conditions); straight, clean cuts; no spalling at joint edges
Point Type: witness
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 8.7 [VERIFY] MRTS40/MRTS41. Timing is critical — too early causes ravelling, too late allows random cracking.
```

**Item 26:**
```
Item #: 26
Description: Verify joint spacing and pattern matches design drawings
Acceptance Criteria: Transverse joint spacing per design (typically 4-6 m for PCP); longitudinal joints at lane edges; all joints straight and aligned with adjacent panels
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey check
Notes: Clause 8.7 [VERIFY] MRTS40. Joint layout as per design drawings.
```

**Item 27:**
```
Item #: 27
Description: Seal joints with specified sealant material after joint reservoir is formed and cleaned
Acceptance Criteria: Joint reservoir cut to correct width and depth; joint faces clean and dry; sealant installed per manufacturer's instructions; sealant level below pavement surface
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: MRTS41 [VERIFY]. Joint sealing may be deferred until after pavement opening to traffic.
```

#### Acceptance Testing

**Item 28:**
```
Item #: 28
Description: Test 28-day flexural strength of concrete from test beams cast during placement
Acceptance Criteria: 28-day rolling mean flexural strength >= ffMin (as specified in Annexure); rolling coefficient of variation <= 11.0%; individual results within acceptance limits
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.11 (flexural strength — third-point loading)
Notes: Clause 9.2 [VERIFY] / Appendix P3 MRTS40. Hold Point 4 applied if 28-day rolling mean flexural strength < 0.95 ffMin. Statistical five-point rolling mean used.
```

**Item 29:**
```
Item #: 29
Description: Test 28-day compressive strength of concrete from cylinders cast during placement
Acceptance Criteria: Compressive strength meets minimum requirements per Table 7.3; no individual result below 0.9 f'c
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (compressive strength)
Notes: Clause 9.2 [VERIFY] MRTS40. Compressive strength supplementary to flexural strength for pavement concrete.
```

**Item 30:**
```
Item #: 30
Description: Core pavement to verify in-situ thickness at random locations per lot
Acceptance Criteria: No core thickness less than design thickness minus tolerance (typically design -10 mm); average thickness >= design thickness; no cumulative thickness deficit
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Coring (diamond core drill)
Notes: Clause 9 [VERIFY] MRTS40. Minimum 3 cores per lot [VERIFY] for thickness verification.
```

**Item 31:**
```
Item #: 31
Description: Verify dowel bar alignment in finished slab using metal detector or ground-penetrating radar
Acceptance Criteria: Dowel alignment within +/- 2 mm tolerance; dowels parallel to pavement surface and centreline; no displaced or rotated dowels
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Metal detector / GPR survey
Notes: MRTS40 — dowel alignment tolerance is +/- 2 mm. Metal detector survey of all dowelled joints.
```

**Item 32:**
```
Item #: 32
Description: Perform tie bar compaction assessment at longitudinal joints
Acceptance Criteria: Concrete around tie bars fully compacted; no voids or honeycombing visible at joints; pull-out testing satisfactory where required
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Visual + pull-out test per MRTS41 [VERIFY]
Notes: Clause 9.2.2 [VERIFY] MRTS40/MRTS41. Hold point applied when nonconformities detected in tiebar location and compaction testing.
```

#### Surface Regularity & Ride Quality

**Item 33:**
```
Item #: 33
Description: Check surface regularity using 3 m straightedge at specified locations
Acceptance Criteria: Maximum deviation under 3 m straightedge <= 3 mm (base course) or <= 5 mm (subbase) [VERIFY]; no abrupt steps at joints
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: 3 m straightedge
Notes: Clause 9 [VERIFY] MRTS40. Regularity checked at multiple locations across width and along length.
```

**Item 34:**
```
Item #: 34
Description: Verify surface texture depth at specified locations
Acceptance Criteria: Texture depth >= minimum specified value (typically >= 0.7 mm by Sand Patch method); uniform across pavement width
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T250 (Sand Patch test)
Notes: Clause 9 [VERIFY] MRTS40. Texture depth critical for skid resistance.
```

**Item 35:**
```
Item #: 35
Description: Perform ride quality survey (IRI or profilograph) on completed pavement
Acceptance Criteria: IRI or Profile Index within specified limits (as per Annexure); no localized roughness exceeding limits
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: ARRB Walking Profiler or profilograph
Notes: Clause 9 [VERIFY] MRTS40. Ride quality typically assessed after joint sealing and before opening to traffic.
```

#### Opening to Traffic

**Item 36:**
```
Item #: 36
Description: Verify concrete has achieved minimum in-situ compressive strength before opening to traffic
Acceptance Criteria: In-situ compressive strength >= 20 MPa before non-essential traffic allowed; essential construction traffic only at lower strength with Administrator approval
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9 (maturity method or cylinder testing)
Notes: MRTS40 — non-essential traffic not allowed until in-situ compressive strength of 20 MPa reached.
```

**Item 37:**
```
Item #: 37
Description: Conduct final level survey to confirm compliance with design levels and cross-falls
Acceptance Criteria: Finished surface level within +/- 5 mm of design [VERIFY]; cross-fall within +/- 0.3% of design [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey (levels)
Notes: Clause 9 [VERIFY] MRTS40 / MRTS56. Survey records form part of as-built documentation.
```

#### Documentation & Completion

**Item 38:**
```
Item #: 38
Description: Compile and submit lot conformance report including all test results, inspection records, and as-built survey data
Acceptance Criteria: All test results within specification; any nonconformances documented with corrective actions; complete traceability of concrete batches to test results
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 9 [VERIFY] MRTS40 / MRTS50. Lot conformance required before acceptance of each lot.
```

**Item 39:**
```
Item #: 39
Description: Submit as-built drawings showing actual joint locations, pavement thickness, and any deviations from design
Acceptance Criteria: As-built drawings complete and accurate; all deviations from design documented and approved
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Contract requirement. As-builts required for asset management.
```

### Test Methods & Frequencies Summary (MRTS40)

| Test | Method | Frequency | Key Acceptance Value |
|------|--------|-----------|---------------------|
| Flexural Strength (28-day) | AS 1012.11 | 1 set per lot or per day's paving | Rolling mean >= ffMin; CV <= 11% |
| Compressive Strength (28-day) | AS 1012.9 | 1 set per lot or per day's paving | Per Table 7.3; no result < 0.9 f'c |
| Slump | AS 1012.3.1 | Every load initially, then per 5 m3 | Within +/- 15 mm of nominated |
| Air Content (if specified) | AS 1012.4.2 | Per lot | As specified |
| Concrete Temperature | AS 1012.8.4 | Every load | 10-32 degrees C (typical) |
| Aggregate PSD | AS 1141.11 | Per source, then 1 per 1000 t | Within grading envelope |
| Aggregate ASR | AS 1141.60.1 | Per source | Pass |
| Core Thickness | Diamond core | Min 3 per lot [VERIFY] | >= design thickness -10 mm |
| Dowel Alignment | Metal detector/GPR | All dowelled joints | Within +/- 2 mm |
| Surface Texture | AG:PT/T250 (Sand Patch) | 3 per lane-km [VERIFY] | >= 0.7 mm [VERIFY] |
| Surface Regularity | 3 m straightedge | Every 20 m, 3 points across | <= 3 mm deviation |
| Ride Quality | IRI/Profilograph | Full length of each lane | Per Annexure |

---

## Template 15: Plant-Mixed Stabilised Pavements (MRTS08)

### Template Header
```
Template Name: Plant-Mixed Heavily Bound (Cemented) Pavements
Activity Type: pavement_bound
Specification Reference: TMR MRTS08 Plant-Mixed Heavily Bound (Cemented) Pavements / TMR Technical Note TN204
Edition/Revision Date: November 2022
```

### Checklist Items

#### Pre-Work Submissions & Approvals

**Item 1:**
```
Item #: 1
Description: Submit Construction Procedures for plant-mixed stabilised pavement works including plant details, delivery logistics, placement method, compaction equipment, and curing procedure
Acceptance Criteria: Procedures accepted by Administrator; must comply with Clause 6 of MRTS50; submitted minimum 14 days before commencement [VERIFY]
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 5.2 [VERIFY] MRTS08 / MRTS50. Hold Point 1 [VERIFY] — No work to commence until procedures accepted.
```

**Item 2:**
```
Item #: 2
Description: Nominate registered mix design with current Stabilised Mix Design Certificate, including stabilising agent type, proportion of each constituent, and supplier details
Acceptance Criteria: Only current (not expired or suspended) registered mix designs per TN204; stabilising agent type and proportion as per Mix Design Certificate; mix design registered with TMR
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: TMR Q115 (UCS of stabilised soil)
Notes: Clause 7.2 [VERIFY] MRTS08 / TN204. Hold Point 2 [VERIFY] — Mix design registration required before production. Mix design removed from MRTS08 and now managed under TN204.
```

**Item 3:**
```
Item #: 3
Description: Verify mix design UCS targets meet specification requirements for material category
Acceptance Criteria: Category 1: minimum 3.0 MPa at 7 days and 6.0 MPa at 28 days, working time 6 hours; Category 2: minimum 2.0 MPa at 7 days and 4.0 MPa at 28 days (no specified working time)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q115 (UCS)
Notes: MRTS08 Table [VERIFY]. UCS categories determine pavement application (base vs subbase).
```

**Item 4:**
```
Item #: 4
Description: Submit details of stabilising agent (cement or cementitious blend) with test certificates confirming compliance
Acceptance Criteria: Stabilising agent complies with MRTS23 [VERIFY]; batch certificates provided; constituents per Table 6.2 of MRTS08
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 6 [VERIFY] MRTS08. Table 6.2 specifies requirements for constituents incorporated into the stabilising agent (binder).
```

**Item 5:**
```
Item #: 5
Description: Verify source aggregate compliance for unbound granular pavement material component
Acceptance Criteria: Aggregate meets grading, PI, CBR and durability requirements as per MRTS05 or Annexure; quarry registration current
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.3.6.1 (PSD), AS 1289.3.3.1 (PI), AS 1289.6.1.1 (CBR)
Notes: Clause 6 [VERIFY] MRTS08. Source material must be approved before use.
```

#### Plant Production

**Item 6:**
```
Item #: 6
Description: Inspect mixing plant to verify calibration of binder feed system, aggregate weigh system, and water addition
Acceptance Criteria: Plant calibrated within tolerances; binder feed rate accurate to +/- 0.5% [VERIFY]; uniform mixing achieved; batch records automated
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Plant inspection before first production run. Continuous or pugmill batch plant acceptable.
```

**Item 7:**
```
Item #: 7
Description: Verify target binder content (stabilising agent percentage) during production using batch records
Acceptance Criteria: Binder content matches Mix Design Certificate within +/- 0.5% [VERIFY]; batch records verify calculated application rate per m3
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Calculation from batch records (mass binder / mass mix)
Notes: Clause 7.2 [VERIFY] MRTS08. Binder content verified via batch plant records. Target content as per nominated Stabilised Mix Design Certificate.
```

**Item 8:**
```
Item #: 8
Description: Determine working time of stabilised mix and ensure all operations completed within this time
Acceptance Criteria: Category 1 material: working time minimum 6 hours (from mixing to compaction completion); material placed and compacted within working time; retarder use to be approved if required
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: VicRoads RC T144 [VERIFY] or alternative working time test
Notes: Clause 7 [VERIFY] MRTS08. Working time critical for cemented materials. If working time exceeded, material may not achieve required UCS.
```

**Item 9:**
```
Item #: 9
Description: Verify moisture content of mixed material at plant
Acceptance Criteria: Moisture content within specified range (typically OMC to OMC + 2%); sufficient moisture for cement hydration; not excessive causing bleeding or segregation
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.2.1.1 (moisture content)
Notes: Clause 8 [VERIFY] MRTS08. Moisture checked at plant before dispatch.
```

#### Transport

**Item 10:**
```
Item #: 10
Description: Verify delivery vehicles are suitable and sufficient for continuous placement without interruption
Acceptance Criteria: Sufficient vehicles to maintain continuous delivery; material covered during transport to prevent moisture loss; transport time within working time allowance
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Continuous delivery essential — heavily bound pavement material should not be stockpiled unless Administrator approves (e.g., set-retarder used for night works).
```

**Item 11:**
```
Item #: 11
Description: Verify material condition on arrival at site — no segregation, drying, or premature hydration
Acceptance Criteria: Material uniform in appearance and moisture; no balling, crusting, or segregation; temperature within acceptable range
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Reject loads showing signs of premature hydration.
```

#### Subgrade/Subbase Preparation

**Item 12:**
```
Item #: 12
Description: Verify underlying layer (subgrade or subbase) is conforming and ready to receive plant-mixed material
Acceptance Criteria: Underlying layer compaction, level, and thickness testing passed; surface clean, moist, and free from loose material; proof rolling passed
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.5.4.1 (density), TMR Q723 (proof roll)
Notes: Clause 8 [VERIFY] MRTS08. Preceding layer must be accepted before placing stabilised material.
```

**Item 13:**
```
Item #: 13
Description: Check for underground services and ensure protection measures in place prior to placement
Acceptance Criteria: All underground services identified, located by survey, and protected; service locations communicated to paving crew
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Similar to MRTS07 underground services requirement.
```

#### Trial Section

**Item 14:**
```
Item #: 14
Description: Construct trial section to demonstrate placement and compaction method achieves specification requirements
Acceptance Criteria: Trial section minimum area [VERIFY]; achieves required compaction, surface finish, thickness, and joint preparation; compaction pattern established
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.5.4.1 (density), TMR Q115 (UCS)
Notes: Clause 8 [VERIFY] MRTS08. Hold Point [VERIFY] — No full-scale production until trial section results accepted by Administrator.
```

**Item 15:**
```
Item #: 15
Description: Administrator to witness trial section construction including placement, compaction, and testing
Acceptance Criteria: Administrator attends and witnesses full trial section construction; all equipment and methods demonstrated
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. 24 hours notice to Administrator prior to trial section [VERIFY].
```

#### Placement

**Item 16:**
```
Item #: 16
Description: Verify placement method (paver, grader, or other approved equipment) and layer thickness
Acceptance Criteria: Layer thickness per design (after compaction); no layer thicker than maximum single lift [VERIFY]; material placed uniformly without segregation
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Depth gauge checks
Notes: Clause 8 [VERIFY] MRTS08. Layer thickness verified during and after placement.
```

**Item 17:**
```
Item #: 17
Description: Verify longitudinal and transverse joint preparation between adjacent runs and between construction lots
Acceptance Criteria: Vertical joint face cut back to sound material; joint face moistened before placing adjacent material; no cold/dry joints; overlap zone properly managed
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Joint preparation critical for heavily bound materials to avoid reflective cracking.
```

#### Compaction

**Item 18:**
```
Item #: 18
Description: Compact material using approved rolling pattern established during trial section
Acceptance Criteria: Rolling pattern per trial section; compaction achieved within working time; rollers operating at correct speed and weight; no over-compaction or crushing
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Compaction must be completed within working time of the cemented material.
```

**Item 19:**
```
Item #: 19
Description: Perform field density testing on compacted material for each lot
Acceptance Criteria: In-situ dry density ratio >= 98% of Standard MDD [VERIFY] or as specified in Annexure; minimum 1 density test per 500 m2 per layer [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.5.4.1 (field density — nuclear gauge or sand replacement)
Notes: Clause 9 [VERIFY] MRTS08. Density testing immediately after compaction. Minimum 3 tests per lot [VERIFY].
```

**Item 20:**
```
Item #: 20
Description: Verify moisture content of compacted material
Acceptance Criteria: Moisture content within specified range (typically OMC to OMC + 2%); degree of saturation not exceeding limit [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1289.2.1.1 (moisture content) / TMR Q250 (DoS calculation)
Notes: Clause 9 [VERIFY] MRTS08. Moisture checked concurrently with density testing.
```

#### Acceptance Testing — Strength

**Item 21:**
```
Item #: 21
Description: Mould UCS test specimens from material sampled during placement for 7-day and 28-day testing
Acceptance Criteria: Minimum 3 specimens per lot [VERIFY]; specimens compacted at field moisture and density; cured under controlled conditions
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q115 (UCS of stabilised soil)
Notes: Clause 9 [VERIFY] MRTS08. Specimens moulded on day of placement.
```

**Item 22:**
```
Item #: 22
Description: Test 7-day UCS of moulded specimens
Acceptance Criteria: Category 1: average >= 3.0 MPa; Category 2: average >= 2.0 MPa; no individual result < 80% of target [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q115 (UCS)
Notes: Clause 9 [VERIFY] MRTS08. 7-day results provide early indication of compliance.
```

**Item 23:**
```
Item #: 23
Description: Test 28-day UCS of moulded specimens and verify compliance with specification
Acceptance Criteria: Category 1: average >= 6.0 MPa; Category 2: average >= 4.0 MPa; no individual result < 80% of target [VERIFY]; mix design conformance maintained
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q115 (UCS)
Notes: Clause 9 [VERIFY] MRTS08. Hold Point 3 [VERIFY] — Use of mix design shall not continue until Hold Point re-established if results nonconforming. Final acceptance based on 28-day UCS.
```

#### Level, Thickness & Surface

**Item 24:**
```
Item #: 24
Description: Perform level survey of finished surface to verify design levels and cross-fall
Acceptance Criteria: Finished surface level within +/- 10 mm of design [VERIFY]; cross-fall within design tolerance
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey (levels)
Notes: Clause 9 [VERIFY] MRTS08 / MRTS56.
```

**Item 25:**
```
Item #: 25
Description: Verify layer thickness by coring or depth measurements
Acceptance Criteria: No negative thickness tolerance (must not be thinner than design); positive tolerance +10 mm [VERIFY]; full pavement width treated
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Core measurement / depth gauge
Notes: Clause 9 [VERIFY] MRTS08. Thickness verified at minimum 1 location per 100 m [VERIFY].
```

**Item 26:**
```
Item #: 26
Description: Check surface regularity using 3 m straightedge
Acceptance Criteria: Maximum deviation under 3 m straightedge <= 10 mm [VERIFY] for bound subbase, <= 5 mm [VERIFY] for base to receive asphalt
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: 3 m straightedge
Notes: Clause 9 [VERIFY] MRTS08. Surface regularity affects ride quality of finished surface.
```

#### Curing

**Item 27:**
```
Item #: 27
Description: Apply curing treatment (water curing or bitumen emulsion seal) promptly after compaction to prevent moisture loss
Acceptance Criteria: Curing applied within 2 hours of final compaction [VERIFY]; surface must not be allowed to dry out; bitumen emulsion spray rate per MRTS11 requirements if used; water curing maintained continuously for specified period
Point Type: standard
Responsible Party: contractor
Evidence Required: photo
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Inadequate curing leads to surface friability and reduced strength.
```

**Item 28:**
```
Item #: 28
Description: Maintain curing regime for specified duration
Acceptance Criteria: Minimum 7 days curing [VERIFY] or until subsequent layer placed; no traffic on cured surface unless approved; surface not allowed to dry and powder
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 8 [VERIFY] MRTS08. Construction traffic restricted during curing period.
```

#### Proof Rolling & Final Acceptance

**Item 29:**
```
Item #: 29
Description: Proof roll completed and cured stabilised layer to check for any weak areas or excessive deflection
Acceptance Criteria: No visible deformation, rutting, or pumping under loaded roller; no cracking wider than 3 mm [VERIFY]; any yielding areas reworked and re-tested
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: TMR Q723 (Proof Roll Test) / Austroads AG:PT/T251 (Ball Penetration)
Notes: Clause 9 [VERIFY] MRTS08. Administrator witnesses proof rolling. Completed after curing period.
```

**Item 30:**
```
Item #: 30
Description: Acceptance of completed stabilised layer — all conformance testing satisfactory and layer ready for subsequent works
Acceptance Criteria: All density, UCS, moisture, thickness, level, and surface regularity results comply with specification; no nonconformances outstanding; lot conformance report completed
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 9 [VERIFY] MRTS08. Hold Point [VERIFY] — Completed layer not accepted (nor subsequent layers placed) until all verification tests indicate compliance.
```

#### Documentation

**Item 31:**
```
Item #: 31
Description: Compile and submit lot conformance report including all test results, batch records, and inspection records
Acceptance Criteria: Complete traceability from mix design to batch records to test results; all results within specification; nonconformances documented with corrective actions
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 Quality System requirements. Conformance report for each lot.
```

**Item 32:**
```
Item #: 32
Description: Submit as-built records including actual layer thickness, levels, and any deviations from design
Acceptance Criteria: As-built data complete and accurate; final levels and thickness recorded
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Contract requirement. As-built data for pavement layer.
```

### Test Methods & Frequencies Summary (MRTS08)

| Test | Method | Frequency | Key Acceptance Value |
|------|--------|-----------|---------------------|
| UCS (7-day) | TMR Q115 | 3 specimens per lot [VERIFY] | Cat 1: >= 3.0 MPa; Cat 2: >= 2.0 MPa |
| UCS (28-day) | TMR Q115 | 3 specimens per lot [VERIFY] | Cat 1: >= 6.0 MPa; Cat 2: >= 4.0 MPa |
| Field Density | AS 1289.5.4.1 | 1 per 500 m2 per layer [VERIFY] | >= 98% Standard MDD [VERIFY] |
| Moisture Content | AS 1289.2.1.1 | With each density test | Within OMC to OMC+2% |
| Binder Content | Batch plant records | Every batch | Per Mix Design Certificate +/- 0.5% |
| Grading (PSD) | AS 1289.3.6.1 | Per source, 1 per 1000 t [VERIFY] | Within grading envelope |
| PI (Atterberg Limits) | AS 1289.3.3.1 | Per source, 1 per 1000 t [VERIFY] | Per MRTS05 limits |
| Layer Thickness | Core/depth gauge | 1 per 100 m [VERIFY] | >= design thickness |
| Surface Level | Survey | 20 m grid [VERIFY] | +/- 10 mm of design |
| Surface Regularity | 3 m straightedge | Every 20 m [VERIFY] | <= 10 mm (subbase) / <= 5 mm (base) |
| Proof Rolling | TMR Q723 | 100% of area | No visible deformation |
| Working Time | RC T144 or equivalent | Per mix design | Cat 1: >= 6 hrs; Cat 2: N/A |

---

## Template 16: Priming & Primersealing (MRTS11)

### Template Header
```
Template Name: Priming & Primersealing (Initial Seals)
Activity Type: asphalt_prep
Specification Reference: TMR MRTS11 Sprayed Bituminous Treatments (Excluding Emulsion) / TMR TN175 / Austroads AGPT04K
Edition/Revision Date: July 2025
```

### Context Note

Priming and primersealing (referred to as "initial seals" in current TMR terminology) are covered within MRTS11 alongside seals, reseals, and enrichments. This template extracts the priming/primersealing-specific items from MRTS11. A separate template exists for sprayed seal work (Template 6).

**Prime coat**: A spray application of cutback bitumen to a prepared pavement surface to seal the surface, bind dust, provide a moisture barrier, and promote adhesion of the subsequent surfacing.

**Primerseal (Initial seal)**: A combined priming and sealing operation where binder and cover aggregate are applied to a new pavement surface in a single operation, providing both waterproofing and a temporary running surface.

### Checklist Items

#### Pre-Work Submissions & Approvals

**Item 1:**
```
Item #: 1
Description: Submit Construction Procedures for priming/primersealing works including equipment details, binder type, application rates, aggregate type, and contingency plans for weather
Acceptance Criteria: Procedures accepted by Administrator per MRTS50 Clause 6; equipment calibration current; operator qualifications confirmed
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 Clause 5 [VERIFY] / MRTS50 Clause 5 & 6. Hold Point 1 [VERIFY] — Work not to commence until procedures accepted.
```

**Item 2:**
```
Item #: 2
Description: Notify Administrator of Designed Spray Rate and Designed Spread Rate for the initial seal/prime treatment
Acceptance Criteria: Spray rate and spread rate designed per TN175 and Austroads AGPT04K; rates appropriate for pavement type, traffic level, and aggregate size; Administrator has confirmed receipt
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 [VERIFY]. Spraying operations shall not commence until the Contractor has been notified by the Administrator of the Designed Spray Rate and Designed Spread Rate.
```

**Item 3:**
```
Item #: 3
Description: Verify sprayer has current TMR Calibration Certificate and sprayer bar is calibrated
Acceptance Criteria: Current TMR Calibration Certificate provided; sprayer bar calibrated within specified period; nozzle condition inspected and satisfactory; spray pattern uniform
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: Sprayer calibration test
Notes: MRTS11 Clause 9 / 11.2 [VERIFY]. Administrator witnesses sprayer and plant check. Calibration Certificate must be current.
```

**Item 4:**
```
Item #: 4
Description: Verify cover aggregate (sealing chips) compliance for primerseal — material dry, clean, and conforming to specification
Acceptance Criteria: Aggregate compliant with specification; moisture content < 1% [VERIFY]; dust content < 1%; particle size distribution within grading envelope; stockpiled on clean, drained surface
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1141.11 (PSD), AS 1141.5 (fines content)
Notes: MRTS11 Clause 8.2 [VERIFY]. Administrator may inspect aggregate condition before spraying. Wet or dusty aggregate causes adhesion failure.
```

#### Surface Preparation (Pavement Base)

**Item 5:**
```
Item #: 5
Description: Verify that underlying pavement base layer has been accepted (compaction, level, thickness testing passed) before priming
Acceptance Criteria: All base layer conformance testing complete and passed per MRTS05/MRTS08; lot acceptance obtained; no outstanding nonconformances
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 [VERIFY]. Base layer must be accepted before priming. Cross-reference to pavement ITP.
```

**Item 6:**
```
Item #: 6
Description: Perform Ball Penetration Test on pavement surface to verify base is sufficiently hard and tight for sealing
Acceptance Criteria: Ball penetration <= 3.0 mm on high-traffic roads (> 2000 v/l/d); ball penetration <= 4.0 mm on low-traffic roads (<= 2000 v/l/d); if exceeded, additional rolling or drying required before sealing
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T251 (Ball Penetration Test) / TMR Q706 [VERIFY]
Notes: MRTS11 Table 6.2 [VERIFY]. Hold Point 2 [VERIFY] — Ball penetration results forwarded to Administrator. Work held until results acceptable. TMR Q171 withdrawn; replaced by AG:PT/T251.
```

**Item 7:**
```
Item #: 7
Description: Sweep pavement surface with road broom to expose larger particles and remove loose material
Acceptance Criteria: Surface swept until larger aggregate particles slightly exposed; no excessive erosion of finer material; no loose material, mud, or vegetation remaining; surface damage (potholes, soft spots) repaired
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause 8 [VERIFY]. Surface preparation critical for binder adhesion and penetration.
```

**Item 8:**
```
Item #: 8
Description: Apply light watering to dry or dusty pavement surface just prior to spraying (if required)
Acceptance Criteria: Surface lightly dampened but not saturated; no ponding water; watering applied just before binder spray to suppress dust and improve binder penetration; surface not excessively wet
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause 8 [VERIFY]. Light watering only — excessive moisture prevents binder adhesion.
```

#### Weather & Temperature Checks

**Item 9:**
```
Item #: 9
Description: Check and record pavement surface temperature and air temperature before commencing spraying
Acceptance Criteria: Pavement surface temperature >= minimum specified in Annexure MRTS11.1 (typically >= 15 degrees C for primerseal, >= 10 degrees C for prime [VERIFY]); no rain falling or imminent; wind speed not excessive for spraying
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: IR thermometer (surface), thermometer (air)
Notes: MRTS11 Clause 11.2 [VERIFY]. All operations must be completed before pavement surface temperature drops below minimum. Cold weather measures require Administrator approval per TN186.
```

**Item 10:**
```
Item #: 10
Description: Confirm no rain is forecast within minimum drying/curing period after spraying
Acceptance Criteria: Weather forecast checked; no rain expected for minimum period (typically 24 hours for primerseal [VERIFY]); contingency plan in place if weather changes
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 [VERIFY] / TN186. Rainfall during or within 1 hour after spraying is a verification required event.
```

#### Binder Preparation

**Item 11:**
```
Item #: 11
Description: Verify binder type and grade comply with specification and match design
Acceptance Criteria: Binder grade matches design (e.g., C170 residual bitumen, AMC cutback grades per AS 2157); supply certificate/COC provided; binder not overheated or degraded
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 Clause 6 [VERIFY]. Binder type specified by Administrator. Cutback bitumen grades per AS 2157 for primes.
```

**Item 12:**
```
Item #: 12
Description: Verify binder temperature at delivery and in sprayer before application
Acceptance Criteria: Binder temperature within specified range for the grade (e.g., 160 +/- 15 degrees C for Class 170 bitumen [VERIFY]); no overheating (which reduces viscosity and quality)
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Thermometer (binder temperature)
Notes: MRTS11 Clause 8.3.1 / 8.3.2 [VERIFY]. Administrator may witness temperature measurement at delivery. Observe heating in sprayer is within safe limits.
```

**Item 13:**
```
Item #: 13
Description: Take binder sample from sprayer for quality assurance testing
Acceptance Criteria: 4 L sample per tanker load [VERIFY]; sample collected at sprayer bar for viscosity/penetration testing; labelled and stored per laboratory requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 2008 (binder grading) / viscosity / penetration
Notes: MRTS11 Clause [VERIFY]. One binder sample per tanker load for QA testing.
```

#### Prime Coat Application (if separate prime, not primerseal)

**Item 14:**
```
Item #: 14
Description: Apply prime coat at the designed spray rate using calibrated sprayer
Acceptance Criteria: Application rate within +/- 10% of designed spray rate [VERIFY]; uniform coverage with no missed strips, pools, or dry patches; spray applied in direction of traffic flow; overlap at joins within tolerance
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T234 (tray test — binder application rate)
Notes: MRTS11 Clause 10 [VERIFY]. Prime coat application rates vary by binder type and pavement — typically 0.5 to 1.5 L/m2 for cutback primes [VERIFY]. Rate depends on surface finish of base.
```

**Item 15:**
```
Item #: 15
Description: Verify field application rate by tray test
Acceptance Criteria: Field tray test result within +/- 10% of designed spray rate; minimum 1 tray test per 500 m of spray run [VERIFY]; trays placed and weighed per AG:PT/T234
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T234 (tray test)
Notes: MRTS11 Clause [VERIFY]. Tray test provides verification of actual application rate.
```

**Item 16:**
```
Item #: 16
Description: Monitor prime coat curing — ensure adequate penetration into base and surface drying
Acceptance Criteria: Prime penetration into base 5-10 mm (typical) [VERIFY]; surface cured until no longer tacky (minimum 3 days for cutback primes [VERIFY]); no tracking by traffic; no rain damage during curing
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause [VERIFY]. Curing time varies with weather and base material. Protect from traffic and rain during curing.
```

#### Primerseal Application (if combined initial seal)

**Item 17:**
```
Item #: 17
Description: Confirm sufficient cover aggregate is stockpiled at site and spreading trucks are on standby before commencing binder spray
Acceptance Criteria: Aggregate stockpile sufficient for planned spray area; aggregate dry and clean; spreading trucks loaded and ready; no delay between binder spray and aggregate spread
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause 11.1 [VERIFY]. Administrator may verify stockpile and spreading trucks on standby. Aggregate must be available before spraying commences.
```

**Item 18:**
```
Item #: 18
Description: Apply binder at designed spray rate for primerseal treatment
Acceptance Criteria: Application rate within +/- 10% of designed spray rate [VERIFY]; uniform coverage; sprayer bar height and speed consistent; no missed strips or excess binder; spray pressure within specification
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T234 (tray test)
Notes: MRTS11 Clause 10 [VERIFY]. Document spraying pressure, temperature, and speed for each run. Spray log submitted to Administrator daily.
```

**Item 19:**
```
Item #: 19
Description: Spread cover aggregate immediately after binder application — within maximum time limit
Acceptance Criteria: Cover aggregate spread within 15 minutes of binder application (no portion left without cover aggregate longer than 15 minutes); spread rate within +/- 10% of designed spread rate; uniform coverage
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause [VERIFY]. Aggregate spreading must commence as soon as possible after binder spraying.
```

**Item 20:**
```
Item #: 20
Description: Verify aggregate spread rate by square patch test
Acceptance Criteria: Spread rate within +/- 10% of design; minimum 3 x 1 m2 areas per 500 m of spray run checked [VERIFY]; count aggregate or weigh stone to verify rate; adjust spreader gates if needed
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Square patch test (1 m2 areas weighed)
Notes: MRTS11 Clause [VERIFY]. Aggregate spread rate verification. Record any adjustments to spreader gates.
```

**Item 21:**
```
Item #: 21
Description: Roll primerseal with multi-tyred roller to embed aggregate into binder
Acceptance Criteria: Rolling commences immediately after aggregate spread; minimum rolling passes per specification [VERIFY]; uniform aggregate embedment approximately 70% target; no over-rolling causing binder flushing
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause 14 [VERIFY]. Rolling essential for aggregate embedment and binder adhesion.
```

#### Post-Application Inspection & Testing

**Item 22:**
```
Item #: 22
Description: Inspect completed primerseal/prime within 24 hours for uniformity, bleeding, or thin areas
Acceptance Criteria: Uniform aggregate embedment across full width; no areas of excessive bleeding (binder flushing); no strips of missed binder; no patchy coverage; no loose aggregate causing hazard
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: MRTS11 Clause [VERIFY]. Full-length visual inspection within 24 hours.
```

**Item 23:**
```
Item #: 23
Description: Perform sweep test at 7 days to verify aggregate adhesion
Acceptance Criteria: Sweep test at 5 random locations per km [VERIFY]; stone loss < 5% by mass indicates good adhesion; excessive stone loss (whip-off > 5%) indicates nonconformance requiring re-sealing or sand patching
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Sweep test (200 mm square, vigorously brushed)
Notes: MRTS11 Clause [VERIFY]. Sweep test performed after initial trafficking. Nonconforming areas require remedial treatment.
```

**Item 24:**
```
Item #: 24
Description: Check surface texture depth of completed primerseal
Acceptance Criteria: Texture depth >= minimum specified (e.g., >= 1.2 mm Sand Patch for 14 mm aggregate seal [VERIFY]); adequate skid resistance for interim trafficking
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Austroads AG:PT/T250 (Sand Patch test)
Notes: MRTS11 Clause [VERIFY]. Texture depth verification for primerseal used as temporary running surface.
```

#### Traffic Control & Curing

**Item 25:**
```
Item #: 25
Description: Implement traffic control on primersealed surface — speed reduction and initial trafficking management
Acceptance Criteria: Speed limited (typically 40-60 km/h [VERIFY]) during initial embedment period; loose stone swept and removed; any bleeding areas addressed; no heavy braking or turning traffic on fresh seal
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 Clause [VERIFY]. Traffic management plan for initial seal. Duration depends on binder curing and aggregate embedment.
```

#### Documentation

**Item 26:**
```
Item #: 26
Description: Complete spray log for each day's operations including binder type, temperature, spray rate, spread rate, area covered, weather conditions, and equipment details
Acceptance Criteria: Spray log complete and accurate; submitted to Administrator daily; all parameters recorded per specification requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS11 Clause [VERIFY]. Daily spray log is a mandatory record.
```

**Item 27:**
```
Item #: 27
Description: Submit lot conformance report with all test results, spray logs, and inspection records
Acceptance Criteria: All test results (tray tests, binder samples, ball penetration, texture depth) compiled; conformance with designed rates demonstrated; any nonconformances documented with corrective actions
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: MRTS50 Quality System requirements. Conformance report for each lot of priming/primersealing work.
```

### Test Methods & Frequencies Summary (MRTS11 — Priming/Primersealing)

| Test | Method | Frequency | Key Acceptance Value |
|------|--------|-----------|---------------------|
| Ball Penetration | AG:PT/T251 / TMR Q706 | Before sealing, per lot | <= 3.0 mm (high traffic) / <= 4.0 mm (low traffic) |
| Binder Application Rate | AG:PT/T234 (tray test) | 1 per 500 m of spray run | Within +/- 10% of design rate |
| Aggregate Spread Rate | Square patch test (1 m2) | 3 x 1 m2 per 500 m | Within +/- 10% of design rate |
| Binder Temperature | Thermometer | Each delivery / during heating | Within grade specification range |
| Binder Sample | AS 2008 (viscosity/penetration) | 1 sample (4 L) per tanker load | Complies with grade requirements |
| Pavement Surface Temp | IR thermometer | Hourly during operations | >= minimum per Annexure MRTS11.1 |
| Air Temperature | Thermometer | Hourly during operations | >= minimum per spec |
| Aggregate PSD | AS 1141.11 | Per source | Within grading envelope |
| Aggregate Moisture | AS 1141.5 | Before use | < 1% |
| Texture Depth (primerseal) | AG:PT/T250 (Sand Patch) | 3 per lane-km | >= 1.2 mm (14 mm aggregate) |
| Sweep Test (adhesion) | 200 mm square brush | 5 per km at 7 days | < 5% stone loss by mass |
| Aggregate Stripping | TMR Q205 / Austroads T236 | Per aggregate source | Qualitative — minimal stripping |

---

## Verification Notes & Caveats

### Items marked [VERIFY]

Many clause numbers in this document are inferred from search result excerpts, cross-referenced specifications, and the known structure of TMR MRTS specifications. Items marked `[VERIFY]` should be confirmed against the full published PDF specification documents:

1. **MRTS40**: https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS40.pdf
2. **MRTS08**: https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS08.pdf
3. **MRTS11**: https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS11.pdf
4. **MRTS41 (Ancillary Works)**: Check TMR Category 5 specifications page
5. **TN204**: https://www.tmr.qld.gov.au/_/media/busind/techstdpubs/technical-notes/pavements-materials-geotechnical/tn204.pdf

### Hold Point Summary by Template

#### Template 14 — Concrete Pavement (MRTS40)
| HP # | Description | Clause |
|------|------------|--------|
| HP1 | Concrete mix design approval | Cl 7.3 [VERIFY] |
| HP2 | Subbase acceptance / high invert levels | Cl 8.2 [VERIFY] |
| HP3 | Trial paving section acceptance | Cl 8.4 [VERIFY] |
| HP4 | 28-day flexural strength < 0.95 ffMin | Cl 9.2 [VERIFY] / Appendix P3 |
| Additional | Opening to traffic (20 MPa compressive) | [VERIFY] |
| Additional | Reinforcement pre-pour inspection | Cl 8 [VERIFY] |

#### Template 15 — Plant-Mixed Stabilised (MRTS08)
| HP # | Description | Clause |
|------|------------|--------|
| HP1 | Construction Procedures approval | Cl 5.2 [VERIFY] |
| HP2 | Mix design registration (TN204) | Cl 7.2 [VERIFY] |
| HP3 | 28-day UCS nonconformance | Cl 9 [VERIFY] |
| Additional | Source material approval | Cl 6 [VERIFY] |
| Additional | Underlying layer acceptance | Cl 8 [VERIFY] |
| Additional | Trial section acceptance | Cl 8 [VERIFY] |
| Additional | Layer acceptance before covering | Cl 9 [VERIFY] |

#### Template 16 — Priming & Primersealing (MRTS11)
| HP # | Description | Clause |
|------|------------|--------|
| HP1 | Construction Procedures / quality plan | Cl 5 [VERIFY] / MRTS50 |
| HP2 | Ball Penetration test results | Table 6.2 [VERIFY] |
| Additional | Designed Spray Rate confirmation | [VERIFY] |
| Additional | Base layer acceptance | [VERIFY] |

### QLD-Specific Terminology Reminders
- Authority: **Administrator** (not Superintendent)
- TMR test methods: TMR Q-series (e.g., Q115, Q706, Q723)
- Quality system: **MRTS50** Specific Quality System Requirements
- Survey: **MRTS56** Construction Surveying
- Binder requirements: Referenced to AS 2008, AS 2157

### Related Specifications (Cross-References)
- **MRTS05** — Unbound Pavements (base/subbase material requirements)
- **MRTS09** — Plant-Mixed Lightly Bound Pavements using Foamed Bitumen or Bitumen Emulsion
- **MRTS10** — Plant-Mixed Lightly Bound Pavements (UCS 1.0-2.0 MPa)
- **MRTS23** — Stabilising Agents [VERIFY]
- **MRTS41** — Concrete Pavement Base Ancillary Works
- **MRTS50** — Specific Quality System Requirements
- **MRTS56** — Construction Surveying
- **TN175** — Selection and Design of Sprayed Bituminous Treatments
- **TN186** — Sealing in Cold Weather Conditions
- **TN204** — Mix Design Registration of Plant-Mixed Cementitiously Stabilised Pavements

---

## Sources

- [TMR Category 5 - Pavements, Subgrade and Surfacing](https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Specifications/5-Pavements-Subgrade-and-Surfacing)
- [TMR MRTS40 Concrete Pavement Base](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS40.pdf)
- [TMR MRTS08 Plant-Mixed Heavily Bound Pavements](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS08.pdf)
- [TMR MRTS11 Sprayed Bituminous Treatments](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS11.pdf)
- [TMR TN175 Selection and Design of Sprayed Bituminous Treatments](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Pavements-materials-geotechnical/TN175.pdf)
- [TMR TN204 Mix Design Registration](https://www.tmr.qld.gov.au/_/media/busind/techstdpubs/technical-notes/pavements-materials-geotechnical/tn204.pdf)
- [TMR Specifications Index](https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/specifications/specifications-index)
- [TMR Amendment Register](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/AmendmentRegister.pdf)
- [Draft MRTSxx Concrete Pavement Base Ancillary Works (Feb 2023)](https://concretepavements.com.au/wp-content/uploads/2023/02/MRTSxx-Concrete-Pavement-Base-Ancillary-Works-February-2023-DRAFT.pdf)
- [Austroads AP-T179/11 Review of Primes and Primerseal Design](https://auststab.com.au/wp-content/uploads/2017/02/AP-T179-11.pdf)
- [Austroads AGPT04K Guide to Sprayed Seals - Initial Treatments](https://austroads.gov.au/publications/pavement/agpt04k/design-method/design-process/initial-treatments-1)
- [TMR TN186 Sealing in Cold Weather Conditions](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Technical-notes/Pavements-materials-geotechnical/TN186.pdf)
- [TMR MRTS10 Plant-Mixed Lightly Bound Pavements](https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/5-Pavements-Subgrade-and-Surfacing/MRTS10.pdf)
