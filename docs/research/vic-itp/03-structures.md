# VicRoads ITP Templates: Structures (Templates 9, 10, 15)

> Research Date: 2026-02-10
> Sources: VicRoads Standard Specifications (600 Series Bridgeworks), AS 5100 (Bridge Design), AS 1379, AS 2159, AS/NZS 4671, AS 1012 series, AS 3610

## Key VicRoads Specification Sections (600 Series - Bridgeworks)

| Section | Title | Version | Notes |
|---------|-------|---------|-------|
| 605 | Driven Piles | v8 (Sep 2023) | Precast prestressed concrete, steel H-piles, steel tube piles |
| 606 | Bored Cast-In-Place Piles (without Permanent Casing) | v6 | Rotary bored, bentonite/polymer support |
| 607 | Continuous Flight Auger Piles | v7 | CFA piles with on-board monitoring |
| 608 | Cast-In-Place Socketed Piles (with Permanent Casing) | v8 (Jan 2021) | Steel cased, socketed into rock |
| 610 | Structural Concrete | v18 (Feb 2020) | Core concrete spec, 52 pages |
| 611 | Steel Reinforcement | v8 (Jan 2021) | All reinforcement requirements |
| 612 | Post-Tensioning of Concrete Units | v8 (Jan 2021) | PT systems |
| 613 | Falsework | v8 (Jan 2021) | Temporary works |
| 614 | Formwork | v8 (Jan 2021) | Formwork design, surface finish |

Note: Section 620 is "Precast Concrete Units" -- NOT piling. Piling is covered by Sections 605-608.

---

## Template 9: Structural Concrete

```
Template Name: Structural Concrete
Activity Type: structures
Specification Reference: VicRoads Section 610 (Structural Concrete), Section 614 (Formwork)
Edition/Revision Date: Version 18 - February 2020
```

### Referenced Standards
- AS 5100.5:2017 - Bridge Design Part 5: Concrete
- AS 1379:2007 - Specification and Supply of Concrete
- AS 1012 series - Methods of Testing Concrete
- AS 3610.1:2018 - Formwork for Concrete
- VicRoads TN 113 - Concrete Mix Design Review and Registration Guidelines
- VicRoads TN 038 - Cracks in Concrete
- VicRoads TN 055 - Construction Factors
- VicRoads TN 073 - Self Compacting Concrete
- VicRoads TN 097 - Concrete Structures in Marine Environments
- VicRoads RC 376.03 - Alkali-Silica Reactivity (Accelerated Mortar Bar)
- VicRoads RC 376.04 - Alkali-Silica Reactivity (Concrete Prism)
- VicRoads RC 500.16 - Selection of Test Methods

### Checklist Items

#### PRE-WORK SUBMISSIONS (Items 1-12)

```
Item #: 1
Description: Submit concrete mix design for review, approval and registration
Acceptance Criteria: Submission minimum 4 weeks (recommended 8-12 weeks) prior to concrete placement; includes product code, batch plant designation, supplier name, and all supporting test data per TN 113
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: VicRoads TN 113
Notes: Clause 610.07. Concrete must NOT be placed until mix design reviewed and approved. Supporting test data must not be greater than 12 months old.
```

```
Item #: 2
Description: Verify concrete grade, class and designation matches design drawings and exposure classification
Acceptance Criteria: Concrete grade, exposure classification (A1, A2, B1, B2, C1, C2, U per AS 5100.5) and designation as shown on drawings; minimum compressive strength per Table 610.051 [VERIFY clause]
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 610.05. Durability requirements per AS 5100.5 Table 4.14.3.2. Design life for bridges is 100 years.
```

```
Item #: 3
Description: Submit alkali aggregate reactivity (AAR) test results for coarse and fine aggregates
Acceptance Criteria: Alkali content in concrete mix not to exceed 2.8 kg/m3 (Na2O equiv); aggregate reactivity determined per VicRoads RC 376.03 (accelerated mortar bar) or RC 376.04 (concrete prism); testing on minimum 3-yearly basis
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: VicRoads RC 376.03 / RC 376.04
Notes: Clause 610.07 [VERIFY]. AAR provisions introduced 1996, upgraded 2013.
```

```
Item #: 4
Description: Submit trial mix test results demonstrating compliance with specified properties
Acceptance Criteria: Trial mix in accordance with AS 1012.2; results for compressive strength, slump, drying shrinkage and all specified properties within limits; conditional registration valid for 8 weeks pending full data
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.2
Notes: Clause 610.07, TN 113. All outstanding data must be submitted within 8 weeks or conditional approval cancelled and mix deregistered.
```

```
Item #: 5
Description: Submit Self Compacting Concrete (SCC) mix design with rheological data (if applicable)
Acceptance Criteria: SCC mix demonstrates flow and self-compaction properties; slump flow, T500 time and J-ring passing ability per AS 1012.3.5; proportions of cementitious materials, aggregates, fine materials, water and admixtures documented
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.5
Notes: Clause 610.07 [VERIFY], TN 073. Only required where SCC specified.
```

```
Item #: 6
Description: Submit concrete supply and placement methodology including pour sequence, access, delivery rates and contingencies
Acceptance Criteria: Methodology addresses method of placement, concrete cover to reinforcement, spacing of reinforcement, element geometry; identifies batch plant and stand-by mixing plant
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 610.07. Mix design must be appropriate for the method of placement and element.
```

```
Item #: 7
Description: Submit formwork design and drawings for review
Acceptance Criteria: Formwork designed in accordance with AS 3610.1:2018; surface finish class specified (Class 1-5); drawings show dimensions, supports, stripping sequence; certified by competent person
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 614 / AS 3610.1. Formwork design must account for all loading conditions including concrete pressure, construction loads.
```

```
Item #: 8
Description: Submit falsework design and drawings for review (where applicable)
Acceptance Criteria: Falsework designed in accordance with Section 613 and AS 3610; independently checked; certified by qualified structural engineer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 613. Required for all elevated structural concrete elements. Must account for all construction stage loadings.
```

```
Item #: 9
Description: Submit curing methodology including materials, methods and monitoring procedures
Acceptance Criteria: Curing method complies with Clause 610.23 [VERIFY]; describes membrane curing compound type, water curing method, or combination; includes temperature monitoring plan for mass concrete; addresses wind/temperature protection measures
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 610.23. Practical on-site curing requirements based on minimisation of evaporative moisture losses from all freshly placed concrete.
```

```
Item #: 10
Description: Verify concrete supplier registration and batch plant compliance
Acceptance Criteria: Supplier registered in accordance with VicRoads requirements; batch plant meets AS 1379; NATA-accredited testing facilities
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 1379, TN 113. Batch plant and stand-by plant both require registration.
```

```
Item #: 11
Description: Submit material certificates for all cementitious materials and admixtures
Acceptance Criteria: Certificates current and demonstrating compliance with AS 3972 (supplementary cementitious materials), AS 1478 (admixtures); blended cement composition documented where alternative to OPC
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 610.05/610.06 [VERIFY]. Supplementary cementitious materials (SCMs) - moderate replacement for A/B1, moderately higher for B2, higher for C1/C2.
```

```
Item #: 12
Description: Submit concrete placement notification minimum 24 hours before pour
Acceptance Criteria: Written notification to Superintendent with pour details including: element description, volume, start time, estimated duration, mix design reference, pump/placement method
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: General requirement. Superintendent given opportunity to attend all concrete placements.
```

#### FORMWORK INSPECTION (Items 13-20)

```
Item #: 13
Description: Inspect formwork alignment, dimensions and stability prior to reinforcement placement
Acceptance Criteria: Formwork dimensions within tolerances per AS 3610.1; clean, free of debris; release agent applied; construction joints prepared; no gaps or misalignment at joints
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 614. Formwork must be checked before reinforcement placement commences.
```

```
Item #: 14
Description: Survey formwork dimensions and verify compliance with design drawings
Acceptance Criteria: Dimensional tolerances per Section 610 and AS 3610.1; position tolerance typically +/-5mm for critical dimensions [VERIFY specific VicRoads tolerances]; levels within specified tolerance
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey
Notes: Section 610/614. Dimensions outside allowable tolerance limits can have adverse structural consequences and reduce concrete cover.
```

```
Item #: 15
Description: Verify surface finish class of formwork meets specification requirements
Acceptance Criteria: Formwork surface condition matches specified finish class per AS 3610.1 (Class 1: highest quality; Class 2: excellent quality with uniform texture; Class 3: good visual quality); plywood grade appropriate for class
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 614 / AS 3610.1. Surface finish classes defined by visual characteristics and tolerance requirements.
```

```
Item #: 16
Description: Inspect formwork for embedded items, blockouts, cast-in accessories
Acceptance Criteria: All embedments, blockouts, holding-down bolts, drainage provisions, bearing plates and cast-in items correctly located and secured per drawings; will not be displaced during concrete placement
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 610 [VERIFY clause]. Embedments must be checked before pour approval.
```

```
Item #: 17
Description: Verify formwork provides required concrete cover to all reinforcement
Acceptance Criteria: Minimum cover per AS 5100.5 for specified exposure classification; cover tolerance per AS 5100.5 Clause 4.14.3.2 [VERIFY]; where curing compounds used, increase cover by 5mm for A/B1 or 10mm for B2/C1/C2
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: Cover meter / physical measurement
Notes: Clause 610.05 [VERIFY]. Cover is the primary durability measure. Inadequate cover reduces long-term durability. Bridge design life is 100 years.
```

