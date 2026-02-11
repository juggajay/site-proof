/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Pavements
 *
 * Creates global ITP templates for QLD pavement activities.
 * Templates: Unbound (MRTS05), Stabilised Lime (MRTS07A), Stabilised Cement (MRTS07B),
 *            Concrete Pavement (MRTS40), Plant-Mixed Stabilised (MRTS08)
 *
 * Run with: node scripts/seed-itp-templates-qld-pavements.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// 1. QLD UNBOUND GRANULAR PAVEMENT (TMR MRTS05)
// =============================================================================

const qldUnboundPavementTemplate = {
  name: 'Unbound Granular Pavement',
  description: 'TMR unbound granular pavement base and subbase construction per MRTS05 (July 2022). Covers Type 1, 2, and 3 materials for base and subbase layers.',
  activityType: 'pavements',
  specificationReference: 'MRTS05',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Asphalt/Unbound Quality Plan (AQP) including construction procedures for material production and placement',
      acceptanceCriteria: 'Quality Plan submitted and accepted by Administrator; covers equipment, layer thickness, compaction sequence, joint preparation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP1 - Clause 5.2.1 MRTS05. No unbound pavement work to commence until AQP is approved.'
    },
    {
      description: 'Obtain Administrator written approval for quarry or material source (Quarry Registration Certificate)',
      acceptanceCriteria: 'Quarry Registration Certificate provided and approved; source registered for Type 1-3 materials as applicable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP2 - Clause 6.1 MRTS05. Cannot use an unregistered quarry or new source without Administrator written approval.'
    },
    {
      description: 'Submit material compliance test results (grading, PI, WPI, CBR, LA Abrasion, wet/dry strength variation) prior to use',
      acceptanceCriteria: 'Grading within envelope; PI per spec; WPI per TMR Q252; CBR >= 80% (Type 2) or >= 60% (Type 3); LA <= 35 (Type 1); wet/dry strength variation <= 35%',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1 (PSD), AS 1289.3.3.1 (PI), TMR Q252 (WPI), AS 1289.6.1.1 (CBR), AS 1141.23 (LA), AS 1141.22 (wet/dry)',
      notes: 'HP5 - Clause 9.1 MRTS05. No granular material to be incorporated until test results confirm compliance.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial pavement section (minimum 1000 m2) demonstrating compaction, surface finish, and joint preparation',
      acceptanceCriteria: 'Trial section >= 1000 m2; compaction, surface finish, thickness, and joint preparation meet specification requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (density)',
      notes: 'HP3 - Clause 8.2 MRTS05. Trial pavement must be demonstrated to meet requirements before general pavement construction.'
    },
    {
      description: 'Administrator to witness construction of trial pavement section including manufacturing, placing, and compaction',
      acceptanceCriteria: 'Administrator witnesses full trial section construction; equipment, layer thickness, joints, and compaction verified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP1 - Clause 8.2 MRTS05. 3 days prior notice required for Administrator attendance.'
    },

    // =========================================================================
    // MOISTURE MANAGEMENT
    // =========================================================================
    {
      description: 'Obtain approval if proposing to exceed standard maximum Degree of Saturation (DoS) for Type 1 base during compaction',
      acceptanceCriteria: 'Revised DoS limit and procedure approved by Administrator; DoS typically <= 70% for Type 1 base',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'TMR Q250 (DoS calculation)',
      notes: 'HP4 - Clause 8.3.4.1 MRTS05. Work held until Administrator approves revised moisture limit/procedure.'
    },
    {
      description: 'Verify moisture content and Degree of Saturation of material prior to and during compaction',
      acceptanceCriteria: 'Moisture within specified range; DoS <= 70-80% (Type 1 base typically < 70%)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q250 (DoS), AS 1289.2.1.1 (moisture content)',
      notes: 'Clause 8.3.4 MRTS05. 1 moisture ratio test per 500 m2 per layer (normal frequency).'
    },

    // =========================================================================
    // MATERIAL DELIVERY & STOCKPILING
    // =========================================================================
    {
      description: 'Check delivery dockets match approved quarry source and verify ongoing production testing (grading, PI)',
      acceptanceCriteria: 'Source matches approved quarry; production testing at minimum 1 grading and PI per 500 t (or per day)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1289.3.6.1 (PSD), AS 1289.3.3.1 (PI)',
      notes: 'Clause 9.1 MRTS05. Retain dockets for lot records. 1 Flakiness Index per 1000 t during production.'
    },
    {
      description: 'Verify stockpile segregation controls and material protection from contamination',
      acceptanceCriteria: 'Material classes separated; protected from contamination and moisture ingress; no mixing of different types',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 6 MRTS05. Prevent mixing of different material classes in stockpiles.'
    },

    // =========================================================================
    // LAYER PLACEMENT
    // =========================================================================
    {
      description: 'Verify loose layer thickness before compaction',
      acceptanceCriteria: 'Loose thickness achieves design compacted thickness; layer not exceeding maximum single lift per approved method',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS05. Check before compaction; adjust if required.'
    },
    {
      description: 'Check material for segregation during spreading',
      acceptanceCriteria: 'No visible segregation; homogeneous appearance; no oversize rock above max size',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS05. Reject segregated areas - remix or replace.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Perform compaction per approved rolling pattern from trial section',
      acceptanceCriteria: 'Minimum passes achieved; uniform coverage; roller type and speed per approved pattern',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS05. Record roller type, passes, and any variations.'
    },
    {
      description: 'Perform field density testing on each compacted lot',
      acceptanceCriteria: '100% Modified Proctor MDD for HSG Type 1, 2.1, 2.2, 3.1, 3.2 materials; 100% Standard Proctor MDD for other unbound materials',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (Standard) or AS 1289.5.7.1 (Hilf Rapid)',
      notes: 'Clause 9 MRTS05. Minimum 1 density test per lot (~2000 m2); in practice ~1 per 500 m2 per layer.'
    },

    // =========================================================================
    // PROOF ROLLING
    // =========================================================================
    {
      description: 'Proof roll completed unbound layer in presence of Administrator to check for visible deformation or spring',
      acceptanceCriteria: 'No visible deformation, rutting, or pumping under loaded roller; ball penetration test satisfactory',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Austroads AG:PT/T251 (Ball Penetration Test)',
      notes: 'WP2 - Clause 9.4.7 MRTS05. Proof rolling triggered after HP5 release. 100% of area proof rolled.'
    },
    {
      description: 'Remedial works if proof rolling reveals soft spots - rectification subject to Administrator inspection',
      acceptanceCriteria: 'Soft spots reworked, re-compacted, and re-tested; no visible deflection on re-test',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Austroads AG:PT/T251 (Ball Penetration Test)',
      notes: 'WP3 - Clause 9.4.7 MRTS05. Administrator witnesses re-test of rectified areas.'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels and verify layer thickness',
      acceptanceCriteria: 'Base course level +/-10 mm from design; subbase +/-15 mm from design; no under-thickness (0 mm negative, +10 mm positive)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS05. Survey levels every 20 m along and across for each layer.'
    },
    {
      description: 'Perform straightedge check on finished surface',
      acceptanceCriteria: 'Base course: max 5 mm deviation under 3 m straightedge; subbase: max 10 mm deviation; correct crossfall',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: '3 m straightedge',
      notes: 'Clause 9 MRTS05. No potholes, segregation, or loose stone on surface.'
    },
    {
      description: 'Verify edge alignment and trimming',
      acceptanceCriteria: 'Clean edges, no overbreak; pavement width meets design (no under-run)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9 MRTS05. Trim edges to line.'
    },

    // =========================================================================
    // LAYER ACCEPTANCE & COVERING
    // =========================================================================
    {
      description: 'Administrator to inspect finished surface of unbound layer before covering with next layer or surfacing',
      acceptanceCriteria: 'Surface clean, smooth, no segregation; ready for next layer',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP4 - Clause 9.5.1 MRTS05. Administrator may inspect before covering.'
    },
    {
      description: 'Do not cover or overlay completed unbound layer until density, moisture, and thickness tests indicate compliance',
      acceptanceCriteria: 'All density, moisture, thickness, and level tests for the lot indicate compliance with specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'HP6 - Clause 9.5.1 MRTS05. Layer not to be covered until all verification tests confirm compliance.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation including all test results, survey data, delivery dockets, and photos',
      acceptanceCriteria: 'Complete lot documentation pack with traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 Quality System requirements. Conformance report for each lot.'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All acceptance criteria met; lot approved for subsequent layer',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval before subsequent layer placement.'
    }
  ]
}

