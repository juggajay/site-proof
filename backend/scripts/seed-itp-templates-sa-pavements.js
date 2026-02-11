/**
 * Seed Script: SA (DIT) ITP Templates - Pavements
 *
 * Creates global ITP templates for SA pavement activities based on
 * Department for Infrastructure and Transport (DIT) Master Specifications
 * and legacy Division R specifications.
 *
 * Templates:
 *   1. Unbound Granular Pavements (DIT RD-PV-C1/S1)
 *   2. Cement Treated Crushed Rock (DIT RD-PV-S2)
 *   3. Stabilised Pavements — In-situ (DIT RD-PV-C3)
 *   4. Concrete Pavement (DIT RD-PV-D3)
 *
 * Run with: node scripts/seed-itp-templates-sa-pavements.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// 1. SA UNBOUND GRANULAR PAVEMENTS (DIT RD-PV-C1/S1)
// =============================================================================

const saUnboundGranularPavementTemplate = {
  name: 'Unbound Granular Pavements (DIT RD-PV-C1/S1)',
  description: 'DIT unbound granular pavement construction including crushed rock base and subbase per RD-PV-C1 (Construction of Unstabilised Granular Pavements) and RD-PV-S1 (Supply of Pavement Materials, formerly Part R15). Covers PM1/20, PM2/20, PM3 material classes.',
  activityType: 'pavements',
  specificationReference: 'RD-PV-C1 / RD-PV-S1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit construction procedures for unbound granular pavement works',
      acceptanceCriteria: 'Construction procedures reviewed and accepted by Principal\'s Authorised Person; includes materials, equipment, compaction methodology, lot layout, and testing regime per RD-PV-C1',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1. HP — Work shall not commence until construction procedures are accepted by Principal\'s Authorised Person.'
    },
    {
      description: 'Submit material source approval and conformance documentation',
      acceptanceCriteria: 'Material source identified and approved; quarry/source investigation report provided; material classification (PM1/20, PM2/20, or PM3) confirmed; NATA endorsed test results submitted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S1 (formerly Part R15). HP — Material source must be approved before supply commences. All test results must be NATA endorsed.'
    },
    {
      description: 'Confirm pavement material class matches design specification',
      acceptanceCriteria: 'PM1/20 (Class 1 basecourse), PM2/20 (Class 2 basecourse/upper subbase), or PM3 (Class 3 subbase) as specified in pavement design (RD-PV-D1); material designation confirmed on conformance certificates',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S1. PM1 = Class 1 road base (highest quality); PM2 = Class 2 road base; PM3 = Class 3 subbase.'
    },

    // =========================================================================
    // MATERIAL COMPLIANCE — PM1/20 (CLASS 1)
    // =========================================================================
    {
      description: 'Verify PM1/20 grading compliance using square aperture sieves (AS 1152)',
      acceptanceCriteria: 'Grading within specified envelope per RD-PV-S1 / Part R15 Attachment A; tested using AS 1152 square aperture sieves; Pressure Filter Method used for grading determination; all sieve sizes within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1152 (Square Aperture Sieves) / Pressure Filter Method',
      notes: 'RD-PV-S1, Part R15 Attachment A. Sieve sizes typically 26.5mm, 19.0mm, 13.2mm, 9.5mm, 4.75mm, 2.36mm, 0.425mm, 0.075mm.'
    },
    {
      description: 'Verify Plasticity Index (PI) of PM1/20 material',
      acceptanceCriteria: 'PI within specified limits per RD-PV-S1 for Class 1 material [VERIFY exact PI limits from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1',
      notes: 'RD-PV-S1. PI limits differ by material class. NATA endorsed results required.'
    },
    {
      description: 'Verify LA Abrasion value of PM1/20 material',
      acceptanceCriteria: 'LA Abrasion value does not exceed specified maximum per RD-PV-S1 [VERIFY exact limit from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.23 (LA Abrasion)',
      notes: 'RD-PV-S1. NATA endorsed results required.'
    },
    {
      description: 'Verify Aggregate Crushing Value of PM1/20 material',
      acceptanceCriteria: 'Aggregate Crushing Value does not exceed specified maximum per RD-PV-S1 [VERIFY exact limit from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.21 (Aggregate Crushing Value)',
      notes: 'RD-PV-S1. NATA endorsed results required.'
    },
    {
      description: 'Verify Flakiness Index of PM1/20 material',
      acceptanceCriteria: 'Flakiness Index does not exceed specified maximum per RD-PV-S1 [VERIFY exact limit from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.15 (Flakiness Index)',
      notes: 'RD-PV-S1. NATA endorsed results required.'
    },
    {
      description: 'Verify CBR of PM1/20 material',
      acceptanceCriteria: 'CBR meets specified minimum for Class 1 material per RD-PV-S1 [VERIFY exact CBR requirement from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.6.1.1 (CBR)',
      notes: 'RD-PV-S1. NATA endorsed results required.'
    },
    {
      description: 'Verify wet/dry strength variation of PM1/20 material',
      acceptanceCriteria: 'Wet/dry strength variation within specified limit per RD-PV-S1 [VERIFY exact limit from Part R15 Attachment A]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.22 (Wet/Dry Strength Variation)',
      notes: 'RD-PV-S1. NATA endorsed results required.'
    },

    // =========================================================================
    // MATERIAL COMPLIANCE — PM2/20 (CLASS 2) AND PM3 (CLASS 3)
    // =========================================================================
    {
      description: 'Verify PM2/20 or PM3 material conformance testing',
      acceptanceCriteria: 'All material properties (grading, PI, LA Abrasion, Aggregate Crushing Value, Flakiness Index, CBR) within specified limits for relevant class per RD-PV-S1 / Part R15 Attachment A',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Multiple (per RD-PV-S1)',
      notes: 'RD-PV-S1, Part R15 Attachment A. PM2/20 = Class 2 basecourse/upper subbase; PM3 = Class 3 subbase. NATA endorsed results required.'
    },
    {
      description: 'Submit NATA endorsed test certificates for all pavement material properties',
      acceptanceCriteria: 'Complete suite of NATA endorsed test results provided for material class; certificates current and traceable to delivered material batches',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S1. All material shall be clean, sound, hard and durable. All test results must be NATA endorsed.'
    },

    // =========================================================================
    // SUBGRADE/FORMATION ACCEPTANCE
    // =========================================================================
    {
      description: 'Verify subgrade/formation has been accepted and released (from Earthworks ITP)',
      acceptanceCriteria: 'Formation release documentation held; proof rolling completed per RD-EW-C1 (no deformation, rutting, softness, yielding, distress or instability); compaction verified via TP 320',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1, RD-EW-C1. HP — Subgrade must be accepted by Principal\'s Authorised Person before pavement placement commences.'
    },
    {
      description: 'Verify subgrade level and shape prior to pavement placement',
      acceptanceCriteria: 'Subgrade level within specified tolerance of design; no ponding water; adequate drainage; cross-fall correct; rock subgrade blinded with subbase material where applicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C1. Rock subgrade must be blinded with subbase material and graded, shaped and compacted to produce a tight dense surface.'
    },

    // =========================================================================
    // PLACEMENT AND COMPACTION
    // =========================================================================
    {
      description: 'Place crushed rock in layers not exceeding maximum compacted thickness',
      acceptanceCriteria: 'Maximum compacted layer thickness per RD-PV-C1; even spreading achieved; no segregation; material moisture conditioned prior to compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C1. Layer thickness as specified in contract documentation.'
    },
    {
      description: 'Moisture condition pavement material during compaction',
      acceptanceCriteria: 'Material moisture content appropriate for achieving specified density; uniform moisture throughout layer; moisture conditioning documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320 (Moisture Variation)',
      notes: 'RD-PV-C1, TP 320. Moisture control critical for achieving target density ratio.'
    },
    {
      description: 'Compact basecourse to minimum 98% Modified Dry Density Ratio',
      acceptanceCriteria: 'Dry Density Ratio >= 98% Modified Compaction (AS 1289.5.2.1); tested per DIT TP 320; "one-for-one" MDD testing conducted (one MDD determination per field density test location)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320 / AS 1289.5.2.1',
      notes: 'RD-PV-C1. Basecourse >= 98% Modified. "One-for-one" MDD testing mandatory — one MDD per field density test. Principal\'s Authorised Person to be notified.'
    },
    {
      description: 'Compact subbase to specified Dry Density Ratio',
      acceptanceCriteria: 'Subbase compaction >= 98% Modified (AS 1289.5.2.1) or >= 100% Standard (AS 1289.5.1.1) depending on material class per RD-PV-C1; tested per TP 320; "one-for-one" MDD testing',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320 / AS 1289.5.2.1 or AS 1289.5.1.1',
      notes: 'RD-PV-C1. Subbase compaction requirement depends on material class. "One-for-one" MDD testing mandatory. Principal\'s Authorised Person to be notified.'
    },

    // =========================================================================
    // LEVEL TOLERANCES AND SURVEYS
    // =========================================================================
    {
      description: 'Verify lateral position and overall width of pavement layer',
      acceptanceCriteria: 'Lateral position and overall width within +/- 50 mm of design per PC-SI1; no deficient areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1, PC-SI1 "Site Surveys". Tolerance on lateral position and overall width: +/- 50 mm.'
    },
    {
      description: 'Conduct longitudinal level testing at specified frequency',
      acceptanceCriteria: 'Testing points no more than 10 m apart (where no longitudinal frequency is specified); levels within specified tolerance of design per PC-SI1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1, PC-SI1. Where no longitudinal frequencies are provided, testing must be no more than 10 m apart.'
    },

    // =========================================================================
    // PROOF ROLLING
    // =========================================================================
    {
      description: 'Conduct proof rolling of completed pavement layer',
      acceptanceCriteria: 'Proof rolling completed per RD-EW-C1 requirements; no deformation, rutting, softness, yielding, distress or instability; minimum 3 passes at walking pace with approved heavy plant',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C1, RD-EW-C1. W — Principal\'s Authorised Person to witness proof rolling. Equipment: pneumatic roller > 24 tonnes OR loaded tandem truck/water cart >= 10 kL with >= 450 kPa tyre pressure.'
    },

    // =========================================================================
    // SURVEY AND FINAL VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels of each pavement layer',
      acceptanceCriteria: 'All levels within specified tolerance of design; survey data documented; as-built levels recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1, PC-SI1.'
    },
    {
      description: 'Verify compacted layer thickness by survey or measurement',
      acceptanceCriteria: 'Compacted layer thickness within tolerance of design; no area deficient by more than specified limit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit all compaction test lot records (TP 320)',
      acceptanceCriteria: 'Complete Dry Density Ratio records for every lot; all lots meet specified minimum DDR; "one-for-one" MDD records included; statistical summary provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1, TP 320.'
    },
    {
      description: 'Submit pavement material conformance test records',
      acceptanceCriteria: 'Complete NATA endorsed test records for all material properties (grading, PI, LA Abrasion, Aggregate Crushing Value, Flakiness Index, CBR, wet/dry strength); all within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S1, Part R15 Attachment A.'
    },
    {
      description: 'Submit material delivery records and traceability documentation',
      acceptanceCriteria: 'Delivery dockets, quantities, source identification for all pavement material delivered; traceability to approved source maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S1.'
    },
    {
      description: 'Submit as-built drawings showing pavement layer thicknesses and levels',
      acceptanceCriteria: 'As-built survey data showing actual vs design for each layer; any variations documented and approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C1.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All acceptance criteria met for unbound granular pavement; lot approved and released for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 2. SA CEMENT TREATED CRUSHED ROCK — PLANT MIXED (DIT RD-PV-S2)
// =============================================================================

const saCementTreatedTemplate = {
  name: 'Cement Treated Crushed Rock (DIT RD-PV-S2)',
  description: 'DIT plant mixed stabilised pavement using cementitious binders (cement, lime, fly ash, blended cement) per RD-PV-S2 (Plant Mixed Stabilised Pavement). Covers PM1/20 or PM2/20 treated with ≥4% blended cement (GB), retarder requirement, UCS testing.',
  activityType: 'pavements',
  specificationReference: 'RD-PV-S2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit mix design for cement treated crushed rock including binder content and retarder details',
      acceptanceCriteria: 'Mix design reviewed and accepted by Principal\'s Authorised Person; PM1/20 or PM2/20 base material with >= 4% blended cement (GB) binder; retarder type and usage rate nominated; NATA endorsed laboratory results provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2. HP — Mix design must be approved before production. Cement treated virgin quarry materials must be PM1/20 or PM2/20 treated with not less than 4% blended cement (GB) binder.'
    },
    {
      description: 'Nominate retarder type and usage rate in construction documentation',
      acceptanceCriteria: 'Retarder type identified; usage rate specified; retarder compatible with cement binder; retarder MUST be used with cement binders per RD-PV-S2',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2. HP — A retarder MUST be used with cement binders to extend working time. Retarder nomination is part of Construction Documentation.'
    },
    {
      description: 'Submit construction documentation including placement, compaction, and curing procedures',
      acceptanceCriteria: 'Construction documentation reviewed and accepted by Principal\'s Authorised Person; covers production, transport, placement, compaction, curing, and testing regime',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2. HP — Construction documentation must be accepted before work commences.'
    },
    {
      description: 'Submit cementitious binder details and compliance certificates',
      acceptanceCriteria: 'Binder type identified (cement, lime, fly ash, blended cement GB); compliance certificates provided; source approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3972',
      notes: 'RD-PV-S2. Binders include cement, lime, fly ash, blended cement (GB).'
    },

    // =========================================================================
    // MATERIAL COMPLIANCE — BASE MATERIAL
    // =========================================================================
    {
      description: 'Verify base material (PM1/20 or PM2/20) conformance prior to treatment',
      acceptanceCriteria: 'Base material grading, PI, LA Abrasion, Aggregate Crushing Value, Flakiness Index, and CBR within specified limits per RD-PV-S1; NATA endorsed results',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Multiple (per RD-PV-S1)',
      notes: 'RD-PV-S1, Part R15 Attachment A. Base material must comply with PM1/20 or PM2/20 requirements before cement treatment.'
    },
    {
      description: 'Verify binder content in mix — minimum 4% blended cement (GB)',
      acceptanceCriteria: 'Binder content tested and verified at >= 4% blended cement (GB) by mass; within design tolerance; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'RD-PV-S2. Minimum 4% blended cement (GB) binder required for cement treated virgin quarry materials.'
    },

    // =========================================================================
    // UCS TESTING AND STRENGTH VERIFICATION
    // =========================================================================
    {
      description: 'Prepare UCS test specimens at 100% Standard Proctor at 100% Standard OMC',
      acceptanceCriteria: 'Specimens prepared using 100% Standard Proctor compactive effort at 100% Standard Optimum Moisture Content per RD-PV-S2; specimen preparation documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.1.1 (Standard Compaction)',
      notes: 'RD-PV-S2. Specimens stabilised with GP cement prepared at 100% Standard Proctor compactive effort at 100% Standard OMC.'
    },
    {
      description: 'Conduct 28-day moist cured UCS testing',
      acceptanceCriteria: 'UCS specimens cured for minimum 28 days in moist condition without soaking in water; UCS results within target range per pavement design (RD-PV-D1); typical target 1-2 MPa for modified/lightly bound [VERIFY exact targets from RD-PV-D1]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'UCS (28-day moist cure)',
      notes: 'RD-PV-S2, RD-PV-D1. Normal curing: minimum 28 days in moist condition without soaking. Target UCS 1-2 MPa for modified/lightly bound; higher for heavily bound.'
    },
    {
      description: 'Conduct accelerated curing UCS testing (where applicable)',
      acceptanceCriteria: 'Specimens cured per approved accelerated method: 7-day at >= 90% humidity and 23°C with 4-hour precondition; OR 7-day at 65°C with 4-hour soak (for slow-setting binders); UCS results within target range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'UCS (accelerated cure per Austroads AGPT04D)',
      notes: 'RD-PV-S2, Austroads AGPT04D. Accelerated curing: 7-day at >= 90% humidity and 23°C with 4hr precondition; OR 7-day at 65°C with 4hr soak.'
    },
    {
      description: 'Classify stabilised material by UCS result',
      acceptanceCriteria: 'Material classified per UCS: Modified 0.5-1.0 MPa, Lightly bound 1.0-2.0 MPa, Heavily bound 2.0-6.0 MPa; classification matches pavement design intent (RD-PV-D1)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'UCS Classification',
      notes: 'RD-PV-D1, Austroads AGPT04D. Modified: 0.5-1.0 MPa; Lightly bound: 1.0-2.0 MPa; Heavily bound: 2.0-6.0 MPa.'
    },

    // =========================================================================
    // SUBGRADE/FOUNDATION ACCEPTANCE
    // =========================================================================
    {
      description: 'Verify foundation/subgrade has been accepted and released',
      acceptanceCriteria: 'Formation release documentation held; proof rolling completed per RD-EW-C1; density and levels compliant; surface clean and free of loose material',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2, RD-EW-C1. HP — Foundation must be accepted by Principal\'s Authorised Person before cement treated pavement placement.'
    },
    {
      description: 'Verify foundation surface level and shape',
      acceptanceCriteria: 'Foundation level within tolerance; no ponding; drainage adequate; surface clean and free of loose material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-S2.'
    },

    // =========================================================================
    // PRODUCTION AND MIXING
    // =========================================================================
    {
      description: 'Verify mixing plant calibration for binder content and moisture',
      acceptanceCriteria: 'Plant calibration current; binder content within design tolerance; moisture content controlled; calibration records available',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2. HP — Plant calibration must be verified before production commences.'
    },
    {
      description: 'Monitor binder content during production',
      acceptanceCriteria: 'Binder content tested and within design tolerance per production lot; records maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'RD-PV-S2. Binder content monitoring throughout production.'
    },
    {
      description: 'Verify moisture content at mixing',
      acceptanceCriteria: 'Moisture content appropriate for compaction; not excessive (causing bleeding) or deficient; monitored during production',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320 (Moisture)',
      notes: 'RD-PV-S2, TP 320.'
    },

    // =========================================================================
    // PLACEMENT AND COMPACTION
    // =========================================================================
    {
      description: 'Place cement treated material and commence compaction within 1.5 hours of stabilisation',
      acceptanceCriteria: 'Rate of delivery and placing sufficient to enable first compaction testing within 1.5 hours of material being stabilised; allows additional rolling if compaction standard not achieved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-S2. HP — First compaction testing must occur within 1.5 hours of stabilisation. Time-critical operation.'
    },
    {
      description: 'Compact cement treated pavement to specified Dry Density Ratio',
      acceptanceCriteria: 'Dry Density Ratio meets specified minimum per TP 320; "one-for-one" MDD testing conducted; compaction completed before initial set of cementitious binder',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320',
      notes: 'RD-PV-S2, TP 320. "One-for-one" MDD testing required. Compaction must be complete before set. Principal\'s Authorised Person to be notified.'
    },
    {
      description: 'Verify surface level of completed cement treated layer',
      acceptanceCriteria: 'Surface level within specified tolerance of design level; cross-fall correct; lateral position within +/- 50 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2, PC-SI1.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment immediately after compaction and finishing',
      acceptanceCriteria: 'Curing compound applied at specified rate immediately after finishing; or approved curing method commenced; surface protected from drying',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-S2. HP — Curing must commence immediately after compaction and finishing.'
    },
    {
      description: 'Maintain curing for specified duration and restrict trafficking',
      acceptanceCriteria: 'Curing maintained for specified period; no trafficking during curing period except where approved; membrane integrity checked; reapplication where damaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-S2. Trafficking restrictions during curing period. Protection from drying and weather effects.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit all UCS test records (28-day and/or accelerated)',
      acceptanceCriteria: 'Complete UCS records with specimen preparation details, curing conditions, and results; material classification confirmed; all results within design target range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2, RD-PV-D1.'
    },
    {
      description: 'Submit all compaction test records (TP 320) with "one-for-one" MDD',
      acceptanceCriteria: 'Complete Dry Density Ratio results for all lots; "one-for-one" MDD records included; all lots meeting specified minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2, TP 320.'
    },
    {
      description: 'Submit all binder content production test records',
      acceptanceCriteria: 'Complete binder content test results for production; all within design tolerance; minimum 4% GB confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2.'
    },
    {
      description: 'Submit mixing plant calibration records',
      acceptanceCriteria: 'Plant calibration records for binder content, moisture, and aggregate proportioning; records current throughout production period',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2.'
    },
    {
      description: 'Submit curing records',
      acceptanceCriteria: 'Records of curing compound application (type, rate, timing) or alternative curing log; weather conditions during cure period documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2.'
    },
    {
      description: 'Submit as-built drawings showing cement treated layer thickness and levels',
      acceptanceCriteria: 'As-built survey data showing actual vs design for cement treated layer; any variations documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-S2.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All acceptance criteria met for cement treated crushed rock pavement; lot approved and released for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 3. SA STABILISED PAVEMENTS — IN-SITU (DIT RD-PV-C3)
// =============================================================================

const saStabilisedPavementTemplate = {
  name: 'Stabilised Pavements — In-situ (DIT RD-PV-C3)',
  description: 'DIT in-situ pavement stabilisation using lime, cement, or other binders per RD-PV-C3 (In-situ Pavement Stabilisation, formerly Part R23). Covers trial section (1,000m²), binder spread rate, mixing depth, compaction, and UCS/CBR testing.',
  activityType: 'pavements',
  specificationReference: 'RD-PV-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit stabilisation procedures including mix design, equipment, and testing regime',
      acceptanceCriteria: 'Stabilisation procedures reviewed and accepted by Principal\'s Authorised Person; includes binder type, spread rate, mixing depth, compaction methodology, equipment details, curing, and testing regime per RD-PV-C3',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3 (formerly Part R23). HP — Work shall not commence until stabilisation procedures are accepted by Principal\'s Authorised Person.'
    },
    {
      description: 'Submit stabilisation mix design with laboratory UCS/CBR results',
      acceptanceCriteria: 'Laboratory mix design determines binder content required to achieve target UCS/CBR per RD-PV-D1; specimens tested; results exceed specified minimum; binder type (lime, cement, or blend) confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'UCS / CBR',
      notes: 'RD-PV-C3, RD-PV-D1. HP — Mix design must be approved by Principal\'s Authorised Person before work commences.'
    },
    {
      description: 'Submit stabilisation equipment details and binder spreader calibration certificates',
      acceptanceCriteria: 'Stabiliser equipment (e.g., Wirtgen stabiliser) identified and suitable; binder spreading machine has calibrated "on-board" measuring devices; calibration certificates current',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3. HP — Equipment details and spreader calibration must be approved. Spreading machine must accurately control spread rate.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section of 1,000 m² to agreed depth and width',
      acceptanceCriteria: 'Trial section of 1,000 m² completed to agreed depth and width; demonstrates contractor\'s ability to achieve specified depth, uniformity, and compaction; all aspects of stabilisation process demonstrated',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. HP — Trial section (1,000 m²) must be completed and accepted by Principal\'s Authorised Person before production stabilisation commences.'
    },
    {
      description: 'Evaluate trial section results — density, UCS/CBR, binder content, mixing uniformity',
      acceptanceCriteria: 'Density, UCS/CBR, binder content, mixing depth, and surface finish from trial meet specification requirements; procedures validated or adjusted as required',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'test_result',
      testType: 'Multiple (TP 320, UCS, CBR)',
      notes: 'RD-PV-C3. HP — Trial section results must be accepted by Principal\'s Authorised Person before production.'
    },

    // =========================================================================
    // BINDER SPREAD RATE VERIFICATION
    // =========================================================================
    {
      description: 'Verify binder spread rate is within tolerance of -0% / +10%',
      acceptanceCriteria: 'Binder spread rate within design tolerance of -0% / +10%; calculated for each 50 m linear interval; spreading machine on-board devices calibrated and functioning',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'RD-PV-C3. W — Binder spread rate tolerance: -0% / +10%. Spread rate calculated per 50 m interval. Principal\'s Authorised Person to be notified.'
    },
    {
      description: 'Verify binder spread rate by tray method (alternative compliance)',
      acceptanceCriteria: 'Minimum 4 trays placed per 100 m continuous run; binder collected and weighed; spread rate calculated and within tolerance of -0% / +10%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'RD-PV-C3. Alternative compliance: not less than 4 trays per 100 m continuous run over which spread rate is measured.'
    },
    {
      description: 'Verify no gaps between spreader runs and no adverse weather during spreading',
      acceptanceCriteria: 'No gaps permitted between spreader runs; binder spreading not affected by adverse weather (wind, rain); visual inspection confirms uniform coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. No gaps between spreader runs. Spreading must not be affected by adverse weather.'
    },

    // =========================================================================
    // MIXING
    // =========================================================================
    {
      description: 'Verify mixing depth achieves design requirement',
      acceptanceCriteria: 'Mixing depth verified by measurement at multiple locations; meets design requirement (typically 150-300 mm as specified); no shallow mixing zones; uniformity of mixing confirmed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. W — Mixing depth and width as agreed during trial section. Principal\'s Authorised Person to be notified.'
    },
    {
      description: 'Verify uniform distribution of binder throughout mixed material',
      acceptanceCriteria: 'Visual inspection confirms uniform distribution; no unmixed pockets or zones of concentrated binder; consistent colour throughout mixed layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. Uniformity of mixing demonstrated during trial section and verified during production.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Conduct compaction testing per TP 320 — minimum 1 test per 400 m², minimum 3 per Work Lot',
      acceptanceCriteria: 'Dry Density Ratio meets specified minimum per TP 320; test frequency: minimum 1 test per 400 m² with minimum 3 tests per Work Lot; locations selected by stratified random basis per AS 1289.1.4.2',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TP 320 / AS 1289.1.4.2',
      notes: 'RD-PV-C3. Min 1 test per 400 m², min 3 per Work Lot. Stratified random per AS 1289.1.4.2. "One-for-one" MDD testing required. Principal\'s Authorised Person to be notified.'
    },
    {
      description: 'Conduct "one-for-one" MDD testing at each field density test location',
      acceptanceCriteria: 'One MDD determination conducted per field density test location; MDD results used to calculate Dry Density Ratio for each test point',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.2.1 (Modified Compaction) / AS 1289.5.1.1 (Standard Compaction)',
      notes: 'RD-PV-C3, TP 320. "One-for-one" MDD testing — one MDD per field density test. Critical for accurate DDR calculation.'
    },
    {
      description: 'Trim and shape surface to design levels and cross-fall',
      acceptanceCriteria: 'Surface trimmed to within specified tolerance of design level; cross-fall correct; no ponding areas; surface finished before initial set of binder',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. Must complete shaping within working time (before initial set).'
    },

    // =========================================================================
    // UCS/CBR TARGETS
    // =========================================================================
    {
      description: 'Conduct UCS testing on production samples',
      acceptanceCriteria: 'UCS results meet target per RD-PV-D1: Modified 0.5-1.0 MPa, Lightly bound 1.0-2.0 MPa, Heavily bound 2.0-6.0 MPa; classification matches pavement design intent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'UCS',
      notes: 'RD-PV-C3, RD-PV-D1, Austroads AGPT04D. Modified: 0.5-1.0 MPa; Lightly bound: 1.0-2.0 MPa; Heavily bound: 2.0-6.0 MPa.'
    },
    {
      description: 'Conduct CBR testing on production samples (where specified)',
      acceptanceCriteria: 'CBR results meet specified minimum per RD-PV-D1 for target material classification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.6.1.1 (CBR)',
      notes: 'RD-PV-C3, RD-PV-D1. CBR testing where specified in addition to or in lieu of UCS.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment immediately after finishing',
      acceptanceCriteria: 'Curing compound applied at specified rate immediately after final trimming; or approved curing method commenced; full surface coverage achieved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. HP — Curing must commence immediately after compaction and finishing.'
    },
    {
      description: 'Maintain curing for specified period and restrict trafficking',
      acceptanceCriteria: 'Curing maintained for specified period; membrane integrity checked; no trafficking during curing period except where approved; reapplication where damaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-C3. Trafficking restrictions during curing period.'
    },

    // =========================================================================
    // LEVEL AND SHAPE VERIFICATION
    // =========================================================================
    {
      description: 'Verify final surface level and shape',
      acceptanceCriteria: 'Surface levels within specified tolerance of design; cross-fall and grade within specification; lateral position within +/- 50 mm per PC-SI1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3, PC-SI1.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit all binder spread rate records (per 50 m interval or tray method)',
      acceptanceCriteria: 'Complete binder spread rate records; all within tolerance of -0% / +10%; calculation per 50 m interval or 4 trays per 100 m documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3.'
    },
    {
      description: 'Submit all compaction test records (TP 320) with "one-for-one" MDD',
      acceptanceCriteria: 'Complete Dry Density Ratio records; "one-for-one" MDD records included; all lots meeting minimum DDR; stratified random locations documented per AS 1289.1.4.2',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3, TP 320, AS 1289.1.4.2.'
    },
    {
      description: 'Submit all UCS/CBR test results',
      acceptanceCriteria: 'Complete UCS and/or CBR records; all results meet specified targets per RD-PV-D1; material classification confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3, RD-PV-D1.'
    },
    {
      description: 'Submit binder spreader calibration and reconciliation records',
      acceptanceCriteria: 'Calibration certificates for on-board measuring devices; binder quantity reconciliation per area treated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3.'
    },
    {
      description: 'Submit trial section documentation and approval records',
      acceptanceCriteria: 'Trial section (1,000 m²) documentation including test results, mixing depth verification, approval by Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3.'
    },
    {
      description: 'Submit as-built drawings showing stabilisation depth, areas treated, and binder rates',
      acceptanceCriteria: 'Final surface levels, stabilisation depth, areas treated, binder rates used; as-built survey data showing actual vs design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-C3.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All acceptance criteria met for in-situ stabilised pavement; lot approved and released for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 4. SA CONCRETE PAVEMENT (DIT RD-PV-D3)
// =============================================================================

const saConcretePavementTemplate = {
  name: 'Concrete Pavement (DIT RD-PV-D3)',
  description: 'DIT concrete road pavement (rigid pavement) per RD-PV-D3 (Concrete Road Pavements). Covers subbase preparation, formwork/slipform, dowels, placement, texturing, curing (7 days minimum, compound within 15 min), and joint sawing (not within 7 days).',
  activityType: 'pavements',
  specificationReference: 'RD-PV-D3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit concrete pavement construction procedures for review',
      acceptanceCriteria: 'Construction procedures reviewed and accepted by Principal\'s Authorised Person; includes concrete supply, placement method (fixed-form or slipform), compaction, finishing, texturing, curing, and joint sawing procedures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3. HP — Construction procedures must be accepted by Principal\'s Authorised Person before work commences.'
    },
    {
      description: 'Submit concrete mix design for review and approval',
      acceptanceCriteria: 'Mix design meets specified strength grade; maximum w/c ratio per durability exposure class; air entrainment as specified; compliant with AS 1379; NATA endorsed test results',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012 series',
      notes: 'RD-PV-D3. HP — Mix design must be approved by Principal\'s Authorised Person before concrete production commences.'
    },

    // =========================================================================
    // SUBBASE PREPARATION
    // =========================================================================
    {
      description: 'Inspect subbase preparation — compacted to levels, rock subgrade blinded',
      acceptanceCriteria: 'Subbase compacted to specified levels and tolerances; where subgrade occurs in rock, excavated surface blinded with subbase material; surface clean, firm, and free of loose material and standing water',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. HP — Subbase must be accepted by Principal\'s Authorised Person before concrete placement. Rock subgrade must be blinded with subbase material.'
    },
    {
      description: 'Verify subbase levels and cross-fall prior to concrete paving',
      acceptanceCriteria: 'Subbase trimmed to within specified tolerance of design level; cross-fall within tolerance; no ponding areas; survey records maintained',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Level survey',
      notes: 'RD-PV-D3. W — Principal\'s Authorised Person to be notified of subbase level surveys.'
    },

    // =========================================================================
    // FORMWORK / SLIPFORM SETUP
    // =========================================================================
    {
      description: 'Inspect formwork alignment, level, and rigidity (fixed-form construction)',
      acceptanceCriteria: 'Forms set to correct line and level; forms clean and oiled; adequate staking; forms rigid and unyielding during concrete placement; expansion and contraction joint formwork correctly positioned',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Level survey',
      notes: 'RD-PV-D3. W — Principal\'s Authorised Person may wish to inspect formwork before concrete placement.'
    },
    {
      description: 'Verify slipform paver alignment and profile (slipform construction)',
      acceptanceCriteria: 'Paver set on correct alignment via string line or GPS guidance; profile template matches design slab cross-section; paver tracking within tolerance of design alignment',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. W — Slipform paver calibrated and test run before production. Principal\'s Authorised Person to be notified.'
    },

    // =========================================================================
    // DOWELS
    // =========================================================================
    {
      description: 'Inspect dowel bar assemblies — alignment with transverse joints, size, spacing, and support',
      acceptanceCriteria: 'Dowel bars correct diameter and length; aligned with transverse joint locations; bars parallel to pavement centreline within tolerance; epoxy coating intact; support cradles rigid and at correct height',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. HP — Dowel misalignment is a critical defect. Principal\'s Authorised Person must inspect and release before concrete placement over dowels.'
    },
    {
      description: 'Verify services aligned with transverse joints — minimum 1.5 m concrete cover to nearest joint',
      acceptanceCriteria: 'Intrusive services within rigid pavement area lined up with transverse joint locations; isolated around all edges with minimum 1.5 m of concrete cover to nearest joint',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. Services must be aligned with transverse joints with minimum 1.5 m concrete cover to nearest joint.'
    },

    // =========================================================================
    // CONCRETE SUPPLY AND PLACEMENT
    // =========================================================================
    {
      description: 'Verify concrete supply conformance — batch tickets, slump, temperature',
      acceptanceCriteria: 'Concrete supply compliant with AS 1379; batch ticket shows correct mix ID, strength grade, batch time; slump within specified range; concrete temperature within limits; delivery within specified time',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012.3.1 (Slump)',
      notes: 'RD-PV-D3. Record batch ticket details for every load.'
    },
    {
      description: 'Conduct concrete conformance sampling — compressive strength cylinders',
      acceptanceCriteria: 'Sampling frequency per specification; minimum 3 cylinders per sample per AS 1012.1 and AS 1012.8.1; tested at 7 days and 28 days; 28-day results meet specified strength grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.1 / AS 1012.8.1 / AS 1012.9',
      notes: 'RD-PV-D3. Strength grade as specified in pavement design.'
    },
    {
      description: 'Monitor concrete placement — vibration, consolidation, and paver operation',
      acceptanceCriteria: 'Concrete spread uniformly; internal vibrators operating at correct frequency; no honeycombing, segregation, or voids; continuous placement without cold joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-PV-D3. Concrete shall be tamped and vibrated to achieve full compaction.'
    },
    {
      description: 'Verify slab thickness during placement',
      acceptanceCriteria: 'Slab thickness within design tolerance; checked by probe or depth gauge at random locations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Depth probe measurement',
      notes: 'RD-PV-D3. Deficient thickness requires investigation and possible remedial action.'
    },

    // =========================================================================
    // FINISHING AND TEXTURING
    // =========================================================================
    {
      description: 'Inspect surface finish and texturing of fresh concrete',
      acceptanceCriteria: 'Surface finished to correct profile and cross-fall; surface texture applied while concrete is still plastic (burlap drag, tined, or broom finish as specified); texture depth adequate for skid resistance; no surface defects',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-PV-D3. W — Texturing must be applied promptly after finishing. Principal\'s Authorised Person to be notified.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound — first application within 15 minutes of low-sheen bleed condition',
      acceptanceCriteria: 'Curing compound first application within 15 minutes of the surface reaching low-sheen bleed water condition; uniform coverage; compound compliant with specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. HP — First application of curing compound within 15 minutes of low-sheen bleed condition. Critical timing requirement.'
    },
    {
      description: 'Apply second coat of curing compound — 10 to 30 minutes after first application',
      acceptanceCriteria: 'Second application of curing compound between 10 minutes and 30 minutes after first application (or as recommended by manufacturer); full coverage maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. Second application between 10 and 30 minutes after first application.'
    },
    {
      description: 'Maintain continuous damp curing for minimum 7 days',
      acceptanceCriteria: 'Concrete kept continuously damp for at least 7 days or until thoroughly cured; in hot, dry or windy conditions, exposed concrete covered and sealed with PVC membrane or similar approved material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3. All concrete shall be kept continuously damp for at least 7 days. Hot/dry/windy conditions require PVC membrane cover.'
    },

    // =========================================================================
    // JOINT SAWING
    // =========================================================================
    {
      description: 'Saw joints — not within 7 days of concrete placement',
      acceptanceCriteria: 'Joint sawing not commenced within 7 days of concrete placement per RD-PV-D3; joints sawed to specified depth and width; no random cracking prior to sawing',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-PV-D3. W — Joint sealants not within 7 days of concrete placement. Principal\'s Authorised Person to be notified of joint sawing.'
    },
    {
      description: 'Verify joints are clean and dry before sealant application',
      acceptanceCriteria: 'Joints clean and dry before sealant application per RD-PV-D3; no debris, moisture, or contaminants in joint; sealant type as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. Joint sealants may only be applied if the joint is clean and dry. Surface sealants applied after curing of concrete base is completed.'
    },

    // =========================================================================
    // POST-PLACEMENT INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed pavement surface for defects',
      acceptanceCriteria: 'No cracking outside of joints; no spalling, scaling, or surface pop-outs; no honeycombing at edges; surface texture uniform; no ponding; all joints aligned',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-PV-D3. W — Visual inspection of completed work by Principal\'s Authorised Person.'
    },

    // =========================================================================
    // LEVEL SURVEYS
    // =========================================================================
    {
      description: 'Conduct finished surface level survey',
      acceptanceCriteria: 'All levels within specified tolerance of design; surface regularity within limits; as-built levels documented and submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Level survey',
      notes: 'RD-PV-D3.'
    },
    {
      description: 'Verify joint layout and spacing against design drawings',
      acceptanceCriteria: 'All transverse, longitudinal, and expansion joints in correct locations per design; joint spacing within tolerance; no missing joints; all joints sawed to correct depth and sealed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Measurement survey',
      notes: 'RD-PV-D3. As-built joint layout to be recorded and submitted.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit concrete strength test records (7-day and 28-day)',
      acceptanceCriteria: 'Complete compressive strength cylinder results; all 28-day results meet specified strength grade; NATA endorsed certificates',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3.'
    },
    {
      description: 'Submit curing records including compound application timing',
      acceptanceCriteria: 'Records of curing compound application (type, rate, first application timing relative to bleed condition, second application timing); continuous damp curing duration; weather conditions during cure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3. First application within 15 min; second 10-30 min later; minimum 7 days continuous damp curing.'
    },
    {
      description: 'Submit batch delivery tickets and concrete supply records',
      acceptanceCriteria: 'All batch delivery tickets filed; mix design conformance confirmed; slump and temperature records; supply source traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3.'
    },
    {
      description: 'Submit as-built drawings showing pavement slab layout, thickness, joint locations, and levels',
      acceptanceCriteria: 'As-built survey data showing actual vs design for slab thickness, joint locations, and levels; any variations documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-PV-D3. Note: primarily design spec; less common than flexible pavements in SA.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All acceptance criteria met for concrete pavement; lot approved and released for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person before subsequent works proceed.'
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
    include: { checklistItems: true }
  })

  const holdPoints = template.checklistItems.filter(i => i.pointType === 'hold_point')
  const witnessPoints = template.checklistItems.filter(i => i.pointType === 'witness')
  const standardItems = template.checklistItems.filter(i => i.pointType === 'standard')

  console.log(`  ✅ Created: ${template.name}`)
  console.log(`     ID: ${template.id}`)
  console.log(`     Spec: ${template.specificationReference}`)
  console.log(`     Total Items: ${template.checklistItems.length}`)
  console.log(`     - Hold Points (H): ${holdPoints.length}`)
  console.log(`     - Witness Points (W): ${witnessPoints.length}`)
  console.log(`     - Standard Items: ${standardItems.length}`)
  console.log('')

  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SA (DIT) ITP Template Seeder - Pavements')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saUnboundGranularPavementTemplate)
    await seedTemplate(saCementTreatedTemplate)
    await seedTemplate(saStabilisedPavementTemplate)
    await seedTemplate(saConcretePavementTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (4 pavement templates)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