```
Item #: 18
Description: Check formwork supports, props and bracing for structural adequacy
Acceptance Criteria: Supports installed per approved formwork/falsework design; bearing on adequate foundation; lateral bracing complete; no overstressed members
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Sections 613/614. Falsework/formwork must be stable under all loading conditions.
```

```
Item #: 19
Description: Inspect construction joints for correct preparation and position
Acceptance Criteria: Construction joints located as shown on drawings or as approved; previous concrete surface roughened, clean and saturated surface dry (SSD); bonding agent applied if specified; waterstops correctly positioned
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.19 [VERIFY]. Construction joint preparation is critical for structural integrity and waterproofing.
```

```
Item #: 20
Description: Confirm formwork is water-tight and ready for concrete placement
Acceptance Criteria: No gaps permitting grout loss; joints sealed; clean and free of debris, water, ice and deleterious materials; release agent applied but not contaminating reinforcement
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 610/614. Final check before pre-pour hold point.
```

#### PRE-POUR INSPECTION (Items 21-27)

```
Item #: 21
Description: Complete pre-pour inspection of formwork, reinforcement and embedments (combined hold point)
Acceptance Criteria: All formwork, reinforcement, post-tensioning ducts, embedments, blockouts and cast-in items inspected and approved; concrete cover verified; construction joints prepared; Superintendent formally releases hold point
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Section 610 [VERIFY clause]. This is the principal hold point for concrete placement. Work must not proceed beyond this hold point without inspection and approval by the Superintendent.
```

```
Item #: 22
Description: Verify all reinforcement inspection items complete (cross-reference to Template 10)
Acceptance Criteria: All items from Reinforcement Placement ITP (Template 10) signed off; bar schedule checked; cover confirmed; lapping verified; mechanical couplers tested; welding inspected if applicable
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Section 611. Reinforcement must be fully inspected before concrete placement approval.
```

```
Item #: 23
Description: Confirm concrete delivery access, pump setup and placement equipment ready
Acceptance Criteria: Pump reach adequate for all parts of pour; delivery route confirmed; sufficient capacity for planned pour rate; vibration equipment available and spare units on site; contingency plans documented
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.07 [VERIFY]. Equipment must be appropriate for the element and pour methodology.
```

```
Item #: 24
Description: Verify weather conditions suitable for concrete placement
Acceptance Criteria: Ambient temperature between 5 deg C and 35 deg C per AS 1379; wind speed acceptable for curing; no rain forecast during critical curing period; hot/cold weather precautions implemented where applicable
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Temperature measurement
Notes: AS 1379, Clause 610.23 [VERIFY]. Concrete temperature at delivery must be 5-35 deg C.
```

```
Item #: 25
Description: Confirm mass concrete temperature management plan (for elements over 600mm thick) [VERIFY thickness threshold]
Acceptance Criteria: Temperature monitoring system in place; thermocouple locations per plan; maximum temperature differential within element not to exceed 20 deg C; cooling measures documented
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: Thermocouple monitoring
Notes: Clause 610.23 [VERIFY]. Temperature differentials exceeding 20 deg C require precautions. Mass concrete definition per Section 610.
```

```
Item #: 26
Description: Confirm pre-pour meeting completed with all parties
Acceptance Criteria: Meeting conducted with relevant personnel; pour methodology reviewed; responsibilities confirmed; quality requirements communicated; emergency procedures established
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Good practice requirement. Attendance records and minutes maintained.
```

```
Item #: 27
Description: Confirm concrete mix design registration current and approved for this element
Acceptance Criteria: Mix design registration current (not expired or cancelled); appropriate for exposure classification of element; product code matches approved submission
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: TN 113. Registration can be cancelled if outstanding data not provided within 8 weeks.
```

#### CONCRETE PLACEMENT (Items 28-40)

```
Item #: 28
Description: Verify concrete delivery docket information on arrival
Acceptance Criteria: Delivery docket shows: mix design product code, batch plant, batch time, truck number, load volume, water added, admixtures, slump target; traceability maintained for all deliveries per AS 1379
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 1379, Clause 610.15 [VERIFY]. Traceability applies to all deliveries. Location of placed concrete must be traceable at all times.
```

```
Item #: 29
Description: Conduct slump test on concrete at point of delivery
Acceptance Criteria: Slump within nominated range on delivery docket (+/-15mm for slump up to 80mm; +/-25mm for slump 80-150mm per AS 1379) [VERIFY VicRoads specific tolerances]; or slump flow for SCC per AS 1012.3.5
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.1 (Slump) / AS 1012.3.5 (SCC Slump Flow)
Notes: Clause 610.15 [VERIFY]. Test first load and then per sampling frequency. Reject loads outside tolerance.
```

```
Item #: 30
Description: Measure concrete temperature at point of delivery
Acceptance Criteria: Temperature between 5 deg C and 35 deg C per AS 1379; recorded on delivery test form
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.8 [VERIFY]
Notes: Clause 610.15 [VERIFY]. Concrete outside temperature range must not be placed without specific approval.
```

```
Item #: 31
Description: Conduct SCC slump flow, T500 and J-ring tests (where SCC specified)
Acceptance Criteria: Slump flow retention, T500 time (viscosity measure) and J-ring passing ability within specified limits; testing at minimum hourly intervals throughout placement
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.3.5
Notes: Clause 610.15 [VERIFY], TN 073. Hourly testing minimum for SCC properties.
```

```
Item #: 32
Description: Take concrete test specimens (cylinders) for compressive strength testing
Acceptance Criteria: Minimum 1 set of 3 specimens per 50 m3 or per day (whichever is more frequent); cylinders moulded per AS 1012.8; cured per AS 1012.8 (standard curing); identified and traceable to delivery and placement location
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.1 (Sampling) / AS 1012.8 (Making and Curing)
Notes: Clause 610.17 [VERIFY]. Minimum 2 cylinders per sample for prestressed post-tensioned concrete tested prior to stressing.
```

```
Item #: 33
Description: Monitor concrete placement to ensure no segregation, excessive free-fall or displacement of reinforcement
Acceptance Criteria: Free-fall height does not exceed 1.5m (or as specified) [VERIFY VicRoads limit]; concrete placed in layers not exceeding 600mm [VERIFY]; no segregation evident; reinforcement and embedments not displaced
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.18 [VERIFY]. Concrete placement methodology per approved method statement.
```

```
Item #: 34
Description: Monitor concrete vibration/compaction during placement
Acceptance Criteria: Internal (immersion) vibrators used correctly; vibrator immersed to penetrate into previous layer; systematic insertion pattern; no over-vibration causing segregation; vibration duration adequate for full compaction without excessive working
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.18 [VERIFY]. Vibration is critical for achieving dense, durable concrete.
```

```
Item #: 35
Description: Monitor pour rate and delivery continuity
Acceptance Criteria: Continuous placement without cold joints; planned pour rate maintained; concrete placed within specified time limit from batching (typically 90 minutes for conventional concrete per AS 1379) [VERIFY VicRoads limits]
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: AS 1379, Clause 610.18 [VERIFY]. Delivery time critical for workability and set properties.
```

```
Item #: 36
Description: Monitor concrete temperature differential during placement (mass concrete)
Acceptance Criteria: Temperature differential within concrete element does not exceed 20 deg C; thermocouples functioning and recording; cooling measures activated if threshold approached
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Thermocouple monitoring
Notes: Clause 610.23 [VERIFY]. Continuous monitoring required for mass concrete elements.
```

```
Item #: 37
Description: Finish and level concrete surfaces to specified requirements
Acceptance Criteria: Surface finish as specified (trowelled, broom, or other); surface levels within tolerance; no ponding areas; adequate falls where specified for drainage; surface regularity per specification
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Straightedge / Survey
Notes: Clause 610.20 [VERIFY]. Surface finish requirements depend on the element and its function.
```

```
Item #: 38
Description: Apply initial curing protection immediately after finishing
Acceptance Criteria: Curing commenced immediately after concrete finishing; initial evaporative protection applied (spray, cover, or curing compound); surfaces protected from wind, sun and rain impact; curing compound applied per manufacturer's recommendations where specified
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.23. Practical on-site curing based on minimisation of evaporative moisture losses from all freshly placed and unprotected concrete.
```

```
Item #: 39
Description: Record concrete placement details including volumes, times, weather, test results
Acceptance Criteria: Concrete pour record completed showing: element reference, start/finish times, ambient temperature, concrete temperature, total volume placed, delivery docket numbers, test specimen numbers, any non-conformances
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 610. Documentation must ensure full traceability of placed concrete at all times.
```

```
Item #: 40
Description: Inspect concrete surface immediately after pour completion for defects
Acceptance Criteria: No honeycombing, surface voids, excessive bleed water, or visible defects; surface finish consistent with specification
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.20 [VERIFY]. Early identification of defects allows timely repair.
```

#### POST-PLACEMENT / CURING (Items 41-50)