// =============================================================================
// 2. QLD STABILISED PAVEMENT - LIME (TMR MRTS07A)
// =============================================================================

const qldStabilisedLimeTemplate = {
  name: 'Stabilised Pavement - Lime',
  description: 'TMR in-situ lime stabilised subgrade construction per MRTS07A (July 2024). Covers quicklime and hydrated lime treatment of subgrade soils.',
  activityType: 'pavements',
  specificationReference: 'MRTS07A',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit detailed Stabilisation Construction Procedures including plant, joints, layer thickness, curing, and protective measures for cold/wet weather',
      acceptanceCriteria: 'Procedures accepted by Administrator; submitted minimum 14-28 days prior to commencement; complies with Clause 6 of MRTS50',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP1 - Clause 5.2.2 MRTS07A. No stabilisation works to commence until procedures are approved.'
    },
    {
      description: 'Submit materials compliance evidence - binder certificate (quicklime/hydrated lime to MRTS23), in-situ soil PI and sulfate levels',
      acceptanceCriteria: 'Binder certificate compliant with MRTS23; soil PI and sulfate levels acceptable for lime treatment; all test results accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.3.1 (PI), Sulfate testing',
      notes: 'HP2 - Clause 7.1 MRTS07A. All materials must be tested and confirmed compliant before use.'
    },
    {
      description: 'Complete all specified pre-treatment (milling, preliminary compaction) and notifications (traffic, utilities) before commencing stabilisation',
      acceptanceCriteria: 'Pre-treatment completed; required notifications made; Administrator gives clearance to proceed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP3 - Clause 8.0 MRTS07A. Do not start pulverisation or binder spreading until clearance given.'
    },
    {
      description: 'Identify, locate, and protect all underground services and structures in the treatment area',
      acceptanceCriteria: 'All underground services surveyed and protection measures in place; Administrator approves proceeding',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP4 - Clause 8.3 MRTS07A. Work held until services survey and protection confirmed.'
    },
    {
      description: 'Submit and obtain approval for process-based compaction method (rolling pattern) via successful trial section',
      acceptanceCriteria: 'Trial section demonstrates compaction method achieves specification requirements; method approved by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (field density)',
      notes: 'HP6 - Clause 8.5.2.1 MRTS07A. Hold applies to begin full-scale works until compaction process approved.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Administrator to witness construction of trial stabilised section to confirm mixing uniformity, compaction, and surface finish',
      acceptanceCriteria: 'Administrator witnesses full trial section construction; mixing, compaction, and finish demonstrated satisfactorily',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP1 - Clause 8.5.2.2 MRTS07A. 24 hours notice required.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Remove any pockets of unsuitable material (excessively wet, organic) encountered during preparation',
      acceptanceCriteria: 'Unsuitable material excavated and disposed of appropriately; Administrator inspects removal',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP2 - Clause 8.6.2 MRTS07A. Notification on occurrence.'
    },
    {
      description: 'Verify ground surface is properly compacted and trimmed prior to binder spreading (correct profile, no loose zones)',
      acceptanceCriteria: 'Surface at correct profile; no loose material; adequate compaction; ready for binder application',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP3 - Clause 8.6.3 MRTS07A. Administrator witnesses before binder spread.'
    },

    // =========================================================================
    // BINDER APPLICATION
    // =========================================================================
    {
      description: 'Verify binder spreading operation - uniform spread rate confirmed via bucket tests, within weather/wind limits',
      acceptanceCriteria: 'Spread rate within +/-10% of design rate; uniform coverage; no missed strips; weather conditions suitable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Bucket test (spread rate calculation)',
      notes: 'WP4 - Clause 8.6.5.1 MRTS07A. Administrator may observe binder application at start of each run.'
    },
    {
      description: 'Perform spread rate check on first run of each day using catch trays to calculate kg/m2 of binder',
      acceptanceCriteria: 'Measured spread rate within +/-10% of design; calibration adjusted if out of tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Catch tray spread rate calculation',
      notes: 'Clause 8.6.5 MRTS07A. Every run observed for missed strips.'
    },

    // =========================================================================
    // MIXING & PULVERISATION
    // =========================================================================
    {
      description: 'Verify quicklime slaking - adequate water for slaking and proper mellowing time; verify mixing depth achieves target depth uniformly',
      acceptanceCriteria: 'Soil moisture >= OMC +2% for mellowing; slaking complete; mixing depth verified to target depth (e.g. 250 mm)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP5 - Clause 8.6.5.3 MRTS07A. Administrator may inspect during processing.'
    },
    {
      description: 'Verify pulverisation quality after initial mixing',
      acceptanceCriteria: '100% passing 37.5 mm; >= 95% passing 19 mm; no lumps > 40 mm; PI of treated material <= 10',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1 (sieve on processed material)',
      notes: 'Clause 8.6 MRTS07A. Clods of plastic soil must be fully broken down.'
    },
    {
      description: 'Verify treatment depth by digging or coring',
      acceptanceCriteria: 'Stabiliser mixed to design depth (e.g. 250 mm); spray indicator dye on cut face to see treated vs untreated soil',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Depth check (excavation or coring)',
      notes: 'Clause 8.6 MRTS07A. At least 1 location per 100 m of run (or per lot).'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Verify moisture content during compaction is within specified range',
      acceptanceCriteria: 'Moisture content at Optimum to OMC +2%; degree of saturation not exceeding ~85%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1 (moisture content)',
      notes: 'Clause 8 MRTS07A. Check moisture at least 2 times per lot - after initial mixing and before compaction.'
    },
    {
      description: 'Perform field density testing on compacted stabilised layer',
      acceptanceCriteria: 'Minimum 97% Standard Proctor MDD for lime-stabilised subgrade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (field density), AS 1289.5.2.1 (Modified compaction for MDD)',
      notes: 'Clause 9 MRTS07A. 1 density test per 500 m2 per layer; minimum 3 tests per lot.'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels of stabilised layer',
      acceptanceCriteria: 'Surface level tolerance +/-10 mm from design (if base for asphalt); correct crossfall',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Level survey',
      notes: 'Clause 9 MRTS07A. Check for high/low spots exceeding tolerance.'
    },
    {
      description: 'Verify stabilised layer thickness - no under-thickness',
      acceptanceCriteria: 'Thickness tolerance: 0 mm (negative), +10 mm (positive); full pavement width treated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Core measurement or depth gauge',
      notes: 'Clause 9 MRTS07A. No untreated pockets or edges.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment promptly after compaction and verify surface finish',
      acceptanceCriteria: 'Surface tightly bound; no loose aggregate or pulverised material; no continuous cracks > 3 mm; curing applied (moisture curing or bitumen emulsion seal)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9 MRTS07A. Surface must not be allowed to dry out and powder.'
    },

    // =========================================================================
    // PROOF ROLLING & STRENGTH
    // =========================================================================
    {
      description: 'Proof roll stabilised layer after curing period in presence of Administrator',
      acceptanceCriteria: 'No excessive deflection or surface cracking; no visible deformation under loaded roller',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q723 (Proof Roll Test)',
      notes: 'WP6 - Clause 9.8 MRTS07A. Administrator witnesses proof rolling after curing period.'
    },
    {
      description: 'Submit strength test results (CBR for lime stabilised subgrade)',
      acceptanceCriteria: 'CBR >= 15 (or as specified in Annexure); if UCS specified, average meets target with no individual < 0.8x target',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.6.1.1 (CBR) or TMR Q115 (UCS)',
      notes: 'Clause 9 MRTS07A. Lime stabilisation typically assessed by CBR. 3 cylinders per lot if UCS required.'
    },

    // =========================================================================
    // ACCEPTANCE & LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'All verification tests (density, moisture, thickness, strength) must indicate compliance before layer accepted',
      acceptanceCriteria: 'All test results within specification; no outstanding nonconformances; layer ready for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'HP7 - Clause 9.9 MRTS07A. Stabilised layer not accepted (nor subsequent layers placed) until all verification tests comply.'
    },
    {
      description: 'Compile lot conformance documentation including all test results, spread rate checks, survey data, and inspection records',
      acceptanceCriteria: 'Complete lot documentation pack with full traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 Quality System requirements. Conformance report for each lot.'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All acceptance criteria met; lot approved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval before subsequent layer placement.'
    }
  ]
}

