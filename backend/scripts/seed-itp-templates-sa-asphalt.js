/**
 * Seed Script: SA (DIT) ITP Templates - Asphalt
 *
 * Creates global ITP templates for SA DIT asphalt and surfacing activities.
 * Templates: Dense Graded Asphalt (RD-BP-S2/C3), Open Graded Asphalt (RD-BP-S2/C3),
 *            Stone Mastic Asphalt (RD-BP-S2/C3), Sprayed Bituminous Surfacing (RD-BP-D2),
 *            Warm Mix / Recycled Asphalt (RD-BP-S2)
 *
 * Run with: node scripts/seed-itp-templates-sa-asphalt.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: DENSE GRADED ASPHALT (DIT RD-BP-S2/C3)
// DIT RD-BP-S2 Supply of Asphalt (supersedes Part R27)
// DIT RD-BP-C3 Construction of Asphalt Pavement (supersedes Part R28)
// Mix types: AC7, AC10, AC14, AC20, AC14 High Binder
// =============================================================================

const saDGATemplate = {
  name: 'Dense Graded Asphalt (DIT RD-BP-S2/C3)',
  description: 'DIT Dense Graded Asphalt including mix design approval, supply verification, placement, compaction, and surface characteristic assessment per RD-BP-S2 (Supply of Asphalt, formerly Part R27) and RD-BP-C3 (Construction of Asphalt Pavement, formerly Part R28). Covers AC7, AC10, AC14, AC20 mix types.',
  activityType: 'asphalt',
  specificationReference: 'RD-BP-S2 / RD-BP-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & MIX DESIGN
    // =========================================================================
    {
      description: 'Submit asphalt mix design for DIT assessment and approval',
      acceptanceCriteria: 'Mix design submitted with all required documentation; design method using gyratory compactor per AS/NZS 2891.2.2 or AGPT-T212; mix type (AC7, AC10, AC14, AC20) as specified; grading within specification envelopes',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2891.2.2 / AGPT-T212',
      notes: 'RD-BP-S2 [VERIFY Cl 4]. HP - Mix design must be approved by Principal\'s Authorised Person before production. Supersedes Part R27.'
    },
    {
      description: 'Confirm DGA mix type matches design specification',
      acceptanceCriteria: 'Mix designation (AC7, AC10, AC14, AC20, AC14 High Binder) as specified for application; nominal aggregate size confirmed; coarse or fine dense grading as required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 4.3/4.4]. HP - Mix type must match design. AC7/AC10 for wearing course, AC14/AC20 for intermediate/base layers.'
    },
    {
      description: 'Verify gyratory compaction design parameters',
      acceptanceCriteria: 'Medium duty category = 80 gyratory cycles; design air voids within target range; average air voids from production tests within +/-0.2% of target',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.2.2 / AGPT-T212',
      notes: 'RD-BP-S2 [VERIFY Cl 4]. Gyratory compaction is the standard design method for SA DIT. SMA and heavy-duty DGA: 80 gyratory cycles.'
    },
    {
      description: 'Submit binder type and compliance certificates',
      acceptanceCriteria: 'Binder type as specified: Class C170 for light duty, polymer modified (A15E, A5E) for medium to heavy duty where specified; compliance with AS 2008',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2008',
      notes: 'RD-BP-S2 [VERIFY Cl 3]. HP - Binder type must be approved by Principal\'s Authorised Person. Fine dense mixes typically use C170.'
    },
    {
      description: 'Submit aggregate source and compliance details',
      acceptanceCriteria: 'Coarse and fine aggregate comply with RD-BP-S2 requirements; source approved; grading within specified envelopes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 3]. Aggregate must comply with DIT material requirements.'
    },
    {
      description: 'Submit production quality plan for asphalt supply',
      acceptanceCriteria: 'Quality plan covers production, transport, placement, and compaction procedures; testing frequencies defined; lot sizes established',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. Quality plan must address all specification requirements.'
    },
    {
      description: 'Submit asphalt production plant details',
      acceptanceCriteria: 'Plant type (batch/continuous) identified; calibration current; capable of producing specified mix within production tolerances per AS 2150',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2. Plant details submitted to Principal\'s Authorised Person.'
    },
    {
      description: 'Submit tack coat / bond coat details',
      acceptanceCriteria: 'Tack coat type, application rate, and procedure compliant with specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 5]. Tack coat details for Principal\'s Authorised Person review.'
    },

    // =========================================================================
    // ADDITIONAL PERFORMANCE TESTING (>5,000 TONNES)
    // =========================================================================
    {
      description: 'Determine if additional performance testing is triggered',
      acceptanceCriteria: 'Assess total asphalt quantity per mix per calendar year; if >5,000 tonnes, additional performance testing required; further testing at every 20,000 tonnes per mix per year',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 6]. Threshold: >5,000 tonnes per mix per calendar year triggers additional testing. Further testing at every 20,000 tonnes per mix per year.'
    },

    // =========================================================================
    // HOLD POINT: CRACK SEALING PRODUCT APPROVAL
    // =========================================================================
    {
      description: 'Submit proposed crack sealing product for approval',
      acceptanceCriteria: 'Crack sealing product details submitted; product suitable for application; Principal\'s Authorised Person approval obtained before use',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 1. HP - Contractor must not use proposed crack sealing product until Hold Point released by Principal\'s Authorised Person.'
    },
    {
      description: 'Complete crack sealing treatment and obtain release',
      acceptanceCriteria: 'Crack sealing treatment completed to specification; all cracks sealed before surfacing works; Hold Point released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 2. HP - Pavement surfacing works must not proceed until crack sealing Hold Point is released.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect and accept existing pavement surface before asphalt placement',
      acceptanceCriteria: 'Existing surface clean, dry, free of loose material; potholes and defects repaired; surface profile acceptable; levels verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 3. HP - Placement of asphalt must not occur until pavement surface preparation Hold Point released by Principal\'s Authorised Person.'
    },
    {
      description: 'Apply tack coat to existing surface',
      acceptanceCriteria: 'Tack coat applied at specified rate; uniform coverage; broken (cured) before asphalt placement; no excess pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 5]. Tack coat critical for interlayer bond.'
    },
    {
      description: 'Verify string lines, level controls, and paver setup',
      acceptanceCriteria: 'String lines set to design levels; paver screed settings checked; automatic level controls functioning where used',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Paver setup verified before placement commences.'
    },
    {
      description: 'Verify edge planing completed where required',
      acceptanceCriteria: 'Edge planing undertaken for each layer to ensure minimum layer thickness is achieved; planed edges clean and ready for asphalt placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Edge planing required for each layer per specification.'
    },

    // =========================================================================
    // PRODUCTION (ASPHALT PLANT)
    // =========================================================================
    {
      description: 'Verify mix production temperature at plant',
      acceptanceCriteria: 'Mix temperature at discharge within specified range per AS 2150 and binder type; Class C170 approx 130-150 deg C; PMB per manufacturer recommendations; temperature recorded for each load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Temperature depends on binder type. Record for each batch.'
    },
    {
      description: 'Conduct production sampling and testing for binder content',
      acceptanceCriteria: 'Binder content within +/-0.3% of job mix binder content; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 (binder content extraction)',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Binder content tolerance: +/-0.3% of job mix value.'
    },
    {
      description: 'Conduct production sampling and testing for grading',
      acceptanceCriteria: 'Grading within specified envelopes; combined grading compliant with mix design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11.1 (Particle Size Distribution)',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Grading compliance monitored per production lot.'
    },
    {
      description: 'Conduct production testing for volumetric properties (air voids)',
      acceptanceCriteria: 'Average air voids from production tests within +/-0.2% of target; production tolerances per AS 2150',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.2.2 (Gyratory), AS/NZS 2891.8',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Average air voids must be within +/-0.2% from the target value.'
    },
    {
      description: 'Verify moisture content of production asphalt',
      acceptanceCriteria: 'Moisture content less than 0.2%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Production asphalt moisture must be <0.2%.'
    },
    {
      description: 'Verify Reclaimed Asphalt Pavement (RAP) content where used in DGA',
      acceptanceCriteria: 'RAP permitted in DGA; RAP source from milling or excavation of existing asphalt; processed to max size no greater than mix being produced; mix design incorporating RAP submitted and approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 4.3/4.4]. RAP permitted in DGA but NOT in OGA or SMA. DIT will not issue additional mix register numbers for <=10% RAP.'
    },

    // =========================================================================
    // TRANSPORT
    // =========================================================================
    {
      description: 'Verify transport conditions prevent heat loss and contamination',
      acceptanceCriteria: 'Trucks covered during transport; temperature loss minimised; no contamination (water, fuel, debris); delivery temperature recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Trucks tarped to maintain temperature.'
    },
    {
      description: 'Verify material temperature on arrival at site',
      acceptanceCriteria: 'Temperature on arrival within specified range for binder type per AS 2150; recorded per load; material rejected if below minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Temperature recorded for each load on arrival.'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Verify weather conditions suitable for placement',
      acceptanceCriteria: 'No rain or pending rain; surface dry; ambient temperature adequate; wind conditions acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Do not place asphalt in rain or on wet surfaces.'
    },
    {
      description: 'Place asphalt at minimum specified temperature',
      acceptanceCriteria: 'Material temperature during placement not below 120 deg C at time of first placement; temperature monitored and recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 6] / AS 2150 Section 12. Minimum compaction temperature 120 deg C.'
    },
    {
      description: 'Verify paver operation and mat quality',
      acceptanceCriteria: 'Paver operating at consistent speed; mat uniform texture; no tearing, segregation, or roller marks; joints properly formed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Continuous monitoring of paver operations during placement.'
    },
    {
      description: 'Form longitudinal and transverse joints correctly',
      acceptanceCriteria: 'Joints straight, well-bonded, smooth, and at specified location; cold joints cut back to sound material; tack coat applied to joint faces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Joint quality critical for waterproofing and ride quality.'
    },
    {
      description: 'Verify asphalt placed adjacent to kerb and gutter within tolerance',
      acceptanceCriteria: 'Wearing course adjacent to kerb and gutter constructed within tolerance of +5 mm, -0 mm; lateral position within +/-50 mm of specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Kerb interface tolerance: +5 mm / -0 mm. Lateral position tolerance: +/-50 mm.'
    },

    // =========================================================================
    // HOLD POINT: BETWEEN LAYERS
    // =========================================================================
    {
      description: 'Between individual layers of asphalt - obtain Hold Point release',
      acceptanceCriteria: 'Previous layer inspected and accepted; level survey confirms compliance; Hold Point released before next layer commences',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 4. HP - Hold Point applies between each individual layer of asphalt. Principal\'s Authorised Person must release.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Commence rolling immediately behind paver',
      acceptanceCriteria: 'Initial (breakdown) rolling commenced as close to paver as possible; material temperature within compaction range; rolling pattern established per AS 2150',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150 Section 13. Breakdown rolling commences immediately. Each course compacted uniformly to full depth and full width.'
    },
    {
      description: 'Complete compaction sequence (breakdown, intermediate, finish rolling)',
      acceptanceCriteria: 'Full rolling pattern completed while material at compaction temperature; no roller marks remaining; surface smooth and even; compacted per AS 2150 Section 13',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150 Section 13. Complete rolling sequence per approved pattern.'
    },

    // =========================================================================
    // CORE EXTRACTION AND AIR VOIDS
    // =========================================================================
    {
      description: 'Extract cores for compaction assessment',
      acceptanceCriteria: 'Cores extracted at random locations within Work Lot; no core within 150 mm of a free edge; no more than one core per lot within proximity limits; tests for density, air voids, and layer thickness on each core',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3 [VERIFY Cl 9]. Core extraction rules: min 150 mm from free edge. Compliance based on random set of tests from each Work Lot.'
    },
    {
      description: 'Assess in-situ air voids compliance from cores',
      acceptanceCriteria: 'In-situ air voids within specified range per mix type: AC10 (4.0-8.0%), AC14 (2.5-7.0%), AC20 (2.5-7.0%), AC14 High Binder (1.0-5.0%), FineAC7 (2.0-6.0%), FineAC10 (2.5-7.0%); relative compaction reported as bulk density percentage of mean maximum density',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3, Table 9.8 (Part R28). Air voids limits per mix type. Mean max density = arithmetic mean of test results for that mix within a Lot. Low and high characteristic values (Lvc, Hvc) calculated statistically.'
    },

    // =========================================================================
    // LAYER THICKNESS AND GEOMETRY
    // =========================================================================
    {
      description: 'Verify layer thickness from cores or survey',
      acceptanceCriteria: 'Thickness within tolerance of design; required thickness written on existing surface at each point with specified level; thickness compliance assessed via core measurements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Thickness verified from acceptance cores or level survey.'
    },
    {
      description: 'Verify level survey of finished surface',
      acceptanceCriteria: 'Finished surface levels within specified tolerance of design levels; cross-fall and longitudinal grade within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Level survey of each completed course.'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Check surface regularity',
      acceptanceCriteria: 'Surface regularity within specified limits; no localised depressions exceeding tolerance under straightedge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: '3m straightedge',
      notes: 'RD-BP-C3 / RD-BP-D4. Surface regularity check.'
    },
    {
      description: 'Measure ride quality (IRI) where specified',
      acceptanceCriteria: 'Wheel path IRI and lane IRI (Quarter Car) within acceptance limits; equipment measuring longitudinal profile in both wheel paths; wavelength range 0.5-50 m; sampling interval max 250 mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'IRI profiler',
      notes: 'RD-BP-D4 (Surface Characteristics of Flexible Pavements, supersedes Part R35). Results must be normally distributed around target values.'
    },
    {
      description: 'Verify surface texture depth where specified',
      acceptanceCriteria: 'Surface texture meets specification for wearing course; each lane divided into 100 m sections for reporting; texture within acceptance limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ATM 250 (modified surface texture depth, pestle method)',
      notes: 'RD-BP-D4. Surface texture target values are preferred mean values for each run.'
    },
    {
      description: 'Measure skid resistance where specified',
      acceptanceCriteria: 'Skid resistance determined using GripTester; reported at 100 m intervals; within specification limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'GripTester',
      notes: 'RD-BP-D4. SA uses GripTester for skid resistance measurement (not SCRIM).'
    },
    {
      description: 'Verify no cracking at completion',
      acceptanceCriteria: 'No cracking permitted at completion or within 2 years of completion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D4 [VERIFY]. 2-year no-cracking requirement for asphalt surfaces.'
    },
    {
      description: 'Inspect surface for defects (bleeding, ravelling, segregation)',
      acceptanceCriteria: 'No visible defects; uniform colour and texture; no fat spots or lean areas; no roller marks or pickup',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Visual assessment of completed surface quality.'
    },

    // =========================================================================
    // BETWEEN ASPHALT AND WATERPROOF MEMBRANE (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'Between asphalt layers and waterproof membrane - obtain Hold Point release (where applicable)',
      acceptanceCriteria: 'Hold Point applies between asphalt layers and waterproof membrane; Principal\'s Authorised Person releases before proceeding',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 5. HP - Hold Point applies between asphalt layers and waterproof membrane where applicable.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit production test results (binder content, grading, volumetrics)',
      acceptanceCriteria: 'Complete production testing records for each production lot; all results within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2. Full production test results package.'
    },
    {
      description: 'Submit temperature records (plant, delivery, placement, compaction)',
      acceptanceCriteria: 'Temperature logs for each load; plant discharge, arrival, placement, and compaction temperatures recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Complete temperature records.'
    },
    {
      description: 'Submit core results (density, air voids, thickness)',
      acceptanceCriteria: 'All core results with calculated in-situ air voids; statistical summary including characteristic values (Lvc, Hvc); compliance assessment per Work Lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3. Core results and air voids reporting per Work Lot.'
    },
    {
      description: 'Submit daily paving records and delivery dockets',
      acceptanceCriteria: 'Paver settings, roller patterns, tonnages placed, areas covered, weather conditions, shift times; all delivery dockets reconciled with total quantities',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3. Daily paving records and docket reconciliation.'
    },
    {
      description: 'Submit surface level survey and as-built data',
      acceptanceCriteria: 'As-built survey showing finished surface levels vs design; layer thickness verification; any variations documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3. As-built survey data.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; air voids compliant; no outstanding nonconformances; lot accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-C3. Final lot acceptance by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: OPEN GRADED ASPHALT (DIT RD-BP-S2/C3)
// DIT RD-BP-S2 Supply of Asphalt (supersedes Part R27)
// DIT RD-BP-C3 Construction of Asphalt Pavement (supersedes Part R28)
// Mix types: OG10, OG14 - permeable wearing course
// =============================================================================

const saOGATemplate = {
  name: 'Open Graded Asphalt (DIT RD-BP-S2/C3)',
  description: 'DIT Open Graded Asphalt (OG10/OG14) for permeable wearing course. Mix design, A15E modified binder, placement, and permeability verification per RD-BP-S2 and RD-BP-C3.',
  activityType: 'asphalt',
  specificationReference: 'RD-BP-S2 / RD-BP-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & MIX DESIGN
    // =========================================================================
    {
      description: 'Submit OGA mix design for DIT assessment and approval',
      acceptanceCriteria: 'Mix design submitted for OG10 or OG14 as specified; design air voids 18-25%; A15E modified binder mandatory; uniformly graded with predominantly coarse aggregate; gyratory compaction design per AS/NZS 2891.2.2',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2891.2.2 / AGPT-T212',
      notes: 'RD-BP-S2 [VERIFY Cl 4]. HP - OGA mix design must be approved by Principal\'s Authorised Person. Must use A15E binder. RAP is NOT permitted in Open Graded Asphalt.'
    },
    {
      description: 'Confirm A15E modified binder supply and compliance',
      acceptanceCriteria: 'Binder is A15E polymer modified; compliance certificates provided; supplier approved; binder compliant with AS 2008 and modification requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2008',
      notes: 'RD-BP-S2 [VERIFY Cl 3]. HP - A15E binder is mandatory for OGA. No substitution without DIT approval.'
    },
    {
      description: 'Verify RAP is NOT included in OGA mix',
      acceptanceCriteria: 'Confirmation that no Reclaimed Asphalt Pavement (RAP) is included in the OGA mix design or production',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. RAP is NOT permitted in Open Graded Asphalt.'
    },
    {
      description: 'Submit aggregate source and compliance for OGA',
      acceptanceCriteria: 'Coarse aggregate compliant with specification; uniformly graded; source approved; aggregate properties verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 3]. OGA requires premium aggregate for open-textured wearing course.'
    },
    {
      description: 'Submit binder drain-down test results',
      acceptanceCriteria: 'Drain-down testing confirms A15E binder does not drain from aggregate skeleton during transport and placement; results within specification limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Drain-down test',
      notes: 'RD-BP-S2 [VERIFY]. Binder drain-down is a critical OGA property. Mix properties of OGA detailed in specification tables.'
    },

    // =========================================================================
    // SURFACE PREPARATION & PLACEMENT
    // =========================================================================
    {
      description: 'Inspect and accept existing surface before OGA placement',
      acceptanceCriteria: 'Existing surface clean, dry, free of loose material; surface profile acceptable; levels verified; Hold Point released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 3. HP - Pavement surface preparation must be released by Principal\'s Authorised Person.'
    },
    {
      description: 'Apply tack coat to substrate surface',
      acceptanceCriteria: 'Tack coat applied at specified rate; uniform coverage; adequately broken before OGA placement; no excess pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 5]. Tack coat adhesion is critical for OGA to prevent delamination.'
    },
    {
      description: 'Verify weather conditions suitable for OGA placement',
      acceptanceCriteria: 'No rain or pending rain; surface dry; ambient temperature adequate; wind speed acceptable; OGA cools rapidly due to open texture',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. OGA is more sensitive to weather than DGA due to rapid heat loss from open texture.'
    },
    {
      description: 'Place OGA at specified temperature',
      acceptanceCriteria: 'Material temperature during placement not below minimum per AS 2150 for A15E binder; temperature monitored and recorded per load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. OGA temperature is critical - too hot causes drain-down, too cold prevents compaction.'
    },
    {
      description: 'Monitor paver operation for OGA',
      acceptanceCriteria: 'Paver at consistent speed; no segregation visible; continuous material feed; hopper maintained at adequate level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. OGA is prone to segregation due to open grading.'
    },

    // =========================================================================
    // COMPACTION & TESTING
    // =========================================================================
    {
      description: 'Compact OGA per specification',
      acceptanceCriteria: 'Compaction per AS 2150 Section 13; compacted uniformly to full depth and width; static steel roller typically used for OGA',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150 Section 13. OGA typically compacted with static rollers to avoid crushing the open matrix.'
    },
    {
      description: 'Extract cores and test in-situ air voids for OGA',
      acceptanceCriteria: 'In-situ air voids within range: 18.0-25.0%; relative compaction reported as bulk density percentage of mean maximum density; cores per Work Lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3, Table 9.8 (Part R28). OGA air voids: 18.0-25.0%. High voids required for permeability function.'
    },
    {
      description: 'Verify OGA permeability',
      acceptanceCriteria: 'Permeability meets specification requirements; high air void content (18-25%) provides inherent permeability; no ponding on surface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. Permeability is the primary functional requirement for OGA.'
    },
    {
      description: 'Verify OGA layer thickness from core measurements',
      acceptanceCriteria: 'Mean thickness not less than design thickness; no individual core less than design minus tolerance; assumed density for OGA: 1,900 kg/m3',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core measurement',
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Assumed density for OGA is 1,900 kg/m3 (vs 2,400 kg/m3 for DGA).'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Measure surface texture depth of completed OGA',
      acceptanceCriteria: 'Texture depth approximately 0.9 mm for OG14; measured using pestle method per ATM 250; consistent texture across full width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ATM 250 (modified surface texture depth, pestle method)',
      notes: 'RD-BP-D4. OG14 texture depth approximately 0.9 mm per DIT documentation.'
    },
    {
      description: 'Verify surface level of completed OGA against design levels',
      acceptanceCriteria: 'Surface level within specified tolerance of design; no localised depressions; crossfall within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / straightedge',
      notes: 'RD-BP-C3 / RD-BP-D4. Surface levels checked.'
    },
    {
      description: 'Production testing for binder content and grading compliance',
      acceptanceCriteria: 'Binder content within +/-0.3% of job mix; grading within envelopes; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 / AS 1141.11.1',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Standard production QC for OGA.'
    },

    // =========================================================================
    // DOCUMENTATION & ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile and submit all OGA production, placement, and testing records',
      acceptanceCriteria: 'Complete records including: mix design, production temperatures, placement records, core results (density, air voids, thickness), texture depth, permeability, surface levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. All test results and inspection records compiled per lot.'
    },
    {
      description: 'Inspect OGA surface after initial trafficking',
      acceptanceCriteria: 'No excessive stone loss or ravelling; no delamination from substrate; surface draining freely; no fat spots or bleeding',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Post-trafficking inspection critical for OGA performance verification.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results within specification; all hold points released; all non-conformances resolved; lot accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-C3. Final lot acceptance by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 3: STONE MASTIC ASPHALT (DIT RD-BP-S2/C3)
// DIT RD-BP-S2 Supply of Asphalt (supersedes Part R27)
// DIT RD-BP-C3 Construction of Asphalt Pavement (supersedes Part R28)
// Mix type: SMA10 - gap-graded wearing course
// =============================================================================

const saSMATemplate = {
  name: 'Stone Mastic Asphalt (DIT RD-BP-S2/C3)',
  description: 'DIT Stone Mastic Asphalt (SMA10) wearing course. Mix design including fibre content, drain-down testing, modified binder, and construction per RD-BP-S2 and RD-BP-C3.',
  activityType: 'asphalt',
  specificationReference: 'RD-BP-S2 / RD-BP-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & MIX DESIGN
    // =========================================================================
    {
      description: 'Submit SMA10 mix design for DIT assessment and approval',
      acceptanceCriteria: 'Mix design submitted for SMA10 (10 mm nominal size); grading within SMA envelopes; gyratory compaction at 80 cycles (medium duty); modified binder specified; fibre content documented; design approved by DIT',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2891.2.2 / AGPT-T212',
      notes: 'RD-BP-S2 [VERIFY Cl 4]. HP - SMA10 mix design must be approved by Principal\'s Authorised Person. SMA10 is classified as a "special asphalt mix" under RD-BP-S2.'
    },
    {
      description: 'Confirm modified binder type for SMA',
      acceptanceCriteria: 'Binder type A5E (primary) for medium to heavy duty traffic; A15E for light to medium duty subject to DIT approval; compliance certificates provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2008',
      notes: 'RD-BP-S2 [VERIFY Cl 3]. HP - SMA requires modified binder. A5E is primary; A15E for light/medium duty subject to DIT approval.'
    },
    {
      description: 'Verify fibre content in SMA mix design',
      acceptanceCriteria: 'Minimum 0.3% cellulose fibre by mass included in mix design; filler, fibre type, and source nominated in submission',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. Min 0.3% cellulose fibre by mass required to reduce binder drain-down.'
    },
    {
      description: 'Submit binder drain-down test results for SMA',
      acceptanceCriteria: 'Drain-down test results demonstrate binder stability at production temperature; cellulose fibre addition (min 0.3%) effective in preventing drain-down',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Drain-down test',
      notes: 'RD-BP-S2 [VERIFY]. HP - Drain-down testing is required for SMA mixes. Results form part of mix design submission to DIT.'
    },
    {
      description: 'Verify RAP is NOT included in SMA mix',
      acceptanceCriteria: 'Confirmation that no Reclaimed Asphalt Pavement (RAP) is included in the SMA mix design or production',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. RAP is NOT permitted in Stone Mastic Asphalt.'
    },
    {
      description: 'Submit aggregate source and compliance for SMA',
      acceptanceCriteria: 'Coarse aggregate compliant with specification; gap grading maintained; source approved; aggregate properties verified for stone-on-stone contact',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 3]. SMA performance depends on stone-on-stone contact of coarse aggregate.'
    },

    // =========================================================================
    // ADDITIONAL PERFORMANCE TESTING (SMA10 SPECIAL MIX)
    // =========================================================================
    {
      description: 'Determine if additional performance testing is triggered for SMA10',
      acceptanceCriteria: 'SMA10 classified as special asphalt mix - additional performance testing required; assess total quantity per calendar year; threshold >5,000 tonnes per mix per year',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 6]. SMA10 is a "special asphalt mix" triggering additional performance testing requirements. Also triggered at >5,000 tonnes per mix per calendar year.'
    },

    // =========================================================================
    // SURFACE PREPARATION & HOLD POINTS
    // =========================================================================
    {
      description: 'Inspect and accept existing surface before SMA placement',
      acceptanceCriteria: 'Surface clean, dry, free of loose material; milled surfaces cleaned; repairs completed; Hold Point released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 3. HP - Surface preparation must be released by Principal\'s Authorised Person.'
    },
    {
      description: 'Apply tack coat to substrate surface for SMA',
      acceptanceCriteria: 'Tack coat applied at design rate; uniform coverage; adequately broken before SMA placement; rate adjusted for milled vs existing surfaces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 [VERIFY Cl 5]. Tack coat rate may need adjustment for milled surfaces.'
    },

    // =========================================================================
    // PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Monitor weather conditions during SMA placement',
      acceptanceCriteria: 'No rain; surface dry; ambient temperature adequate; wind conditions acceptable for gap-graded mix placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. SMA may have more restrictive weather limits due to gap-graded mix compaction requirements.'
    },
    {
      description: 'Place SMA at specified temperature and monitor placement quality',
      acceptanceCriteria: 'Material temperature during placement not below minimum per AS 2150; paver at consistent speed; no segregation; continuous material feed; temperature recorded per load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. SMA temperature control critical - excessive temperature causes drain-down even with fibres.'
    },
    {
      description: 'Compact SMA per specification',
      acceptanceCriteria: 'Rolling pattern as approved; compaction per AS 2150 Section 13; no displacement of aggregate skeleton; surface closed but not over-compacted; no crushing of stone skeleton',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150 Section 13. SMA compaction is delicate - over-rolling crushes the stone skeleton and reduces surface texture.'
    },
    {
      description: 'Form joints in SMA correctly',
      acceptanceCriteria: 'Cold joints cut back to sound material; tack coat applied to joint face; joints compacted within temperature window; no open or segregated joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. SMA joints require careful execution due to gap-graded mix.'
    },

    // =========================================================================
    // CORE EXTRACTION AND TESTING
    // =========================================================================
    {
      description: 'Extract cores and test in-situ air voids for SMA',
      acceptanceCriteria: 'In-situ air voids within range: 2.5-7.0%; relative compaction reported; cores per Work Lot; no core within 150 mm of free edge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3, Table 9.8 (Part R28). SMA air voids: 2.5-7.0%. Compliance based on Work Lot analysis.'
    },
    {
      description: 'Verify SMA layer thickness from cores',
      acceptanceCriteria: 'Mean thickness not less than design thickness; thickness determined from density cores',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core measurement',
      notes: 'RD-BP-C3 [VERIFY Cl 7]. Assumed density for SMA: 2,400 kg/m3.'
    },

    // =========================================================================
    // PRODUCTION MIX COMPLIANCE
    // =========================================================================
    {
      description: 'Sample and test SMA production mix for binder content',
      acceptanceCriteria: 'Binder content within +/-0.3% of job mix value; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. SMA binder content verification per production lot.'
    },
    {
      description: 'Sample and test SMA production mix for grading',
      acceptanceCriteria: 'Grading within SMA envelopes; gap grading maintained; production tolerances per AS 2150',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11.1',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. SMA gap grading must be maintained in production.'
    },
    {
      description: 'Verify fibre content in SMA production samples',
      acceptanceCriteria: 'Cellulose fibre content minimum 0.3% by mass; consistent dosing demonstrated; fibre stored dry and uncontaminated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. Fibre content must be verified during production. Min 0.3% cellulose fibre.'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Measure surface texture depth of completed SMA',
      acceptanceCriteria: 'Surface texture meets specification for SMA wearing course; consistent texture across full width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ATM 250 (modified surface texture depth, pestle method)',
      notes: 'RD-BP-D4. SMA should have higher macro-texture than DGA but lower than OGA.'
    },
    {
      description: 'Assess surface for binder-rich (fat) spots',
      acceptanceCriteria: 'No visible fat spots or binder-rich areas; uniform surface appearance; no bleeding under trafficking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3. Fat spots in SMA indicate either drain-down or over-compaction.'
    },

    // =========================================================================
    // DOCUMENTATION & ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile and submit all SMA production, placement, and testing records',
      acceptanceCriteria: 'Complete records including: mix design, fibre dosing records, drain-down results, production temperatures, placement records, core results, texture depth, surface levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. Records include fibre content verification specific to SMA.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results within specification limits; all hold points released; all non-conformances resolved; fibre content verified; lot accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-C3. Final lot acceptance by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 4: SPRAYED BITUMINOUS SURFACING (DIT RD-BP-D2)
// DIT RD-BP-D2 Design and Application of Sprayed Bituminous Surfacing
// (supersedes Part R26 / R26DA)
// Covers: Priming, Primer sealing, Resealing, Single/Double seals
// =============================================================================

const saSprayedSealTemplate = {
  name: 'Sprayed Bituminous Surfacing (DIT RD-BP-D2)',
  description: 'DIT Sprayed Bituminous Surfacing including priming, primer sealing, and resealing per RD-BP-D2 (Design and Application of Sprayed Bituminous Surfacing, formerly Part R26/R26DA). Covers binder application, aggregate spreading, and embedment.',
  activityType: 'asphalt',
  specificationReference: 'RD-BP-D2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & DESIGN
    // =========================================================================
    {
      description: 'Submit seal design for the sprayed bituminous surfacing',
      acceptanceCriteria: 'Seal design submitted including treatment type (priming, primer sealing, single/double seal, reseal, geotextile seal); binder type and application rate; aggregate size and spread rate; design compliant with Austroads methodology',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 5]. HP - Seal design must be approved by Principal\'s Authorised Person before works commence. Supersedes Part R26/R26DA.'
    },
    {
      description: 'Submit quality plan for sprayed sealing works',
      acceptanceCriteria: 'Quality plan covers proposed equipment, operator qualifications, weather monitoring, application procedures, traffic management, and testing schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2. Quality plan must detail sprayer calibration, aggregate spreader calibration, and rolling procedures.'
    },
    {
      description: 'Submit binder supply documentation and compliance (per RD-BP-S1)',
      acceptanceCriteria: 'Binder type matches seal design; compliance with RD-BP-S1 (Supply of Bituminous Material, supersedes Part R25); binder grades may include CRS170/67, S10E, S35E, multigrade per AS 2008; flux and cutter per RD-BP-S1',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2008',
      notes: 'RD-BP-S1 / RD-BP-D2 [VERIFY]. HP - Binder supply must comply with RD-BP-S1 (supersedes Part R25). PMB grades tested for consistency and elastic recovery.'
    },
    {
      description: 'Submit aggregate test results for sprayed seal aggregate',
      acceptanceCriteria: 'Aggregate tested for size, shape, cleanliness, stripping resistance, and durability; aggregate compliant with specification requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 4]. HP - Aggregate quality is fundamental to seal performance.'
    },

    // =========================================================================
    // EQUIPMENT VERIFICATION
    // =========================================================================
    {
      description: 'Verify calibration of bitumen sprayer',
      acceptanceCriteria: 'Sprayer calibrated to deliver within +/-5% of design application rate for primer, primer binder, binder, and overspray; uniform transverse distribution; nozzles clean and at correct angle; temperature gauge calibrated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Sprayer calibration (tray test)',
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Application rate tolerance: +/-5% of specified rate. Tolerance for short bar runs and hand spray: +/-20%.'
    },
    {
      description: 'Verify calibration of aggregate spreader',
      acceptanceCriteria: 'Spreader delivers uniform aggregate across full width; spread rate within tolerance of design; no gaps or heavy spots',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tray test or area measurement',
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Aggregate spread rate monitored during works.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect pavement surface condition and preparation',
      acceptanceCriteria: 'Pavement cleaned free of loose material so primer will be absorbed or binder will adhere without prilling; surface shaped to required profile; potholes and defects repaired; dust and dirt removed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 6]. Surface must be prepared so primer absorbs into base or binder adheres to existing seal.'
    },
    {
      description: 'Verify weather conditions suitable for seal application',
      acceptanceCriteria: 'Priming and initial sealing only when prevailing weather conditions have a risk rating of \'low\' or less; no rain during or pending; appropriate work practices in place',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 6]. Weather risk rating must be \'low\' or less for priming and initial sealing.'
    },

    // =========================================================================
    // PRIMER APPLICATION (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'Apply primer to granular pavement surface at specified rate',
      acceptanceCriteria: 'Primer applied at design rate; application rate within +/-5% tolerance; uniform application; penetration into pavement surface achieved; no pooling or run-off',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Primer must be absorbed into the base. Binder volumes determined by dip stick measurement.'
    },
    {
      description: 'Allow primer to cure for required period',
      acceptanceCriteria: 'Primer cured for minimum 28 days (industry/DIT consensus) for volatiles to escape before applying new seals; surface stable under traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2. Industry/DIT consensus of 28 days curing for volatiles to escape before new seal application.'
    },

    // =========================================================================
    // HOLD POINT: BINDER APPLICATION
    // =========================================================================
    {
      description: 'Obtain Hold Point release before binder application',
      acceptanceCriteria: 'Surface preparation complete; equipment calibrated; weather conditions suitable; Hold Point released by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-D2, Table RD-BP-D2 10-1 [VERIFY]. HP - Binder must not be applied until Hold Point released.'
    },

    // =========================================================================
    // SEAL APPLICATION - BINDER SPRAYING
    // =========================================================================
    {
      description: 'Verify binder temperature at sprayer before application',
      acceptanceCriteria: 'Binder temperature within specified range for binder type; temperature recorded and documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Calibrated thermometer',
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Correct binder viscosity at application depends on temperature.'
    },
    {
      description: 'Monitor binder application rate during spraying',
      acceptanceCriteria: 'Binder application rate within +/-5% of design rate; uniform transverse distribution; no misses, double sprays, or edge issues',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Area/volume calculation',
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Application rate tolerance: +/-5%. Short bar runs and hand spray: +/-20%.'
    },
    {
      description: 'Field sampling of binder during application',
      acceptanceCriteria: 'Binder sampled during application for compliance verification; sample retained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY]. Field sampling of binder is a quality control requirement.'
    },

    // =========================================================================
    // SEAL APPLICATION - AGGREGATE SPREADING
    // =========================================================================
    {
      description: 'Spread aggregate immediately following binder application',
      acceptanceCriteria: 'Aggregate spread immediately after binder; uniform one-stone-thick coverage; spread rate per design; no bare patches or double coverage; precoat applied where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Minimise delay between binder application and aggregate spreading. Precoat application required.'
    },
    {
      description: 'Monitor aggregate spread rate and uniformity',
      acceptanceCriteria: 'Spread rate within tolerance of design; uniform single stone layer; no clumps or bare areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Aggregate spread rate monitored during works.'
    },

    // =========================================================================
    // ROLLING AND EMBEDMENT
    // =========================================================================
    {
      description: 'Roll aggregate immediately after spreading to achieve embedment',
      acceptanceCriteria: 'Rolling commences immediately after aggregate spreading; minimum passes completed; aggregate seated in binder; no crushing of aggregate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Rolling critical for aggregate retention. Pneumatic tyre roller preferred.'
    },
    {
      description: 'Verify embedment of aggregate',
      acceptanceCriteria: 'Aggregate adequately embedded into binder; embedment factor accounted for in binder application rate design; no over-embedment causing flushing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 8]. Embedment of aggregate is a factor affecting design of binder application rates.'
    },

    // =========================================================================
    // DOUBLE SEAL (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'For double seals: apply second binder coat and aggregate at specified rates',
      acceptanceCriteria: 'Second application per design (e.g., 10/5 mm or 14/7 mm); second binder rate per design; smaller aggregate spread uniformly; rolled to embed; interlocking achieved',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY Cl 7]. Double/double seals (e.g., 10/5 mm, 14/7 mm) using CRS170/67 or other specified binder.'
    },

    // =========================================================================
    // POST-APPLICATION QUALITY
    // =========================================================================
    {
      description: 'Assess surface texture of completed seal',
      acceptanceCriteria: 'Surface texture uniform and consistent; texture depth requirements per RD-BP-D3 (Surface Characteristics of Spray Seals)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ATM 250 or equivalent',
      notes: 'RD-BP-D3 (Surface Characteristics of Spray Seals, supersedes Part R35 partial). Texture requirements for completed sprayed seals.'
    },
    {
      description: 'Assess aggregate retention during and after initial trafficking',
      acceptanceCriteria: 'No excessive stone loss; aggregate firmly embedded; no widespread stripping; loose stones swept and removed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2. Aggregate retention assessed after initial trafficking.'
    },
    {
      description: 'Assess surface for bleeding/flushing',
      acceptanceCriteria: 'No visible bleeding or flushing in wheel paths or elsewhere; binder not exceeding aggregate surface level; uniform appearance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 / RD-BP-D3. Bleeding indicates excess binder or over-embedment.'
    },
    {
      description: 'Verify adhesion of seal',
      acceptanceCriteria: 'Adhesion testing where specified; adequate bond between binder and aggregate; no stripping under traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-BP-D2 / RD-BP-D3. Adhesion verified through performance monitoring.'
    },

    // =========================================================================
    // TRAFFIC MANAGEMENT & DOCUMENTATION
    // =========================================================================
    {
      description: 'Implement post-seal traffic management and sweeping',
      acceptanceCriteria: 'Speed limit reduced for initial period; loose stone swept regularly; protection from contamination; DPTI 397 daily record sheet completed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 [VERIFY]. Contractors must complete form DPTI 397 "Seal Coat Treatment - Daily Record Sheet".'
    },
    {
      description: 'Compile and submit all seal design, application, and quality records',
      acceptanceCriteria: 'Complete records: seal design, binder delivery/temperature, application rates (actual vs design), aggregate dockets, weather records, rolling records, DPTI 397 forms, post-seal inspection reports',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2. All records submitted to Principal\'s Authorised Person.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results and inspections within specification; all hold points released; texture and retention acceptable; no unresolved non-conformances; lot accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-D2. Final lot acceptance by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 5: WARM MIX / RECYCLED ASPHALT (DIT RD-BP-S2)
// DIT RD-BP-S2 Supply of Asphalt (supersedes Part R27)
// WMA is a permitted variation within RD-BP-S2, not a separate specification
// RAP usage is addressed within RD-BP-S2
// =============================================================================

const saWMARecycledTemplate = {
  name: 'Warm Mix / Recycled Asphalt (DIT RD-BP-S2)',
  description: 'DIT Warm Mix Asphalt and Recycled Asphalt Pavement (RAP) content verification within DGA supply. WMA additives and RAP percentage compliance per RD-BP-S2.',
  activityType: 'asphalt',
  specificationReference: 'RD-BP-S2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // WMA ADDITIVE APPROVAL
    // =========================================================================
    {
      description: 'Submit WMA additive or foaming technique for prior approval',
      acceptanceCriteria: 'WMA technology type documented (additive or foaming technique); prior approval obtained from DIT; product data sheets submitted; additive compatible with binder and aggregates; DIT will not issue additional mix register numbers for WMA variants',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. HP - Subject to prior approval, Contractor may use additive or foaming technique to reduce temperatures. DIT will not issue additional mix register numbers for WMA.'
    },
    {
      description: 'Submit testing temperature of gyratory compaction for WMA',
      acceptanceCriteria: 'Testing temperature of gyratory compaction documented when WMA additives or foaming techniques are used; results demonstrate compliance at reduced temperature',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2891.2.2 / AGPT-T212',
      notes: 'RD-BP-S2 [VERIFY]. Contractor must provide gyratory compaction testing temperature when WMA is used.'
    },
    {
      description: 'Submit mix design incorporating WMA for DIT assessment',
      acceptanceCriteria: 'Mix design demonstrates compliance with RD-BP-S2 volumetric and performance requirements at reduced production temperature; WMA additive dosage per manufacturer recommendation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. HP - Mix design with WMA must be approved by Principal\'s Authorised Person. Typical temperature reduction of 20-30 deg C below conventional HMA.'
    },

    // =========================================================================
    // RAP SOURCE & CONTENT VERIFICATION
    // =========================================================================
    {
      description: 'Verify RAP source and processing (if RAP used)',
      acceptanceCriteria: 'RAP obtained from milling or excavation of existing asphalt pavements or asphalt plant waste; crushed and screened to ensure max size no greater than maximum size of asphalt being produced',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. RAP source must be documented. RAP must be crushed and screened to appropriate size.'
    },
    {
      description: 'Submit mix design incorporating RAP for DIT assessment',
      acceptanceCriteria: 'Mix design incorporating RAP submitted; RAP percentage documented; design meets requirements of Cl 4.3 (Coarse Dense Mix) or Cl 4.4 (Fine Dense Mix) of RD-BP-S2; approved by DIT',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY Cl 4.3/4.4]. HP - Mix design with RAP must be approved. DIT will not issue additional mix register numbers for mixes with 10% or less RAP.'
    },
    {
      description: 'Confirm RAP is NOT used in OGA or SMA mixes',
      acceptanceCriteria: 'RAP is NOT permitted in Open Graded Asphalt (OGA) or Stone Mastic Asphalt (SMA); confirmation provided that RAP is only used in permitted DGA mixes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. RAP NOT permitted in OGA or SMA. RAP permitted only in DGA mixes.'
    },

    // =========================================================================
    // PRODUCTION
    // =========================================================================
    {
      description: 'Verify asphalt plant capability for WMA and/or RAP production',
      acceptanceCriteria: 'Plant capable of achieving specified WMA production temperature (typically 20-30 deg C below conventional HMA); RAP feed system operational and calibrated where applicable; temperature monitoring at discharge',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. Plant capability verified before production commences.'
    },
    {
      description: 'Monitor WMA production temperature',
      acceptanceCriteria: 'Production temperature within specified reduced range per WMA technology; typical reduction of 20-30 deg C below conventional HMA; temperature recorded for each load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3 [VERIFY]. WMA production temperature lower than conventional HMA using organic additives.'
    },
    {
      description: 'Verify RAP dosing rate during production (if RAP used)',
      acceptanceCriteria: 'RAP feed rate monitored and within tolerance of target percentage; RAP distribution uniform throughout mix; no clumping or segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 [VERIFY]. RAP dosing accuracy affects mix properties.'
    },
    {
      description: 'Production quality control - sampling and testing',
      acceptanceCriteria: 'Asphalt sampled at specified frequency; binder content within +/-0.3% of job mix; grading within envelopes; average air voids within +/-0.2% of target; moisture <0.2%; production tolerances per AS 2150',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 / AS 1141.11.1 / AS/NZS 2891.2.2',
      notes: 'RD-BP-S2 [VERIFY Cl 5]. Standard production QC applies equally to WMA and RAP mixes.'
    },

    // =========================================================================
    // PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Verify surface preparation and tack coat before placement',
      acceptanceCriteria: 'Surface clean, dry, free of loose material; tack coat applied and broken; Hold Point released for surface preparation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-C3 Hold Point 3. HP - Standard surface preparation applies. Principal\'s Authorised Person must release.'
    },
    {
      description: 'Place WMA/RAP asphalt at specified temperature',
      acceptanceCriteria: 'Material temperature during placement adequate for compaction; compaction requirements must still be met per RD-BP-C3; paver operation normal; mat quality acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-C3 / AS 2150. Where placement temperature is reduced (WMA), compaction requirements must still be met per RD-BP-C3.'
    },
    {
      description: 'Compact WMA/RAP asphalt to specification',
      acceptanceCriteria: 'Compaction per AS 2150 Section 13; density requirements met; WMA may have narrower compaction window; rolling pattern as approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3 / AS 2150 Section 13. WMA compaction window may be narrower than conventional HMA.'
    },
    {
      description: 'Extract cores and verify in-situ air voids',
      acceptanceCriteria: 'In-situ air voids within range for mix type per standard DGA criteria; same acceptance limits apply as conventional HMA',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.8',
      notes: 'RD-BP-C3, Table 9.8 (Part R28). Standard air voids acceptance criteria apply to WMA/RAP mixes.'
    },
    {
      description: 'Verify layer thickness and surface quality',
      acceptanceCriteria: 'Thickness within tolerance; surface texture and ride quality meet specification; no defects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / ATM 250',
      notes: 'RD-BP-C3 / RD-BP-D4. Standard surface quality requirements apply equally to WMA/RAP and conventional mixes.'
    },

    // =========================================================================
    // DOCUMENTATION & ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile RAP/recycled content documentation',
      acceptanceCriteria: 'RAP source records, RAP processing records, actual RAP percentage in each production lot documented; WMA additive usage documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2. RAP and WMA content documentation for traceability.'
    },
    {
      description: 'Compile WMA production temperature records',
      acceptanceCriteria: 'Production temperatures recorded per load; comparison with conventional HMA temperature requirements; energy savings documented where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. WMA temperature records support verification of reduced temperature approach.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results within specification; density, thickness, and volumetric properties compliant; as-built records complete; WMA/RAP content verified; lot accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'RD-BP-S2 / RD-BP-C3. Final lot acceptance by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  console.log(`  Seeding: ${templateData.name}...`)

  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: templateData.name,
      stateSpec: 'DIT',
      projectId: null
    }
  })

  if (existing) {
    console.log(`  ⚠️  "${templateData.name}" already exists (ID: ${existing.id}). Skipping.`)
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
    include: {
      checklistItems: true
    }
  })

  // Print summary with hold/witness/standard counts
  const hp = template.checklistItems.filter(i => i.pointType === 'hold_point').length
  const wp = template.checklistItems.filter(i => i.pointType === 'witness').length
  const sp = template.checklistItems.filter(i => i.pointType === 'standard').length
  console.log(`  ✅ Created: ${template.name} (${template.checklistItems.length} items: ${hp}H/${wp}W/${sp}S)`)

  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SA (DIT) ITP Template Seeder - Asphalt')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saDGATemplate)
    await seedTemplate(saOGATemplate)
    await seedTemplate(saSMATemplate)
    await seedTemplate(saSprayedSealTemplate)
    await seedTemplate(saWMARecycledTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 asphalt templates)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