```
Item #: 41
Description: Maintain curing regime for specified minimum period
Acceptance Criteria: Minimum curing period per Clause 610.23 [VERIFY] - typically 7 days for OPC, 14 days for blended cement; continuous moisture retention maintained; curing membrane compound or water curing as approved; wind/temperature protection maintained
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 610.23. Curing is the primary mechanism for achieving dense, impermeable cover concrete for long-term durability.
```

```
Item #: 42
Description: Monitor curing temperature and conditions throughout curing period
Acceptance Criteria: Temperature differential within element not exceeding 20 deg C; ambient conditions within acceptable range; curing membrane intact and not damaged; water curing maintaining continuous moisture
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Temperature monitoring
Notes: Clause 610.23. Temperature monitoring required for mass concrete throughout entire curing period.
```

```
Item #: 43
Description: Test compressive strength of concrete cylinders at 7 days (early age)
Acceptance Criteria: 7-day compressive strength results consistent with expected strength gain for the mix design; results recorded and any trends identified
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 610.17 [VERIFY]. Early age results used to monitor strength gain trend. Not typically used for acceptance.
```

```
Item #: 44
Description: Obtain Superintendent approval before formwork stripping (soffit forms for beams/slabs)
Acceptance Criteria: Minimum concrete strength achieved before removal of load-bearing formwork; strength demonstrated by cylinder test results or maturity method; stripping sequence per approved methodology
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 610.22 [VERIFY], Section 614. Formwork removal times must not compromise structural integrity or durability. Soffit forms and props for beams/slabs require strength verification.
```

```
Item #: 45
Description: Strip non-load-bearing (side) formwork at appropriate time
Acceptance Criteria: Minimum time elapsed per specification before side formwork removal [VERIFY specific VicRoads times]; concrete surfaces not damaged during removal; surfaces protected from rapid moisture loss after stripping
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 610/614. Side formwork can typically be removed earlier than soffit formwork. Resume curing after stripping.
```

```
Item #: 46
Description: Test compressive strength of concrete cylinders at 28 days (acceptance)
Acceptance Criteria: 28-day compressive strength equals or exceeds specified characteristic strength (f'c) per AS 1379 compliance criteria; assessment per AS 1379 Section 6 [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 610.17 [VERIFY]. 28-day results are the primary acceptance criterion for concrete strength. Non-compliant results require investigation and potential remedial action.
```

```
Item #: 47
Description: Test compressive strength at time of stressing (post-tensioned concrete)
Acceptance Criteria: Minimum of 2 cylinders per sample tested prior to application of post-tensioning force; compressive strength at time of stressing equals or exceeds specified minimum; cylinders cured per AS 1012
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 610.17 [VERIFY]. Post-tensioning must not proceed until specified concrete strength is achieved and verified by cylinder testing.
```

```
Item #: 48
Description: Inspect concrete surfaces after formwork removal for defects and crack assessment
Acceptance Criteria: No structural defects; crack widths within permissible limits per Section 610 (0.1mm for precast prestressed elements [VERIFY], per AS 5100.5 for reinforced elements); honeycombing and surface defects documented and repaired per approved method
Point Type: witness
Responsible Party: superintendent
Evidence Required: inspection
Test Type: Crack width gauge
Notes: Clause 610.24 [VERIFY], TN 038. VicRoads TN 038 provides guidance on crack assessment. Repair methods per TN 072 (Cementitious Repair of Concrete Structures).
```

```
Item #: 49
Description: Survey completed concrete element dimensions and levels
Acceptance Criteria: All dimensions within specified tolerances per Section 610; levels within tolerance; alignment within tolerance; cover verified by cover meter survey
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey / Cover meter (AS/NZS 1170 [VERIFY])
Notes: Clause 610.24 [VERIFY]. Dimensional non-compliance may have structural and durability consequences.
```

```
Item #: 50
Description: Compile and submit concrete quality records to Superintendent
Acceptance Criteria: Complete record package including: mix design registration, delivery dockets, slump/temperature records, cylinder test results (7-day and 28-day), curing records, temperature monitoring data, non-conformance reports, formwork stripping records, dimensional survey
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 610. Full documentation package required for each concrete element. Records must demonstrate traceability of all concrete placed.
```

#### DOCUMENTATION / COMPLETION (Items 51-58)

```
Item #: 51
Description: Submit 56-day or 90-day compressive strength results (where specified for high-performance concrete)
Acceptance Criteria: Later-age compressive strength meets specified requirements where longer-term strength is a design criterion (e.g., high-performance or blended cement concretes)
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Clause 610.17 [VERIFY]. May be specified for certain exposure classifications or special concrete mixes.
```

```
Item #: 52
Description: Submit drying shrinkage test results (where specified)
Acceptance Criteria: Drying shrinkage within specified limits per mix design registration; test results within 8 weeks of conditional registration
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.13
Notes: TN 113. Drying shrinkage testing may take several weeks. Part of conditional registration requirements.
```

```
Item #: 53
Description: Submit concrete durability test results (where specified for marine/saline environments)
Acceptance Criteria: Durability test results per VicRoads TN 089 and TN 097; resistivity, sorptivity, chloride diffusion or other durability indicators within specified limits
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: VicRoads TN 089 test methods
Notes: TN 089, TN 097. Required for marine/saline exposure environments. Test methods per TN 089.
```

```
Item #: 54
Description: Complete and document any concrete repairs using approved methods
Acceptance Criteria: Repair method approved by Superintendent; repair material compatible with parent concrete; curing of repair material per approved method; final inspection confirms repair is acceptable; documented per TN 072
Point Type: witness
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: TN 072 (Cementitious Repair), TN 087 [VERIFY] (Crack Repair per Section 687/689). All repairs must be documented.
```

```
Item #: 55
Description: Verify concrete cover by electromagnetic cover meter survey on completed structure
Acceptance Criteria: Cover measurements confirm design cover achieved within tolerance at all survey points; deficient areas identified and addressed
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Electromagnetic cover meter
Notes: Section 610. Cover survey confirms the as-built cover matches design requirements for long-term durability.
```

```
Item #: 56
Description: Assess and document crack mapping on completed structure
Acceptance Criteria: All visible cracks mapped, measured and recorded; crack widths assessed against permissible limits; structural significance evaluated; monitoring or repair recommendations documented per TN 038
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Crack width gauge / mapping
Notes: TN 038. All concrete is susceptible to cracking. Systematic assessment required for acceptance.
```

```
Item #: 57
Description: Complete as-built survey and documentation
Acceptance Criteria: As-built survey demonstrates compliance with design dimensions; all variations documented; as-built drawings updated; quality records archived
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey
Notes: Section 610. Final documentation package for the completed structure.
```

```
Item #: 58
Description: Superintendent final acceptance of structural concrete element
Acceptance Criteria: All hold points released; all test results compliant; all non-conformances resolved; all documentation complete and submitted; structure accepted for next stage of works
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Section 610. Formal acceptance before subsequent works can commence on or adjacent to the element.
```

### Test Methods and Frequencies Summary

| Test | Standard | Frequency | Key Acceptance Value |
|------|----------|-----------|---------------------|
| Slump (conventional) | AS 1012.3.1 | First load + per sampling plan | Within specified range (+/-15mm or +/-25mm per AS 1379) |
| Slump Flow (SCC) | AS 1012.3.5 | Minimum hourly during SCC placement | Within specified flow range; T500 and J-ring per limits |
| Concrete Temperature | AS 1379 | Every load | 5 deg C to 35 deg C |
| Compressive Strength (cylinders) | AS 1012.9 | 1 set of 3 per 50 m3 or per day (more frequent) | >= f'c at 28 days |
| Stressing Strength (PT) | AS 1012.9 | Min 2 cylinders per sample before stressing | >= specified minimum at time of stress |
| Drying Shrinkage | AS 1012.13 | Per mix design registration | Within specified limits |
| Alkali Aggregate Reactivity | VicRoads RC 376.03/04 | Minimum 3-yearly per aggregate source | Alkali content <= 2.8 kg/m3 Na2O equiv |
| Durability (marine) | VicRoads TN 089 methods | As specified | Per specification limits |
| Cover Survey | EM cover meter | Per element completion | Design cover +/- tolerance |
| Dimensional Survey | Survey instrument | Per element | Per Section 610 tolerances |
| Internal Temperature | Thermocouple | Continuous for mass concrete | Differential <= 20 deg C |

---

## Template 10: Reinforcement Placement

```
Template Name: Reinforcement Placement
Activity Type: structures
Specification Reference: VicRoads Section 611 (Steel Reinforcement)
Edition/Revision Date: Version 8 - January 2021 [VERIFY]
```

### Referenced Standards
- AS/NZS 4671:2001 - Steel Reinforcing Materials
- AS 5100.5:2017 - Bridge Design Part 5: Concrete
- AS 3600:2018 - Concrete Structures (for general provisions)
- VicRoads Section 610 - Structural Concrete (cover requirements)

### Checklist Items

#### PRE-WORK SUBMISSIONS (Items 1-8)

```
Item #: 1
Description: Submit bar schedule and bending details for Superintendent review
Acceptance Criteria: Bar schedule complies with drawings; all bar marks, sizes, shapes, lengths and quantities listed; bending dimensions per AS 3600 or AS 5100.5; schedule prepared by competent person
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 611.03 [VERIFY]. Bar schedule must be reviewed and approved before materials are ordered or fabricated.
```