// =============================================================================
// 3. QLD STABILISED PAVEMENT - CEMENT (TMR MRTS07B)
// =============================================================================

const qldStabilisedCementTemplate = {
  name: 'Stabilised Pavement - Cement',
  description: 'TMR in-situ cement stabilised pavement construction per MRTS07B (July 2024). Covers cement-treated base and subbase layers.',
  activityType: 'pavements',
  specificationReference: 'MRTS07B',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit detailed Stabilisation Construction Procedures including plant, joints, layer thickness, curing, and protective measures for cold/wet weather',
      acceptanceCriteria: 'Procedures accepted by Administrator; submitted minimum 14-28 days prior to commencement; complies with Clause 6 of MRTS50',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP1 - Clause 5.2.2 MRTS07B. No stabilisation works to commence until procedures are approved.'
    },
    {
      description: 'Submit materials compliance evidence - cement/binder certificate to MRTS23, in-situ soil PI and sulfate levels',
      acceptanceCriteria: 'Binder certificate compliant with MRTS23; soil PI and sulfate levels acceptable for cement treatment; all test results accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.3.1 (PI), Sulfate testing',
      notes: 'HP2 - Clause 7.1 MRTS07B. All materials must be tested and confirmed compliant before use.'
    },
    {
      description: 'Complete all specified pre-treatment (milling, preliminary compaction) and notifications (traffic, utilities) before commencing stabilisation',
      acceptanceCriteria: 'Pre-treatment completed; required notifications made; Administrator gives clearance to proceed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP3 - Clause 8.0 MRTS07B. Do not start pulverisation or binder spreading until clearance given.'
    },
    {
      description: 'Identify, locate, and protect all underground services and structures in the treatment area',
      acceptanceCriteria: 'All underground services surveyed and protection measures in place; Administrator approves proceeding',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP4 - Clause 8.3 MRTS07B. Work held until services survey and protection confirmed.'
    },
    {
      description: 'Determine and submit Allowable Working Time (from mixing to compaction completion) via testing for Administrator approval',
      acceptanceCriteria: 'Working time determined by testing (VicRoads RC T144 or equivalent); approved by Administrator before cement stabilisation commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'VicRoads RC T144 (working time assessment)',
      notes: 'HP5 - Clause 8.4 MRTS07B. Cement-only hold point. No cement stabilisation until working time is approved.'
    },
    {
      description: 'Submit and obtain approval for process-based compaction method (rolling pattern) via successful trial section',
      acceptanceCriteria: 'Trial section demonstrates compaction method achieves specification requirements; method approved by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (field density)',
      notes: 'HP6 - Clause 8.5.2.1 MRTS07B. Hold applies to begin full-scale works until compaction process approved.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Administrator to witness construction of trial stabilised section to confirm mixing uniformity, compaction, and surface finish',
      acceptanceCriteria: 'Administrator witnesses full trial section construction; mixing, compaction, and finish demonstrated satisfactorily',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP1 - Clause 8.5.2.2 MRTS07B. 24 hours notice required.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Remove any pockets of unsuitable material (excessively wet, organic) encountered during preparation',
      acceptanceCriteria: 'Unsuitable material excavated and disposed of appropriately; Administrator inspects removal',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP2 - Clause 8.6.1 MRTS07B. Notification on occurrence.'
    },

    // =========================================================================
    // BINDER APPLICATION
    // =========================================================================
    {
      description: 'Verify binder (cement) spreading operation - uniform spread rate confirmed via bucket tests, within weather/wind limits',
      acceptanceCriteria: 'Spread rate within +/-10% of design rate; uniform coverage; no missed strips; weather conditions suitable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Bucket test (spread rate calculation)',
      notes: 'WP4 - Clause 8.6.6 MRTS07B. Administrator may observe binder application at start of each run.'
    },
    {
      description: 'Perform spread rate check on first run of each day using catch trays to calculate kg/m2 of binder',
      acceptanceCriteria: 'Measured spread rate within +/-10% of design; calibration adjusted if out of tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Catch tray spread rate calculation',
      notes: 'Clause 8.6 MRTS07B. Every run observed for missed strips.'
    },

    // =========================================================================
    // MIXING
    // =========================================================================
    {
      description: 'Verify mixing depth achieves target depth uniformly throughout treatment area',
      acceptanceCriteria: 'Mixing depth verified to design depth (e.g. 250 mm); uniform mixing throughout; no shallow areas',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP5 - Clause 8.6.9 MRTS07B. Administrator may inspect during mixing operations.'
    },
    {
      description: 'Verify pulverisation quality after initial mixing',
      acceptanceCriteria: '100% passing 37.5 mm; >= 95% passing 19 mm; no lumps > 40 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1 (sieve on processed material)',
      notes: 'Clause 8.6 MRTS07B. Clods of plastic soil must be fully broken down.'
    },
    {
      description: 'Verify treatment depth by digging or coring',
      acceptanceCriteria: 'Stabiliser mixed to design depth; indicator dye confirms treated vs untreated boundary',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Depth check (excavation or coring)',
      notes: 'Clause 8.6 MRTS07B. At least 1 location per 100 m of run (or per lot).'
    },

    // =========================================================================
    // COMPACTION (WITHIN WORKING TIME)
    // =========================================================================
    {
      description: 'Verify moisture content during compaction is within specified range',
      acceptanceCriteria: 'Moisture content at OMC to OMC +2%; degree of saturation not exceeding ~85%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1 (moisture content)',
      notes: 'Clause 8 MRTS07B. Check moisture at least 2 times per lot.'
    },
    {
      description: 'Perform compaction within approved working time - compaction must be complete before initial set',
      acceptanceCriteria: 'Compaction completed within approved working time; no compaction after initial set commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8.4/8.6 MRTS07B. CRITICAL - record time from mixing to compaction completion. Material exceeding working time is rejected.'
    },
    {
      description: 'Perform field density testing on compacted stabilised layer',
      acceptanceCriteria: '100% Standard Proctor MDD for cement-treated base (or as specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (field density), AS 1289.5.2.1 (Modified compaction for MDD)',
      notes: 'Clause 9 MRTS07B. 1 density test per 500 m2 per layer; minimum 3 tests per lot.'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels of stabilised layer',
      acceptanceCriteria: 'Surface level tolerance +/-10 mm from design (if base for asphalt); correct crossfall',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Level survey',
      notes: 'Clause 9 MRTS07B. Check for high/low spots exceeding tolerance.'
    },
    {
      description: 'Verify stabilised layer thickness - no under-thickness',
      acceptanceCriteria: 'Thickness tolerance: 0 mm (negative), +10 mm (positive); full pavement width treated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Core measurement or depth gauge',
      notes: 'Clause 9 MRTS07B. No untreated pockets or edges.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment (moisture curing or bitumen emulsion seal) promptly after compaction',
      acceptanceCriteria: 'Curing applied promptly; surface tightly bound; no surface drying or powdering; no continuous cracks > 3 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9 MRTS07B. Surface must not be allowed to dry out; lack of curing requires rectification.'
    },

    // =========================================================================
    // PROOF ROLLING & STRENGTH VERIFICATION
    // =========================================================================
    {
      description: 'Proof roll stabilised layer after curing period in presence of Administrator',
      acceptanceCriteria: 'No excessive deflection or surface cracking; no visible deformation under loaded roller',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q723 (Proof Roll Test)',
      notes: 'WP6 - Clause 9.8.2 MRTS07B. Administrator witnesses proof rolling after curing period.'
    },
    {
      description: 'Collect and submit 7-day UCS test specimens',
      acceptanceCriteria: '3 cylinders per lot moulded at field conditions; cured for 7 days; average UCS meets design target (e.g. 4.0 MPa for base)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS of stabilised soil)',
      notes: 'Clause 9 MRTS07B. 7-day UCS specimens compacted at OMC, cured 7 days.'
    },
    {
      description: 'Submit 7-day UCS results and verify compliance',
      acceptanceCriteria: 'Average UCS meets target; no individual result < 0.8x target (e.g. target 4.0 MPa base: average >= 4.0, no result < 3.2 MPa)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS)',
      notes: 'Clause 9 MRTS07B. Early indication of compliance. Failing lots may require re-treatment.'
    },

    // =========================================================================
    // ACCEPTANCE & LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'All verification tests (density, moisture, thickness, UCS) must indicate compliance before layer accepted',
      acceptanceCriteria: 'All test results within specification; no outstanding nonconformances; completed stabilised layer ready for subsequent works',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'HP7 - Clause 9.10 MRTS07B. Stabilised layer not accepted (nor subsequent layers placed) until all verification tests comply.'
    },
    {
      description: 'Compile lot conformance documentation including all test results, working time records, spread rate checks, survey data, and inspection records',
      acceptanceCriteria: 'Complete lot documentation pack with full traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 Quality System requirements. Conformance report for each lot.'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All acceptance criteria met; lot approved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval before subsequent layer placement.'
    }
  ]
}

