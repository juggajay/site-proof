/**
 * Seed Script: VIC (VicRoads) ITP Templates - Structures
 *
 * Creates global ITP templates for VIC structural activities.
 * Templates: Structural Concrete (Sec 610/614), Reinforcement (Sec 611),
 *            Piling (Sec 605-608), Steelwork (Sec 630), Bearings (Sec 656),
 *            Precast (Sec 620), Post-Tensioning (Sec 612), Waterproofing (Sec 691)
 *
 * Run with: node scripts/seed-itp-templates-vic-structures.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// 1. STRUCTURAL CONCRETE (Sec 610/614)
// =============================================================================

const vicStructuralConcreteTemplate = {
  name: 'VIC Structural Concrete (Sec 610/614)',
  description: 'VicRoads structural concrete for bridges, culverts, and retaining structures per Section 610 (Structural Concrete) and Section 614 (Formwork). Covers mix design registration, formwork, placement, curing, and strength acceptance for 100-year design life bridges.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 610 (Structural Concrete) v18 (Feb 2020), Section 614 (Formwork)',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-12)
    // =========================================================================
    {
      description: 'Submit concrete mix design for review, approval and registration',
      acceptanceCriteria: 'Submission minimum 4 weeks (recommended 8-12 weeks) prior to concrete placement; includes product code, batch plant designation, supplier name, and all supporting test data per TN 113',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'VicRoads TN 113',
      notes: 'Clause 610.07. Concrete must NOT be placed until mix design reviewed and approved. Supporting test data must not be greater than 12 months old.'
    },
    {
      description: 'Verify concrete grade, class and designation matches design drawings and exposure classification',
      acceptanceCriteria: 'Concrete grade, exposure classification (A1, A2, B1, B2, C1, C2, U per AS 5100.5) and designation as shown on drawings; minimum compressive strength per Table 610.051',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 610.05. Durability requirements per AS 5100.5 Table 4.14.3.2. Design life for bridges is 100 years.'
    },
    {
      description: 'Submit alkali aggregate reactivity (AAR) test results for coarse and fine aggregates',
      acceptanceCriteria: 'Alkali content in concrete mix not to exceed 2.8 kg/m3 (Na2O equiv); aggregate reactivity determined per VicRoads RC 376.03 (accelerated mortar bar) or RC 376.04 (concrete prism); testing on minimum 3-yearly basis',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'VicRoads RC 376.03 / RC 376.04',
      notes: 'Clause 610.07. AAR provisions introduced 1996, upgraded 2013.'
    },
    {
      description: 'Submit trial mix test results demonstrating compliance with specified properties',
      acceptanceCriteria: 'Trial mix in accordance with AS 1012.2; results for compressive strength, slump, drying shrinkage and all specified properties within limits; conditional registration valid for 8 weeks pending full data',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.2',
      notes: 'Clause 610.07, TN 113. All outstanding data must be submitted within 8 weeks or conditional approval cancelled and mix deregistered.'
    },
    {
      description: 'Submit Self Compacting Concrete (SCC) mix design with rheological data (if applicable)',
      acceptanceCriteria: 'SCC mix demonstrates flow and self-compaction properties; slump flow, T500 time and J-ring passing ability per AS 1012.3.5; proportions of cementitious materials, aggregates, fine materials, water and admixtures documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.5',
      notes: 'Clause 610.07, TN 073. Only required where SCC specified.'
    },
    {
      description: 'Submit concrete supply and placement methodology including pour sequence, access, delivery rates and contingencies',
      acceptanceCriteria: 'Methodology addresses method of placement, concrete cover to reinforcement, spacing of reinforcement, element geometry; identifies batch plant and stand-by mixing plant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 610.07. Mix design must be appropriate for the method of placement and element.'
    },
    {
      description: 'Submit formwork design and drawings for review',
      acceptanceCriteria: 'Formwork designed in accordance with AS 3610.1:2018; surface finish class specified (Class 1-5); drawings show dimensions, supports, stripping sequence; certified by competent person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 614 / AS 3610.1. Formwork design must account for all loading conditions including concrete pressure, construction loads.'
    },
    {
      description: 'Submit falsework design and drawings for review (where applicable)',
      acceptanceCriteria: 'Falsework designed in accordance with Section 613 and AS 3610; independently checked; certified by qualified structural engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 613. Required for all elevated structural concrete elements. Must account for all construction stage loadings.'
    },
    {
      description: 'Submit curing methodology including materials, methods and monitoring procedures',
      acceptanceCriteria: 'Curing method complies with Clause 610.23; describes membrane curing compound type, water curing method, or combination; includes temperature monitoring plan for mass concrete; addresses wind/temperature protection measures',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 610.23. Practical on-site curing requirements based on minimisation of evaporative moisture losses from all freshly placed concrete.'
    },
    {
      description: 'Verify concrete supplier registration and batch plant compliance',
      acceptanceCriteria: 'Supplier registered in accordance with VicRoads requirements; batch plant meets AS 1379; NATA-accredited testing facilities',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 1379, TN 113. Batch plant and stand-by plant both require registration.'
    },
    {
      description: 'Submit material certificates for all cementitious materials and admixtures',
      acceptanceCriteria: 'Certificates current and demonstrating compliance with AS 3972 (supplementary cementitious materials), AS 1478 (admixtures); blended cement composition documented where alternative to OPC',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 610.05/610.06. Supplementary cementitious materials (SCMs) - moderate replacement for A/B1, moderately higher for B2, higher for C1/C2.'
    },
    {
      description: 'Submit concrete placement notification minimum 24 hours before pour',
      acceptanceCriteria: 'Written notification to Superintendent with pour details including: element description, volume, start time, estimated duration, mix design reference, pump/placement method',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement. Superintendent given opportunity to attend all concrete placements.'
    },
    // =========================================================================
    // FORMWORK INSPECTION (Items 13-20)
    // =========================================================================
    {
      description: 'Inspect formwork alignment, dimensions and stability prior to reinforcement placement',
      acceptanceCriteria: 'Formwork dimensions within tolerances per AS 3610.1; clean, free of debris; release agent applied; construction joints prepared; no gaps or misalignment at joints',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 614. Formwork must be checked before reinforcement placement commences.'
    },
    {
      description: 'Survey formwork dimensions and verify compliance with design drawings',
      acceptanceCriteria: 'Dimensional tolerances per Section 610 and AS 3610.1; position tolerance typically +/-5mm for critical dimensions; levels within specified tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'Section 610/614. Dimensions outside allowable tolerance limits can have adverse structural consequences and reduce concrete cover.'
    },
    {
      description: 'Verify surface finish class of formwork meets specification requirements',
      acceptanceCriteria: 'Formwork surface condition matches specified finish class per AS 3610.1 (Class 1: highest quality; Class 2: excellent quality with uniform texture; Class 3: good visual quality); plywood grade appropriate for class',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 614 / AS 3610.1. Surface finish classes defined by visual characteristics and tolerance requirements.'
    },
    {
      description: 'Inspect formwork for embedded items, blockouts, cast-in accessories',
      acceptanceCriteria: 'All embedments, blockouts, holding-down bolts, drainage provisions, bearing plates and cast-in items correctly located and secured per drawings; will not be displaced during concrete placement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 610. Embedments must be checked before pour approval.'
    },
    {
      description: 'Verify formwork provides required concrete cover to all reinforcement',
      acceptanceCriteria: 'Minimum cover per AS 5100.5 for specified exposure classification; cover tolerance per AS 5100.5 Clause 4.14.3.2; where curing compounds used, increase cover by 5mm for A/B1 or 10mm for B2/C1/C2',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Cover meter / physical measurement',
      notes: 'Clause 610.05. Cover is the primary durability measure. Inadequate cover reduces long-term durability. Bridge design life is 100 years.'
    },
    {
      description: 'Check formwork supports, props and bracing for structural adequacy',
      acceptanceCriteria: 'Supports installed per approved formwork/falsework design; bearing on adequate foundation; lateral bracing complete; no overstressed members',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Sections 613/614. Falsework/formwork must be stable under all loading conditions.'
    },
    {
      description: 'Inspect construction joints for correct preparation and position',
      acceptanceCriteria: 'Construction joints located as shown on drawings or as approved; previous concrete surface roughened, clean and saturated surface dry (SSD); bonding agent applied if specified; waterstops correctly positioned',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.19. Construction joint preparation is critical for structural integrity and waterproofing.'
    },
    {
      description: 'Confirm formwork is water-tight and ready for concrete placement',
      acceptanceCriteria: 'No gaps permitting grout loss; joints sealed; clean and free of debris, water, ice and deleterious materials; release agent applied but not contaminating reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 610/614. Final check before pre-pour hold point.'
    },
    // =========================================================================
    // PRE-POUR INSPECTION (Items 21-27)
    // =========================================================================
    {
      description: 'Complete pre-pour inspection of formwork, reinforcement and embedments (combined hold point)',
      acceptanceCriteria: 'All formwork, reinforcement, post-tensioning ducts, embedments, blockouts and cast-in items inspected and approved; concrete cover verified; construction joints prepared; Superintendent formally releases hold point',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 610. This is the principal hold point for concrete placement. Work must not proceed beyond this hold point without inspection and approval by the Superintendent.'
    },
    {
      description: 'Verify all reinforcement inspection items complete (cross-reference to Template 10)',
      acceptanceCriteria: 'All items from Reinforcement Placement ITP (Template 10) signed off; bar schedule checked; cover confirmed; lapping verified; mechanical couplers tested; welding inspected if applicable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 611. Reinforcement must be fully inspected before concrete placement approval.'
    },
    {
      description: 'Confirm concrete delivery access, pump setup and placement equipment ready',
      acceptanceCriteria: 'Pump reach adequate for all parts of pour; delivery route confirmed; sufficient capacity for planned pour rate; vibration equipment available and spare units on site; contingency plans documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.07. Equipment must be appropriate for the element and pour methodology.'
    },
    {
      description: 'Verify weather conditions suitable for concrete placement',
      acceptanceCriteria: 'Ambient temperature between 5 deg C and 35 deg C per AS 1379; wind speed acceptable for curing; no rain forecast during critical curing period; hot/cold weather precautions implemented where applicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Temperature measurement',
      notes: 'AS 1379, Clause 610.23. Concrete temperature at delivery must be 5-35 deg C.'
    },
    {
      description: 'Confirm mass concrete temperature management plan (for elements over 600mm thick)',
      acceptanceCriteria: 'Temperature monitoring system in place; thermocouple locations per plan; maximum temperature differential within element not to exceed 20 deg C; cooling measures documented',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Thermocouple monitoring',
      notes: 'Clause 610.23. Temperature differentials exceeding 20 deg C require precautions. Mass concrete definition per Section 610.'
    },
    {
      description: 'Confirm pre-pour meeting completed with all parties',
      acceptanceCriteria: 'Meeting conducted with relevant personnel; pour methodology reviewed; responsibilities confirmed; quality requirements communicated; emergency procedures established',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Good practice requirement. Attendance records and minutes maintained.'
    },
    {
      description: 'Confirm concrete mix design registration current and approved for this element',
      acceptanceCriteria: 'Mix design registration current (not expired or cancelled); appropriate for exposure classification of element; product code matches approved submission',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TN 113. Registration can be cancelled if outstanding data not provided within 8 weeks.'
    },
    // =========================================================================
    // CONCRETE PLACEMENT (Items 28-40)
    // =========================================================================
    {
      description: 'Verify concrete delivery docket information on arrival',
      acceptanceCriteria: 'Delivery docket shows: mix design product code, batch plant, batch time, truck number, load volume, water added, admixtures, slump target; traceability maintained for all deliveries per AS 1379',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 1379, Clause 610.15. Traceability applies to all deliveries. Location of placed concrete must be traceable at all times.'
    },
    {
      description: 'Conduct slump test on concrete at point of delivery',
      acceptanceCriteria: 'Slump within nominated range on delivery docket (+/-15mm for slump up to 80mm; +/-25mm for slump 80-150mm per AS 1379); or slump flow for SCC per AS 1012.3.5',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (Slump) / AS 1012.3.5 (SCC Slump Flow)',
      notes: 'Clause 610.15. Test first load and then per sampling frequency. Reject loads outside tolerance.'
    },
    {
      description: 'Measure concrete temperature at point of delivery',
      acceptanceCriteria: 'Temperature between 5 deg C and 35 deg C per AS 1379; recorded on delivery test form',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8',
      notes: 'Clause 610.15. Concrete outside temperature range must not be placed without specific approval.'
    },
    {
      description: 'Conduct SCC slump flow, T500 and J-ring tests (where SCC specified)',
      acceptanceCriteria: 'Slump flow retention, T500 time (viscosity measure) and J-ring passing ability within specified limits; testing at minimum hourly intervals throughout placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.5',
      notes: 'Clause 610.15, TN 073. Hourly testing minimum for SCC properties.'
    },
    {
      description: 'Take concrete test specimens (cylinders) for compressive strength testing',
      acceptanceCriteria: 'Minimum 1 set of 3 specimens per 50 m3 or per day (whichever is more frequent); cylinders moulded per AS 1012.8; cured per AS 1012.8 (standard curing); identified and traceable to delivery and placement location',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.1 (Sampling) / AS 1012.8 (Making and Curing)',
      notes: 'Clause 610.17. Minimum 2 cylinders per sample for prestressed post-tensioned concrete tested prior to stressing.'
    },
    {
      description: 'Monitor concrete placement to ensure no segregation, excessive free-fall or displacement of reinforcement',
      acceptanceCriteria: 'Free-fall height does not exceed 1.5m (or as specified); concrete placed in layers not exceeding 600mm; no segregation evident; reinforcement and embedments not displaced',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.18. Concrete placement methodology per approved method statement.'
    },
    {
      description: 'Monitor concrete vibration/compaction during placement',
      acceptanceCriteria: 'Internal (immersion) vibrators used correctly; vibrator immersed to penetrate into previous layer; systematic insertion pattern; no over-vibration causing segregation; vibration duration adequate for full compaction without excessive working',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.18. Vibration is critical for achieving dense, durable concrete.'
    },
    {
      description: 'Monitor pour rate and delivery continuity',
      acceptanceCriteria: 'Continuous placement without cold joints; planned pour rate maintained; concrete placed within specified time limit from batching (typically 90 minutes for conventional concrete per AS 1379)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 1379, Clause 610.18. Delivery time critical for workability and set properties.'
    },
    {
      description: 'Monitor concrete temperature differential during placement (mass concrete)',
      acceptanceCriteria: 'Temperature differential within concrete element does not exceed 20 deg C; thermocouples functioning and recording; cooling measures activated if threshold approached',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Thermocouple monitoring',
      notes: 'Clause 610.23. Continuous monitoring required for mass concrete elements.'
    },
    {
      description: 'Finish and level concrete surfaces to specified requirements',
      acceptanceCriteria: 'Surface finish as specified (trowelled, broom, or other); surface levels within tolerance; no ponding areas; adequate falls where specified for drainage; surface regularity per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Straightedge / Survey',
      notes: 'Clause 610.20. Surface finish requirements depend on the element and its function.'
    },
    {
      description: 'Apply initial curing protection immediately after finishing',
      acceptanceCriteria: 'Curing commenced immediately after concrete finishing; initial evaporative protection applied (spray, cover, or curing compound); surfaces protected from wind, sun and rain impact; curing compound applied per manufacturer recommendations where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.23. Practical on-site curing based on minimisation of evaporative moisture losses from all freshly placed and unprotected concrete.'
    },
    {
      description: 'Record concrete placement details including volumes, times, weather, test results',
      acceptanceCriteria: 'Concrete pour record completed showing: element reference, start/finish times, ambient temperature, concrete temperature, total volume placed, delivery docket numbers, test specimen numbers, any non-conformances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 610. Documentation must ensure full traceability of placed concrete at all times.'
    },
    {
      description: 'Inspect concrete surface immediately after pour completion for defects',
      acceptanceCriteria: 'No honeycombing, surface voids, excessive bleed water, or visible defects; surface finish consistent with specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.20. Early identification of defects allows timely repair.'
    },
    // =========================================================================
    // POST-PLACEMENT / CURING (Items 41-50)
    // =========================================================================
    {
      description: 'Maintain curing regime for specified minimum period',
      acceptanceCriteria: 'Minimum curing period per Clause 610.23 - typically 7 days for OPC, 14 days for blended cement; continuous moisture retention maintained; curing membrane compound or water curing as approved; wind/temperature protection maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 610.23. Curing is the primary mechanism for achieving dense, impermeable cover concrete for long-term durability.'
    },
    {
      description: 'Monitor curing temperature and conditions throughout curing period',
      acceptanceCriteria: 'Temperature differential within element not exceeding 20 deg C; ambient conditions within acceptable range; curing membrane intact and not damaged; water curing maintaining continuous moisture',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Temperature monitoring',
      notes: 'Clause 610.23. Temperature monitoring required for mass concrete throughout entire curing period.'
    },
    {
      description: 'Test compressive strength of concrete cylinders at 7 days (early age)',
      acceptanceCriteria: '7-day compressive strength results consistent with expected strength gain for the mix design; results recorded and any trends identified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 610.17. Early age results used to monitor strength gain trend. Not typically used for acceptance.'
    },
    {
      description: 'Obtain Superintendent approval before formwork stripping (soffit forms for beams/slabs)',
      acceptanceCriteria: 'Minimum concrete strength achieved before removal of load-bearing formwork; strength demonstrated by cylinder test results or maturity method; stripping sequence per approved methodology',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 610.22, Section 614. Formwork removal times must not compromise structural integrity or durability. Soffit forms and props for beams/slabs require strength verification.'
    },
    {
      description: 'Strip non-load-bearing (side) formwork at appropriate time',
      acceptanceCriteria: 'Minimum time elapsed per specification before side formwork removal; concrete surfaces not damaged during removal; surfaces protected from rapid moisture loss after stripping',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 610/614. Side formwork can typically be removed earlier than soffit formwork. Resume curing after stripping.'
    },
    {
      description: 'Test compressive strength of concrete cylinders at 28 days (acceptance)',
      acceptanceCriteria: '28-day compressive strength equals or exceeds specified characteristic strength (f\'c) per AS 1379 compliance criteria; assessment per AS 1379 Section 6',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 610.17. 28-day results are the primary acceptance criterion for concrete strength. Non-compliant results require investigation and potential remedial action.'
    },
    {
      description: 'Test compressive strength at time of stressing (post-tensioned concrete)',
      acceptanceCriteria: 'Minimum of 2 cylinders per sample tested prior to application of post-tensioning force; compressive strength at time of stressing equals or exceeds specified minimum; cylinders cured per AS 1012',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 610.17. Post-tensioning must not proceed until specified concrete strength is achieved and verified by cylinder testing.'
    },
    {
      description: 'Inspect concrete surfaces after formwork removal for defects and crack assessment',
      acceptanceCriteria: 'No structural defects; crack widths within permissible limits per Section 610 (0.1mm for precast prestressed elements, per AS 5100.5 for reinforced elements); honeycombing and surface defects documented and repaired per approved method',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Crack width gauge',
      notes: 'Clause 610.24, TN 038. VicRoads TN 038 provides guidance on crack assessment. Repair methods per TN 072 (Cementitious Repair of Concrete Structures).'
    },
    {
      description: 'Survey completed concrete element dimensions and levels',
      acceptanceCriteria: 'All dimensions within specified tolerances per Section 610; levels within tolerance; alignment within tolerance; cover verified by cover meter survey',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / Cover meter',
      notes: 'Clause 610.24. Dimensional non-compliance may have structural and durability consequences.'
    },
    {
      description: 'Compile and submit concrete quality records to Superintendent',
      acceptanceCriteria: 'Complete record package including: mix design registration, delivery dockets, slump/temperature records, cylinder test results (7-day and 28-day), curing records, temperature monitoring data, non-conformance reports, formwork stripping records, dimensional survey',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 610. Full documentation package required for each concrete element. Records must demonstrate traceability of all concrete placed.'
    },
    // =========================================================================
    // DOCUMENTATION / COMPLETION (Items 51-58)
    // =========================================================================
    {
      description: 'Submit 56-day or 90-day compressive strength results (where specified for high-performance concrete)',
      acceptanceCriteria: 'Later-age compressive strength meets specified requirements where longer-term strength is a design criterion (e.g., high-performance or blended cement concretes)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 610.17. May be specified for certain exposure classifications or special concrete mixes.'
    },
    {
      description: 'Submit drying shrinkage test results (where specified)',
      acceptanceCriteria: 'Drying shrinkage within specified limits per mix design registration; test results within 8 weeks of conditional registration',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.13',
      notes: 'TN 113. Drying shrinkage testing may take several weeks. Part of conditional registration requirements.'
    },
    {
      description: 'Submit concrete durability test results (where specified for marine/saline environments)',
      acceptanceCriteria: 'Durability test results per VicRoads TN 089 and TN 097; resistivity, sorptivity, chloride diffusion or other durability indicators within specified limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'VicRoads TN 089 test methods',
      notes: 'TN 089, TN 097. Required for marine/saline exposure environments. Test methods per TN 089.'
    },
    {
      description: 'Complete and document any concrete repairs using approved methods',
      acceptanceCriteria: 'Repair method approved by Superintendent; repair material compatible with parent concrete; curing of repair material per approved method; final inspection confirms repair is acceptable; documented per TN 072',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TN 072 (Cementitious Repair), TN 087 (Crack Repair per Section 687/689). All repairs must be documented.'
    },
    {
      description: 'Verify concrete cover by electromagnetic cover meter survey on completed structure',
      acceptanceCriteria: 'Cover measurements confirm design cover achieved within tolerance at all survey points; deficient areas identified and addressed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Electromagnetic cover meter',
      notes: 'Section 610. Cover survey confirms the as-built cover matches design requirements for long-term durability.'
    },
    {
      description: 'Assess and document crack mapping on completed structure',
      acceptanceCriteria: 'All visible cracks mapped, measured and recorded; crack widths assessed against permissible limits; structural significance evaluated; monitoring or repair recommendations documented per TN 038',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Crack width gauge / mapping',
      notes: 'TN 038. All concrete is susceptible to cracking. Systematic assessment required for acceptance.'
    },
    {
      description: 'Complete as-built survey and documentation',
      acceptanceCriteria: 'As-built survey demonstrates compliance with design dimensions; all variations documented; as-built drawings updated; quality records archived',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey',
      notes: 'Section 610. Final documentation package for the completed structure.'
    },
    {
      description: 'Superintendent final acceptance of structural concrete element',
      acceptanceCriteria: 'All hold points released; all test results compliant; all non-conformances resolved; all documentation complete and submitted; structure accepted for next stage of works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 610. Formal acceptance before subsequent works can commence on or adjacent to the element.'
    }
  ]
}

// =============================================================================
// 2. REINFORCEMENT PLACEMENT (Sec 611)
// =============================================================================

const vicReinforcementTemplate = {
  name: 'VIC Reinforcement Placement (Sec 611)',
  description: 'VicRoads reinforcement placement for structural concrete elements per Section 611 (Steel Reinforcement). Covers material certification, bar schedule review, fixing inspection, cover verification, and mechanical coupler/welding requirements.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 611 (Steel Reinforcement) v8 (Jan 2021)',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-8)
    // =========================================================================
    {
      description: 'Submit bar schedule and bending details for Superintendent review',
      acceptanceCriteria: 'Bar schedule complies with drawings; all bar marks, sizes, shapes, lengths and quantities listed; bending dimensions per AS 3600 or AS 5100.5; schedule prepared by competent person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 611.03. Bar schedule must be reviewed and approved before materials are ordered or fabricated.'
    },
    {
      description: 'Submit material certificates for reinforcing steel',
      acceptanceCriteria: 'Steel reinforcement complies with AS/NZS 4671; certificates show grade (typically 500N for deformed bars, 500L for mesh), yield strength, tensile strength, ductility class; certificates traceable to heat/batch number',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4671',
      notes: 'Clause 611.02. Material must be from an approved source with current certification. Grade 500N (normal ductility) is standard for bridge reinforcement.'
    },
    {
      description: 'Submit material certificates for stainless steel reinforcement (where specified)',
      acceptanceCriteria: 'Stainless steel reinforcement grade and composition per specification; mechanical properties meet requirements; material traceable to source',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 611. Stainless steel may be specified in aggressive exposure environments (C1, C2, U).'
    },
    {
      description: 'Submit mechanical coupler type-test certificates and installation procedure (where couplers specified)',
      acceptanceCriteria: 'Couplers type-tested in accordance with relevant standard; demonstrate minimum strength equal to 100% of characteristic yield strength of reinforcement; installation procedure documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 611.06. Mechanical couplers must be type-tested and approved before use on site.'
    },
    {
      description: 'Submit welding procedure specification (WPS) and welder qualifications (where welding specified)',
      acceptanceCriteria: 'WPS qualified per AS/NZS 1554.3 (Structural Steel Welding - Welding of Reinforcing Steel); welders hold current qualifications for the specified weld type; procedure approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1554.3',
      notes: 'Clause 611.07. Welding of reinforcement requires specific qualification. Not all reinforcement grades are readily weldable.'
    },
    {
      description: 'Submit reinforcement fixing methodology including spacer types and installation details',
      acceptanceCriteria: 'Methodology addresses fixing method, bar support systems, spacer type and size for required cover, tie wire type, access arrangements; spacers appropriate for exposure classification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 611.05. Spacer type must be compatible with concrete exposure classification - plastic/cementitious spacers for exposed faces.'
    },
    {
      description: 'Submit post-tensioning system details and stressing calculations (where applicable)',
      acceptanceCriteria: 'PT system type approved; tendon profile per drawings; stressing sequence documented; elongation calculations provided; friction and wobble coefficients documented; anchorage details per manufacturer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Required only for post-tensioned elements. Cross-reference to Post-Tensioning specification.'
    },
    {
      description: 'Verify reinforcement storage and protection on site',
      acceptanceCriteria: 'Reinforcement stored off ground on supports; protected from weather, contamination and damage; identified by bar mark and size; different grades/types clearly separated; no excessive rust, oil or other deleterious coating',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 611.04. Contaminated or damaged reinforcement must not be placed.'
    },
    // =========================================================================
    // REINFORCEMENT FIXING (Items 9-22)
    // =========================================================================
    {
      description: 'Verify reinforcement bar sizes, grade and marks match approved bar schedule',
      acceptanceCriteria: 'All bar sizes correct per schedule; grade identification marks visible (500N, 500L); bar marks correspond to schedule; material certificates traceable to delivered reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 611.04. Physical verification against bar schedule before fixing commences.'
    },
    {
      description: 'Verify bar bending dimensions and shapes comply with schedule and standards',
      acceptanceCriteria: 'Bending dimensions within tolerances per AS 3600/AS 5100.5; minimum bend diameters per AS/NZS 4671 (typically 5d for fitments, larger for main bars); no cracks or damage from bending',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.03. Minimum bend diameters depend on bar size and purpose.'
    },
    {
      description: 'Inspect reinforcement placement position and spacing against drawings',
      acceptanceCriteria: 'Bars positioned per drawings; spacing within tolerance (+/-5mm typically); clear spacing between bars sufficient for concrete placement and compaction; maximum aggregate size considered',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.05. Bar spacing must allow adequate concrete flow and compaction.'
    },
    {
      description: 'Verify concrete cover to reinforcement meets design requirements',
      acceptanceCriteria: 'Cover measured and confirmed at multiple points; minimum cover per AS 5100.5 for exposure classification (e.g., 40mm for B1, 45mm for B2, 50mm for C1, 65mm for C2); spacers correctly positioned and at adequate frequency',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Physical measurement / cover meter',
      notes: 'Clause 611.05, Section 610. Cover is the primary durability mechanism. Inadequate cover compromises the 100-year design life. Additional 5mm cover for A/B1 or 10mm for B2+ where curing compounds used.'
    },
    {
      description: 'Verify spacer type, size and frequency of installation',
      acceptanceCriteria: 'Spacers provide correct cover; material appropriate for exposure classification (concrete/plastic spacers on exposed faces, no steel wire spacers on exposed faces); spacing between spacers adequate to prevent bar sag (typically max 1m centres)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 611.05. Spacers directly influence as-built cover. Steel wire supports may create corrosion paths on exposed surfaces.'
    },
    {
      description: 'Inspect lap splice locations and lengths',
      acceptanceCriteria: 'Lap locations per drawings (typically staggered, not more than 50% of bars lapped at one section); lap length per AS 5100.5 design requirements; laps tied at both ends and centre; no laps in high stress zones unless shown on drawings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.06. Lap length depends on bar size, concrete strength, cover and confinement.'
    },
    {
      description: 'Inspect mechanical coupler installations (where used)',
      acceptanceCriteria: 'Couplers installed per approved procedure; bar fully inserted to required depth (witness marks verified); torque applied to specification (where applicable); visual inspection confirms correct installation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Torque wrench (where applicable)',
      notes: 'Clause 611.06. Every coupler should be inspected. Defective couplers must be replaced.'
    },
    {
      description: 'Inspect reinforcement welding (where specified)',
      acceptanceCriteria: 'Welds per qualified WPS; visual inspection per AS/NZS 1554.3; no cracks, porosity, undercut or other defects; NDT where specified; welder holds current qualification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual / NDT per specification',
      notes: 'Clause 611.07. Welding reinforcement is not common in bridge construction but may be required for specific connections.'
    },
    {
      description: 'Inspect tie wire fixings for security of reinforcement cage',
      acceptanceCriteria: 'All intersections tied (or as specified for the element); tie wire does not reduce cover; cage rigid and stable; will not displace during concrete placement; wire ends turned inward (not protruding into cover zone)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 611.05. Cage stability is critical during concrete placement, especially for tall elements or pump-placed concrete.'
    },
    {
      description: 'Inspect fitments (stirrups/ligatures) for correct size, spacing and anchorage',
      acceptanceCriteria: 'Fitment size and spacing per drawings; hook lengths and bends per AS 5100.5; hooks oriented correctly; stirrups engaging longitudinal bars at all corners',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.05. Fitments provide shear resistance and confinement. Correct installation is critical for structural performance.'
    },
    {
      description: 'Inspect post-tensioning ducts/tendons for correct profile and fixing (where applicable)',
      acceptanceCriteria: 'Duct profile matches drawings; ducts fixed at specified intervals to prevent displacement during concrete placement; duct joints sealed; anchorage components correctly positioned; vents and grout connections installed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Section 612. PT ducts must be inspected as part of the pre-pour reinforcement inspection. Profile accuracy directly affects structural performance.'
    },
    {
      description: 'Verify reinforcement cleanliness before concrete placement',
      acceptanceCriteria: 'Reinforcement free from loose rust, oil, grease, form release agent, paint, mud and other contaminants that could impair bond; light mill scale acceptable; firmly adhered rust acceptable if not scaled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 611.04. Contaminants impair bond between reinforcement and concrete.'
    },
    {
      description: 'Check clearance between reinforcement layers for concrete placement',
      acceptanceCriteria: 'Clear distance between bars sufficient for concrete placement and compaction; minimum clear spacing per AS 5100.5 (typically 1.5 x maximum aggregate size or bar diameter, whichever is greater)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.05. Insufficient spacing leads to honeycombing and inadequate compaction.'
    },
    {
      description: 'Final reinforcement inspection and hold point release',
      acceptanceCriteria: 'All reinforcement items inspected and compliant; cover confirmed; bar schedule verified; laps and couplers checked; cage stable and clean; Superintendent releases hold point for concrete placement',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 611 / Section 610. This hold point must be released before concrete placement can commence. Cross-reference to Template 9 Item 21.'
    },
    // =========================================================================
    // POST-POUR REINFORCEMENT ITEMS (Items 23-28)
    // =========================================================================
    {
      description: 'Verify protruding reinforcement (starter bars, continuity bars) for next stage',
      acceptanceCriteria: 'Starter bars at correct position, size and length for next pour stage; protected from damage; cover to adjacent faces maintained; projection length correct for lap requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Clause 611.05. Starter bar position must be checked before formwork for subsequent pour stages.'
    },
    {
      description: 'Conduct post-stressing inspection of post-tensioned tendons (where applicable)',
      acceptanceCriteria: 'Elongation measurements within 5% of calculated values; stressing force verified by jack pressure gauge and elongation; wedge seating losses within expected range; lock-off force recorded',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Stressing equipment / elongation measurement',
      notes: 'Section 612. Post-tensioning results are critical for structural performance verification.'
    },
    {
      description: 'Inspect grouting of post-tensioned ducts (where applicable)',
      acceptanceCriteria: 'Grouting commenced within specified time after stressing; grout mix per approved design; grouting continuous until clean grout flows from vents; all vents sealed; grout caps installed at anchorages',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Complete grouting is essential for durability and corrosion protection of tendons.'
    },
    {
      description: 'Verify cover meter survey results on completed element',
      acceptanceCriteria: 'Electromagnetic cover meter survey confirms design cover achieved at all survey points; results within tolerance; any deficient areas identified for assessment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Electromagnetic cover meter',
      notes: 'Clause 611.05, Section 610. Post-pour verification of as-built cover confirms quality of reinforcement fixing.'
    },
    {
      description: 'Submit reinforcement quality records including material certificates and inspection checklists',
      acceptanceCriteria: 'Complete documentation including: material certificates (traceable to AS/NZS 4671), bar schedule (marked up as-built), fixing inspection records, cover measurements, coupler records, welding records (where applicable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 611. Full documentation package required for each structural element.'
    },
    {
      description: 'Superintendent acceptance of reinforcement installation records',
      acceptanceCriteria: 'All hold points released; all inspection records complete; all material certificates filed; non-conformances resolved; documentation accepted by Superintendent',
      pointType: 'standard',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 611. Formal closure of reinforcement quality records.'
    }
  ]
}

// =============================================================================
// 3. PILING (Sec 605-608)
// =============================================================================

const vicPilingTemplate = {
  name: 'VIC Piling - Driven, Bored, CFA & Socketed (Sec 605-608)',
  description: 'VicRoads piling for bridge/structure foundations covering driven piles (Sec 605), bored cast-in-place piles (Sec 606), CFA piles (Sec 607), and socketed piles with permanent casing (Sec 608). Per AS 2159 and AS 5100.3.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 605/606/607/608, AS 2159',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-12)
    // =========================================================================
    {
      description: 'Submit piling method statement for Superintendent review',
      acceptanceCriteria: 'Method statement addresses: pile type, equipment, installation sequence, methodology, quality control procedures, contingency plans; complies with relevant specification section (605/606/607/608); reviewed and approved before commencement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 605.03/606.03/607.03/608.03. Method statement must be comprehensive and address all construction stages.'
    },
    {
      description: 'Submit pile design and drawings including pile layout, lengths, diameters, capacities and tolerances',
      acceptanceCriteria: 'Pile design per AS 2159 and AS 5100.3; drawings show pile locations, cut-off levels, design capacities, socket requirements (for bored piles), minimum embedment lengths; approved by designer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159, AS 5100.3. Design must be complete before installation commences.'
    },
    {
      description: 'Submit geotechnical investigation report and foundation assessment',
      acceptanceCriteria: 'Report covers all pile locations; describes subsurface conditions, rock levels, groundwater; identifies potential installation hazards (boulders, obstructions, contamination); pile design parameters documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159. Geotechnical assessment is fundamental to pile design and installation planning.'
    },
    {
      description: 'Submit concrete mix design for pile concrete (bored piles / CFA)',
      acceptanceCriteria: 'Concrete mix design registered per VicRoads TN 113 and Section 610; appropriate for placement method (tremie, pump, free-fall); minimum slump for tremie placement (typically 180-220mm); exposure classification appropriate for buried/submerged conditions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'VicRoads TN 113',
      notes: 'Section 610, Clause 606.06/607.06/608.06. Concrete must be suitable for underwater/tremie placement where applicable.'
    },
    {
      description: 'Submit reinforcement cage details and bar schedule for cast-in-place piles',
      acceptanceCriteria: 'Cage design per AS 5100.5 and Section 611; bar schedule including main bars, helical reinforcement, centraliser locations, lifting points; cage length and diameter appropriate for pile design',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 611, Clause 606.05/607.05/608.05. Cage design must account for installation methodology (lifting, lowering into bore).'
    },
    {
      description: 'Submit material certificates for precast piles (driven piles)',
      acceptanceCriteria: 'Precast pile manufacture certificates demonstrating compliance with design; concrete strength achieved; prestressing records; dimensional checks; no defects or damage',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 605.04. Precast piles must be inspected and certified before delivery to site. Applicable to driven piles only.'
    },
    {
      description: 'Submit piling equipment details and capability certification',
      acceptanceCriteria: 'Equipment type and capacity appropriate for pile type and design loads; crane/rig capacity adequate; hammer type and energy rating suitable (driven piles); auger specification (CFA); boring equipment specification (bored piles)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 605.05/606.04/607.04/608.04. Equipment must be capable of installing piles to design requirements without damage.'
    },
    {
      description: 'Submit integrity testing and load testing program',
      acceptanceCriteria: 'Testing program per AS 2159 requirements based on risk rating; number and location of test piles identified; test methods specified (PDA, PIT, CSL, static load test); testing contractor identified and qualified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2159',
      notes: 'AS 2159. Integrity testing mandatory where geotechnical strength reduction factor (phi_gb) > 0.4. Load testing mandatory where phi_gb > 0.4 AND average risk rating (ARR) >= 2.5.'
    },
    {
      description: 'Submit stabilising fluid (bentonite/polymer) specification and management plan (bored piles)',
      acceptanceCriteria: 'Fluid type and properties specified; density, viscosity, pH and sand content limits documented; mixing, recycling and disposal procedures; environmental management requirements addressed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 606.04. Required for bored piles using bentonite or polymer support fluid. Fluid properties critical for bore stability and concrete quality.'
    },
    {
      description: 'Submit CFA on-board monitoring system specification and calibration records',
      acceptanceCriteria: 'On-board monitoring system capable of recording: auger depth, rotation speed, penetration rate, concrete/grout pressure, volume pumped, extraction rate; system calibrated and certified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 607.04. CFA rigs must be fitted with on-board monitoring instruments for real-time monitoring during installation. Applicable to CFA piles only.'
    },
    {
      description: 'Submit pile marking and identification procedure',
      acceptanceCriteria: 'Driven piles marked at 500mm intervals from pile toe; all piles uniquely identified with reference system matching pile layout drawing; marking method durable and readable during installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 605.04. Marking at 500mm intervals allows accurate penetration monitoring during driving.'
    },
    {
      description: 'Verify pile storage and handling procedures',
      acceptanceCriteria: 'Precast piles stored on level supports at specified points; no overstress or permanent distortion during handling; lifting points per manufacturer/design; timber/concrete support blocks at correct locations; damaged piles rejected',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 605.04. Piles must be carefully stored and handled to prevent damage, overstress or permanent distortion. Applicable primarily to driven piles.'
    },
    // =========================================================================
    // PILE INSTALLATION - COMMON (Items 13-20)
    // =========================================================================
    {
      description: 'Survey and set out pile positions',
      acceptanceCriteria: 'Pile positions surveyed and marked from project control network; position accuracy within +/-75mm at cut-off level; reference points established for monitoring during installation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'Clause 605.06/606.05/607.05/608.05. Set-out accuracy directly affects pile group performance and pile cap construction.'
    },
    {
      description: 'Verify ground conditions at pile location match geotechnical assessment',
      acceptanceCriteria: 'Excavated/observed ground conditions consistent with geotechnical report; any variations documented and reported to designer; unexpected conditions (contamination, voids, obstructions) reported immediately',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159. Ground conditions must be verified as construction proceeds. Design review required if conditions differ significantly from assessment.'
    },
    {
      description: 'Check piling rig/equipment alignment and verticality before installation',
      acceptanceCriteria: 'Rig positioned over pile location; leader/mast verticality checked (deviation not to exceed 1 in 75); alignment appropriate for pile rake if specified; rig stable on level platform',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Spirit level / inclinometer',
      notes: 'Clause 605.06/606.05. Rig alignment directly affects final pile verticality.'
    },
    {
      description: 'Verify protection of adjacent piles and structures during installation',
      acceptanceCriteria: 'Adjacent completed piles and structures protected from damage due to driving vibration, ground movement or equipment operation; monitoring in place where required; exclusion zones observed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 605.07/606.06. Installation activities can affect adjacent piles, especially driven piles.'
    },
    {
      description: 'Monitor pile verticality during installation',
      acceptanceCriteria: 'Pile verticality maintained within tolerance: deviation not to exceed 1 in 75 at cut-off level for bored piles; 1 in 75 for driven piles; measured at regular intervals during installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Inclinometer / Survey',
      notes: 'Clause 605.06/606.05/607.05/608.05. Excessive deviation may require redesign of pile cap or additional piles.'
    },
    {
      description: 'Inspect reinforcement cage before lowering into bore/casing (cast-in-place piles)',
      acceptanceCriteria: 'Cage complies with bar schedule; main bars, helical reinforcement, centralisers all correctly positioned; cage diameter allows adequate concrete cover; lifting points secure; cage clean and free from mud/debris',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Measurement',
      notes: 'Section 611, Clause 606.05/607.05/608.05. Cage inspection before installation is a critical hold point. Cage dimensions verified against bar schedule.'
    },
    {
      description: 'Monitor reinforcement cage installation into bore/casing',
      acceptanceCriteria: 'Cage lowered vertically without damage; cage level correct relative to design cut-off; centralisers maintaining cover; cage secured against flotation during concrete placement; no displacement of base stabilising material',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 606.05/608.05. Cage must be secured to prevent uplift during tremie concrete placement.'
    },
    {
      description: 'Record pile installation data and maintain pile log',
      acceptanceCriteria: 'Pile log records: pile reference, date, start/finish times, pile dimensions, founding depth, penetration rates, ground conditions encountered, any deviations from specification, equipment used',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 605/606/607/608. Comprehensive pile log required for every pile installed.'
    },
    // =========================================================================
    // DRIVEN PILE ITEMS (Items 21-28)
    // =========================================================================
    {
      description: 'Verify hammer type, weight and drop height match approved methodology (driven piles)',
      acceptanceCriteria: 'Hammer energy rating suitable for pile type and design capacity; hammer type as approved in method statement; drop height within specified range; cushion/helmet in satisfactory condition',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 605.05. Hammer must have sufficient energy to install pile and achieve ultimate capacity without causing damage. Driven piles only.'
    },
    {
      description: 'Monitor pile driving and record set measurements (driven piles)',
      acceptanceCriteria: 'Set measurements taken to verify capacity; traces recorded during driving showing temporary compression and permanent set; traces taken relative to stable hurdle supported by posts at least one pile diameter from each side of pile',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Set measurement / driving traces',
      notes: 'Clause 605.06. Set measurement is the primary installation control for driven piles. Driving resistance must equal or exceed pile test load shown on drawings.'
    },
    {
      description: 'Conduct PDA (Pile Driving Analyzer) dynamic testing during initial driving (driven piles)',
      acceptanceCriteria: 'PDA testing by qualified operator; CAPWAP analysis demonstrating ultimate capacity exceeds specified pile test load; pile integrity confirmed; results submitted to Superintendent',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D4945 / AS 2159 Appendix C',
      notes: 'Clause 605.07. PDA testing verifies capacity and integrity during driving. High-strain dynamic testing involves application of large force at pile head.'
    },
    {
      description: 'Conduct restrike test (driven piles where initial set not achieved)',
      acceptanceCriteria: 'Restrike not less than 24 hours after initial driving; PDA monitoring during restrike; ultimate capacity equals or exceeds specified pile test load after restrike; if still not achieved, further action directed by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D4945 / AS 2159',
      notes: 'Clause 605.08. Restrike testing required if ultimate load capacity not achieved at specified level during initial driving. Driven piles only.'
    },
    {
      description: 'Assess pile for driving damage (driven piles)',
      acceptanceCriteria: 'No visible damage to pile head, shaft or toe; no excessive cracking in precast concrete piles; no buckling or distortion in steel piles; PDA signals consistent with undamaged pile; any suspected damage investigated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual / PDA',
      notes: 'Clause 605.06. Piles must be driven without causing damage. Excessive driving energy or hard driving can cause pile damage.'
    },
    {
      description: 'Monitor pile heave of adjacent piles during driving (driven piles)',
      acceptanceCriteria: 'Previously driven piles monitored for heave; heave exceeding specified tolerance requires re-driving or retest; monitoring system in place before driving commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / level monitoring',
      notes: 'Clause 605.07. Pile heave can reduce capacity of previously installed piles. Driven piles in cohesive soils are most susceptible.'
    },
    {
      description: 'Verify pile toe level against design requirements (driven piles)',
      acceptanceCriteria: 'Pile toe reaches specified founding level or achieves specified driving resistance; penetration depth recorded from pile markings (500mm intervals); toe level consistent with geotechnical profile',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Pile marking record',
      notes: 'Clause 605.06. Toe level is determined by driving criteria (set) rather than depth alone for driven piles.'
    },
    {
      description: 'Cut off driven piles to specified level',
      acceptanceCriteria: 'Pile cut-off level per drawings (+/-25mm); concrete pile heads trimmed without damaging remaining pile; steel piles cut cleanly; reinforcement exposed to correct projection for pile cap connection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey',
      notes: 'Clause 605.09. Cut-off level accuracy is critical for pile cap construction.'
    },
    // =========================================================================
    // BORED PILE ITEMS (Items 29-36)
    // =========================================================================
    {
      description: 'Inspect bore excavation and verify founding conditions (bored piles)',
      acceptanceCriteria: 'Bore excavated to specified depth; socket into competent rock achieved to design depth (where specified); base of excavation clean with no loose material or water; founding conditions consistent with geotechnical assessment; Superintendent releases hold point',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Geotechnical inspection',
      notes: 'Clause 606.06. Bore inspection is a critical hold point. Holes can safely be cleaned by hand and inspected in situ prior to cage insertion. Bored piles only.'
    },
    {
      description: 'Conduct test hole drilling at base of socket (bored piles in rock)',
      acceptanceCriteria: 'Test holes minimum 24mm diameter drilled to at least 2.4m or two pile diameters below bottom of excavation; suitable material persists at that depth; driller records time per 250mm increment; supervised by Geotechnical Assessor',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Test hole drilling',
      notes: 'Clause 606.06. Test drilling confirms competent founding material extends below socket base. Written records provided to Superintendent. Bored piles in rock sockets only.'
    },
    {
      description: 'Test stabilising fluid properties before concrete placement (bored piles with fluid support)',
      acceptanceCriteria: 'Density within specified range; viscosity within range (Marsh funnel test); pH within range; sand content below maximum (typically <4% by volume); fluid suitable for concrete displacement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Density, Marsh funnel, pH, sand content',
      notes: 'Clause 606.05. Fluid properties affect bore stability and concrete quality. Fluid must be suitable for displacement by tremie concrete.'
    },
    {
      description: 'Monitor bore stability throughout excavation process (bored piles)',
      acceptanceCriteria: 'No collapse or excessive loss of ground; temporary casing installed where required; fluid level maintained above groundwater level; adjacent piles/structures not affected',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 606.05. Bore stability is critical for pile integrity and adjacent structure protection.'
    },
    {
      description: 'Place concrete in bore using tremie method (bored piles with fluid support)',
      acceptanceCriteria: 'Tremie pipe sections sufficient to reach toe; joints sealed; tremie immersed in concrete at all times (minimum 2m embedment); concrete placed continuously without interruption; tremie raised progressively maintaining embedment',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 606.07. Tremie must remain immersed in concrete throughout placement to prevent contamination from stabilising fluid.'
    },
    {
      description: 'Monitor concrete volume placed against theoretical pile volume (bored piles)',
      acceptanceCriteria: 'Actual concrete volume recorded; compared to theoretical volume; over-consumption ratio documented (typically should not exceed 1.15-1.25 for stable bore); excessive over-consumption indicates potential bore instability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Volume calculation',
      notes: 'Clause 606.07. Volume monitoring is an indicator of bore stability and concrete quality.'
    },
    {
      description: 'Continue concrete placement until contaminated concrete displaced above cut-off level (bored piles)',
      acceptanceCriteria: 'Concrete placed to above cut-off level by sufficient margin to ensure contaminated top-of-pile concrete (mixed with fluid/debris) is above the cut-off; typically 0.5-1.0m above cut-off',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 606.07. Contaminated concrete at top of pile must be above cut-off level and removed during pile trimming.'
    },
    {
      description: 'Trim bored pile concrete to cut-off level',
      acceptanceCriteria: 'Cut-off level per drawings (+/-25mm); contaminated concrete above cut-off fully removed; sound concrete exposed; reinforcement protruding to correct length for pile cap connection; no damage to pile reinforcement or concrete below cut-off',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey',
      notes: 'Clause 606.08. All contaminated concrete must be removed to expose sound pile concrete.'
    },
    // =========================================================================
    // CFA PILE ITEMS (Items 37-40)
    // =========================================================================
    {
      description: 'Monitor CFA pile installation using on-board monitoring system',
      acceptanceCriteria: 'On-board monitoring records: auger depth vs time, rotation speed, penetration rate; auger rotation only in drilling direction (no reversing during drilling); auger not pulled out to clear head during drilling; records stored and available for review',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'On-board monitoring system',
      notes: 'Clause 607.05. Reversing auger or pulling out during drilling is not permitted. Real-time monitoring is mandatory for CFA piles.'
    },
    {
      description: 'Monitor concrete/grout placement during auger extraction (CFA piles)',
      acceptanceCriteria: 'Concrete/grout pressure maintained positive at auger tip at all times during extraction; extraction rate controlled to maintain concrete column; on-board monitoring records concrete pressure, volume and auger depth continuously',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'On-board monitoring system',
      notes: 'Clause 607.06. Loss of positive pressure can cause necking or soil inclusion. CFA piles only.'
    },
    {
      description: 'Compare actual concrete volume to theoretical pile volume (CFA piles)',
      acceptanceCriteria: 'Actual volume from on-board monitoring; theoretical volume from pile diameter and depth; over-consumption ratio documented; minimum 1.0 (no under-consumption); excessive over-consumption investigated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Volume calculation',
      notes: 'Clause 607.06. Under-consumption indicates potential defect. Over-consumption may indicate unstable ground.'
    },
    {
      description: 'Install reinforcement cage into fresh CFA pile concrete',
      acceptanceCriteria: 'Cage installed immediately after concrete placement while concrete is fluid; cage pushed/vibrated to design depth; centralisers maintaining cover; cage secured at correct level; installation completed within workability time of concrete',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 607.07. CFA pile reinforcement is installed after concrete placement, unlike conventional bored piles. Timing is critical.'
    },
    // =========================================================================
    // PILE TESTING AND INTEGRITY (Items 41-48)
    // =========================================================================
    {
      description: 'Conduct low-strain integrity testing (PIT) on completed piles',
      acceptanceCriteria: 'Testing per ASTM D5882 and AS 2159; all piles tested or per testing program; pile head prepared (clean, level, cured); pile age minimum 7 days; results assessed by qualified engineer; classification per AS 2159 (acceptable/defective/inconclusive)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D5882 / AS 2159 Appendix E',
      notes: 'AS 2159. Low-strain integrity testing (PIT) is a rapid screening method for assessing pile shaft integrity. Detects major defects such as necking, bulging, cracks, inclusions.'
    },
    {
      description: 'Conduct cross-hole sonic logging (CSL) on bored piles (where specified)',
      acceptanceCriteria: 'CSL tubes installed per specification (minimum 2 tubes per pile, more for larger diameters); testing conducted per AS 2159; results interpreted by qualified engineer; defects located and quantified; concrete age minimum 7 days',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CSL / ASTM D6760',
      notes: 'AS 2159. CSL provides detailed assessment using sound wave travel times between access tubes. Required for large diameter bored piles. More detailed than PIT.'
    },
    {
      description: 'Submit pile integrity test results to Superintendent',
      acceptanceCriteria: 'All test results compiled, interpreted and submitted; qualified engineer assessment of each pile; defective piles identified with recommended remedial action; results constitute a hold point per AS 2159',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159',
      notes: 'AS 2159 Section 6.3/6.4. Submission of integrity test results is a hold point. Work must not proceed until results reviewed and accepted.'
    },
    {
      description: 'Conduct static load test on test pile(s) (where specified)',
      acceptanceCriteria: 'Static load test per AS 2159 Appendix A; pile head prepared for coaxial load application; test load applied in increments per standard; settlement measured at each increment; ultimate capacity determined; results compared to design requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159 Appendix A',
      notes: 'AS 2159. Static load testing is the most reliable method for verifying pile capacity. Required where risk assessment demands high confidence. Test pile(s) identified in testing program.'
    },
    {
      description: 'Conduct high-strain dynamic load test (PDA) on production piles (where specified)',
      acceptanceCriteria: 'PDA testing by qualified operator per AS 2159 Appendix C; CAPWAP signal matching analysis completed; ultimate capacity equals or exceeds design requirement; pile integrity confirmed; testing on sufficient number of piles per risk rating',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ASTM D4945 / AS 2159 Appendix C',
      notes: 'AS 2159. PDA testing verifies both capacity and integrity. Applicable to driven piles and some bored piles with restrike capability.'
    },
    {
      description: 'Conduct rapid load test (Statnamic) on test piles (where specified)',
      acceptanceCriteria: 'Rapid load test per AS 2159 Appendix D; unloading point method or signal matching used for capacity assessment; results compared to design requirements; interpretation by qualified engineer',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159 Appendix D',
      notes: 'AS 2159. Rapid load testing is an alternative to static load testing. Less common but can test higher capacities.'
    },
    {
      description: 'Assess and resolve defective piles identified by testing',
      acceptanceCriteria: 'Defective piles assessed by designer; remedial options evaluated (re-drilling, grouting, replacement, additional piles); remedial action approved by Superintendent; verification testing of remediated piles where required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159. Defective piles must be addressed before foundation acceptance. Remedial options depend on nature and severity of defect.'
    },
    {
      description: 'Verify pile as-built positions and cut-off levels by survey',
      acceptanceCriteria: 'All pile positions surveyed at cut-off level; position tolerance within +/-75mm of design; cut-off level within +/-25mm; as-built coordinates and levels documented; any out-of-tolerance piles reported to designer for assessment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'Section 605/606/607/608. As-built pile positions are critical for pile cap design and construction.'
    },
    // =========================================================================
    // DOCUMENTATION / COMPLETION (Items 49-55)
    // =========================================================================
    {
      description: 'Submit 28-day compressive strength results for pile concrete (cast-in-place piles)',
      acceptanceCriteria: '28-day strength equals or exceeds specified f\'c per AS 1379 compliance criteria; all samples traceable to individual piles; non-compliant results reported and investigated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Section 610, Clause 606/607/608. Concrete strength verification for all cast-in-place piles.'
    },
    {
      description: 'Submit complete pile installation records for all piles',
      acceptanceCriteria: 'Pile log for every pile including: reference, type, dimensions, founding depth, installation date, ground conditions, driving records (driven piles), concrete volumes (bored/CFA piles), reinforcement details, any deviations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 605/606/607/608. Comprehensive pile records are part of the quality management documentation.'
    },
    {
      description: 'Submit complete pile testing records and certified results',
      acceptanceCriteria: 'All test results compiled: integrity testing (PIT/CSL), load testing (static/dynamic/rapid), concrete strength, as-built survey; results certified by qualified engineer; any non-conformances documented with resolution',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159, Section 605/606/607/608. Test results are part of the Quality Management Records required by AS 2159.'
    },
    {
      description: 'Submit driving records and PDA analysis reports (driven piles)',
      acceptanceCriteria: 'Complete driving records for all driven piles; PDA traces and CAPWAP analyses; restrike results where applicable; summary of achieved capacities vs design requirements; certified by qualified testing engineer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 605. Driving records must be comprehensive and traceable. Driven piles only.'
    },
    {
      description: 'Submit CFA pile monitoring records and analysis (CFA piles)',
      acceptanceCriteria: 'On-board monitoring printouts for all CFA piles; concrete pressure/volume records; auger depth/rotation records; over-consumption calculations; analysis report by qualified engineer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 607. CFA on-board records are primary quality documentation. CFA piles only.'
    },
    {
      description: 'Submit as-built pile layout drawing with survey coordinates and levels',
      acceptanceCriteria: 'As-built drawing showing all pile positions (coordinates), cut-off levels, founding depths, pile types and sizes; discrepancies from design highlighted; certified by surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey',
      notes: 'Section 605/606/607/608. As-built pile layout required before pile cap construction commences.'
    },
    {
      description: 'Superintendent final acceptance of piling works',
      acceptanceCriteria: 'All hold points released; all pile testing completed and results accepted; all non-conformances resolved; all documentation submitted and reviewed; piling works accepted for foundation/pile cap construction to commence',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 605/606/607/608. Formal acceptance of piling works is required before subsequent foundation construction. This is a critical project milestone.'
    }
  ]
}

// =============================================================================
// 4. STRUCTURAL STEELWORK (Sec 630)
// =============================================================================

const vicSteelworkTemplate = {
  name: 'VIC Structural Steelwork (Sec 630)',
  description: 'VicRoads structural steelwork for bridges and road structures per Section 630 (Fabrication of Steelwork), TB 46 (Surveillance of Structural Steelwork), and TB 48 (Protective Coatings). Covers fabrication, welding, NDE, coatings and erection.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 630, TB 46, TB 48, AS/NZS 5131',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-FABRICATION (Items 1-7)
    // =========================================================================
    {
      description: 'Submit fabrication Quality Plan and ITP for Superintendent review',
      acceptanceCriteria: 'Quality Plan addresses all Section 630 requirements; ITP includes hold points, witness points and inspection requirements for fabrication and erection; fabricator accredited to AS/NZS 5131 for appropriate Construction Category (CC3 or CC4 for bridges)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 630, TB 46, AS/NZS 5131. Quality Plan and ITP are prerequisite documents. Fabrication must not commence until accepted.'
    },
    {
      description: 'Verify fabricator accreditation and personnel qualifications',
      acceptanceCriteria: 'Fabricator holds current accreditation to AS/NZS 5131 for specified Construction Category; welding quality management to AS/NZS ISO 3834; welders qualified to AS/NZS 1554.1; inspection personnel competent per AS/NZS ISO/IEC 17020',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 630, TB 46. Accreditation and welder qualifications must be current and verified before fabrication commences.'
    },
    {
      description: 'Submit material test certificates for structural steel',
      acceptanceCriteria: 'Mill certificates for all structural steel demonstrating compliance with specified grade (AS/NZS 3678 for plate, AS/NZS 3679 for sections); mechanical properties, chemical composition, and identification marking verified; traceability from certificate to delivered material',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Mill test certificates per AS/NZS 3678/3679',
      notes: 'Section 630, AS/NZS 5131 Clause 5.2. Material traceability is mandatory.'
    },
    {
      description: 'Submit Welding Procedure Specifications (WPS) and Procedure Qualification Records (PQR)',
      acceptanceCriteria: 'WPS prepared for all weld joint configurations; PQR demonstrating successful qualification testing; WPS and PQR comply with AS/NZS 1554.1; weld categories matched to structural demand',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1554.1',
      notes: 'Section 630, TB 46. All welding must be performed to qualified WPS. AS/NZS 1554.1 is the normal welding standard for structural steelwork.'
    },
    {
      description: 'Submit protective coating system specification',
      acceptanceCriteria: 'Coating system selected per AS/NZS 2312 for specified durability category and environment; product data sheets for all coating products; surface preparation standard specified (typically Sa 2.5 per AS 1627.4); DFT requirements for each coat documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 630, TB 48. Protective coating system must be submitted and accepted before surface preparation commences.'
    },
    {
      description: 'Review shop drawings and verify dimensions against design',
      acceptanceCriteria: 'Shop drawings checked against design drawings; all dimensions, connection details, bolt patterns, weld symbols verified; camber and pre-set details confirmed; marking plan for identification of members documented',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 630, TB 46. Dimensional accuracy at fabrication stage prevents erection problems.'
    },
    {
      description: 'Verify cutting, edge treatment and assembly procedures',
      acceptanceCriteria: 'Steelwork cut by flame cutting, sawing or shearing per Section 630; cut edges finished square (or bevelled for butt welds); cut surface finish satisfactory - ground or machined where not acceptable; assembly follows approved sequence',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 630. Where finish of cut edges is not satisfactory, edges shall be ground or machined.'
    },
    // =========================================================================
    // WELDING & NDE (Items 8-13)
    // =========================================================================
    {
      description: 'Inspect fit-up and joint preparation before welding',
      acceptanceCriteria: 'Joint configuration matches WPS; root gap, root face, bevel angle within WPS tolerances; joint surfaces clean and free of mill scale, rust, oil, moisture; tack welds (if used) are sound and will be incorporated or removed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 630, TB 46. Pre-weld fit-up inspection is critical for weld quality.'
    },
    {
      description: 'Monitor welding in progress',
      acceptanceCriteria: 'Welder qualification current for weld being performed; WPS parameters followed (current, voltage, travel speed, preheat, interpass temperature); welding consumables as specified in WPS; environmental conditions suitable (no welding in rain or high wind)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 630, AS/NZS 1554.1. In-process monitoring by qualified welding inspector.'
    },
    {
      description: 'Visual inspection of completed welds',
      acceptanceCriteria: '100% visual inspection of all welds; weld profile, size and length per design; no cracks, incomplete fusion, undercut, porosity, spatter or other defects exceeding AS/NZS 1554.1 acceptance limits for specified weld category',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual (AS/NZS 1554.1)',
      notes: 'Section 630, TB 46. Visual inspection is mandatory for all welds regardless of NDE requirements.'
    },
    {
      description: 'Perform Non-Destructive Examination (NDE) of welds',
      acceptanceCriteria: 'NDE method, extent and acceptance criteria per AS/NZS 1554.1 and Section 630; typically UT (ultrasonic) for butt welds, MT (magnetic particle) for fillet welds; NDE technicians qualified to AS 2062 or equivalent; NDE reports documented with defect locations and dispositions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 1554.1 (UT, MT, PT, RT as specified)',
      notes: 'Section 630, TB 46. NDE extent depends on Construction Category per AS/NZS 5131. CC3/CC4 requires increased NDE percentage. Hold point on NDE results before member release.'
    },
    {
      description: 'Repair defective welds and re-inspect',
      acceptanceCriteria: 'Defective welds removed by grinding or gouging; repair welding to approved repair WPS; repaired welds re-inspected by same NDE method as original; repair records documented including defect type, location, repair method and re-inspection result',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 1554.1',
      notes: 'Section 630, TB 46. Weld repair procedures must be documented and approved.'
    },
    {
      description: 'Verify bolt hole preparation and accuracy',
      acceptanceCriteria: 'Bolt holes drilled (not punched for primary structural connections); hole diameter within tolerance per AS 4100; bolt group geometry matches shop drawings; mating surfaces in contact; burrs removed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'AS 4100',
      notes: 'Section 630, AS/NZS 5131. Bolt hole accuracy critical for fit-up during erection.'
    },
    // =========================================================================
    // PROTECTIVE COATINGS (Items 14-17)
    // =========================================================================
    {
      description: 'Inspect surface preparation before coating',
      acceptanceCriteria: 'Surface prepared to specified standard (typically Sa 2.5 per AS 1627.4 - near-white blast cleaning); surface profile within specified range; surface free of oil, grease, weld spatter, sharp edges and mill scale; environmental conditions suitable (steel temperature min 3 deg C above dew point, RH below 85%)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'AS 1627.4, surface profile comparator',
      notes: 'TB 48. Surface preparation is the most critical factor in coating performance. Hold point before coating commences.'
    },
    {
      description: 'Apply coating system and verify dry film thickness (DFT)',
      acceptanceCriteria: 'Each coat applied per manufacturer recommendations; DFT measured at specified frequency (typically every 10 m2 or per TB 48); DFT within tolerances for each coat (minimum, nominal and maximum); no defects (runs, sags, pinholes, misses, contamination)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'DFT gauge (magnetic or eddy current per AS 3894.3)',
      notes: 'TB 48. DFT is the primary acceptance parameter for coatings. Records must include location, coat number, and DFT readings.'
    },
    {
      description: 'Verify overcoat intervals between coating layers',
      acceptanceCriteria: 'Time between coats within manufacturer specified minimum and maximum overcoat intervals; surface preparation between coats as required (light abrasion, solvent wipe); ambient conditions within limits at each application',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TB 48. Overcoat intervals are critical - exceeding maximum interval requires re-preparation of surface.'
    },
    {
      description: 'Final coating inspection and release for transport',
      acceptanceCriteria: 'Complete coating system inspected; overall DFT meets specification; coating adhesion tested where specified (cross-cut or pull-off per AS 3894.9); holiday detection on immersion zone coatings (if applicable); touch-up of handling damage completed; members identified and marked',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3894.3 (DFT), AS 3894.9 (adhesion)',
      notes: 'TB 48. Final coating release is a hold point before transport to site.'
    },
    // =========================================================================
    // ERECTION (Items 18-23)
    // =========================================================================
    {
      description: 'Verify bearing and support preparation at site',
      acceptanceCriteria: 'Bearing locations prepared to design levels and tolerances; anchor bolts positioned correctly (template used); grout pads or mortar beds as specified; survey confirms bearing elevation and alignment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 630, TB 46. Bearing preparation must be confirmed before steelwork erection commences.'
    },
    {
      description: 'Review erection methodology and temporary works',
      acceptanceCriteria: 'Erection methodology submitted and accepted; crane capacity adequate; temporary bracing and support designed for construction loads; erection sequence documented; safety plan addresses working at height',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 630, TB 46. AS/NZS 5131 Hold Point 12 - commencement of erection.'
    },
    {
      description: 'Inspect steelwork for transport damage before erection',
      acceptanceCriteria: 'Members inspected on arrival at site; coating damage recorded and scheduled for repair; no distortion, bending or structural damage; member identification verified against erection drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'TB 46, TB 48. Transport damage must be identified and repaired before erection.'
    },
    {
      description: 'Verify bolt tensioning at site connections',
      acceptanceCriteria: 'High-strength structural bolts (AS/NZS 1252.1) tensioned to specified minimum bolt tension using approved method (torque control, turn-of-nut, or direct tension indicator); bolt tensioning records maintained; snug-tight connections where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 1252.1, AS 4100 Section 15',
      notes: 'Section 630, AS/NZS 5131. Bolt tensioning verification is a key erection quality check.'
    },
    {
      description: 'Complete field welding and NDE (if applicable)',
      acceptanceCriteria: 'Field welds performed to qualified WPS; NDE as specified (same requirements as shop welds); environmental protection provided for welding (wind shields, preheating in cold weather); weld records maintained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 1554.1',
      notes: 'Section 630, TB 46. Field welding requires same quality controls as shop welding.'
    },
    {
      description: 'Final survey, touch-up coatings, and acceptance',
      acceptanceCriteria: 'Final survey confirms steelwork geometry within specified erection tolerances per AS 4100; coating touch-up completed at all field connections, bolt heads, and transport damage areas; as-built documentation compiled',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 630, TB 46, TB 48. Superintendent acceptance of completed steelwork.'
    }
  ]
}

// =============================================================================
// 5. BRIDGE BEARINGS (Sec 656)
// =============================================================================

const vicBearingsTemplate = {
  name: 'VIC Bridge Bearings (Sec 656)',
  description: 'VicRoads bridge bearing installation per Section 656 (Installation of Bridge Bearings and Pads) and BTN 024. Covers bearing procurement, pedestal preparation, installation, grouting, load transfer and documentation.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 656, BTN 024, AS 5100.4',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-INSTALLATION (Items 1-5)
    // =========================================================================
    {
      description: 'Submit bearing shop drawings and product data for Superintendent review',
      acceptanceCriteria: 'Shop drawings show bearing type, dimensions, load capacity, movement capacity, orientation, and anchorage details; product data demonstrates compliance with AS 5100.4; Clause 12.6.7 requirements addressed per BTN 024; drawings reference design drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 656, BTN 024. Bearing selection and details must comply with AS 5100.4 and be accepted before procurement.'
    },
    {
      description: 'Submit bearing manufacturer test certificates',
      acceptanceCriteria: 'Factory test certificates demonstrating compliance with AS 5100.4 for specified bearing type; load-deflection testing, rotational capacity, material properties all within design requirements; certificates from accredited testing laboratory',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 5100.4 factory testing',
      notes: 'Section 656. Factory QA is critical for bearing performance.'
    },
    {
      description: 'Verify bearing pedestal dimensions, level and surface preparation',
      acceptanceCriteria: 'Bearing pedestals constructed to correct dimensions and levels per design; surface flat and smooth; level within specified tolerance (typically +/- 2 mm); concrete strength achieved; any surface defects repaired',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 656, Section 610. Pedestal preparation directly affects bearing performance and load transfer.'
    },
    {
      description: 'Verify mortar/grout mix design for bearing bedding',
      acceptanceCriteria: 'Bedding mortar mix design submitted; minimum compressive strength 50 MPa; no epoxy grout or mortar unless specified on drawings; non-shrink properties confirmed; materials compatible with concrete and bearing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Compressive strength (AS 1012.9 or equivalent)',
      notes: 'Section 656, ATS 5570. Bedding mortar minimum 50 MPa. Epoxy grout prohibited unless drawing specifies.'
    },
    {
      description: 'Inspect bearings on delivery for damage and verify identification',
      acceptanceCriteria: 'Bearings inspected for shipping damage; dimensions verified against shop drawings; orientation markings clear and correct; movement direction indicators present; bearing identification matches installation schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Bearings must be undamaged and correctly identified before installation.'
    },
    // =========================================================================
    // INSTALLATION (Items 6-12)
    // =========================================================================
    {
      description: 'Set bearing at correct location, orientation and level',
      acceptanceCriteria: 'Bearing positioned at exact design location on pedestal; orientation correct (fixed end, expansion direction confirmed); initial offset (pre-set) applied as specified for temperature at installation; shimming or packing as approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 656. Bearing orientation and pre-set are critical. Incorrect orientation causes structural distress.'
    },
    {
      description: 'Verify bearing level and alignment before grouting',
      acceptanceCriteria: 'Bearing level checked in both axes; level within specified tolerance; alignment with superstructure bearing axis confirmed; temporary restraints in place to prevent movement during grouting',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey/level check',
      notes: 'Section 656. Final levelling check before grout locks bearing in position.'
    },
    {
      description: 'Place bedding mortar/grout under bearing',
      acceptanceCriteria: 'Bedding mortar/grout placed to achieve full contact under bearing; no voids; mortar thickness within design range; mortar placed in one continuous operation; formwork prevents grout loss; excess grout cleaned off before setting',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 656. Full contact between bearing and bedding mortar is essential for load transfer.'
    },
    {
      description: 'Verify bedding mortar strength before load transfer',
      acceptanceCriteria: 'Mortar/grout cube or cylinder test results demonstrate minimum 50 MPa compressive strength achieved before any load applied to bearing; test specimens cured alongside bearing installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 656, ATS 5570. Load must not be applied until mortar has reached specified strength.'
    },
    {
      description: 'Install bearing anchorage and connection hardware',
      acceptanceCriteria: 'Anchor bolts, keeper plates, guide bars or other connection hardware installed per design; bolts tightened to specified torque; dowels grouted (if applicable); restraint mechanisms function as designed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Anchorage must restrain bearing while allowing designed movements.'
    },
    {
      description: 'Place superstructure on bearings and verify load transfer',
      acceptanceCriteria: 'Superstructure lowered onto bearings in controlled manner per erection methodology; load transfer verified visually (uniform compression, no tilting); bearing deflection within expected range; no signs of distress or misalignment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Load transfer verification confirms bearing is functioning as designed.'
    },
    {
      description: 'Remove temporary bearing restraints and verify free movement',
      acceptanceCriteria: 'Temporary packing, shims and restraints removed after load transfer; expansion bearings checked for free movement in design direction; sliding surfaces clean and unobstructed; no binding or restriction',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Bearings must be free to move as designed after construction loads removed.'
    },
    // =========================================================================
    // POST-INSTALLATION (Items 13-16)
    // =========================================================================
    {
      description: 'Record as-installed bearing pre-set and temperature',
      acceptanceCriteria: 'Actual pre-set (offset from centred position) recorded for each bearing; ambient and structure temperature at time of installation recorded; records allow verification of bearing position at any future temperature',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 656. Pre-set records are essential for future bearing inspections.'
    },
    {
      description: 'Apply protective treatment to bearing surfaces (if specified)',
      acceptanceCriteria: 'Exposed metal surfaces protected from corrosion per specification; stainless steel sliding surfaces protected from contamination; elastomeric surfaces protected from UV and ozone; protective covers installed where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Bearing longevity depends on protection during and after construction.'
    },
    {
      description: 'Compile bearing as-built records',
      acceptanceCriteria: 'As-built records for each bearing include: bearing type and manufacturer, serial number, design load and movement capacity, as-installed location and level, pre-set and temperature, mortar strength results, all inspection records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 656. Complete bearing records required for maintenance and future bridge inspections.'
    },
    {
      description: 'Final bearing inspection and Superintendent acceptance',
      acceptanceCriteria: 'All bearings installed, levelled, grouted and functioning; load transfer verified; as-built documentation complete; no defects or damage; bearings accessible for future inspection and replacement',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 656. Superintendent acceptance of bearing installation.'
    }
  ]
}

// =============================================================================
// 6. PRECAST CONCRETE ELEMENTS (Sec 620)
// =============================================================================

const vicPrecastTemplate = {
  name: 'VIC Precast Concrete Elements (Sec 620)',
  description: 'VicRoads precast concrete elements per Section 620 (Precast Concrete Units) and TB 47 (Surveillance of Precast Concrete Units). Covers factory QA, production, transport, erection and completion for beams, planks, culverts and other structural units.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 620, TB 47/47B, AS 5100.5',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // FACTORY QA - PRE-PRODUCTION (Items 1-6)
    // =========================================================================
    {
      description: 'Submit precast concrete Quality Plan and ITP for Superintendent review',
      acceptanceCriteria: 'Quality Plan addresses Section 620 requirements; ITP includes hold points and witness points for factory production and site erection; precaster accredited or approved; surveillance arrangements confirmed to AS/NZS ISO/IEC 17020',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 620, TB 47. Quality Plan prerequisite for production. Surveillance accreditation to AS/NZS ISO/IEC 17020 is mandatory.'
    },
    {
      description: 'Submit concrete mix design for precast units',
      acceptanceCriteria: 'Mix design compliant with Section 610 requirements; grade, exposure classification and durability provisions per AS 5100.5; trial mix data and registration per VicRoads TN 113; transfer and 28-day strength targets documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'VicRoads TN 113',
      notes: 'Section 620/610. Concrete mix must be registered per TN 113 before production commences.'
    },
    {
      description: 'Review shop drawings and reinforcement schedules',
      acceptanceCriteria: 'Shop drawings checked against design; reinforcement schedules verified for bar sizes, spacing, cover, and detailing; cast-in items, lifting points, connection hardware all shown; strand patterns for prestressed units confirmed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 620, TB 47. Drawing review prevents production errors.'
    },
    {
      description: 'Verify formwork/moulds condition and dimensions',
      acceptanceCriteria: 'Formwork clean, oiled, and free from damage; dimensions checked against shop drawings; formwork tolerances per Section 614; formwork stiff enough to maintain shape during placement and vibration; release agent compatible with concrete and any coating',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620/614, TB 47. Mould condition directly affects unit dimensions and surface finish.'
    },
    {
      description: 'Verify prestressing strand/wire material (for prestressed units)',
      acceptanceCriteria: 'Strand material test certificates demonstrate compliance with specified grade; strand identified and traceable; storage clean, dry, free from corrosion; strand not damaged or kinked',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificates',
      notes: 'Section 612/620, TB 47. Prestressing strand quality is critical for structural performance.'
    },
    {
      description: 'Verify reinforcement material and placing',
      acceptanceCriteria: 'Reinforcement complies with Section 611; bar identification verified; reinforcement placed per schedule and shop drawings; cover maintained with approved spacers; laps and anchorage lengths correct; reinforcement tied securely; cast-in items positioned correctly',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620/611, TB 47. Pre-pour reinforcement inspection is a key TB 47 checklist item.'
    },
    // =========================================================================
    // FACTORY QA - PRODUCTION (Items 7-13)
    // =========================================================================
    {
      description: 'Pre-pour inspection of complete assembly',
      acceptanceCriteria: 'All reinforcement, strand, formwork, cast-in items, lifting anchors inspected and approved; concrete cover confirmed at critical locations; strand tensioned to specified force (for pretensioned units); assembly clean and ready to pour',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620, TB 47. Pre-pour inspection covers stressing of pre-stressed elements and ensures all reinforcement and casting items as per design. Hold point before concrete placement.'
    },
    {
      description: 'Verify concrete placement and compaction',
      acceptanceCriteria: 'Concrete placed continuously without cold joints; vibration adequate to achieve compaction without segregation; concrete not dropped from excessive height; placement rate suitable for formwork; slump/workability within limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'AS 1012.3 (slump)',
      notes: 'Section 620/610, TB 47. Concrete placement quality affects structural integrity and surface finish.'
    },
    {
      description: 'Take concrete test specimens during pour',
      acceptanceCriteria: 'Test cylinders taken at specified frequency per Section 610/173; specimens cured alongside units (match cure) and in standard conditions; identification linked to pour batch and unit numbers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8.1 (making test specimens), AS 1012.9 (compressive strength)',
      notes: 'Section 620/610. Concrete strength testing is fundamental QA for precast production.'
    },
    {
      description: 'Verify curing regime',
      acceptanceCriteria: 'Curing method and duration per Section 610; steam curing (if used) ramp rates within limits; minimum temperature and duration achieved; curing records maintained; units not exposed to drying conditions prematurely',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 620/610. Curing directly affects concrete strength development and durability.'
    },
    {
      description: 'Verify strand release strength achieved (for pretensioned units)',
      acceptanceCriteria: 'Concrete compressive strength at strand release meets minimum specified transfer strength (typically 35-40 MPa); match-cured specimen results available before strand release; strand release sequence as specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 612/620, TB 47. Strand must not be released until transfer strength confirmed. Hold point.'
    },
    {
      description: 'Inspect finished units for defects and dimensional compliance',
      acceptanceCriteria: 'Units inspected after stripping/demoulding; no structural cracks, honeycombing, or exposed reinforcement; dimensions within specified tolerances; surface finish meets specification; camber within limits (for prestressed units); strand cut flush and ends sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620, TB 47. Post-production inspection before units leave factory.'
    },
    {
      description: 'Verify 28-day concrete compressive strength',
      acceptanceCriteria: '28-day compressive strength results meet or exceed specified characteristic strength; results assessed per lot-based acceptance criteria; non-conforming results reported and assessed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 620/610. 28-day strength confirms design assumptions.'
    },
    // =========================================================================
    // TRANSPORT & STORAGE (Items 14-16)
    // =========================================================================
    {
      description: 'Verify unit storage at factory',
      acceptanceCriteria: 'Units stored on level supports at specified bearing points; supports do not damage units; stacking (if permitted) with timber dunnage at bearing points only; units identified and marked; protection from weather if required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620, TB 47. Incorrect storage can cause cracking or permanent deformation.'
    },
    {
      description: 'Submit transport methodology for Superintendent review',
      acceptanceCriteria: 'Transport methodology addresses route, vehicle type, restraint method, support points, and protection during transit; over-size/over-mass permits obtained if required; delivery sequence coordinated with erection schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 620. Transport methodology to prevent damage during transit.'
    },
    {
      description: 'Inspect units on delivery to site',
      acceptanceCriteria: 'Units inspected on arrival for transport damage; any cracks, chips, spalling, or coating damage recorded; damaged units assessed for acceptance, repair or rejection; identification marks verified against erection schedule',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620, TB 47. Delivery inspection before units are erected.'
    },
    // =========================================================================
    // ERECTION & COMPLETION (Items 17-22)
    // =========================================================================
    {
      description: 'Verify bearing seats/support preparation before erection',
      acceptanceCriteria: 'Bearing seats clean, level and at correct elevation; bearing pads or mortar beds placed per design; anchor bolts or dowels positioned correctly; temporary supports ready (if required by erection methodology)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 620. Support preparation must be confirmed before lifting units into place.'
    },
    {
      description: 'Review erection methodology and cranage',
      acceptanceCriteria: 'Erection methodology accepted by Superintendent; crane capacity verified for maximum lift weight and radius; lifting points on units checked; erection sequence documented; safety exclusion zones established',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 620. Erection methodology must address safety and structural considerations.'
    },
    {
      description: 'Erect precast units and verify position',
      acceptanceCriteria: 'Units lifted using designated lifting points only; positioned at correct location, level and alignment; bearing as designed; temporary bracing or propping installed per methodology; units not released from crane until stable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check',
      notes: 'Section 620. Unit erection is a critical construction activity requiring close supervision.'
    },
    {
      description: 'Grout connections and joints between units',
      acceptanceCriteria: 'Grout/mortar mix per specification; joints cleaned and prepared before grouting; grout placed to fill connections completely; reinforcement continuity connections made as designed; grout strength verified by test specimens before loading',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 620. Connection grouting provides structural continuity between precast elements.'
    },
    {
      description: 'Remove temporary bracing and propping',
      acceptanceCriteria: 'Temporary supports removed only after connections have achieved specified strength; removal sequence as per methodology; structure monitored during removal for any signs of distress',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620. Premature removal of temporary works can cause structural failure.'
    },
    {
      description: 'Final inspection and Superintendent acceptance',
      acceptanceCriteria: 'All precast units erected, connected and grouted; alignment and levels within tolerances; all connections complete and grout strengths achieved; surface defects repaired; as-built documentation compiled; QA records submitted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 620, TB 47. Superintendent acceptance of completed precast installation.'
    }
  ]
}

// =============================================================================
// 7. POST-TENSIONING (Sec 612)
// =============================================================================

const vicPostTensioningTemplate = {
  name: 'VIC Post-Tensioning (Sec 612)',
  description: 'VicRoads post-tensioning of concrete units per Section 612. Covers PT system approval, material certification, duct installation, tendon placement, stressing, grouting and anchorage protection. High-risk specialist activity.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 612 (Post-Tensioning) v8 (Jan 2021), AS 5100.5, AS/NZS 4672',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-5)
    // =========================================================================
    {
      description: 'Submit post-tensioning system details and design calculations',
      acceptanceCriteria: 'PT system details submitted to Superintendent including: anchorage type, duct type and size, tendon layout, stressing sequence, jack type and calibration; design calculations showing required stressing force, expected elongation, friction losses, seating losses',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Contractor must submit all PT details to Superintendent prior to construction. Work must not commence until details are accepted.'
    },
    {
      description: 'Submit PT material test certificates',
      acceptanceCriteria: 'Test certificates for strand/bar (AS/NZS 4672), anchorage components, duct material; strand certificates show tensile strength, relaxation class, and modulus of elasticity; all materials traceable to certificates',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4672',
      notes: 'Section 612. Material compliance is fundamental to PT system performance.'
    },
    {
      description: 'Verify PT subcontractor qualifications and experience',
      acceptanceCriteria: 'PT subcontractor experienced with specified PT system; personnel trained and competent; jack operator experienced; stressing records demonstrate capability on similar projects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. PT is specialist work requiring qualified personnel.'
    },
    {
      description: 'Submit jack calibration certificates',
      acceptanceCriteria: 'Stressing jack calibrated by accredited laboratory within specified timeframe (typically 6 months); calibration chart shows pressure-force relationship; calibration certificate current; jack identified by serial number',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Jack calibration certificate',
      notes: 'Section 612. Jack calibration essential for accurate stressing force measurement.'
    },
    {
      description: 'Verify concrete strength before stressing (minimum strength for PT operations)',
      acceptanceCriteria: 'Concrete compressive strength at time of stressing meets minimum specified (typically 80% of f\'c or as specified in design); test results from match-cured or standard-cured specimens; results available before stressing commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 612/610. Concrete must achieve specified minimum strength before PT forces are applied. Premature stressing can cause concrete failure at anchorages.'
    },
    // =========================================================================
    // DUCT INSTALLATION (Items 6-9)
    // =========================================================================
    {
      description: 'Install PT ducts to design profile and alignment',
      acceptanceCriteria: 'Ducts installed at correct profile (coordinates checked at specified intervals); duct supports adequate to maintain profile during concrete placement; duct joints sealed to prevent grout leakage and concrete ingress; inlet and outlet grout tubes installed at correct locations',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Duct profile accuracy is critical for achieving design forces and avoiding unintended friction losses.'
    },
    {
      description: 'Verify duct condition and continuity before concrete placement',
      acceptanceCriteria: 'Ducts inspected for damage, kinks, blockages; duct continuity confirmed (light or mandrel passed through); grout tubes clear and connected; duct connections sealed; anchorage pockets formed correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Duct continuity check (mandrel/light)',
      notes: 'Section 612. Blocked or damaged ducts cannot be repaired after concrete placement. Hold point before pouring.'
    },
    {
      description: 'Install anchorage hardware and bearing plates',
      acceptanceCriteria: 'Anchorage hardware positioned at correct location and orientation; bearing plates perpendicular to tendon axis; spiral or grid reinforcement around anchorages per design; anchorage zone reinforcement complete; blockout dimensions correct',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Anchorage zone is a highly stressed region requiring careful detailing and construction.'
    },
    {
      description: 'Install drainage vents at duct low points',
      acceptanceCriteria: 'Drainage vents installed at all duct low points to allow accumulated moisture to drain prior to tendon installation; vents sealed after drainage confirmed; locations documented on as-built records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Drainage vents prevent water accumulation in ducts which causes strand corrosion.'
    },
    // =========================================================================
    // TENDON PLACEMENT & STRESSING (Items 10-16)
    // =========================================================================
    {
      description: 'Thread/push tendons through ducts',
      acceptanceCriteria: 'Tendons installed without damage (no nicks, kinks, or contamination); tendon length sufficient for stressing (dead and live end allowances); tendon identified and matched to duct per stressing schedule; strand wedges and barrel fittings clean',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Tendon installation must not damage strand surface.'
    },
    {
      description: 'Pre-stressing hold point - Superintendent notification',
      acceptanceCriteria: 'Superintendent notified minimum 24 hours before stressing; concrete strength confirmed; jack calibration current; stressing procedure and sequence reviewed; expected elongation calculations available for comparison; safety exclusion zone established',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Prior to commencement of each post-tensioning operation, a Hold Point applies.'
    },
    {
      description: 'Stress tendons and record jack pressure and elongation',
      acceptanceCriteria: 'Stressing performed per approved stressing procedure and sequence; jack pressure and corresponding tendon elongation recorded at each stage; measured elongation within +/- 5% of calculated elongation; if outside tolerance, stop and investigate; stressing personnel experienced',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Jack pressure gauge, elongation measurement',
      notes: 'Section 612. Elongation check vs jack pressure is the primary verification of correct stressing. Discrepancy indicates friction, duct profile, or material property issues.'
    },
    {
      description: 'Verify anchor set (wedge draw-in) at lock-off',
      acceptanceCriteria: 'Wedge draw-in measured at lock-off; draw-in within expected range for PT system (typically 6-8 mm); effective prestress after losses verified; any abnormal draw-in investigated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Wedge draw-in measurement',
      notes: 'Section 612. Anchor set affects final effective prestress.'
    },
    {
      description: 'Stress remaining tendons in specified sequence',
      acceptanceCriteria: 'Stressing sequence as specified to maintain structural balance and avoid overloading; intermediate tendon stress records compiled; any deviations from expected elongation documented and assessed; temporary supports adjusted per stressing methodology',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Jack pressure gauge, elongation measurement',
      notes: 'Section 612. Stressing sequence affects load distribution and concrete stresses.'
    },
    {
      description: 'Submit stressing records for Superintendent review',
      acceptanceCriteria: 'Complete stressing records for all tendons submitted; records include tendon identification, stressing date, jack serial number, pressure at each stage, measured elongation, calculated elongation, anchor set, and any anomalies; Superintendent reviews and accepts records before grouting',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Stressing records must be accepted before grouting tendons.'
    },
    {
      description: 'Cut protruding strand and seal anchorage recesses (if pre-grouting)',
      acceptanceCriteria: 'Strand cut flush with anchorage after lock-off; protective cap or grease applied to strand ends if not grouting immediately; anchorage pocket temporarily protected from weather and contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Strand end protection prevents corrosion before grouting.'
    },
    // =========================================================================
    // GROUTING & ANCHORAGE PROTECTION (Items 17-22)
    // =========================================================================
    {
      description: 'Submit grout mix design and grouting procedure',
      acceptanceCriteria: 'Grout mix design for PT duct grouting submitted; mix compliant with Section 612 and AS 5100.5; w/c ratio within limits; grout strength and fluidity requirements documented; grouting procedure addresses sequence, pressures, venting, and temperature limitations',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Grout mix and procedure must be accepted before grouting commences.'
    },
    {
      description: 'Conduct grout trial and test',
      acceptanceCriteria: 'Trial grout batch mixed and tested; fluidity (flow cone test), bleed, volume change, and set time within specification limits; grout strength test specimens prepared; trial demonstrates mixing equipment and procedure are satisfactory',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Flow cone test, bleed test, compressive strength',
      notes: 'Section 612. Grout trial validates mix design and procedures.'
    },
    {
      description: 'Grout PT ducts per approved procedure',
      acceptanceCriteria: 'Grouting performed from lowest point; grout injected until clean grout flows from outlet at high point; grout pressure monitored and within limits; all air expelled; vents closed in sequence; grout not allowed to set in mixer or lines; ambient temperature within limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 612. Grouting protects tendons from corrosion and provides bond. Incomplete grouting leaves tendons vulnerable.'
    },
    {
      description: 'Verify grout compressive strength',
      acceptanceCriteria: 'Grout cube or cylinder strength results meet specified minimum (typically 27 MPa at 28 days); results recorded and linked to grouted tendons; non-conforming results assessed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Section 612. Grout strength verification.'
    },
    {
      description: 'Seal and protect anchorage recesses',
      acceptanceCriteria: 'Anchorage pockets filled with approved concrete or mortar; protection extends minimum cover over all anchorage hardware; pocket surface finished flush with surrounding concrete; curing applied',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 612. Anchorage protection provides corrosion protection for the critical anchorage zone.'
    },
    {
      description: 'Final PT documentation and Superintendent acceptance',
      acceptanceCriteria: 'Complete PT documentation package compiled including: material certificates, stressing records, elongation comparison, grout records, grout strength results, anchorage protection records; as-built tendon layout documented; Superintendent accepts PT works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 612. Complete documentation is essential for structure maintenance and future assessment.'
    }
  ]
}

// =============================================================================
// 8. BRIDGE DECK WATERPROOFING (Sec 691)
// =============================================================================

const vicWaterproofingTemplate = {
  name: 'VIC Bridge Deck Waterproofing (Sec 691)',
  description: 'VicRoads bridge deck waterproofing per Section 691 (Waterproofing of Concrete Bridge Decks). Covers membrane types (I, II, III), surface preparation, application, testing, protection course and completion.',
  activityType: 'structural',
  specificationReference: 'VicRoads Section 691 (Waterproofing of Concrete Bridge Decks)',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-4)
    // =========================================================================
    {
      description: 'Submit waterproofing system details and product data for Superintendent review',
      acceptanceCriteria: 'Waterproofing system type (I, II or III) as specified; product data sheets and technical literature submitted; BBA certification or equivalent provided; manufacturer installation instructions provided; system compatibility with asphalt overlay confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 691. Waterproofing system must be accepted before procurement and installation.'
    },
    {
      description: 'Verify applicator qualifications and training',
      acceptanceCriteria: 'Applicator trained and approved by waterproofing system manufacturer; evidence of successful application on similar projects; personnel familiar with specific product requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 691. Waterproofing application is specialist work requiring trained applicators.'
    },
    {
      description: 'Submit application methodology and quality plan',
      acceptanceCriteria: 'Application methodology addresses surface preparation, primer application, membrane application, protection course installation; quality plan includes inspection points, testing requirements, weather limitations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 691. Methodology must be product-specific.'
    },
    {
      description: 'Verify material storage conditions',
      acceptanceCriteria: 'Waterproofing materials stored per manufacturer requirements; temperature-sensitive materials stored within specified range; shelf life checked; materials protected from moisture and contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Improper storage can degrade waterproofing materials.'
    },
    // =========================================================================
    // SURFACE PREPARATION (Items 5-8)
    // =========================================================================
    {
      description: 'Inspect concrete deck surface condition',
      acceptanceCriteria: 'Concrete surface free from contaminants, dust, loose material, laitance, curing compounds (unless compatible); surface dry (moisture content within product requirements); concrete curing period complete (minimum 28 days); concrete strength achieved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Surface condition is critical for membrane adhesion.'
    },
    {
      description: 'Prepare concrete surface to specified profile',
      acceptanceCriteria: 'Surface prepared by shot-blasting, grinding, or other approved method to achieve required texture/profile for membrane adhesion; surface profile measured and within specification; all surface defects (cracks, honeycombing, blow holes) repaired before membrane application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Surface profile measurement',
      notes: 'Section 691. Surface profile must be within manufacturer specified range for product adhesion.'
    },
    {
      description: 'Verify ambient conditions before application',
      acceptanceCriteria: 'Ambient temperature within product application range; deck surface temperature within limits; no rain or moisture; relative humidity within limits; wind speed acceptable; conditions stable and forecast suitable for duration of application and curing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Temperature, RH measurement',
      notes: 'Section 691. Weather conditions must be suitable throughout application and curing period.'
    },
    {
      description: 'Apply primer to prepared surface (if required by system)',
      acceptanceCriteria: 'Primer type as specified by membrane manufacturer; applied at recommended rate; uniform coverage verified; primer tack-free or within specified overcoat window before membrane application',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Some membrane systems require primer for adhesion.'
    },
    // =========================================================================
    // MEMBRANE APPLICATION (Items 9-14)
    // =========================================================================
    {
      description: 'Apply waterproofing membrane',
      acceptanceCriteria: 'Membrane applied per manufacturer instructions and approved methodology; coverage rate and thickness per specification; uniform application without holidays, thin spots, blisters or wrinkles; membrane extends to all required areas including upstands, drains and kerbs',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Membrane application quality determines waterproofing effectiveness.'
    },
    {
      description: 'Verify membrane thickness/coverage',
      acceptanceCriteria: 'Wet or dry film thickness measured at specified intervals; thickness meets minimum specification requirements; thin areas identified and additional coat applied; records maintained showing location and thickness readings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'WFT/DFT gauge',
      notes: 'Section 691. Membrane thickness is a primary acceptance parameter.'
    },
    {
      description: 'Perform adhesion testing on applied membrane',
      acceptanceCriteria: 'Pull-off adhesion test performed at specified frequency; adhesion strength meets minimum specification (failure should be cohesive in membrane or concrete, not adhesive at interface); test locations documented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Pull-off adhesion test (ASTM D4541 or equivalent)',
      notes: 'Section 691. Adhesion testing verifies membrane is bonded to concrete substrate.'
    },
    {
      description: 'Perform holiday detection testing',
      acceptanceCriteria: 'Holiday detection (spark test or equivalent) performed over entire membrane surface; all holidays (pinholes, gaps, thin spots) identified and repaired; retested after repair; complete coverage confirmed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Holiday detector (spark test)',
      notes: 'Section 691. Holiday detection identifies application defects invisible to the eye.'
    },
    {
      description: 'Treat membrane at details (joints, drains, upstands, penetrations)',
      acceptanceCriteria: 'Membrane turned up at kerbs and upstands to minimum specified height; membrane dressed into drain outlets; expansion joint details as designed; penetrations sealed; all detail areas reinforced with additional membrane layer where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 691. Details are the most vulnerable locations for water ingress.'
    },
    {
      description: 'Cure membrane per manufacturer requirements',
      acceptanceCriteria: 'Curing time and conditions per manufacturer specification; membrane protected from traffic, weather and damage during curing; curing period documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 691. Full cure required before protection layer placement.'
    },
    // =========================================================================
    // PROTECTION & COMPLETION (Items 15-20)
    // =========================================================================
    {
      description: 'Install membrane protection course',
      acceptanceCriteria: 'Protection board or layer installed over cured membrane per specification; protection covers entire membrane area; joints in protection layer offset from membrane seams; no damage to membrane during protection installation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. All membrane types require a protection course to prevent damage from asphalt overlay placement.'
    },
    {
      description: 'Protect membrane during subsequent construction activities',
      acceptanceCriteria: 'Membrane and protection course protected from construction traffic, equipment, welding sparks, falling objects and chemical spills; access controlled; any damage identified and repaired immediately',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Membrane damage during construction negates waterproofing.'
    },
    {
      description: 'Verify drainage details at membrane level',
      acceptanceCriteria: 'Water on membrane surface drains freely to outlets; no ponding areas; drain outlets connected to bridge drainage system; scuppers or weepholes functional at membrane level; falls correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Water trapped above membrane must drain to prevent deterioration.'
    },
    {
      description: 'Coordinate asphalt overlay placement on protection course',
      acceptanceCriteria: 'Asphalt overlay placed per Section 407 requirements; asphalt temperature does not exceed membrane manufacturer maximum; compaction achieved without damaging membrane system; tack coat compatible with protection layer',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691/407. Asphalt placement temperature must not damage membrane.'
    },
    {
      description: 'Compile waterproofing as-built records',
      acceptanceCriteria: 'Complete records including: product batch numbers, application dates, weather conditions, thickness readings, adhesion test results, holiday detection results, detail photos, repair records; product warranty documentation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 691. Records required for warranty and future maintenance planning.'
    },
    {
      description: 'Final waterproofing inspection and Superintendent acceptance',
      acceptanceCriteria: 'All testing complete and results compliant; protection course in place; no visible damage; documentation package complete; manufacturer warranty issued; Superintendent accepts waterproofing works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 691. Superintendent acceptance of waterproofing installation.'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  console.log(`  Seeding: ${templateData.name}...`)
  const existing = await prisma.iTPTemplate.findFirst({
    where: { name: templateData.name, stateSpec: 'VicRoads', projectId: null }
  })
  if (existing) {
    console.log(`  \u26A0\uFE0F  "${templateData.name}" already exists (ID: ${existing.id}). Skipping.`)
    return existing
  }
  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: null,
      name: templateData.name,
      description: templateData.description,
      activityType: templateData.activityType,
      specificationReference: templateData.specificationReference,
      stateSpec: templateData.stateSpec,
      isActive: true,
      checklistItems: {
        create: templateData.checklistItems.map((item, index) => ({
          sequenceNumber: index + 1,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          pointType: item.pointType,
          responsibleParty: item.responsibleParty,
          evidenceRequired: item.evidenceRequired,
          testType: item.testType,
          notes: item.notes
        }))
      }
    },
    include: { checklistItems: true }
  })
  const hp = template.checklistItems.filter(i => i.pointType === 'hold_point').length
  const wp = template.checklistItems.filter(i => i.pointType === 'witness').length
  const sp = template.checklistItems.filter(i => i.pointType === 'standard').length
  console.log(`  \u2705 Created: ${template.name} (${template.checklistItems.length} items: ${hp}H/${wp}W/${sp}S)`)
  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
  console.log(' VIC (VicRoads) ITP Template Seeder - Structures')
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n')
  try {
    await seedTemplate(vicStructuralConcreteTemplate)
    await seedTemplate(vicReinforcementTemplate)
    await seedTemplate(vicPilingTemplate)
    await seedTemplate(vicSteelworkTemplate)
    await seedTemplate(vicBearingsTemplate)
    await seedTemplate(vicPrecastTemplate)
    await seedTemplate(vicPostTensioningTemplate)
    await seedTemplate(vicWaterproofingTemplate)
    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
    console.log(' Seeding Complete! (8 structures templates)')
    console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550')
  } catch (error) {
    console.error('\u274C Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