```
Item #: 2
Description: Submit material certificates for reinforcing steel
Acceptance Criteria: Steel reinforcement complies with AS/NZS 4671; certificates show grade (typically 500N for deformed bars, 500L for mesh), yield strength, tensile strength, ductility class; certificates traceable to heat/batch number
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS/NZS 4671
Notes: Clause 611.02 [VERIFY]. Material must be from an approved source with current certification. Grade 500N (normal ductility) is standard for bridge reinforcement.
```

```
Item #: 3
Description: Submit material certificates for stainless steel reinforcement (where specified)
Acceptance Criteria: Stainless steel reinforcement grade and composition per specification; mechanical properties meet requirements; material traceable to source
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 611 [VERIFY]. Stainless steel may be specified in aggressive exposure environments (C1, C2, U).
```

```
Item #: 4
Description: Submit mechanical coupler type-test certificates and installation procedure (where couplers specified)
Acceptance Criteria: Couplers type-tested in accordance with relevant standard [VERIFY]; demonstrate minimum strength equal to 100% of characteristic yield strength of reinforcement; installation procedure documented
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 611.06 [VERIFY]. Mechanical couplers must be type-tested and approved before use on site.
```

```
Item #: 5
Description: Submit welding procedure specification (WPS) and welder qualifications (where welding specified)
Acceptance Criteria: WPS qualified per AS/NZS 1554.3 (Structural Steel Welding - Welding of Reinforcing Steel) [VERIFY]; welders hold current qualifications for the specified weld type; procedure approved by Superintendent
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS/NZS 1554.3 [VERIFY]
Notes: Clause 611.07 [VERIFY]. Welding of reinforcement requires specific qualification. Not all reinforcement grades are readily weldable.
```

```
Item #: 6
Description: Submit reinforcement fixing methodology including spacer types and installation details
Acceptance Criteria: Methodology addresses fixing method, bar support systems, spacer type and size for required cover, tie wire type, access arrangements; spacers appropriate for exposure classification
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 611.05 [VERIFY]. Spacer type must be compatible with concrete exposure classification - plastic/cementitious spacers for exposed faces.
```

```
Item #: 7
Description: Submit post-tensioning system details and stressing calculations (where applicable)
Acceptance Criteria: PT system type approved; tendon profile per drawings; stressing sequence documented; elongation calculations provided; friction and wobble coefficients documented; anchorage details per manufacturer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 612. Required only for post-tensioned elements. Cross-reference to Post-Tensioning specification.
```

```
Item #: 8
Description: Verify reinforcement storage and protection on site
Acceptance Criteria: Reinforcement stored off ground on supports; protected from weather, contamination and damage; identified by bar mark and size; different grades/types clearly separated; no excessive rust, oil or other deleterious coating
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 611.04 [VERIFY]. Contaminated or damaged reinforcement must not be placed.
```

#### REINFORCEMENT FIXING (Items 9-22)

```
Item #: 9
Description: Verify reinforcement bar sizes, grade and marks match approved bar schedule
Acceptance Criteria: All bar sizes correct per schedule; grade identification marks visible (500N, 500L); bar marks correspond to schedule; material certificates traceable to delivered reinforcement
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 611.04 [VERIFY]. Physical verification against bar schedule before fixing commences.
```

```
Item #: 10
Description: Verify bar bending dimensions and shapes comply with schedule and standards
Acceptance Criteria: Bending dimensions within tolerances per AS 3600/AS 5100.5; minimum bend diameters per AS/NZS 4671 (typically 5d for fitments, larger for main bars) [VERIFY]; no cracks or damage from bending
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.03 [VERIFY]. Minimum bend diameters depend on bar size and purpose.
```

```
Item #: 11
Description: Inspect reinforcement placement position and spacing against drawings
Acceptance Criteria: Bars positioned per drawings; spacing within tolerance (+/-5mm typically) [VERIFY VicRoads tolerance]; clear spacing between bars sufficient for concrete placement and compaction; maximum aggregate size considered
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.05 [VERIFY]. Bar spacing must allow adequate concrete flow and compaction.
```

```
Item #: 12
Description: Verify concrete cover to reinforcement meets design requirements
Acceptance Criteria: Cover measured and confirmed at multiple points; minimum cover per AS 5100.5 for exposure classification (e.g., 40mm for B1, 45mm for B2, 50mm for C1, 65mm for C2) [VERIFY exact values from AS 5100.5 Table 4.14.3.2]; spacers correctly positioned and at adequate frequency
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: Physical measurement / cover meter
Notes: Clause 611.05 [VERIFY], Section 610. Cover is the primary durability mechanism. Inadequate cover compromises the 100-year design life. Additional 5mm cover for A/B1 or 10mm for B2+ where curing compounds used.
```

```
Item #: 13
Description: Verify spacer type, size and frequency of installation
Acceptance Criteria: Spacers provide correct cover; material appropriate for exposure classification (concrete/plastic spacers on exposed faces, no steel wire spacers on exposed faces); spacing between spacers adequate to prevent bar sag (typically max 1m centres) [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 611.05 [VERIFY]. Spacers directly influence as-built cover. Steel wire supports may create corrosion paths on exposed surfaces.
```

```
Item #: 14
Description: Inspect lap splice locations and lengths
Acceptance Criteria: Lap locations per drawings (typically staggered, not more than 50% of bars lapped at one section) [VERIFY]; lap length per AS 5100.5 design requirements; laps tied at both ends and centre; no laps in high stress zones unless shown on drawings
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.06 [VERIFY]. Lap length depends on bar size, concrete strength, cover and confinement.
```

```
Item #: 15
Description: Inspect mechanical coupler installations (where used)
Acceptance Criteria: Couplers installed per approved procedure; bar fully inserted to required depth (witness marks verified); torque applied to specification (where applicable); visual inspection confirms correct installation
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Torque wrench (where applicable)
Notes: Clause 611.06 [VERIFY]. Every coupler should be inspected. Defective couplers must be replaced.
```

```
Item #: 16
Description: Inspect reinforcement welding (where specified)
Acceptance Criteria: Welds per qualified WPS; visual inspection per AS/NZS 1554.3 [VERIFY]; no cracks, porosity, undercut or other defects; NDT where specified; welder holds current qualification
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual / NDT per specification
Notes: Clause 611.07 [VERIFY]. Welding reinforcement is not common in bridge construction but may be required for specific connections.
```

```
Item #: 17
Description: Inspect tie wire fixings for security of reinforcement cage
Acceptance Criteria: All intersections tied (or as specified for the element); tie wire does not reduce cover; cage rigid and stable; will not displace during concrete placement; wire ends turned inward (not protruding into cover zone)
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 611.05 [VERIFY]. Cage stability is critical during concrete placement, especially for tall elements or pump-placed concrete.
```

```
Item #: 18
Description: Inspect fitments (stirrups/ligatures) for correct size, spacing and anchorage
Acceptance Criteria: Fitment size and spacing per drawings; hook lengths and bends per AS 5100.5; hooks oriented correctly; stirrups engaging longitudinal bars at all corners
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.05 [VERIFY]. Fitments provide shear resistance and confinement. Correct installation is critical for structural performance.
```

```
Item #: 19
Description: Inspect post-tensioning ducts/tendons for correct profile and fixing (where applicable)
Acceptance Criteria: Duct profile matches drawings; ducts fixed at specified intervals to prevent displacement during concrete placement; duct joints sealed; anchorage components correctly positioned; vents and grout connections installed
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Section 612. PT ducts must be inspected as part of the pre-pour reinforcement inspection. Profile accuracy directly affects structural performance.
```

```
Item #: 20
Description: Verify reinforcement cleanliness before concrete placement
Acceptance Criteria: Reinforcement free from loose rust, oil, grease, form release agent, paint, mud and other contaminants that could impair bond; light mill scale acceptable; firmly adhered rust acceptable if not scaled
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 611.04 [VERIFY]. Contaminants impair bond between reinforcement and concrete.
```

```
Item #: 21
Description: Check clearance between reinforcement layers for concrete placement
Acceptance Criteria: Clear distance between bars sufficient for concrete placement and compaction; minimum clear spacing per AS 5100.5 (typically 1.5 x maximum aggregate size or bar diameter, whichever is greater) [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.05 [VERIFY]. Insufficient spacing leads to honeycombing and inadequate compaction.
```

```
Item #: 22
Description: Final reinforcement inspection and hold point release
Acceptance Criteria: All reinforcement items inspected and compliant; cover confirmed; bar schedule verified; laps and couplers checked; cage stable and clean; Superintendent releases hold point for concrete placement
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: null
Notes: Section 611 / Section 610. This hold point must be released before concrete placement can commence. Cross-reference to Template 9 Item 21.
```

#### POST-POUR REINFORCEMENT ITEMS (Items 23-28)

```
Item #: 23
Description: Verify protruding reinforcement (starter bars, continuity bars) for next stage
Acceptance Criteria: Starter bars at correct position, size and length for next pour stage; protected from damage; cover to adjacent faces maintained; projection length correct for lap requirements
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Measurement
Notes: Clause 611.05 [VERIFY]. Starter bar position must be checked before formwork for subsequent pour stages.
```