// =============================================================================
// 4. QLD CONCRETE PAVEMENT (TMR MRTS40)
// =============================================================================

const qldConcretePavementTemplate = {
  name: 'Concrete Pavement',
  description: 'TMR concrete pavement base construction per MRTS40 (November 2018). Covers Plain Concrete Pavements (PCP), Jointed Reinforced (JRCP), Continuously Reinforced (CRCP), and Steel Fibre Reinforced (SFCP).',
  activityType: 'pavements',
  specificationReference: 'MRTS40',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Construction Procedures for concrete pavement works including plant details, equipment, placement methods, curing procedures, and contingency plans',
      acceptanceCriteria: 'Procedures accepted by Administrator at least 14 calendar days before work commences; complies with Clause 6 of MRTS50',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 MRTS40 / MRTS50. No paving to commence until procedures accepted.'
    },
    {
      description: 'Submit nominated concrete mix design for approval including cement type, admixtures, water/cement ratio, and target 28-day flexural strength',
      acceptanceCriteria: 'Mix design meets requirements of Table 7.3 (minimum compressive and flexural strength at 28 days); mix design certificate provided at least 4 weeks prior to placement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012.9 (compressive), AS 1012.11 (flexural)',
      notes: 'HP1 - Clause 7.3 MRTS40. No concrete to be placed until mix design approved by Administrator.'
    },
    {
      description: 'Submit Construction Procedure for aggregate production including quarry details and conformity of particle size distribution',
      acceptanceCriteria: 'Aggregate complies with AS 2758.1 and Table 6.1.5 of MRTS40; quarry source approved and registered',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1141.11 (particle size distribution)',
      notes: 'Clause 6 MRTS40 / MRTS50. Aggregate source to be registered.'
    },
    {
      description: 'Submit details of proposed dowel support system and method of debonding dowels (for JRCP/PCP with dowelled joints)',
      acceptanceCriteria: 'Dowel system suitable for pavement type; debonding method prevents concrete bond to dowels on one side of joint',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS40/MRTS41. Dowel details form part of Construction Procedures.'
    },
    {
      description: 'Submit details of tie bar installation method (drilled/grouted or inserted during paving) with demonstration trial if using inserted tie bars',
      acceptanceCriteria: 'Tie bar system demonstrates adequate pull-out resistance; demonstration trial acceptable to Administrator',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Pull-out test per MRTS41',
      notes: 'MRTS41. Inserted tie bars usually require demonstration trial plus pull-out testing.'
    },

    // =========================================================================
    // SUBBASE PREPARATION
    // =========================================================================
    {
      description: 'Verify subbase layer compliance (unbound or bound) is complete with all conformance testing passed before concrete pavement placement',
      acceptanceCriteria: 'Subbase compaction, level, and thickness meet design requirements per MRTS05/MRTS08 as applicable; proof rolling complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (density), Survey (levels)',
      notes: 'Clause 8.2 MRTS40. Concrete not to be placed on nonconforming subbase. Cross-reference to MRTS05 or MRTS08 ITP.'
    },
    {
      description: 'Inspect subbase surface for cleanliness, correct profile, and absence of loose material or damage prior to paving',
      acceptanceCriteria: 'Surface free of debris, standing water, and damage; profile within specified tolerances',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8.2 MRTS40. Hold point applied if any high invert levels exist.'
    },
    {
      description: 'Verify set-out of pavement edges, joints, and alignment prior to formwork or slipform paving',
      acceptanceCriteria: 'Set-out matches design drawings within survey tolerances; all joint locations marked',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check',
      notes: 'MRTS56 Construction Surveying requirements apply.'
    },

    // =========================================================================
    // FORMWORK & REINFORCEMENT
    // =========================================================================
    {
      description: 'Inspect formwork alignment, grade, and rigidity prior to concrete placement (fixed form paving)',
      acceptanceCriteria: 'Forms set to correct line and level; rigid enough to resist concrete pressure; clean and oiled; expansion joint filler positioned',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey check (line and level)',
      notes: 'Clause 8 MRTS40. Applicable to fixed form paving only, not slipform.'
    },
    {
      description: 'Inspect reinforcement placement including bar size, spacing, cover, lap lengths, and chair spacing (JRCP/CRCP)',
      acceptanceCriteria: 'Reinforcement complies with drawings; cover as specified; lap lengths per design; chairs stable and correctly spaced',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Cover meter verification',
      notes: 'Clause 8 MRTS40. No concrete to be placed until reinforcement inspected and accepted. For CRCP, longitudinal reinforcement is critical.'
    },
    {
      description: 'Verify dowel bar assembly placement at transverse joints including alignment, spacing, and debonding (JRCP/PCP)',
      acceptanceCriteria: 'Dowels aligned within +/-2 mm tolerance; spacing per design; debonding material intact; dowels parallel to pavement surface and centreline',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Metal detector survey post-pour',
      notes: 'MRTS40. Dowel alignment tolerance +/-2 mm. Verified by metal detector after placement.'
    },
    {
      description: 'Verify tie bar placement at longitudinal joints including spacing, length, and embedment depth',
      acceptanceCriteria: 'Tie bars at specified spacing, length, and embedment; perpendicular to joint face',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS41. Tie bars connect longitudinal joint faces to prevent lane separation.'
    },
    {
      description: 'Inspect slipform paver setup including string line, machine calibration, vibrator condition, and automatic grade/steering sensors',
      acceptanceCriteria: 'Paver calibrated; string line set to correct grade; vibrators operational at correct frequency; grade sensors functional',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS40. Equipment check before each paving session.'
    },

    // =========================================================================
    // TRIAL PAVING SECTION
    // =========================================================================
    {
      description: 'Construct trial paving section to demonstrate equipment capability, placement methods, finishing, and texturing',
      acceptanceCriteria: 'Trial section placed in continuous operation; surface finish, ride quality, joint formation, compaction, and texturing meet specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Surface regularity, core testing',
      notes: 'HP3 - Clause 8.4 MRTS40. No full-scale paving until trial section results accepted by Administrator.'
    },
    {
      description: 'Administrator to witness trial paving section construction including concrete supply, placement, consolidation, finishing, texturing, and curing',
      acceptanceCriteria: 'All operations demonstrated satisfactorily; ride quality, surface texture, edge slump, and joint formation acceptable',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8.4 MRTS40. Administrator witnesses full trial paving operation.'
    },

    // =========================================================================
    // CONCRETE SUPPLY & PLACEMENT
    // =========================================================================
    {
      description: 'Verify concrete slump at point of discharge for each delivery',
      acceptanceCriteria: 'Slump within +/-15 mm (or +/-25%) of nominated slump; consistence suitable for equipment and placement method',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.3.1 (slump test)',
      notes: 'Clause 7 MRTS40. Every load initially, then per 5 m3.'
    },
    {
      description: 'Record concrete temperature at discharge and verify placement time from batching',
      acceptanceCriteria: 'Concrete temperature 10-32 degrees C; placement completed within 90 min from batching (unless retarder used)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.8.4 (temperature)',
      notes: 'Clause 7 MRTS40. Record temperature and batch time for every load. Reject loads exceeding limits.'
    },
    {
      description: 'Cast flexural strength test beams and compressive strength cylinders during paving for each lot',
      acceptanceCriteria: 'Minimum 1 set of beams per lot (or per day paving); specimens made per AS 1012.8.1; stored and cured at 23 +/-2 degrees C',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.8.1 (making specimens), AS 1012.11 (flexural), AS 1012.9 (compressive)',
      notes: 'Clause 9 MRTS40 / Appendix P3. Flexural strength is the primary acceptance criterion for concrete pavement.'
    },
    {
      description: 'Monitor concrete placement to ensure continuous supply, proper consolidation by internal vibrators, and no segregation or cold joints',
      acceptanceCriteria: 'No interruption causing cold joints; concrete fully consolidated; vibrators at correct frequency; no segregation at edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8.4 MRTS40. Continuous supply essential to avoid construction joints.'
    },
    {
      description: 'Verify concrete placement does not occur when surface temperature of subbase is below minimum or during rain',
      acceptanceCriteria: 'No placement when subbase surface temperature below 5 degrees C; no placement during rain or when rain imminent without protection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Thermometer (surface temperature)',
      notes: 'Clause 8 MRTS40. Weather conditions must be suitable for placement and finishing.'
    },

    // =========================================================================
    // FINISHING & TEXTURING
    // =========================================================================
    {
      description: 'Inspect surface finish after strike-off and floating to verify correct cross-fall, smoothness, and absence of surface defects',
      acceptanceCriteria: 'Surface profile within tolerances; no surface tears, dragging, or laitance accumulation; correct cross-fall achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Straightedge check (3 m)',
      notes: 'Clause 8.5 MRTS40. Surface finishing must be completed within the concrete workability window.'
    },
    {
      description: 'Apply surface texture (tining, broom drag, or exposed aggregate) within specified time window after finishing',
      acceptanceCriteria: 'Texture applied uniformly; texture depth >= 0.7 mm Sand Patch; tine spacing and depth per design; no damage to slab edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Austroads AG:PT/T250 (Sand Patch texture depth)',
      notes: 'Clause 8.5 MRTS40. Texturing before concrete sets but after surface moisture dissipated.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound immediately after texturing to prevent moisture loss',
      acceptanceCriteria: 'Curing compound complies with AS 3799; Type 3 (black) and Class C (chlorinated rubber) NOT to be used; applied at recommended rate with uniform coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8.6 MRTS40. Curing compound must comply with AS 3799. Type 3 and Class C excluded.'
    },
    {
      description: 'Maintain curing regime for the specified duration (minimum 7 days or as specified)',
      acceptanceCriteria: 'Curing compound intact for minimum period; any damage repaired by re-application; wet curing maintained if used as alternative',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8.6 MRTS40. Continuous curing critical for concrete pavement durability and crack prevention.'
    },

    // =========================================================================
    // JOINT SAWING
    // =========================================================================
    {
      description: 'Saw contraction joints within the specified time window after placement (PCP/JRCP)',
      acceptanceCriteria: 'Joints sawn to design depth (1/4 to 1/3 of slab thickness); sawn within 4-12 hours; straight, clean cuts; no spalling at edges',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8.7 MRTS40/MRTS41. CRITICAL timing - too early causes ravelling, too late allows random cracking.'
    },
    {
      description: 'Verify joint spacing and pattern matches design drawings',
      acceptanceCriteria: 'Transverse joint spacing per design (typically 4-6 m for PCP); longitudinal joints at lane edges; all joints straight and aligned',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey check',
      notes: 'Clause 8.7 MRTS40. Joint layout as per design drawings.'
    },
    {
      description: 'Seal joints with specified sealant material after joint reservoir is formed and cleaned',
      acceptanceCriteria: 'Joint reservoir cut to correct width and depth; joint faces clean and dry; sealant installed per manufacturer instructions; sealant level below surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS41. Joint sealing may be deferred until after pavement opening to traffic.'
    },

    // =========================================================================
    // ACCEPTANCE TESTING
    // =========================================================================
    {
      description: 'Test 28-day flexural strength of concrete from test beams cast during placement',
      acceptanceCriteria: '28-day rolling mean flexural strength >= ffMin (as specified in Annexure); rolling CV <= 11.0%; individual results within acceptance limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.11 (flexural strength - third-point loading)',
      notes: 'HP4 - Clause 9.2 MRTS40 / Appendix P3. Hold point applied if 28-day rolling mean < 0.95 ffMin. Statistical five-point rolling mean.'
    },
    {
      description: 'Test 28-day compressive strength of concrete from cylinders cast during placement',
      acceptanceCriteria: 'Compressive strength meets minimum requirements per Table 7.3; no individual result below 0.9 fc',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.9 (compressive strength)',
      notes: 'Clause 9.2 MRTS40. Compressive strength supplementary to flexural strength for pavement concrete.'
    },
    {
      description: 'Core pavement to verify in-situ thickness at random locations per lot',
      acceptanceCriteria: 'No core thickness less than design thickness minus 10 mm; average thickness >= design thickness',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Coring (diamond core drill)',
      notes: 'Clause 9 MRTS40. Minimum 3 cores per lot for thickness verification.'
    },
    {
      description: 'Verify dowel bar alignment in finished slab using metal detector or ground-penetrating radar',
      acceptanceCriteria: 'Dowel alignment within +/-2 mm tolerance; dowels parallel to pavement surface and centreline; no displaced or rotated dowels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Metal detector / GPR survey',
      notes: 'MRTS40. Metal detector survey of all dowelled joints.'
    },
    {
      description: 'Perform tie bar compaction assessment at longitudinal joints',
      acceptanceCriteria: 'Concrete around tie bars fully compacted; no voids or honeycombing; pull-out testing satisfactory where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Visual + pull-out test per MRTS41',
      notes: 'Clause 9 MRTS40/MRTS41. Hold point applied when nonconformities detected in tiebar location.'
    },

    // =========================================================================
    // SURFACE REGULARITY & RIDE QUALITY
    // =========================================================================
    {
      description: 'Check surface regularity using 3 m straightedge at specified locations',
      acceptanceCriteria: 'Maximum deviation under 3 m straightedge <= 3 mm; no abrupt steps at joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: '3 m straightedge',
      notes: 'Clause 9 MRTS40. Regularity checked at multiple locations across width and along length.'
    },
    {
      description: 'Verify surface texture depth at specified locations',
      acceptanceCriteria: 'Texture depth >= 0.7 mm by Sand Patch method; uniform across pavement width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Austroads AG:PT/T250 (Sand Patch test)',
      notes: 'Clause 9 MRTS40. Texture depth critical for skid resistance. 3 per lane-km.'
    },
    {
      description: 'Perform ride quality survey (IRI or profilograph) on completed pavement',
      acceptanceCriteria: 'IRI or Profile Index within specified limits per Annexure; no localised roughness exceeding limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'ARRB Walking Profiler or profilograph',
      notes: 'Clause 9 MRTS40. Ride quality assessed after joint sealing and before opening to traffic.'
    },

    // =========================================================================
    // OPENING TO TRAFFIC
    // =========================================================================
    {
      description: 'Verify concrete has achieved minimum in-situ compressive strength before opening to traffic',
      acceptanceCriteria: 'In-situ compressive strength >= 20 MPa before non-essential traffic; essential construction traffic only at lower strength with Administrator approval',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.9 (maturity method or cylinder testing)',
      notes: 'MRTS40. Non-essential traffic not allowed until in-situ compressive strength of 20 MPa reached.'
    },

    // =========================================================================
    // FINAL SURVEYS & DOCUMENTATION
    // =========================================================================
    {
      description: 'Conduct final level survey to confirm compliance with design levels and cross-falls',
      acceptanceCriteria: 'Finished surface level within +/-5 mm of design; cross-fall within +/-0.3% of design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Survey (levels)',
      notes: 'Clause 9 MRTS40 / MRTS56. Survey records form part of as-built documentation.'
    },
    {
      description: 'Compile and submit lot conformance report including all test results, inspection records, and as-built survey data',
      acceptanceCriteria: 'All test results within specification; any nonconformances documented with corrective actions; complete traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS40 / MRTS50. Lot conformance required before acceptance of each lot.'
    },
    {
      description: 'Submit as-built drawings showing actual joint locations, pavement thickness, and any deviations from design',
      acceptanceCriteria: 'As-built drawings complete and accurate; all deviations documented and approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Contract requirement. As-builts required for asset management.'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All acceptance criteria met; lot approved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval.'
    }
  ]
}

