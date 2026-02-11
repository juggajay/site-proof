/**
 * Seed Script: VIC (VicRoads) ITP Templates - Pavements
 *
 * Creates global ITP templates for VIC pavement activities based on
 * VicRoads Standard Specifications for Roadworks and Bridgeworks.
 *
 * Templates:
 *   2. Unbound Granular Pavements (VicRoads Sec 304)
 *   3. CTCR - Cement Treated Crushed Rock (VicRoads Sec 306)
 *   4. Stabilised Pavements In-Situ (VicRoads Sec 307)
 *  16. Concrete Pavement (VicRoads Sec 503)
 *
 * Run with: node scripts/seed-itp-templates-vic-pavements.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// 1. VIC UNBOUND GRANULAR PAVEMENTS (VicRoads Sec 304)
// =============================================================================

const vicUnboundGranularPavementTemplate = {
  name: 'Unbound Granular Pavements',
  description: 'VicRoads unbound flexible pavement construction per Section 304, with crushed rock material requirements per Section 812. Covers Class 2 (base) and Class 3 (subbase) crushed rock placement, compaction, and acceptance testing.',
  activityType: 'pavements',
  specificationReference: 'Sec 304',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Pavement Quality Plan including materials, equipment, compaction procedures, lot layout, and testing regime',
      acceptanceCriteria: 'Plan reviewed and accepted by Superintendent; compliant with Section 304 requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.02. HP - Work shall not commence until Quality Plan is accepted.'
    },
    {
      description: 'Submit crushed rock mix design registration certificate (RC 500.02)',
      acceptanceCriteria: 'Crushed rock registered with VicRoads/DTP in accordance with RC 500.02; current registration valid',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.02',
      notes: 'Section 812, RC 500.02. HP - Only registered crushed rock mixes shall be used.'
    },
    {
      description: 'Submit crushed rock source investigation and accreditation (RC 500.00)',
      acceptanceCriteria: 'Source investigated and accredited per RC 500.00; rock type, geology, and processing confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.00',
      notes: 'Section 812.03, RC 500.00. HP - Source must be accredited.'
    },
    {
      description: 'Confirm crushed rock class matches design specification',
      acceptanceCriteria: 'Class 2 (base course) or Class 3 (subbase) as specified in pavement design; material class confirmed on registration certificate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 812.04. Class 2 = high quality base; Class 3 = high quality subbase.'
    },

    // =========================================================================
    // MATERIAL COMPLIANCE
    // =========================================================================
    {
      description: 'Verify crushed rock grading compliance (pre-compaction)',
      acceptanceCriteria: 'Grading within specified envelope per RC 500.02 Table; initial target near centre of envelope; all sieves within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.11.1 (Particle Size Distribution)',
      notes: 'Section 812.13, RC 500.02. Test per Table 812.141 frequency.'
    },
    {
      description: 'Verify Plasticity Index (PI) of crushed rock',
      acceptanceCriteria: 'Class 2: PI between 0 and maximum per specification; Class 3: PI within specified range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1',
      notes: 'Section 812.05. PI requirements differ by class.'
    },
    {
      description: 'Verify crushed rock Unsound Rock Content',
      acceptanceCriteria: 'Unsound rock content not exceeding maximum per registration; typically <= 15%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 302.01',
      notes: 'Section 812.05.'
    },
    {
      description: 'Verify crushed rock Degradation Factor',
      acceptanceCriteria: 'Degradation Factor - Fine Aggregate within specified limits per crushed rock class',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 302.12',
      notes: 'Section 812.05.'
    },
    {
      description: 'Verify pH and Conductivity of crushed rock',
      acceptanceCriteria: 'pH and conductivity within specified limits; monitoring for potential reactivity or corrosion issues',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.4.3.1 (pH)',
      notes: 'Section 812.05.'
    },
    {
      description: 'Conduct production testing at specified frequencies per Table 812.141',
      acceptanceCriteria: 'All production test results within specification; frequency may be halved where most recent 10 results comply',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Multiple (per Table 812.141)',
      notes: 'Section 812.14, Table 812.141.'
    },

    // =========================================================================
    // SUBGRADE/FOUNDATION ACCEPTANCE
    // =========================================================================
    {
      description: 'Verify subgrade formation has been accepted and released (from Earthworks ITP)',
      acceptanceCriteria: 'Formation release certificate held; proof rolling completed and signed off; density ratio meets specification',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.04. HP - Subgrade must be released before pavement construction. Superintendent to verify formation release documentation.'
    },
    {
      description: 'Verify subgrade level and shape prior to pavement placement',
      acceptanceCriteria: 'Subgrade level within specified tolerance of design; no ponding water; adequate drainage; cross-fall correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 304.04.'
    },

    // =========================================================================
    // PLACEMENT AND COMPACTION
    // =========================================================================
    {
      description: 'Place crushed rock in layers not exceeding maximum compacted thickness',
      acceptanceCriteria: 'Maximum compacted layer thickness per specification; minimum 100 mm compacted thickness for base course; even spreading achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 304.06. Minimum 100 mm Class 2 base regardless of traffic.'
    },
    {
      description: 'Moisture condition crushed rock material during compaction',
      acceptanceCriteria: 'Material moisture content not less than 85% of optimum moisture content during compaction; uniform moisture throughout layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1',
      notes: 'Section 304.06. Min 85% OMC during compaction.'
    },
    {
      description: 'Compact each layer to specified density ratio',
      acceptanceCriteria: 'Characteristic density ratio >= 100% Modified Dry Density Ratio (MDDR); tested per RC 500.05 Scale A or B requirements',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1, RC 316.00',
      notes: 'Section 304.08, Tables 304.081/082, RC 500.05. Superintendent to be notified of compaction testing.'
    },
    {
      description: 'Conduct density testing - 6 tests per lot for Scale A/B compliance',
      acceptanceCriteria: 'All 6 test results obtained; lot size per Table 304.111; characteristic value calculated per RC 316.00',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
      notes: 'Section 304.11, Table 304.111, RC 500.05. 6 tests per lot.'
    },
    {
      description: 'Conduct post-compaction grading and PI testing',
      acceptanceCriteria: 'Post-compaction grading and PI comply with specification; no degradation beyond acceptable limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.11.1, AS 1289.3.6.1',
      notes: 'Section 304.08. Verify material not degraded during compaction.'
    },
    {
      description: 'Proof roll each pavement layer',
      acceptanceCriteria: 'Proof rolling conducted per Section 173; no deflection exceeding specification limit; all defective areas identified and treated',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 304.08. W - All pavement layers to be test rolled in accordance with Section 173. Superintendent to be present.'
    },

    // =========================================================================
    // SURFACE LEVEL AND SHAPE
    // =========================================================================
    {
      description: 'Survey finished surface levels of each pavement layer',
      acceptanceCriteria: 'Level of top of each course within specified tolerance of design level; tolerance depends on road classification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.03. Tolerance depends on road classification.'
    },
    {
      description: 'Verify layer thickness by survey or measurement',
      acceptanceCriteria: 'Compacted layer thickness within tolerance of design; no area deficient by more than specified limit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.06.'
    },
    {
      description: 'Check surface regularity with straight edge',
      acceptanceCriteria: 'Surface regularity within specified limits per road classification; no high spots or depressions exceeding tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 304.03.'
    },

    // =========================================================================
    // FINAL ACCEPTANCE
    // =========================================================================
    {
      description: 'Conduct final proof rolling of completed pavement surface',
      acceptanceCriteria: 'Final proof roll with no visible deflection; Superintendent present; suitable as platform for surfacing',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 304.08. HP - Final pavement acceptance before surfacing. Superintendent must be present.'
    },
    {
      description: 'Verify moisture ratio/dryback prior to surfacing (where specified)',
      acceptanceCriteria: 'Moisture ratio within specified range per RC 316.14; adequate dryback achieved before seal or asphalt placement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 316.14',
      notes: 'Section 304.10. W - Dryback verification required for seal work. Superintendent to be notified.'
    },
    {
      description: 'Complete final surface level survey',
      acceptanceCriteria: 'All levels within specified tolerance; as-built levels documented and submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.03.'
    },
    {
      description: 'Submit all compaction test lot records',
      acceptanceCriteria: 'Complete density ratio records for every lot; all lots meet characteristic value requirements; statistical summary provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.11, RC 500.05.'
    },
    {
      description: 'Submit crushed rock production test records',
      acceptanceCriteria: 'All production testing records from quarry/source; grading, PI, and property test results within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 812.14, Table 812.141.'
    },
    {
      description: 'Submit material delivery records and traceability documentation',
      acceptanceCriteria: 'Delivery dockets, quantities, source identification for all crushed rock delivered; traceability maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 812.'
    },
    {
      description: 'Submit as-built drawings showing pavement layer thicknesses and levels',
      acceptanceCriteria: 'As-built survey data showing actual vs design for each layer; any variations noted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 304.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Superintendent',
      acceptanceCriteria: 'All acceptance criteria met for unbound granular pavement; lot approved and released',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 2. VIC CTCR - CEMENT TREATED CRUSHED ROCK (VicRoads Sec 306)
// =============================================================================

const vicCTCRTemplate = {
  name: 'CTCR - Cement Treated Crushed Rock',
  description: 'VicRoads cementitious treated pavement subbase construction per Section 306, with CTCR material requirements per Section 815. Covers mix design registration, production, placement, compaction, curing, and UCS strength verification.',
  activityType: 'pavements',
  specificationReference: 'Sec 306',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit CTCR Quality Plan including mix design, production procedures, placement, compaction, curing, and testing regime',
      acceptanceCriteria: 'Plan reviewed and accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.02. HP - Work shall not commence until Quality Plan is accepted.'
    },
    {
      description: 'Submit CTCR mix design registration certificate (RC 500.02)',
      acceptanceCriteria: 'Mix registered with VicRoads/DTP per RC 500.02; crushed rock component registered; cement type and source identified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.02',
      notes: 'Section 815, RC 500.02. HP - Only registered CTCR mixes shall be used.'
    },
    {
      description: 'Submit source rock investigation and accreditation (RC 500.00)',
      acceptanceCriteria: 'Source rock investigated and accredited; processing plant details confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.00',
      notes: 'Section 815.03, RC 500.00. HP - Source must be accredited.'
    },
    {
      description: 'Submit cementitious binder details and compliance certificates',
      acceptanceCriteria: 'Binder type (GP, GB, or blend with GGBFS/fly ash) identified; compliance certificates provided; binder source approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3972',
      notes: 'Section 815.04. HP - Binder must be approved before production. Binders include Portland cement Type GP, blended cement Type GB, GGBFS, hydrated lime, fly ash.'
    },
    {
      description: 'Submit Design Cementitious Binder Content determination',
      acceptanceCriteria: 'Laboratory mix design demonstrates minimum 7-day UCS meets Table 815.101 requirements; binder content not less than minimum in Table 815.101; compaction per AS 5101.4 Clause 7.2(d)(ii)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4 (UCS test on compacted specimens)',
      notes: 'Section 815.10, Table 815.101. HP - Design binder content must be approved.'
    },
    {
      description: 'Submit trial mix results from production plant',
      acceptanceCriteria: 'Production trial demonstrates consistent mixing, binder distribution, moisture content, and compliance with specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'Section 306. HP - Trial mix must be approved before production commences.'
    },
    {
      description: 'Submit proposed placement and compaction methodology',
      acceptanceCriteria: 'Placement equipment, layer thickness (100-180 mm compacted), compaction equipment and procedures documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.06. Single layer; min 100 mm, max 180 mm compacted thickness.'
    },
    {
      description: 'Submit curing methodology',
      acceptanceCriteria: 'Curing method compliant with specification; curing compound type and application rate, or water curing procedure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.09.'
    },

    // =========================================================================
    // MATERIAL COMPLIANCE - CRUSHED ROCK COMPONENT
    // =========================================================================
    {
      description: 'Verify crushed rock grading compliance',
      acceptanceCriteria: 'Grading within specified envelope per RC 500.02 and Section 815 requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1141.11.1',
      notes: 'Section 815.13, Table 815.141 frequency.'
    },
    {
      description: 'Verify Plasticity Index of crushed rock',
      acceptanceCriteria: 'PI within specified limits per Section 815 requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1',
      notes: 'Section 815.05, Table 815.141 frequency.'
    },
    {
      description: 'Verify Unsound Rock Content',
      acceptanceCriteria: 'Unsound rock content within specified maximum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 302.01',
      notes: 'Section 815.05, Table 815.141 frequency.'
    },
    {
      description: 'Verify Degradation Factor',
      acceptanceCriteria: 'Degradation Factor within specification limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 302.12',
      notes: 'Section 815.05, Table 815.141 frequency.'
    },
    {
      description: 'Conduct production testing per Table 815.141 frequencies',
      acceptanceCriteria: 'All test results within specification; test frequency may be halved after 10 successive compliant results for specified properties',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Multiple per Table 815.141',
      notes: 'Section 815.14, Table 815.141.'
    },

    // =========================================================================
    // SUBGRADE/FOUNDATION ACCEPTANCE
    // =========================================================================
    {
      description: 'Verify foundation/subgrade has been accepted and released',
      acceptanceCriteria: 'Formation release certificate held; proof rolling completed; density and levels compliant',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.04. HP - Foundation must be accepted before CTCR placement. Superintendent to verify release documentation.'
    },
    {
      description: 'Verify foundation surface level and shape',
      acceptanceCriteria: 'Foundation level within tolerance; no ponding; drainage adequate; surface clean and free of loose material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.04.'
    },

    // =========================================================================
    // PRODUCTION AND MIXING
    // =========================================================================
    {
      description: 'Verify mixing plant calibration for binder content',
      acceptanceCriteria: 'Plant calibration current; binder content within +/- 0.3% of Design Cementitious Binder Content by mass of dry crushed rock',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 815.10. HP - Plant calibration must be verified. Tolerance: +/- 0.3% of design binder content.'
    },
    {
      description: 'Monitor binder content during production',
      acceptanceCriteria: 'Binder content tested and within +/- 0.3% of design; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 330.01',
      notes: 'Section 815.10, RC 330.01.'
    },
    {
      description: 'Verify moisture content at mixing',
      acceptanceCriteria: 'Moisture content appropriate for compaction; not excessive (causing bleeding) or deficient',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.2.1.1',
      notes: 'Section 815.'
    },
    {
      description: 'Conduct UCS testing of production samples',
      acceptanceCriteria: '7-day UCS: rolling average of most recent 3 test results >= minimum per Table 815.101; individual results recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4',
      notes: 'Section 815.10, Table 815.101. Rolling average of 3 results must meet minimum.'
    },
    {
      description: 'Verify maximum allowable working time',
      acceptanceCriteria: 'Working time determined per RC 330.02; material placed and compacted within working time; UCS at working time limit >= 90% of 1-hour UCS value',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 330.02',
      notes: 'Section 815, RC 330.02. Material must be compacted before initial set. Superintendent to be notified.'
    },

    // =========================================================================
    // PLACEMENT AND COMPACTION
    // =========================================================================
    {
      description: 'Place CTCR in single layer within specified thickness range',
      acceptanceCriteria: 'Compacted thickness between 100 mm minimum and 180 mm maximum; even distribution; no segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.06. Single layer placement; 100-180 mm compacted.'
    },
    {
      description: 'Commence compaction within specified time of mixing',
      acceptanceCriteria: 'Compaction commences within maximum allowable working time; delay not exceeding limit from RC 330.02',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.07, RC 330.02. Time-critical operation.'
    },
    {
      description: 'Complete compaction before initial set of cementitious binder',
      acceptanceCriteria: 'All compaction completed within working time; no further compaction after initial set; surface finished',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.07. HP - Compaction must be complete before set.'
    },
    {
      description: 'Conduct density testing of compacted CTCR',
      acceptanceCriteria: 'Characteristic density ratio meets specified minimum per RC 500.05; corrected for density decay per RC 330.03',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1, RC 316.00, RC 330.03',
      notes: 'Section 306.08, RC 500.05, RC 330.03. Density decay correction applied. Superintendent to be notified.'
    },
    {
      description: 'Apply density decay correction factor',
      acceptanceCriteria: 'Density decay correction factor applied per RC 330.03 to account for cementitious hydration affecting density measurement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 330.03',
      notes: 'Section 306.08, RC 330.03. Critical for accurate density assessment.'
    },
    {
      description: 'Verify surface level of completed CTCR layer',
      acceptanceCriteria: 'Surface level within specified tolerance of design level; cross-fall correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.03.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment immediately after compaction and finishing',
      acceptanceCriteria: 'Curing compound applied at specified rate within specified time of finishing; or continuous water curing commenced; surface protected from drying',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.09. HP - Curing must commence immediately.'
    },
    {
      description: 'Maintain curing for specified duration',
      acceptanceCriteria: 'Curing maintained for minimum 7 days (or as specified); no trafficking during curing period except where approved; moisture maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.09. Typically 7-day minimum cure.'
    },
    {
      description: 'Verify curing compound coverage and integrity',
      acceptanceCriteria: 'Curing membrane intact; no cracking, peeling, or loss of coverage; reapplication where damaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.09.'
    },

    // =========================================================================
    // STRENGTH VERIFICATION
    // =========================================================================
    {
      description: 'Conduct 7-day UCS testing on production samples',
      acceptanceCriteria: 'Rolling average of most recent 3 UCS results >= minimum per Table 815.101; specimens compacted using AS 5101.4 split mould method',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4',
      notes: 'Section 815.10, Table 815.101.'
    },
    {
      description: 'Conduct 28-day UCS testing where specified',
      acceptanceCriteria: '28-day UCS results comply with specification requirements; confirms long-term strength development',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4',
      notes: 'Section 815. 28-day testing where required by project specification.'
    },
    {
      description: 'Verify design modulus is achievable',
      acceptanceCriteria: 'Pavement design modulus (500 MPa, 2000 MPa, or 3500 MPa as specified) can be assigned based on construction compliance with Section 306',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: null,
      notes: 'Section 306. Assigned modulus depends on meeting all construction requirements.'
    },

    // =========================================================================
    // TRAFFIC CONTROL AND PROTECTION
    // =========================================================================
    {
      description: 'Restrict traffic on completed CTCR during curing',
      acceptanceCriteria: 'No traffic on CTCR during curing period unless specifically approved; traffic management plan in place; loading restrictions applied',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.09. Traffic restrictions during cure period.'
    },
    {
      description: 'Protect completed CTCR from weather damage',
      acceptanceCriteria: 'CTCR protected from rain during initial cure; ponding water removed; temperature monitored where extreme conditions exist',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306.09.'
    },

    // =========================================================================
    // POST-CONSTRUCTION AND DOCUMENTATION
    // =========================================================================
    {
      description: 'Inspect completed CTCR for reflective cracking',
      acceptanceCriteria: 'Surface inspected for excessive shrinkage cracking; crack pattern and widths recorded; comparison with specification limits',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 306. W - Superintendent inspection after curing.'
    },
    {
      description: 'Conduct final level survey of completed CTCR surface',
      acceptanceCriteria: 'All levels within specification tolerance; as-built data recorded and submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.03.'
    },
    {
      description: 'Submit all production binder content test records',
      acceptanceCriteria: 'Complete binder content test results for production; all within +/- 0.3% tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 815.10, RC 330.01.'
    },
    {
      description: 'Submit all UCS test records',
      acceptanceCriteria: 'Complete 7-day UCS records; rolling average compliance demonstrated; all production lots documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 815.10, Table 815.101.'
    },
    {
      description: 'Submit all density test records with decay correction',
      acceptanceCriteria: 'Complete density ratio results with RC 330.03 corrections applied; all lots meeting characteristic value',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.08, RC 330.03.'
    },
    {
      description: 'Submit mixing plant calibration records',
      acceptanceCriteria: 'Plant calibration records for binder content, moisture, and aggregate proportioning',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 815.'
    },
    {
      description: 'Submit as-built drawings showing CTCR layer thickness and levels',
      acceptanceCriteria: 'As-built survey data showing actual vs design for CTCR layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.'
    },
    {
      description: 'Submit curing records',
      acceptanceCriteria: 'Records of curing compound application (type, rate, timing) or water curing log; weather conditions during cure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 306.09.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Superintendent',
      acceptanceCriteria: 'All acceptance criteria met for CTCR subbase; lot approved and released',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 3. VIC STABILISED PAVEMENTS IN-SITU (VicRoads Sec 307)
// =============================================================================

const vicStabilisedPavementTemplate = {
  name: 'Stabilised Pavements (In-Situ)',
  description: 'VicRoads in-situ stabilisation of pavements with cementitious binders per Section 307. Covers lime pre-treatment where required, cementitious binder application, mixing, compaction within working time, and curing.',
  activityType: 'pavements',
  specificationReference: 'Sec 307',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Stabilisation Quality Plan including binder type, spread rate, mixing depth, compaction, curing, and testing',
      acceptanceCriteria: 'Plan reviewed and accepted by Superintendent; compliant with Section 307 requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.02. HP - Work shall not commence until Quality Plan is accepted.'
    },
    {
      description: 'Submit existing pavement investigation results',
      acceptanceCriteria: 'Laboratory results for existing material grading, PI, moisture content, CBR; material characterisation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289 series',
      notes: 'Section 307.04. HP - Existing material must be characterised before design.'
    },
    {
      description: 'Submit stabilisation mix design with laboratory UCS results',
      acceptanceCriteria: 'Laboratory design determines binder content required to achieve minimum UCS; specimens compacted per AS 5101.4; results exceed specified minimum',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4 (UCS)',
      notes: 'Section 307.05. HP - Mix design must be approved.'
    },
    {
      description: 'Submit binder supply details and compliance certificates',
      acceptanceCriteria: 'Binder type (cement Type GP/GB, lime, GGBFS, or blend) confirmed; compliance certificates provided; source approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3972',
      notes: 'Section 307.04. HP - Binder must be approved before use.'
    },
    {
      description: 'Submit binder spreading equipment calibration certificates',
      acceptanceCriteria: 'Spreader calibration current; computerised spreading equipment has valid calibration certificate; binder mass monitored at intervals <= 100 m of forward travel',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.06. HP - Spreader calibration required. Mass monitored at <= 100 m intervals.'
    },
    {
      description: 'Submit proposed trial section details',
      acceptanceCriteria: 'Trial section location, length, and procedures defined; demonstrates all equipment and procedures prior to production',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307. HP - Trial section required before production.'
    },

    // =========================================================================
    // PRE-TREATMENT (LIME WHERE REQUIRED)
    // =========================================================================
    {
      description: 'Determine if lime pre-treatment is required',
      acceptanceCriteria: 'PI of existing material tested; if PI exceeds specified limit, lime pre-treatment required to reduce PI',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1',
      notes: 'Section 307.06. Pre-treat if PI exceeds limit.'
    },
    {
      description: 'Calculate and verify lime spreading rate',
      acceptanceCriteria: 'Lime spreading rate calculated per specification formula; quantity not less than 1.5% by mass; rate approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.06. HP - Lime rate approval. Min 1.5% lime by mass for pre-treatment.'
    },
    {
      description: 'Spread lime uniformly over prepared surface',
      acceptanceCriteria: 'Lime spread at approved rate; monitored at intervals <= 100 m; visual uniformity verified; wind conditions acceptable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.06. W - Superintendent to be notified of lime spreading.'
    },
    {
      description: 'Mix lime into existing material to full design depth',
      acceptanceCriteria: 'Lime mixed uniformly through full specified depth; visual inspection confirms no unmixed pockets; mixing depth verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.06.'
    },
    {
      description: 'Allow lime pre-treatment to cure before adding cementitious binder',
      acceptanceCriteria: 'Minimum curing period of overnight (addition of further binder and remixing shall not commence until the following day)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.06. Next day minimum before further binder addition.'
    },
    {
      description: 'Re-test PI after lime pre-treatment',
      acceptanceCriteria: 'PI reduced to specified maximum; material now suitable for cementitious stabilisation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.3.6.1',
      notes: 'Section 307.06. W - Verify PI reduction achieved. Superintendent to be notified.'
    },

    // =========================================================================
    // CEMENTITIOUS BINDER APPLICATION
    // =========================================================================
    {
      description: 'Prepare surface for binder spreading',
      acceptanceCriteria: 'Surface prepared to uniform level; debris removed; moisture content appropriate; no ponding water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.06.'
    },
    {
      description: 'Spread cementitious binder at approved design rate',
      acceptanceCriteria: 'Binder spread at design rate (+/- tolerance); mass monitored at intervals <= 100 m of forward travel; uniform distribution',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.06. W - Superintendent to be notified. Binder mass monitored at <= 100 m intervals.'
    },
    {
      description: 'Verify binder spread rate by bag/truck reconciliation and monitoring',
      acceptanceCriteria: 'Actual binder quantity placed reconciles with design quantity for area treated; within specified tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 330.01',
      notes: 'Section 307.06, RC 330.01.'
    },
    {
      description: 'Mix binder into existing material to full design depth',
      acceptanceCriteria: 'Mixing achieved to full specified depth; uniform distribution of binder throughout material; no unmixed zones',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.07. W - Superintendent to witness mixing.'
    },
    {
      description: 'Verify mixing depth',
      acceptanceCriteria: 'Depth of mixing verified by measurement; meets design requirement; no shallow mixing zones',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.07.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Commence compaction within maximum allowable working time',
      acceptanceCriteria: 'Compaction started immediately after mixing; completed within working time per RC 330.02; maximum time from mixing to completion of compaction within limit',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'RC 330.02',
      notes: 'Section 307.08, RC 330.02. HP - Must complete compaction within working time. Working time = UCS reaches 90% of 1-hour value.'
    },
    {
      description: 'Compact to specified density ratio',
      acceptanceCriteria: 'Characteristic density ratio meets specified minimum; tested per RC 500.05; density decay correction applied per RC 330.03',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1, RC 316.00, RC 330.03',
      notes: 'Section 307.08, RC 500.05, RC 330.03.'
    },
    {
      description: 'Trim and shape surface to design levels and cross-fall',
      acceptanceCriteria: 'Surface trimmed to within specified tolerance of design level; cross-fall correct; no ponding areas; surface finished before initial set',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.08. Must complete shaping within working time.'
    },
    {
      description: 'Complete all compaction and finishing before initial set',
      acceptanceCriteria: 'All rolling, shaping, and trimming completed before cementitious binder reaches initial set; no reworking after set',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.08. HP - No further working after initial set.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing treatment immediately after finishing',
      acceptanceCriteria: 'Curing compound applied at specified rate immediately after final trimming; or water curing commenced; full surface coverage',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.09. HP - Curing must commence immediately.'
    },
    {
      description: 'Maintain curing for specified period',
      acceptanceCriteria: 'Minimum curing period maintained (typically 7 days); membrane integrity checked; reapplication where damaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.09. Typically 7-day cure.'
    },
    {
      description: 'Restrict traffic during curing period',
      acceptanceCriteria: 'No traffic on stabilised pavement during curing unless specifically approved with protection measures; traffic management plan',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307.09.'
    },

    // =========================================================================
    // TESTING AND VERIFICATION
    // =========================================================================
    {
      description: 'Conduct density testing on compacted stabilised material',
      acceptanceCriteria: 'Density ratio with RC 330.03 decay correction meets specification; tested per RC 500.05',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1, RC 330.03, RC 316.00',
      notes: 'Section 307.08, RC 330.03.'
    },
    {
      description: 'Conduct binder content testing on mixed material',
      acceptanceCriteria: 'Binder content within tolerance of design; tested per RC 330.01',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'RC 330.01',
      notes: 'Section 307.06, RC 330.01.'
    },
    {
      description: 'Conduct UCS testing on production samples',
      acceptanceCriteria: '7-day UCS meets or exceeds specified minimum; specimens compacted per AS 5101.4',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 5101.4',
      notes: 'Section 307.05.'
    },
    {
      description: 'Verify final surface level and shape',
      acceptanceCriteria: 'Surface levels within specified tolerance of design; cross-fall and grade within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.03.'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section before production commencement',
      acceptanceCriteria: 'Trial section constructed using proposed equipment, materials, and procedures; all aspects of process demonstrated',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Section 307. HP - Trial section must be approved before production. Superintendent to be present.'
    },
    {
      description: 'Evaluate trial section results',
      acceptanceCriteria: 'Density, UCS, binder content, and surface finish from trial meet specification; procedures validated or adjusted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'test_result',
      testType: 'Multiple',
      notes: 'Section 307. HP - Trial results must be accepted by Superintendent.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit all binder content test results',
      acceptanceCriteria: 'Complete binder content records; all results within tolerance of design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.06, RC 330.01.'
    },
    {
      description: 'Submit all density test records with decay corrections',
      acceptanceCriteria: 'Complete density ratio records; RC 330.03 corrections applied; all lots compliant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.08, RC 330.03.'
    },
    {
      description: 'Submit all UCS test results',
      acceptanceCriteria: 'Complete 7-day UCS records; all results meet specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.05.'
    },
    {
      description: 'Submit binder spreader calibration and reconciliation records',
      acceptanceCriteria: 'Calibration certificates; binder quantity reconciliation per area treated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.06.'
    },
    {
      description: 'Submit as-built drawings',
      acceptanceCriteria: 'Final surface levels, stabilisation depth, areas treated, binder rates used',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 307.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Superintendent',
      acceptanceCriteria: 'All acceptance criteria met for stabilised pavement; lot approved and released',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent before subsequent works proceed.'
    }
  ]
}

// =============================================================================
// 4. VIC CONCRETE PAVEMENT (VicRoads Sec 503)
// =============================================================================

const vicConcretePavementTemplate = {
  name: 'Concrete Pavement',
  description: 'VicRoads concrete pavement construction per Section 503 (Concrete Base and Lean Mix Concrete Subbase), with references to Section 703 (General Concrete Paving) and Section 610 (Structural Concrete). Covers PCP, JRCP, and CRCP pavement types including dowels, reinforcement, joint sawing, curing, and ride quality.',
  activityType: 'pavements',
  specificationReference: 'Sec 503',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for concrete pavement works',
      acceptanceCriteria: 'All current revision drawings, Sections 503, 703, 610, and SD 5300-series drawings reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 503.01. Confirm pavement type (PCP, JRCP, or CRCP), slab thickness, joint layout, reinforcement details, and concrete strength grade.'
    },
    {
      description: 'Submit concrete mix design for review and approval prior to commencement',
      acceptanceCriteria: 'Mix design registered per RC 500.02; strength grade as specified (typically N32 or N40 for pavement); maximum w/c ratio per durability exposure class; air entrainment as specified; slump/spread within specified limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012 series; RC 500.02',
      notes: 'Cl 503 / 703.05. Superintendent to approve mix design before concrete production commences. Mix must comply with AS 1379.'
    },
    {
      description: 'Submit material test certificates for dowel bars, tie bars, reinforcement, and epoxy coatings',
      acceptanceCriteria: 'Steel grade certificates per AS/NZS 4671; dowel bars epoxy coated to specification; tie bar dimensions and grade compliant; certificates received minimum 14 days before use',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 503. Dowels typically Grade 300 round bar, epoxy coated per AS/NZS 4680. Tie bars typically deformed Grade 500 per AS/NZS 4671.'
    },
    {
      description: 'Verify paving equipment is suitable and has been calibrated - slipform paver or fixed-form setup',
      acceptanceCriteria: 'Slipform paver or fixed-form equipment inspected and operational; string lines or machine guidance system calibrated; vibrators functional; texturing equipment available and serviceable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Cl 503. Superintendent may wish to inspect paving train setup before commencement.'
    },

    // =========================================================================
    // SUBBASE PREPARATION
    // =========================================================================
    {
      description: 'Inspect subbase surface preparation and condition before concrete placement',
      acceptanceCriteria: 'Subbase surface clean, firm, free of loose material and standing water; compacted to specified density; trimmed to design levels within tolerances; curing of lean mix subbase complete (if applicable, minimum 7 days)',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: 'RC 500.05; Level survey',
      notes: 'Cl 503. HP - Subbase must be released before paving. Lean mix concrete subbase typically has 7-day compressive strength not exceeding 5-7 MPa and 28-day strength approx 15 MPa.'
    },
    {
      description: 'Verify subbase levels and cross-fall prior to paving',
      acceptanceCriteria: 'Subbase trimmed to within +/-10mm of design level; cross-fall within +/-0.3% of design; no ponding areas',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Level survey',
      notes: 'Cl 503. Survey records to be maintained for each lot.'
    },
    {
      description: 'Verify separation membrane / bond-breaker placement on subbase',
      acceptanceCriteria: 'Polyethylene sheeting or approved bond-breaker membrane placed over entire subbase area; overlaps minimum 300mm; no tears or punctures; anchored against wind displacement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 503. Bond-breaker required between lean mix subbase and concrete pavement slab to allow slab movement.'
    },

    // =========================================================================
    // FORMWORK / SLIPFORM SETUP
    // =========================================================================
    {
      description: 'Inspect formwork alignment, level, and rigidity (fixed-form construction)',
      acceptanceCriteria: 'Forms set to correct line and level within +/-3mm; forms clean and oiled; adequate staking; forms rigid and unyielding during concrete placement; expansion and contraction joint formwork correctly positioned',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Level survey',
      notes: 'Cl 503 / 703.12 (AS 3610). Forms shall comply with AS 3610 and not be stripped until minimum times per AS 3610 Table 5.4.1 have elapsed.'
    },
    {
      description: 'Verify slipform paver alignment and profile (slipform construction)',
      acceptanceCriteria: 'Paver set on correct alignment via string line or GPS guidance; profile template matches design slab cross-section; side forms producing correct edge profile; paver tracking within +/-10mm of design alignment',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Cl 503. Slipform paver to be calibrated and test run before production paving.'
    },

    // =========================================================================
    // DOWELS AND TIE BARS
    // =========================================================================
    {
      description: 'Inspect dowel bar assemblies - size, spacing, alignment, and support',
      acceptanceCriteria: 'Dowel bars correct diameter and length; spacing as per SD 5300/5301 (typically 300mm centres); bars parallel to pavement centreline within +/-5mm per 300mm; bars horizontal within +/-3mm; epoxy coating intact; support cradles rigid and at correct height; bars centred on joint within +/-25mm',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'SD 5300, SD 5301, SD 5311. HP - Dowel misalignment is a critical defect. Superintendent must inspect and release before concrete placement over dowels.'
    },
    {
      description: 'Inspect tie bar placement at longitudinal joints',
      acceptanceCriteria: 'Tie bars correct diameter (typically 16mm deformed), length (typically 750mm), and grade (Grade 500); spacing as per SD 5411 (typically 750mm centres); bars set at mid-depth of slab; perpendicular to longitudinal joint within +/-25mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'SD 5411. Tie bars connect adjacent lanes at longitudinal construction or contraction joints.'
    },
    {
      description: 'Verify dowel bar inserter operation (if machine-inserted)',
      acceptanceCriteria: 'DBI (dowel bar inserter) inserting dowels to correct depth, alignment and spacing; verify by random extraction and measurement of first slab; alignment within tolerances',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Cl 503. Where dowels are machine-inserted, verify performance at commencement and periodically during paving.'
    },

    // =========================================================================
    // REINFORCEMENT (JRCP/CRCP)
    // =========================================================================
    {
      description: 'Inspect reinforcement placement - mesh or bar, cover, lapping, and support (JRCP)',
      acceptanceCriteria: 'Reinforcement type, size, and spacing per SD 5321; minimum concrete cover 50mm top and bottom; lap lengths per AS/NZS 4671 and SD 5321; reinforcement clean and free from loose rust, oil, or contaminants; bar chairs at maximum 1000mm centres',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Cl 503 / 703.13. HP - Superintendent to inspect reinforcement before concrete placement. Reinforcement in JRCP is typically positioned in upper third of slab.'
    },
    {
      description: 'Inspect reinforcement placement - longitudinal bars, lapping, and support (CRCP)',
      acceptanceCriteria: 'Longitudinal bars per SD 5361; lapping per SD 5371 (staggered lap pattern); transverse bars per design; cover as specified; all bars tied at intersections; chairs stable',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'SD 5361, SD 5371. HP - CRCP has no transverse contraction joints - crack control is by continuous longitudinal reinforcement. Superintendent must inspect before concrete placement.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Verify weather conditions are acceptable before and during concrete placement',
      acceptanceCriteria: 'Ambient temperature between 5C and 35C (or as modified by specification); concrete temperature at delivery between 5C and 35C; wind speed not excessive for curing; no rain or forecast rain that would damage fresh concrete surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 503 / 703.09. Reference Section 610 weather restrictions with modified curing provisions. Hot weather and cold weather precautions apply.'
    },
    {
      description: 'Verify concrete delivery - slump, temperature, batch ticket, and delivery time',
      acceptanceCriteria: 'Slump within specified range (typically 40-80mm for slipform, up to 120mm for fixed-form); concrete temperature within limits; batch ticket shows correct mix ID, strength grade, batch time; concrete placed within 60 minutes of batching (90 minutes with retarder)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012.3.1 (Slump)',
      notes: 'Cl 503 / 703.05. Record batch ticket details for every load.'
    },
    {
      description: 'Conduct concrete conformance sampling - compressive strength cylinders',
      acceptanceCriteria: 'Minimum one sample per 50m3 placed per day (per Cl 703.11); sample consists of minimum 3 cylinders per AS 1012.1 and AS 1012.8.1; tested at 7 days and 28 days; 28-day results meet strength grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.1; AS 1012.8.1; AS 1012.9',
      notes: 'Cl 703.11 / Table 703.111. Strength grades: N20 (20 MPa), N25 (25 MPa), N32 (32 MPa). Testing frequency minimum 1 sample per 50m3 placed per day.'
    },
    {
      description: 'Monitor concrete placement - vibration, consolidation, and screed/paver operation',
      acceptanceCriteria: 'Concrete spread uniformly ahead of paver/screed; internal vibrators operating at correct frequency; no honeycombing, segregation, or voids; slipform paver producing smooth, consolidated slab; concrete placed continuously without cold joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 503 / 703.08. Concrete shall be tamped and vibrated to achieve full compaction.'
    },
    {
      description: 'Verify slab thickness during placement',
      acceptanceCriteria: 'Slab thickness within design tolerance (typically design thickness +10mm / -5mm); checked by probe or depth gauge at random locations; minimum 3 checks per lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Depth probe measurement',
      notes: 'Cl 503. Deficient thickness requires investigation and possible remedial action.'
    },

    // =========================================================================
    // FINISHING AND TEXTURING
    // =========================================================================
    {
      description: 'Inspect surface finish and texturing of fresh concrete',
      acceptanceCriteria: 'Surface finished to correct profile and cross-fall; surface texture applied while concrete is still plastic - burlap drag, tined, or broom finish as specified; texture depth adequate for skid resistance; no surface defects (tears, dragging of aggregate, slurry build-up)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 503. Texturing must be applied promptly after finishing. Longitudinal tining is standard for high-speed roads; transverse tining or burlap drag for lower-speed roads.'
    },
    {
      description: 'Verify straightedge profile of finished surface',
      acceptanceCriteria: 'Maximum 5mm deviation under a 3m straightedge in any direction; maximum 10mm deviation from design level; ride quality per Section 180 if applicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: '3m straightedge; level survey',
      notes: 'Cl 703.14 / Section 180. Tolerances: maximum 10mm deviation from line/level, 5mm under 3m straightedge.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound or curing method immediately after finishing',
      acceptanceCriteria: 'Curing compound applied uniformly at specified rate (typically 0.20-0.25 litres/m2) within 30 minutes of finishing; or alternative curing method (wet hessian, polyethylene sheeting, ponding) commenced immediately; compound compliant with AS 3799; no traffic or damage to curing membrane',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.10. Minimum 7 days curing for general concrete, 3 days for edgings. Acceptable methods include water, wet hessian, polyethylene sheeting, and approved curing compounds.'
    },
    {
      description: 'Monitor curing duration and protection',
      acceptanceCriteria: 'Curing maintained for minimum 7 days without interruption; concrete surface kept continuously moist (if wet curing) or membrane intact (if compound); protection from rain damage, traffic, and construction loads during curing period',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 703.10. Curing records to be maintained daily. Hot weather may require extended curing. Cold weather curing requires insulation.'
    },

    // =========================================================================
    // JOINT SAWING AND SEALING
    // =========================================================================
    {
      description: 'Saw transverse contraction joints within specified time window',
      acceptanceCriteria: 'Joints sawed as soon as concrete can support sawing equipment without ravelling (typically 4-24 hours after placement depending on conditions); joint depth as per SD 5301/5311 (typically one-third of slab depth for PCP, one-quarter for JRCP); joint width as specified; joint aligned with dowels; no random cracking',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 5301, SD 5311. Critical timing - sawing too early causes ravelling, too late causes random cracking. Contractor must monitor concrete maturity and commence sawing at earliest suitable time.'
    },
    {
      description: 'Saw longitudinal contraction/construction joints',
      acceptanceCriteria: 'Longitudinal joints sawed to specified depth and width per SD 5411; joints aligned with tie bars; joint spacing per design (typically 3.5-4.5m lane width)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 5411. Longitudinal joints connect lanes and are held together by tie bars.'
    },
    {
      description: 'Install expansion joint filler and seal',
      acceptanceCriteria: 'Expansion joints installed per SD 5401; compressible filler board to full depth less seal reservoir; joint sealant applied after joints are clean and dry; sealant type as specified (typically hot-poured or silicone); no overfill or underfill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 5401. Expansion joints required at bridge abutments, fixed structures, and other locations per design.'
    },
    {
      description: 'Clean and seal all contraction and construction joints',
      acceptanceCriteria: 'Joints cleaned by air blasting and/or water flushing; joints dry before sealing; sealant type and dimensions per specification; sealant bonded to both joint faces; no voids, bubbles, or adhesion failures; sealant level slightly below pavement surface (typically 3-5mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 5300 series. Joint sealing prevents ingress of water and incompressible materials that cause joint distress.'
    },

    // =========================================================================
    // POST-PLACEMENT INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed pavement surface for defects',
      acceptanceCriteria: 'No cracking outside of joints; no spalling, scaling, or surface pop-outs; no honeycombing at edges; surface texture uniform; no ponding or bird baths; all joints straight and aligned',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Cl 503. Visual inspection of completed work by Superintendent.'
    },
    {
      description: 'Verify finished pavement levels and thickness by coring (if required)',
      acceptanceCriteria: 'Cores taken at random locations per specification; core thickness within tolerances; core compressive strength meets specification; surface level within +/-10mm of design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.14 (Cores); Level survey',
      notes: 'Cl 503. Coring typically required at frequency of 1 per 500m2 or as specified.'
    },
    {
      description: 'Conduct flexural strength testing (if specified)',
      acceptanceCriteria: 'Flexural beams cast per AS 1012.11; tested at 28 days; flexural strength meets minimum specified value (typically 4.5 MPa for N32 pavement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.11 (Flexural strength)',
      notes: 'Cl 503. Flexural strength may be specified in lieu of or in addition to compressive strength for pavement concrete.'
    },
    {
      description: 'Conduct surface regularity / ride quality testing',
      acceptanceCriteria: 'Ride quality per Section 180; IRI or roughness within specified limits; 3m straightedge deviation not exceeding 5mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Section 180; Profilometer / 3m straightedge',
      notes: 'Section 180. Final ride quality testing after all joints are sealed and surface corrections (if any) are complete.'
    },
    {
      description: 'Verify joint layout and spacing against design drawings',
      acceptanceCriteria: 'All transverse, longitudinal, and expansion joints in correct locations per design; joint spacing within +/-25mm of specified dimensions; no missing joints; all joints sawed to correct depth and sealed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Measurement survey',
      notes: 'SD 5300 series. As-built joint layout to be recorded and submitted.'
    },
    {
      description: 'Inspect pavement transitions - concrete to flexible pavement, concrete to bridge',
      acceptanceCriteria: 'Transitions constructed per SD 5351, SD 5352, SD 5381; slab anchors installed per design; smooth ride transition; no abrupt level changes; joint sealant installed at interface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'SD 5351, SD 5352, SD 5381. Transition details depend on pavement type.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot sign-off by Superintendent',
      acceptanceCriteria: 'All acceptance criteria met for concrete pavement; lot approved and released',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent before subsequent works proceed.'
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
      stateSpec: 'VicRoads',
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Pavements')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicUnboundGranularPavementTemplate)
    await seedTemplate(vicCTCRTemplate)
    await seedTemplate(vicStabilisedPavementTemplate)
    await seedTemplate(vicConcretePavementTemplate)

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