```
Item #: 24
Description: Conduct post-stressing inspection of post-tensioned tendons (where applicable)
Acceptance Criteria: Elongation measurements within 5% of calculated values [VERIFY]; stressing force verified by jack pressure gauge and elongation; wedge seating losses within expected range; lock-off force recorded
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Stressing equipment / elongation measurement
Notes: Section 612. Post-tensioning results are critical for structural performance verification.
```

```
Item #: 25
Description: Inspect grouting of post-tensioned ducts (where applicable)
Acceptance Criteria: Grouting commenced within specified time after stressing; grout mix per approved design; grouting continuous until clean grout flows from vents; all vents sealed; grout caps installed at anchorages
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Section 612. Complete grouting is essential for durability and corrosion protection of tendons.
```

```
Item #: 26
Description: Verify cover meter survey results on completed element
Acceptance Criteria: Electromagnetic cover meter survey confirms design cover achieved at all survey points; results within tolerance; any deficient areas identified for assessment
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Electromagnetic cover meter
Notes: Clause 611.05 [VERIFY], Section 610. Post-pour verification of as-built cover confirms quality of reinforcement fixing.
```

```
Item #: 27
Description: Submit reinforcement quality records including material certificates and inspection checklists
Acceptance Criteria: Complete documentation including: material certificates (traceable to AS/NZS 4671), bar schedule (marked up as-built), fixing inspection records, cover measurements, coupler records, welding records (where applicable)
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 611. Full documentation package required for each structural element.
```

```
Item #: 28
Description: Superintendent acceptance of reinforcement installation records
Acceptance Criteria: All hold points released; all inspection records complete; all material certificates filed; non-conformances resolved; documentation accepted by Superintendent
Point Type: standard
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Section 611. Formal closure of reinforcement quality records.
```

### Test Methods and Frequencies Summary

| Test | Standard | Frequency | Key Acceptance Value |
|------|----------|-----------|---------------------|
| Material Certification | AS/NZS 4671 | Per delivery/heat number | Grade 500N/500L; yield, tensile, ductility per standard |
| Cover Measurement (pre-pour) | Physical measurement | All faces, multiple points | Design cover per AS 5100.5 exposure class |
| Cover Meter Survey (post-pour) | EM cover meter | Per completed element | Design cover within tolerance |
| Lap Length Measurement | Tape measure | All lapped bars | Per design lap length |
| Coupler Torque (where applicable) | Torque wrench | 100% of couplers | Per manufacturer specification |
| Weld Inspection (where applicable) | AS/NZS 1554.3 | 100% visual; NDT as specified | No defects per standard |
| Bar Size/Spacing Measurement | Tape/ruler | Per element face | Per bar schedule and drawings |
| Post-Tensioning Elongation | Stressing equipment | 100% of tendons | Within 5% of calculated [VERIFY] |

---

## Template 15: Piling

```
Template Name: Piling
Activity Type: structures
Specification Reference: VicRoads Section 605 (Driven Piles), Section 606 (Bored Cast-In-Place Piles without Permanent Casing), Section 607 (CFA Piles), Section 608 (Cast-In-Place Socketed Piles with Permanent Casing)
Edition/Revision Date: Section 605 v8 (Sep 2023), Section 606 v6, Section 607 v7, Section 608 v8 (Jan 2021)
```

**Note:** VicRoads has four separate piling specifications. This template is structured to cover the common requirements across all pile types with type-specific items clearly identified. The Superintendent should select applicable items based on the pile type specified for the project.

### Referenced Standards
- AS 2159:2009 - Piling - Design and Installation
- AS 5100.3:2017 - Bridge Design Part 3: Foundation and Soil-Supporting Structures
- AS 1379:2007 - Specification and Supply of Concrete
- AS 1012 series - Methods of Testing Concrete
- AS/NZS 4671:2001 - Steel Reinforcing Materials
- ASTM D5882 - Low Strain Impact Integrity Testing of Deep Foundations
- VicRoads Section 610 - Structural Concrete (for concrete in piles)
- VicRoads Section 611 - Steel Reinforcement (for reinforcement cages)

### Checklist Items

#### PRE-WORK SUBMISSIONS (Items 1-12)

```
Item #: 1
Description: Submit piling method statement for Superintendent review
Acceptance Criteria: Method statement addresses: pile type, equipment, installation sequence, methodology, quality control procedures, contingency plans; complies with relevant specification section (605/606/607/608); reviewed and approved before commencement
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 605.03/606.03/607.03/608.03 [VERIFY]. Method statement must be comprehensive and address all construction stages.
```

```
Item #: 2
Description: Submit pile design and drawings including pile layout, lengths, diameters, capacities and tolerances
Acceptance Criteria: Pile design per AS 2159 and AS 5100.3; drawings show pile locations, cut-off levels, design capacities, socket requirements (for bored piles), minimum embedment lengths; approved by designer
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 2159, AS 5100.3. Design must be complete before installation commences.
```

```
Item #: 3
Description: Submit geotechnical investigation report and foundation assessment
Acceptance Criteria: Report covers all pile locations; describes subsurface conditions, rock levels, groundwater; identifies potential installation hazards (boulders, obstructions, contamination); pile design parameters documented
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 2159. Geotechnical assessment is fundamental to pile design and installation planning.
```

```
Item #: 4
Description: Submit concrete mix design for pile concrete (bored piles / CFA)
Acceptance Criteria: Concrete mix design registered per VicRoads TN 113 and Section 610; appropriate for placement method (tremie, pump, free-fall); minimum slump for tremie placement (typically 180-220mm) [VERIFY]; exposure classification appropriate for buried/submerged conditions
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: VicRoads TN 113
Notes: Section 610, Clause 606.06/607.06/608.06 [VERIFY]. Concrete must be suitable for underwater/tremie placement where applicable.
```

```
Item #: 5
Description: Submit reinforcement cage details and bar schedule for cast-in-place piles
Acceptance Criteria: Cage design per AS 5100.5 and Section 611; bar schedule including main bars, helical reinforcement, centraliser locations, lifting points; cage length and diameter appropriate for pile design
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 611, Clause 606.05/607.05/608.05 [VERIFY]. Cage design must account for installation methodology (lifting, lowering into bore).
```

```
Item #: 6
Description: Submit material certificates for precast piles (driven piles)
Acceptance Criteria: Precast pile manufacture certificates demonstrating compliance with design; concrete strength achieved; prestressing records; dimensional checks; no defects or damage
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 605.04 [VERIFY]. Precast piles must be inspected and certified before delivery to site. Applicable to driven piles only.
```

```
Item #: 7
Description: Submit piling equipment details and capability certification
Acceptance Criteria: Equipment type and capacity appropriate for pile type and design loads; crane/rig capacity adequate; hammer type and energy rating suitable (driven piles); auger specification (CFA); boring equipment specification (bored piles)
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 605.05/606.04/607.04/608.04 [VERIFY]. Equipment must be capable of installing piles to design requirements without damage.
```

```
Item #: 8
Description: Submit integrity testing and load testing program
Acceptance Criteria: Testing program per AS 2159 requirements based on risk rating; number and location of test piles identified; test methods specified (PDA, PIT, CSL, static load test); testing contractor identified and qualified
Point Type: hold_point
Responsible Party: contractor
Evidence Required: document
Test Type: AS 2159
Notes: AS 2159. Integrity testing mandatory where geotechnical strength reduction factor (phi_gb) > 0.4. Load testing mandatory where phi_gb > 0.4 AND average risk rating (ARR) >= 2.5.
```

```
Item #: 9
Description: Submit stabilising fluid (bentonite/polymer) specification and management plan (bored piles)
Acceptance Criteria: Fluid type and properties specified; density, viscosity, pH and sand content limits documented; mixing, recycling and disposal procedures; environmental management requirements addressed
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 606.04 [VERIFY]. Required for bored piles using bentonite or polymer support fluid. Fluid properties critical for bore stability and concrete quality.
```

```
Item #: 10
Description: Submit CFA on-board monitoring system specification and calibration records
Acceptance Criteria: On-board monitoring system capable of recording: auger depth, rotation speed, penetration rate, concrete/grout pressure, volume pumped, extraction rate; system calibrated and certified [VERIFY specific parameters]
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 607.04 [VERIFY]. CFA rigs must be fitted with on-board monitoring instruments for real-time monitoring during installation. Applicable to CFA piles only.
```

```
Item #: 11
Description: Submit pile marking and identification procedure
Acceptance Criteria: Driven piles marked at 500mm intervals from pile toe; all piles uniquely identified with reference system matching pile layout drawing; marking method durable and readable during installation
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Clause 605.04 [VERIFY]. Marking at 500mm intervals allows accurate penetration monitoring during driving.
```

```
Item #: 12
Description: Verify pile storage and handling procedures
Acceptance Criteria: Precast piles stored on level supports at specified points; no overstress or permanent distortion during handling; lifting points per manufacturer/design; timber/concrete support blocks at correct locations; damaged piles rejected
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 605.04 [VERIFY]. Piles must be carefully stored and handled to prevent damage, overstress or permanent distortion. Applicable primarily to driven piles.
```

#### PILE INSTALLATION - COMMON (Items 13-20)