// =============================================================================
// 5. QLD PLANT-MIXED STABILISED PAVEMENT (TMR MRTS08)
// =============================================================================

const qldPlantMixedStabilisedTemplate = {
  name: 'Plant-Mixed Stabilised Pavement',
  description: 'TMR plant-mixed heavily bound (cemented) pavement construction per MRTS08 (November 2022). Covers Category 1 (UCS > 4 MPa at 28 days) and Category 2 (UCS > 2 MPa at 28 days) materials.',
  activityType: 'pavements',
  specificationReference: 'MRTS08',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Construction Procedures for plant-mixed stabilised pavement including plant details, delivery logistics, placement method, compaction equipment, and curing procedure',
      acceptanceCriteria: 'Procedures accepted by Administrator; complies with Clause 6 of MRTS50; submitted minimum 14 days before commencement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP1 - Clause 5.2 MRTS08 / MRTS50. No work to commence until procedures accepted.'
    },
    {
      description: 'Nominate registered mix design with current Stabilised Mix Design Certificate per TN204, including stabilising agent type and proportion',
      acceptanceCriteria: 'Only current (not expired/suspended) registered mix design per TN204; stabilising agent type and proportion as per certificate; registered with TMR',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'TMR Q115 (UCS of stabilised soil)',
      notes: 'HP2 - Clause 7.2 MRTS08 / TN204. Mix design registration required before production. Now managed under TN204.'
    },
    {
      description: 'Verify source aggregate compliance for unbound granular pavement material component',
      acceptanceCriteria: 'Aggregate meets grading, PI, CBR, and durability requirements per MRTS05 or Annexure; quarry registration current',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1 (PSD), AS 1289.3.3.1 (PI), AS 1289.6.1.1 (CBR)',
      notes: 'Clause 6 MRTS08. Source material must be approved before use.'
    },
    {
      description: 'Verify mix design UCS targets meet specification requirements for material category',
      acceptanceCriteria: 'Category 1: min 3.0 MPa at 7 days and 6.0 MPa at 28 days, working time >= 6 hours; Category 2: min 2.0 MPa at 7 days and 4.0 MPa at 28 days',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS)',
      notes: 'MRTS08 Table. UCS categories determine pavement application (base vs subbase).'
    },
    {
      description: 'Submit details of stabilising agent (cement or cementitious blend) with test certificates confirming compliance',
      acceptanceCriteria: 'Stabilising agent complies with MRTS23; batch certificates provided; constituents per Table 6.2 of MRTS08',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS08. Table 6.2 specifies requirements for binder constituents.'
    },

    // =========================================================================
    // PLANT PRODUCTION
    // =========================================================================
    {
      description: 'Inspect mixing plant to verify calibration of binder feed system, aggregate weigh system, and water addition',
      acceptanceCriteria: 'Plant calibrated within tolerances; binder feed rate accurate to +/-0.5%; uniform mixing achieved; batch records automated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS08. Plant inspection before first production run. Continuous or pugmill batch plant acceptable.'
    },
    {
      description: 'Verify target binder content (stabilising agent percentage) during production using batch records',
      acceptanceCriteria: 'Binder content matches Mix Design Certificate within +/-0.5%; batch records verify calculated application rate per m3',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Calculation from batch records (mass binder / mass mix)',
      notes: 'Clause 7.2 MRTS08. Binder content verified via batch plant records.'
    },
    {
      description: 'Determine working time of stabilised mix and ensure all operations completed within this time',
      acceptanceCriteria: 'Category 1: working time minimum 6 hours (from mixing to compaction completion); material placed and compacted within working time',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'VicRoads RC T144 or alternative working time test',
      notes: 'Clause 7 MRTS08. Working time critical for cemented materials. If exceeded, material may not achieve required UCS.'
    },
    {
      description: 'Verify moisture content of mixed material at plant',
      acceptanceCriteria: 'Moisture content within OMC to OMC +2%; sufficient moisture for cement hydration; not excessive causing bleeding or segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1 (moisture content)',
      notes: 'Clause 8 MRTS08. Moisture checked at plant before dispatch.'
    },

    // =========================================================================
    // TRANSPORT
    // =========================================================================
    {
      description: 'Verify delivery vehicles are suitable and sufficient for continuous placement without interruption',
      acceptanceCriteria: 'Sufficient vehicles for continuous delivery; material covered during transport; transport time within working time allowance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS08. Continuous delivery essential - material should not be stockpiled unless retarder approved.'
    },
    {
      description: 'Verify material condition on arrival at site - no segregation, drying, or premature hydration',
      acceptanceCriteria: 'Material uniform in appearance and moisture; no balling, crusting, or segregation; temperature acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS08. Reject loads showing signs of premature hydration.'
    },

    // =========================================================================
    // SUBGRADE/SUBBASE PREPARATION
    // =========================================================================
    {
      description: 'Verify underlying layer (subgrade or subbase) is conforming and ready to receive plant-mixed material',
      acceptanceCriteria: 'Underlying layer compaction, level, and thickness testing passed; surface clean, moist, free from loose material; proof rolling passed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (density), TMR Q723 (proof roll)',
      notes: 'Clause 8 MRTS08. Preceding layer must be accepted before placing stabilised material.'
    },
    {
      description: 'Check for underground services and ensure protection measures in place prior to placement',
      acceptanceCriteria: 'All underground services identified, located by survey, and protected; locations communicated to paving crew',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS08. Similar to MRTS07 underground services requirement.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section to demonstrate placement and compaction method achieves specification requirements',
      acceptanceCriteria: 'Trial section achieves required compaction, surface finish, thickness, and joint preparation; compaction pattern established',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (density), TMR Q115 (UCS)',
      notes: 'Clause 8 MRTS08. No full-scale production until trial section results accepted by Administrator.'
    },
    {
      description: 'Administrator to witness trial section construction including placement, compaction, and testing',
      acceptanceCriteria: 'Administrator attends and witnesses full trial section construction; all equipment and methods demonstrated',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS08. 24 hours notice to Administrator prior to trial section.'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Verify placement method (paver, grader, or other approved equipment) and layer thickness',
      acceptanceCriteria: 'Layer thickness per design (after compaction); material placed uniformly without segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Depth gauge checks',
      notes: 'Clause 8 MRTS08. Layer thickness verified during and after placement.'
    },
    {
      description: 'Verify longitudinal and transverse joint preparation between adjacent runs and construction lots',
      acceptanceCriteria: 'Vertical joint face cut back to sound material; joint face moistened; no cold/dry joints; overlap zone managed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS08. Joint preparation critical for heavily bound materials to avoid reflective cracking.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Compact material using approved rolling pattern established during trial section',
      acceptanceCriteria: 'Rolling pattern per trial section; compaction within working time; rollers at correct speed and weight; no over-compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS08. Compaction must be completed within working time of cemented material.'
    },
    {
      description: 'Perform field density testing on compacted material for each lot',
      acceptanceCriteria: 'In-situ dry density ratio >= 98% of Standard MDD (or as specified in Annexure); minimum testing frequency met',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (field density - nuclear gauge or sand replacement)',
      notes: 'Clause 9 MRTS08. Density testing immediately after compaction. 1 per 500 m2 per layer, minimum 3 per lot.'
    },
    {
      description: 'Verify moisture content of compacted material',
      acceptanceCriteria: 'Moisture content within OMC to OMC +2%; degree of saturation not exceeding limit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1 (moisture content) / TMR Q250 (DoS calculation)',
      notes: 'Clause 9 MRTS08. Moisture checked concurrently with density testing.'
    },

    // =========================================================================
    // ACCEPTANCE TESTING - STRENGTH
    // =========================================================================
    {
      description: 'Mould UCS test specimens from material sampled during placement for 7-day and 28-day testing',
      acceptanceCriteria: 'Minimum 3 specimens per lot; specimens compacted at field moisture and density; cured under controlled conditions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS of stabilised soil)',
      notes: 'Clause 9 MRTS08. Specimens moulded on day of placement.'
    },
    {
      description: 'Test 7-day UCS of moulded specimens',
      acceptanceCriteria: 'Category 1: average >= 3.0 MPa; Category 2: average >= 2.0 MPa; no individual result < 80% of target',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS)',
      notes: 'Clause 9 MRTS08. 7-day results provide early indication of compliance.'
    },
    {
      description: 'Test 28-day UCS of moulded specimens and verify compliance with specification',
      acceptanceCriteria: 'Category 1: average >= 6.0 MPa; Category 2: average >= 4.0 MPa; no individual result < 80% of target; mix design conformance maintained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q115 (UCS)',
      notes: 'HP3 - Clause 9 MRTS08. Use of mix design shall not continue until hold point re-established if results nonconforming. Final acceptance based on 28-day UCS.'
    },

    // =========================================================================
    // LEVEL, THICKNESS & SURFACE
    // =========================================================================
    {
      description: 'Perform level survey of finished surface to verify design levels and cross-fall',
      acceptanceCriteria: 'Finished surface level within +/-10 mm of design; cross-fall within design tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Survey (levels)',
      notes: 'Clause 9 MRTS08 / MRTS56.'
    },
    {
      description: 'Verify layer thickness by coring or depth measurements',
      acceptanceCriteria: 'No negative thickness tolerance (must not be thinner than design); positive tolerance +10 mm; full pavement width treated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Core measurement / depth gauge',
      notes: 'Clause 9 MRTS08. Thickness verified at minimum 1 location per 100 m.'
    },
    {
      description: 'Check surface regularity using 3 m straightedge',
      acceptanceCriteria: 'Max deviation <= 10 mm for bound subbase; <= 5 mm for base to receive asphalt',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: '3 m straightedge',
      notes: 'Clause 9 MRTS08. Surface regularity affects ride quality of finished surface.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment (water curing or bitumen emulsion seal) promptly after compaction to prevent moisture loss',
      acceptanceCriteria: 'Curing applied within 2 hours of final compaction; surface not allowed to dry out; bitumen emulsion spray rate per MRTS11 if used',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS08. Inadequate curing leads to surface friability and reduced strength.'
    },
    {
      description: 'Maintain curing regime for specified duration',
      acceptanceCriteria: 'Minimum 7 days curing or until subsequent layer placed; no traffic on cured surface unless approved; surface not allowed to dry and powder',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 8 MRTS08. Construction traffic restricted during curing period.'
    },

    // =========================================================================
    // PROOF ROLLING & FINAL ACCEPTANCE
    // =========================================================================
    {
      description: 'Proof roll completed and cured stabilised layer to check for weak areas or excessive deflection',
      acceptanceCriteria: 'No visible deformation, rutting, or pumping under loaded roller; no cracking wider than 3 mm; yielding areas reworked',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'TMR Q723 (Proof Roll Test) / Austroads AG:PT/T251 (Ball Penetration)',
      notes: 'Clause 9 MRTS08. Administrator witnesses proof rolling. Completed after curing period.'
    },
    {
      description: 'Acceptance of completed stabilised layer - all conformance testing satisfactory and layer ready for subsequent works',
      acceptanceCriteria: 'All density, UCS, moisture, thickness, level, and surface regularity results comply; no nonconformances outstanding; lot conformance report completed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 9 MRTS08. Completed layer not accepted (nor subsequent layers placed) until all verification tests indicate compliance.'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Compile and submit lot conformance report including all test results, batch records, and inspection records',
      acceptanceCriteria: 'Complete traceability from mix design to batch records to test results; all results within specification; nonconformances documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 Quality System requirements. Conformance report for each lot.'
    },
    {
      description: 'Submit as-built records including actual layer thickness, levels, and any deviations from design',
      acceptanceCriteria: 'As-built data complete and accurate; final levels and thickness recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Contract requirement. As-built data for pavement layer.'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All acceptance criteria met; lot approved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval before subsequent layer placement.'
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
      stateSpec: 'MRTS',
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Pavements')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldUnboundPavementTemplate)
    await seedTemplate(qldStabilisedLimeTemplate)
    await seedTemplate(qldStabilisedCementTemplate)
    await seedTemplate(qldConcretePavementTemplate)
    await seedTemplate(qldPlantMixedStabilisedTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 pavement templates)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