```
Item #: 13
Description: Survey and set out pile positions
Acceptance Criteria: Pile positions surveyed and marked from project control network; position accuracy within +/-75mm at cut-off level [VERIFY VicRoads tolerance]; reference points established for monitoring during installation
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey
Notes: Clause 605.06/606.05/607.05/608.05 [VERIFY]. Set-out accuracy directly affects pile group performance and pile cap construction.
```

```
Item #: 14
Description: Verify ground conditions at pile location match geotechnical assessment
Acceptance Criteria: Excavated/observed ground conditions consistent with geotechnical report; any variations documented and reported to designer; unexpected conditions (contamination, voids, obstructions) reported immediately
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 2159. Ground conditions must be verified as construction proceeds. Design review required if conditions differ significantly from assessment.
```

```
Item #: 15
Description: Check piling rig/equipment alignment and verticality before installation
Acceptance Criteria: Rig positioned over pile location; leader/mast verticality checked (deviation not to exceed 1 in 75) [VERIFY]; alignment appropriate for pile rake if specified; rig stable on level platform
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Spirit level / inclinometer
Notes: Clause 605.06/606.05 [VERIFY]. Rig alignment directly affects final pile verticality.
```

```
Item #: 16
Description: Verify protection of adjacent piles and structures during installation
Acceptance Criteria: Adjacent completed piles and structures protected from damage due to driving vibration, ground movement or equipment operation; monitoring in place where required; exclusion zones observed
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 605.07/606.06 [VERIFY]. Installation activities can affect adjacent piles, especially driven piles.
```

```
Item #: 17
Description: Monitor pile verticality during installation
Acceptance Criteria: Pile verticality maintained within tolerance: deviation not to exceed 1 in 75 at cut-off level for bored piles [VERIFY]; 1 in 75 for driven piles [VERIFY]; or 1.5% angular deviation [VERIFY]; measured at regular intervals during installation
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Inclinometer / Survey
Notes: Clause 605.06/606.05/607.05/608.05 [VERIFY]. Excessive deviation may require redesign of pile cap or additional piles.
```

```
Item #: 18
Description: Inspect reinforcement cage before lowering into bore/casing (cast-in-place piles)
Acceptance Criteria: Cage complies with bar schedule; main bars, helical reinforcement, centralisers all correctly positioned; cage diameter allows adequate concrete cover; lifting points secure; cage clean and free from mud/debris
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: Measurement
Notes: Section 611, Clause 606.05/607.05/608.05 [VERIFY]. Cage inspection before installation is a critical hold point. Cage dimensions verified against bar schedule.
```

```
Item #: 19
Description: Monitor reinforcement cage installation into bore/casing
Acceptance Criteria: Cage lowered vertically without damage; cage level correct relative to design cut-off; centralisers maintaining cover; cage secured against flotation during concrete placement; no displacement of base stabilising material
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 606.05/608.05 [VERIFY]. Cage must be secured to prevent uplift during tremie concrete placement.
```

```
Item #: 20
Description: Record pile installation data and maintain pile log
Acceptance Criteria: Pile log records: pile reference, date, start/finish times, pile dimensions, founding depth, penetration rates, ground conditions encountered, any deviations from specification, equipment used
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 605/606/607/608. Comprehensive pile log required for every pile installed.
```

#### DRIVEN PILE ITEMS (Items 21-28)

```
Item #: 21
Description: Verify hammer type, weight and drop height match approved methodology (driven piles)
Acceptance Criteria: Hammer energy rating suitable for pile type and design capacity; hammer type as approved in method statement; drop height within specified range; cushion/helmet in satisfactory condition
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 605.05 [VERIFY]. Hammer must have sufficient energy to install pile and achieve ultimate capacity without causing damage. Driven piles only.
```

```
Item #: 22
Description: Monitor pile driving and record set measurements (driven piles)
Acceptance Criteria: Set measurements taken to verify capacity; traces recorded during driving showing temporary compression and permanent set; traces taken relative to stable hurdle supported by posts at least one pile diameter from each side of pile
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Set measurement / driving traces
Notes: Clause 605.06 [VERIFY]. Set measurement is the primary installation control for driven piles. Driving resistance must equal or exceed pile test load shown on drawings.
```

```
Item #: 23
Description: Conduct PDA (Pile Driving Analyzer) dynamic testing during initial driving (driven piles)
Acceptance Criteria: PDA testing by qualified operator; CAPWAP analysis demonstrating ultimate capacity exceeds specified pile test load; pile integrity confirmed; results submitted to Superintendent
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: ASTM D4945 / AS 2159 Appendix C
Notes: Clause 605.07 [VERIFY]. PDA testing verifies capacity and integrity during driving. High-strain dynamic testing involves application of large force at pile head.
```

```
Item #: 24
Description: Conduct restrike test (driven piles where initial set not achieved)
Acceptance Criteria: Restrike not less than 24 hours after initial driving; PDA monitoring during restrike; ultimate capacity equals or exceeds specified pile test load after restrike; if still not achieved, further action directed by Superintendent
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: ASTM D4945 / AS 2159
Notes: Clause 605.08. Restrike testing required if ultimate load capacity not achieved at specified level during initial driving. Driven piles only.
```

```
Item #: 25
Description: Assess pile for driving damage (driven piles)
Acceptance Criteria: No visible damage to pile head, shaft or toe; no excessive cracking in precast concrete piles; no buckling or distortion in steel piles; PDA signals consistent with undamaged pile; any suspected damage investigated
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Visual / PDA
Notes: Clause 605.06 [VERIFY]. Piles must be driven without causing damage. Excessive driving energy or hard driving can cause pile damage.
```

```
Item #: 26
Description: Monitor pile heave of adjacent piles during driving (driven piles)
Acceptance Criteria: Previously driven piles monitored for heave; heave exceeding specified tolerance requires re-driving or retest; monitoring system in place before driving commences
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey / level monitoring
Notes: Clause 605.07 [VERIFY]. Pile heave can reduce capacity of previously installed piles. Driven piles in cohesive soils are most susceptible.
```

```
Item #: 27
Description: Verify pile toe level against design requirements (driven piles)
Acceptance Criteria: Pile toe reaches specified founding level or achieves specified driving resistance; penetration depth recorded from pile markings (500mm intervals); toe level consistent with geotechnical profile
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Pile marking record
Notes: Clause 605.06 [VERIFY]. Toe level is determined by driving criteria (set) rather than depth alone for driven piles.
```

```
Item #: 28
Description: Cut off driven piles to specified level
Acceptance Criteria: Pile cut-off level per drawings (+/-25mm) [VERIFY]; concrete pile heads trimmed without damaging remaining pile; steel piles cut cleanly; reinforcement exposed to correct projection for pile cap connection
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Survey
Notes: Clause 605.09 [VERIFY]. Cut-off level accuracy is critical for pile cap construction.
```

#### BORED PILE ITEMS (Items 29-36)

```
Item #: 29
Description: Inspect bore excavation and verify founding conditions (bored piles)
Acceptance Criteria: Bore excavated to specified depth; socket into competent rock achieved to design depth (where specified); base of excavation clean with no loose material or water; founding conditions consistent with geotechnical assessment; Superintendent releases hold point
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: inspection
Test Type: Geotechnical inspection
Notes: Clause 606.06 [VERIFY]. Bore inspection is a critical hold point. Holes can safely be cleaned by hand and inspected in situ prior to cage insertion. Bored piles only.
```

```
Item #: 30
Description: Conduct test hole drilling at base of socket (bored piles in rock)
Acceptance Criteria: Test holes minimum 24mm diameter drilled to at least 2.4m or two pile diameters below bottom of excavation [VERIFY]; suitable material persists at that depth; driller records time per 250mm increment; supervised by Geotechnical Assessor
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: Test hole drilling
Notes: Clause 606.06 [VERIFY]. Test drilling confirms competent founding material extends below socket base. Written records provided to Superintendent. Bored piles in rock sockets only.
```

```
Item #: 31
Description: Test stabilising fluid properties before concrete placement (bored piles with fluid support)
Acceptance Criteria: Density within specified range; viscosity within range (Marsh funnel test); pH within range; sand content below maximum (typically <4% by volume) [VERIFY]; fluid suitable for concrete displacement
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: Density, Marsh funnel, pH, sand content
Notes: Clause 606.05 [VERIFY]. Fluid properties affect bore stability and concrete quality. Fluid must be suitable for displacement by tremie concrete.
```

```
Item #: 32
Description: Monitor bore stability throughout excavation process (bored piles)
Acceptance Criteria: No collapse or excessive loss of ground; temporary casing installed where required; fluid level maintained above groundwater level; adjacent piles/structures not affected
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 606.05 [VERIFY]. Bore stability is critical for pile integrity and adjacent structure protection.
```

```
Item #: 33
Description: Place concrete in bore using tremie method (bored piles with fluid support)
Acceptance Criteria: Tremie pipe sections sufficient to reach toe; joints sealed; tremie immersed in concrete at all times (minimum 2m embedment) [VERIFY]; concrete placed continuously without interruption; tremie raised progressively maintaining embedment
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 606.07 [VERIFY]. Tremie must remain immersed in concrete throughout placement to prevent contamination from stabilising fluid.
```

```
Item #: 34
Description: Monitor concrete volume placed against theoretical pile volume (bored piles)
Acceptance Criteria: Actual concrete volume recorded; compared to theoretical volume; over-consumption ratio documented (typically should not exceed 1.15-1.25 for stable bore) [VERIFY]; excessive over-consumption indicates potential bore instability
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Volume calculation
Notes: Clause 606.07 [VERIFY]. Volume monitoring is an indicator of bore stability and concrete quality.
```

```
Item #: 35
Description: Continue concrete placement until contaminated concrete displaced above cut-off level (bored piles)
Acceptance Criteria: Concrete placed to above cut-off level by sufficient margin to ensure contaminated top-of-pile concrete (mixed with fluid/debris) is above the cut-off; typically 0.5-1.0m above cut-off [VERIFY]
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 606.07 [VERIFY]. Contaminated concrete at top of pile must be above cut-off level and removed during pile trimming.
```

```
Item #: 36
Description: Trim bored pile concrete to cut-off level
Acceptance Criteria: Cut-off level per drawings (+/-25mm) [VERIFY]; contaminated concrete above cut-off fully removed; sound concrete exposed; reinforcement protruding to correct length for pile cap connection; no damage to pile reinforcement or concrete below cut-off
Point Type: standard
Responsible Party: contractor
Evidence Required: inspection
Test Type: Survey
Notes: Clause 606.08 [VERIFY]. All contaminated concrete must be removed to expose sound pile concrete.
```

#### CFA PILE ITEMS (Items 37-40)

```
Item #: 37
Description: Monitor CFA pile installation using on-board monitoring system
Acceptance Criteria: On-board monitoring records: auger depth vs time, rotation speed, penetration rate; auger rotation only in drilling direction (no reversing during drilling) [VERIFY]; auger not pulled out to clear head during drilling; records stored and available for review
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: On-board monitoring system
Notes: Clause 607.05 [VERIFY]. Reversing auger or pulling out during drilling is not permitted. Real-time monitoring is mandatory for CFA piles.
```

```
Item #: 38
Description: Monitor concrete/grout placement during auger extraction (CFA piles)
Acceptance Criteria: Concrete/grout pressure maintained positive at auger tip at all times during extraction; extraction rate controlled to maintain concrete column; on-board monitoring records concrete pressure, volume and auger depth continuously
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: On-board monitoring system
Notes: Clause 607.06 [VERIFY]. Loss of positive pressure can cause necking or soil inclusion. CFA piles only.
```

```
Item #: 39
Description: Compare actual concrete volume to theoretical pile volume (CFA piles)
Acceptance Criteria: Actual volume from on-board monitoring; theoretical volume from pile diameter and depth; over-consumption ratio documented; minimum 1.0 (no under-consumption); excessive over-consumption investigated
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Volume calculation
Notes: Clause 607.06 [VERIFY]. Under-consumption indicates potential defect. Over-consumption may indicate unstable ground.
```

```
Item #: 40
Description: Install reinforcement cage into fresh CFA pile concrete
Acceptance Criteria: Cage installed immediately after concrete placement while concrete is fluid; cage pushed/vibrated to design depth; centralisers maintaining cover; cage secured at correct level; installation completed within workability time of concrete
Point Type: witness
Responsible Party: contractor
Evidence Required: inspection
Test Type: null
Notes: Clause 607.07 [VERIFY]. CFA pile reinforcement is installed after concrete placement, unlike conventional bored piles. Timing is critical.
```

#### PILE TESTING AND INTEGRITY (Items 41-48)

```
Item #: 41
Description: Conduct low-strain integrity testing (PIT) on completed piles
Acceptance Criteria: Testing per ASTM D5882 and AS 2159; all piles tested or per testing program; pile head prepared (clean, level, cured); pile age minimum 7 days [VERIFY]; results assessed by qualified engineer; classification per AS 2159 (acceptable/defective/inconclusive)
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: ASTM D5882 / AS 2159 Appendix E [VERIFY]
Notes: AS 2159. Low-strain integrity testing (PIT) is a rapid screening method for assessing pile shaft integrity. Detects major defects such as necking, bulging, cracks, inclusions.
```

```
Item #: 42
Description: Conduct cross-hole sonic logging (CSL) on bored piles (where specified)
Acceptance Criteria: CSL tubes installed per specification (minimum 2 tubes per pile, more for larger diameters); testing conducted per AS 2159; results interpreted by qualified engineer; defects located and quantified; concrete age minimum 7 days [VERIFY]
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: CSL / ASTM D6760 [VERIFY]
Notes: AS 2159. CSL provides detailed assessment using sound wave travel times between access tubes. Required for large diameter bored piles. More detailed than PIT.
```

```
Item #: 43
Description: Submit pile integrity test results to Superintendent
Acceptance Criteria: All test results compiled, interpreted and submitted; qualified engineer's assessment of each pile; defective piles identified with recommended remedial action; results constitute a hold point per AS 2159
Point Type: hold_point
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 2159
Notes: AS 2159 Section 6.3/6.4 [VERIFY]. Submission of integrity test results is a hold point. Work must not proceed until results reviewed and accepted.
```

```
Item #: 44
Description: Conduct static load test on test pile(s) (where specified)
Acceptance Criteria: Static load test per AS 2159 Appendix A; pile head prepared for coaxial load application; test load applied in increments per standard; settlement measured at each increment; ultimate capacity determined; results compared to design requirements
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: test_result
Test Type: AS 2159 Appendix A
Notes: AS 2159. Static load testing is the most reliable method for verifying pile capacity. Required where risk assessment demands high confidence. Test pile(s) identified in testing program.
```

```
Item #: 45
Description: Conduct high-strain dynamic load test (PDA) on production piles (where specified)
Acceptance Criteria: PDA testing by qualified operator per AS 2159 Appendix C; CAPWAP signal matching analysis completed; ultimate capacity equals or exceeds design requirement; pile integrity confirmed; testing on sufficient number of piles per risk rating
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: ASTM D4945 / AS 2159 Appendix C
Notes: AS 2159. PDA testing verifies both capacity and integrity. Applicable to driven piles and some bored piles with restrike capability.
```

```
Item #: 46
Description: Conduct rapid load test (Statnamic) on test piles (where specified)
Acceptance Criteria: Rapid load test per AS 2159 Appendix D [VERIFY]; unloading point method or signal matching used for capacity assessment; results compared to design requirements; interpretation by qualified engineer
Point Type: witness
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 2159 Appendix D [VERIFY]
Notes: AS 2159. Rapid load testing is an alternative to static load testing. Less common but can test higher capacities.
```

```
Item #: 47
Description: Assess and resolve defective piles identified by testing
Acceptance Criteria: Defective piles assessed by designer; remedial options evaluated (re-drilling, grouting, replacement, additional piles); remedial action approved by Superintendent; verification testing of remediated piles where required
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: AS 2159. Defective piles must be addressed before foundation acceptance. Remedial options depend on nature and severity of defect.
```

```
Item #: 48
Description: Verify pile as-built positions and cut-off levels by survey
Acceptance Criteria: All pile positions surveyed at cut-off level; position tolerance within +/-75mm of design [VERIFY]; cut-off level within +/-25mm [VERIFY]; as-built coordinates and levels documented; any out-of-tolerance piles reported to designer for assessment
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: Survey
Notes: Section 605/606/607/608. As-built pile positions are critical for pile cap design and construction.
```

#### DOCUMENTATION / COMPLETION (Items 49-55)

```
Item #: 49
Description: Submit 28-day compressive strength results for pile concrete (cast-in-place piles)
Acceptance Criteria: 28-day strength equals or exceeds specified f'c per AS 1379 compliance criteria; all samples traceable to individual piles; non-compliant results reported and investigated
Point Type: standard
Responsible Party: contractor
Evidence Required: test_result
Test Type: AS 1012.9
Notes: Section 610, Clause 606/607/608 [VERIFY]. Concrete strength verification for all cast-in-place piles.
```

```
Item #: 50
Description: Submit complete pile installation records for all piles
Acceptance Criteria: Pile log for every pile including: reference, type, dimensions, founding depth, installation date, ground conditions, driving records (driven piles), concrete volumes (bored/CFA piles), reinforcement details, any deviations
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 605/606/607/608. Comprehensive pile records are part of the quality management documentation.
```

```
Item #: 51
Description: Submit complete pile testing records and certified results
Acceptance Criteria: All test results compiled: integrity testing (PIT/CSL), load testing (static/dynamic/rapid), concrete strength, as-built survey; results certified by qualified engineer; any non-conformances documented with resolution
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: AS 2159, Section 605/606/607/608. Test results are part of the Quality Management Records required by AS 2159.
```

```
Item #: 52
Description: Submit driving records and PDA analysis reports (driven piles)
Acceptance Criteria: Complete driving records for all driven piles; PDA traces and CAPWAP analyses; restrike results where applicable; summary of achieved capacities vs design requirements; certified by qualified testing engineer
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 605. Driving records must be comprehensive and traceable. Driven piles only.
```

```
Item #: 53
Description: Submit CFA pile monitoring records and analysis (CFA piles)
Acceptance Criteria: On-board monitoring printouts for all CFA piles; concrete pressure/volume records; auger depth/rotation records; over-consumption calculations; analysis report by qualified engineer
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: null
Notes: Section 607. CFA on-board records are primary quality documentation. CFA piles only.
```

```
Item #: 54
Description: Submit as-built pile layout drawing with survey coordinates and levels
Acceptance Criteria: As-built drawing showing all pile positions (coordinates), cut-off levels, founding depths, pile types and sizes; discrepancies from design highlighted; certified by surveyor
Point Type: standard
Responsible Party: contractor
Evidence Required: document
Test Type: Survey
Notes: Section 605/606/607/608. As-built pile layout required before pile cap construction commences.
```

```
Item #: 55
Description: Superintendent final acceptance of piling works
Acceptance Criteria: All hold points released; all pile testing completed and results accepted; all non-conformances resolved; all documentation submitted and reviewed; piling works accepted for foundation/pile cap construction to commence
Point Type: hold_point
Responsible Party: superintendent
Evidence Required: document
Test Type: null
Notes: Section 605/606/607/608. Formal acceptance of piling works is required before subsequent foundation construction. This is a critical project milestone.
```

### Test Methods and Frequencies Summary

| Test | Standard | Frequency | Key Acceptance Value |
|------|----------|-----------|---------------------|
| Pile Position Survey | Survey | 100% of piles | +/-75mm at cut-off level [VERIFY] |
| Pile Verticality | Inclinometer | 100% during installation | 1 in 75 max deviation [VERIFY] |
| Set Measurement (driven) | Manual/PDA | Every driven pile | Driving resistance >= pile test load |
| PDA Dynamic Testing | ASTM D4945 / AS 2159 | Per testing program / risk rating | Ultimate capacity > design load |
| Restrike Test (driven) | ASTM D4945 / AS 2159 | Where initial set not achieved | Ultimate capacity after 24hrs min |
| PIT Integrity (low strain) | ASTM D5882 / AS 2159 | Per AS 2159 risk rating or 100% | Acceptable classification |
| CSL Integrity (bored piles) | ASTM D6760 / AS 2159 | Large diameter bored piles | No significant defects |
| Static Load Test | AS 2159 Appendix A | Per testing program | Capacity > design with safety factor |
| Concrete Slump (pile concrete) | AS 1012.3.1 | Per load at point of delivery | Per mix design (180-220mm tremie) [VERIFY] |
| Concrete Temperature | AS 1379 | Per load | 5 deg C to 35 deg C |
| Concrete Cylinders | AS 1012.9 | 1 set per 50 m3 or per pile [VERIFY] | >= f'c at 28 days |
| Stabilising Fluid (bored) | Density/viscosity/pH/sand | Before each pour | Within specified ranges |
| CFA Monitoring | On-board system | 100% of CFA piles (continuous) | Positive concrete pressure maintained |
| Concrete Volume | Calculation | Every cast-in-place pile | >= theoretical volume |

---

## Key Differences Between VicRoads (Victoria) and NSW/TMR Specifications

| Aspect | VicRoads (Victoria) | Notes |
|--------|-------------------|-------|
| Authority Term | "Superintendent" | Victoria uses "Superintendent" as the authority term |
| Concrete Spec | Section 610 (Structural Concrete) | Comprehensive 52-page specification with extensive durability provisions |
| Piling Specs | Sections 605 (Driven), 606 (Bored), 607 (CFA), 608 (Socketed) | Four separate specifications by pile type vs single spec |
| Mix Design | TN 113 review and registration process | 4 weeks minimum lead time; 8-12 weeks recommended |
| AAR Testing | RC 376.03/376.04 | VicRoads-specific test methods for alkali-silica reactivity |
| AAR Limit | 2.8 kg/m3 Na2O equiv | Specific alkali limit for concrete mixes |
| Curing | Clause 610.23 | Focus on evaporative moisture loss minimisation |
| Temperature | 20 deg C max differential | Mass concrete temperature differential limit |
| Crack Limits | 0.1mm for precast prestressed | Permissible crack widths per Section 610 |
| Testing Standards | AS 1012 series, RC 376, RC 500 | Mix of Australian Standards and VicRoads RC test methods |
| Bridge Design | AS 5100 (100-year design life) | VicRoads supplements AS 5100 with Bridge Technical Notes |

## Summary of Hold Points by Template

### Template 9: Structural Concrete - Hold Points
1. Mix design approval (Item 1)
2. Trial mix results (Item 4)
3. SCC mix design (Item 5, where applicable)
4. Formwork design (Item 7)
5. Falsework design (Item 8)
6. Concrete cover verification (Item 17)
7. Pre-pour combined inspection (Item 21)
8. Reinforcement inspection complete (Item 22)
9. Formwork stripping approval (Item 44)
10. PT concrete strength for stressing (Item 47)
11. Final acceptance (Item 58)

### Template 10: Reinforcement Placement - Hold Points
1. Bar schedule approval (Item 1)
2. Material certificates (Item 2)
3. Stainless steel certificates (Item 3, where applicable)
4. Coupler type-test certificates (Item 4, where applicable)
5. Welding procedure (Item 5, where applicable)
6. Concrete cover verification (Item 12)
7. Final reinforcement inspection (Item 22)
8. Post-tensioning results (Item 24, where applicable)

### Template 15: Piling - Hold Points
1. Method statement (Item 1)
2. Pile design (Item 2)
3. Geotechnical report (Item 3)
4. Pile concrete mix design (Item 4)
5. Reinforcement cage details (Item 5)
6. Precast pile certificates (Item 6, driven only)
7. Testing program (Item 8)
8. Cage inspection before lowering (Item 18)
9. Restrike test (Item 24, driven only)
10. Bore inspection and founding (Item 29, bored only)
11. Rock socket test holes (Item 30, bored in rock only)
12. Integrity test results submission (Item 43)
13. Static load test (Item 44)
14. Defective pile resolution (Item 47)
15. Final acceptance (Item 55)

---

## Sources

- [VicRoads Standard Documents - 610 Structural Concrete](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/9D7325ADAD6BB912CA25851200151FF5?OpenDocument=)
- [VicRoads Standard Documents - 611 Steel Reinforcement](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/5442564D9F270A68CA2583460002C2E0)
- [VicRoads Standard Documents - 605 Driven Piles](http://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/E68B60359362BD95CA257FEE0010141B/$File/Sec605.doc)
- [VicRoads Standard Documents - 606 Bored Cast-In-Place Piles](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/AEB01C4EDB9C2BDECA258153000673CB)
- [VicRoads Standard Documents - 607 CFA Piles](https://webapps.vicroads.vic.gov.au/VRNE/csdspeci.nsf/webscdocs/2537B377845340FDCA25771B0025DD19/$File/Sec607.doc)
- [VicRoads TN 113 - Concrete Mix Design Review and Registration](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/technical-notes/technical-note-tn-113-concrete-mix-design_-review-and-registration-guidelines.ashx)
- [VicRoads TN 038 - Cracks in Concrete](https://www.studocu.com/en-au/document/royal-melbourne-institute-of-technology/engineering-methods/vicroads-technical-note-tn-038-cracks-in-concrete/6803504)
- [VicRoads Contract Documents Portal](https://webapps.vicroads.vic.gov.au/vrne/csdspeci.nsf/)
- [VicRoads Bridges & Structures Technical Documents](https://www.vicroads.vic.gov.au/business-and-industry/technical-publications/bridges-and-structures)
- [VicRoads Engineering Standards Index](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/accepted-safety-barrier-products/idx-std-0001-engineering-standards-index--01052024.ashx)
- [Tasmania Specification Listings (600 Series based on VicRoads)](https://www.transport.tas.gov.au/roadworks/contractor_and_industry_information/specification_listings_-_standard_sections)
- [BTN 023 - AS 5100 Part 3: Foundation and Soil-Supporting Structures](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/bridge-technical-notes/bridge-technical-note-2023_023-as5100-part-3-v20-july-2023.ashx)
- [BTN 025 - AS 5100 Part 5: Concrete](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/bridge-technical-notes/bridge-technical-note-2022_025-as5100-part-5-v21-concrete.ashx)
- [Wyndham City Council - Section 610 Structural Concrete](https://www.wyndham.vic.gov.au/sites/default/files/2021-11/Technical%20Specification%20Section%20610%20-%20Structural%20Concrete.pdf)
- [VicRoads RC 376.03 - Alkali-Silica Reactivity Test Method](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/test-methods/test-method-rc-37603--potential-alkalisilica-reactivity-accelerated-mortar-bar-test.ashx)
- [VicRoads RC 500.16 - Selection of Test Methods](https://www.vicroads.vic.gov.au/-/media/files/technical-documents-new/codes-of-practice-rc500/code-of-practice-rc-50016-selection-of-test-methods-for-testing-of-materials-and-work-july-2018.ashx)
- [AS 5100.5 Durability Provisions Conference Paper](http://www.ciaconference.com.au/concrete2021/pdf/full-paper_152.pdf)
- [Concrete Cover - Conference Paper](https://www.ciaconference.com.au/concrete2021/pdf/full-paper_74.pdf)
- [AS 2159 Piling - Design and Installation (StudyLib)](https://studylib.net/doc/27780665/as-2159-2009-piling---design-and-installation)
- [VPA Construction Framework](https://www.vpa.vic.gov.au/wp-content/uploads/2016/07/PART-D-Engineering-Design-and-Construction-Manual-FINAL-DRAFT-PDF-version-April-2011.pdf)
