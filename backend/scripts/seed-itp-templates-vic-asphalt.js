/**
 * Seed Script: VIC (VicRoads) ITP Templates - Asphalt
 *
 * Creates global ITP templates for VIC asphalt and surfacing activities.
 * Templates: DGA (Sec 407), OGA (Sec 417), SMA (Sec 404),
 *            Sprayed Bituminous Surfacing (Sec 408), Warm Mix Asphalt / Recycled (Sec 407/TN107)
 *
 * Run with: node scripts/seed-itp-templates-vic-asphalt.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 5: DENSE GRADED ASPHALT DGA (VicRoads Sec 407)
// VicRoads Section 407 (Dense Graded Asphalt) - v17, 14/07/2023
// Mix types: L (light), N (normal), H (high), HP (high performance),
//            V (very heavy), VP (very heavy performance)
// =============================================================================

const vicDGATemplate = {
  name: 'Dense Graded Asphalt DGA (VIC)',
  description: 'VIC VicRoads dense graded asphalt (DGA) construction per Section 407. Covers mix design registration (RC 500.01), production, transport, placement, compaction, and acceptance testing. Mix types L/N/H/HP/V/VP for wearing course and intermediate course applications.',
  activityType: 'asphalt',
  specificationReference: 'Sec 407',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit DGA Quality Plan including mix design, production, transport, placement, and compaction procedures',
      acceptanceCriteria: 'Plan reviewed and accepted by Superintendent; compliant with Section 407 requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.02. HP - Work shall not commence until Quality Plan is accepted.'
    },
    {
      description: 'Submit registered asphalt mix design per RC 500.01',
      acceptanceCriteria: 'Mix design registered with VicRoads/DTP per RC 500.01; registration submitted minimum 2 months before production; valid current registration',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.01',
      notes: 'Section 407.04, RC 500.01. HP - Only registered mix designs shall be used. Submit 2 months before production.'
    },
    {
      description: 'Confirm DGA mix type matches design specification',
      acceptanceCriteria: 'Mix type (L, N, H, HP, V, VP) as specified for wearing course or intermediate course application; nominal aggregate size confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.03. HP - Mix type must match design. Types: L (light), N (normal), H (high), HP (high performance), V (very heavy), VP (very heavy performance).'
    },
    {
      description: 'Submit aggregate source and compliance details',
      acceptanceCriteria: 'Coarse and fine aggregate comply with Section 407 requirements; source approved and registered',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.05. Aggregate must comply with VicRoads Section 801 requirements.'
    },
    {
      description: 'Submit binder (bitumen) type and compliance certificates',
      acceptanceCriteria: 'Binder type complies with specification; viscosity within range per Table 407.132; PMBs comply with ATS 3110 where specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.05, Table 407.132. HP - Binder type must be approved by Superintendent.'
    },
    {
      description: 'Submit asphalt production plant details',
      acceptanceCriteria: 'Plant compliant with Section 407 requirements; calibration current; batch/continuous plant type identified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.06. Plant details submitted to Superintendent.'
    },
    {
      description: 'Submit tack coat / bond coat details',
      acceptanceCriteria: 'Tack coat type, application rate, and procedure compliant with specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.11. Tack coat details for Superintendent review.'
    },

    // =========================================================================
    // PLACEMENT TRIAL
    // =========================================================================
    {
      description: 'Conduct placement trial where specified',
      acceptanceCriteria: 'Trial uses proposed mix, plant, procedures, and personnel; each nominated mix type requires separate trial; results demonstrate compliance with specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Section 407.07. HP - Placement trial must be approved by Superintendent before production. Separate trial per mix type.'
    },
    {
      description: 'Evaluate placement trial results',
      acceptanceCriteria: 'Air voids, compaction, temperature, thickness, and surface finish all compliant; procedures validated or adjusted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Section 407.07. HP - Trial results must be approved by Superintendent.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect and accept existing surface before asphalt placement',
      acceptanceCriteria: 'Existing surface clean, dry, free of loose material, potholes repaired, surface profile acceptable; levels verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.10. HP - Surface must be accepted by Superintendent before asphalt placement.'
    },
    {
      description: 'Apply tack coat / bond coat to existing surface',
      acceptanceCriteria: 'Tack coat applied at specified rate; uniform coverage; broken (cured) before asphalt placement; no excess pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.11. Tack coat critical for interlayer bond.'
    },
    {
      description: 'Verify string lines, level controls, and paver setup',
      acceptanceCriteria: 'String lines set to design levels; paver screed settings checked; automatic level controls functioning',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.12. Paver setup verified before placement commences.'
    },

    // =========================================================================
    // PRODUCTION (ASPHALT PLANT)
    // =========================================================================
    {
      description: 'Verify mix production temperature at plant',
      acceptanceCriteria: 'Mix temperature at discharge within specified range per binder type; temperature recorded for each load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.06. Temperature depends on binder type and mix type. Record for each batch.'
    },
    {
      description: 'Conduct production sampling and testing for binder content',
      acceptanceCriteria: 'Binder content within tolerance of registered design value; tested per production lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 (binder content extraction)',
      notes: 'Section 407.08. Production QC sampling per registered mix design tolerances.'
    },
    {
      description: 'Conduct production sampling and testing for grading',
      acceptanceCriteria: 'Grading within registered envelope; combined grading compliant with design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11.1 (Particle Size Distribution)',
      notes: 'Section 407.08. Grading compliance monitored per production lot.'
    },
    {
      description: 'Conduct production testing for volumetric properties (air voids, VMA, BFI)',
      acceptanceCriteria: 'Laboratory air voids within design range per mix type; VMA within specification limits; Binder Film Index within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 201.01 (Marshall) or RC 201.12 (Gyratory), AS/NZS 2891.8',
      notes: 'Section 407.08. Design air voids per mix type: L/N/H/HP/V/VP.'
    },
    {
      description: 'Verify binder viscosity from recovered bitumen',
      acceptanceCriteria: 'Viscosity of recovered binder falls within specified range per Table 407.082',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 212.01 (Recovery of binder for viscosity)',
      notes: 'Section 407.08, Table 407.082. Recovered binder viscosity compliance.'
    },
    {
      description: 'Verify Reclaimed Asphalt Pavement (RAP) content where used',
      acceptanceCriteria: 'RAP content within approved limits; RAP stockpile lot not exceeding 1000 tonnes; RAP properties verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Section 407.05. RAP stockpile max 1000 tonnes. RAP content per approved mix design.'
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
      notes: 'Section 407.09. Trucks tarped to maintain temperature.'
    },
    {
      description: 'Verify material temperature on arrival at site',
      acceptanceCriteria: 'Temperature on arrival within specified range for binder type; recorded per load; material rejected if below minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.09. Temperature recorded for each load on arrival.'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Verify weather conditions suitable for placement',
      acceptanceCriteria: 'No rain or pending rain; ambient temperature above minimum (>= 5 deg C); surface temperature adequate; wind conditions acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.12. Do not place asphalt in rain or on wet surfaces.'
    },
    {
      description: 'Place asphalt at minimum specified temperature',
      acceptanceCriteria: 'Material temperature during placement not less than minimum for binder type; temperature monitored and recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.12. Minimum placement temperature depends on binder type.'
    },
    {
      description: 'Verify paver operation and mat quality',
      acceptanceCriteria: 'Paver operating at consistent speed; mat uniform texture; no tearing, segregation, or roller marks; joints properly formed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.12. Continuous monitoring of paver operations during placement.'
    },
    {
      description: 'Form longitudinal and transverse joints correctly',
      acceptanceCriteria: 'Joints straight, well-bonded, smooth, and at specified location; cold joints cut back to sound material; tack coat applied to joint faces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.12. Joint quality critical for waterproofing and ride quality.'
    },
    {
      description: 'Place to specified layer thickness',
      acceptanceCriteria: 'Layer thickness within tolerance of design; checked by measurement or survey; no area more than specified tolerance below design thickness',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.12. Layer thickness verified during placement.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Commence rolling immediately behind paver',
      acceptanceCriteria: 'Initial (breakdown) rolling commenced as close to paver as possible; material temperature within compaction range; rolling pattern established',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.13. Breakdown rolling commences immediately.'
    },
    {
      description: 'Complete compaction sequence (breakdown, intermediate, finish rolling)',
      acceptanceCriteria: 'Full rolling pattern completed while material at compaction temperature; no roller marks remaining; surface smooth and even',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.13. Complete rolling sequence per approved pattern.'
    },
    {
      description: 'Verify minimum compaction temperature during rolling',
      acceptanceCriteria: 'Material temperature above minimum specified temperature throughout compaction; temperature monitored',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.13. Material must remain above minimum compaction temperature.'
    },
    {
      description: 'Conduct density test check on compacted asphalt (minimum 5% of lots)',
      acceptanceCriteria: 'Density test check plan provides minimum test frequency of 5% of relevant lots; additional testing where non-conformance detected',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.9.2 (nuclear gauge) or cores',
      notes: 'Section 407.14. Min 5% of lots tested. Superintendent to be notified.'
    },
    {
      description: 'Extract cores for air voids determination where specified',
      acceptanceCriteria: 'Cores extracted at random locations within lot; field air voids determined; results within specified range',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.9.2, AS/NZS 2891.8',
      notes: 'Section 407.14. Core locations per RC 316.00.'
    },
    {
      description: 'Assess field (in-situ) air voids compliance',
      acceptanceCriteria: 'Field air voids within specified range for mix type (typically 3-7% for wearing course); reported per VicRoads TN-098 methodology',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.8, VicRoads TN-098',
      notes: 'Section 407.14, VicRoads Technical Note TN-098 (Reporting Field Air Voids).'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Verify finished surface level',
      acceptanceCriteria: 'Level of top of each course not differing from specified level by more than 10 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.03. Tolerance typically +/- 10 mm.'
    },
    {
      description: 'Check surface regularity (straight edge)',
      acceptanceCriteria: 'Surface regularity within specified limits; 3 m straight edge; maximum gap per road classification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: '3m straightedge',
      notes: 'Section 407.03. Surface regularity check per road classification.'
    },
    {
      description: 'Verify surface texture depth where specified',
      acceptanceCriteria: 'Surface texture depth meets specification for wearing course; tested per specified method',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.13.1 (Sand Patch) / RC 317.01',
      notes: 'Section 407. Texture depth for skid resistance verification.'
    },
    {
      description: 'Conduct ride quality (IRI) testing where specified',
      acceptanceCriteria: 'International Roughness Index (IRI) within specified maximum for road classification; tested over specified test sections',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Section 407 / Section 180. IRI requirements per project specification.'
    },
    {
      description: 'Inspect surface for defects (bleeding, ravelling, cracking, segregation)',
      acceptanceCriteria: 'No visible defects; uniform colour and texture; no fat spots or lean areas; no roller marks or pickup',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407. Visual assessment of completed surface quality.'
    },

    // =========================================================================
    // LAYER THICKNESS AND GEOMETRY
    // =========================================================================
    {
      description: 'Verify layer thickness by coring or survey',
      acceptanceCriteria: 'Thickness within tolerance of design (typically not more than -5 mm below design for wearing course); cores may be used for thickness verification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Section 407. Thickness verified from acceptance cores or level survey.'
    },
    {
      description: 'Verify cross-fall and longitudinal grade',
      acceptanceCriteria: 'Cross-fall within specified tolerance of design; longitudinal grade smooth and consistent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.03. Geometry verification.'
    },

    // =========================================================================
    // TEMPORARY WORKS AND WEDGES
    // =========================================================================
    {
      description: 'Install temporary asphalt wedges where required',
      acceptanceCriteria: 'Temporary wedges placed at construction joints to manage traffic interface; wedge profile acceptable; secured against displacement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.12. Temporary wedges for traffic management during construction.'
    },
    {
      description: 'Remove temporary wedges before final course placement',
      acceptanceCriteria: 'Temporary wedges fully removed; surface cleaned and tack coated before overlay; no debris remaining',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407.12. Wedges removed before final surfacing layer.'
    },

    // =========================================================================
    // POST-CONSTRUCTION DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit mix design registration certificate and current compliance',
      acceptanceCriteria: 'Current RC 500.01 registration with mix design data; all component materials compliant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.04, RC 500.01. Registration and compliance records.'
    },
    {
      description: 'Submit production test results (binder content, grading, volumetrics)',
      acceptanceCriteria: 'Complete production testing records for each production lot/day; all results within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.08. Full production test results package.'
    },
    {
      description: 'Submit temperature records (plant, delivery, placement, compaction)',
      acceptanceCriteria: 'Temperature logs for each load; plant discharge, arrival, placement, and compaction temperatures recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.09, 407.12, 407.13. Complete temperature records.'
    },
    {
      description: 'Submit density/air void core results',
      acceptanceCriteria: 'All core results with calculated field air voids; statistical summary; compliance assessment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.14, TN-098. Core results and air voids reporting.'
    },
    {
      description: 'Submit daily paving records',
      acceptanceCriteria: 'Paver settings, roller patterns, tonnages placed, areas covered, weather conditions, shift times',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407. Daily paving records submitted to Superintendent.'
    },
    {
      description: 'Submit material delivery dockets and quantities',
      acceptanceCriteria: 'All delivery dockets reconciled with total quantities; traceability to production batches',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407. Delivery docket reconciliation.'
    },
    {
      description: 'Submit surface level survey and as-built data',
      acceptanceCriteria: 'As-built survey showing finished surface levels vs design; layer thickness verification; any variations documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.03. As-built survey data.'
    },
    {
      description: 'Submit ride quality (IRI) results where specified',
      acceptanceCriteria: 'IRI test results per project specification; compliance demonstrated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407 / Section 180. IRI results if specified.'
    },
    {
      description: 'Submit placement trial report (where trial conducted)',
      acceptanceCriteria: 'Trial section results including all test data, observations, and approved procedures',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.07. Trial section documentation.'
    },
    {
      description: 'Submit binder compliance certificates',
      acceptanceCriteria: 'Bitumen/PMB compliance certificates from supplier; viscosity, penetration, and performance grade data',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.05. Binder compliance records.'
    },
    {
      description: 'Submit RAP compliance records where RAP used',
      acceptanceCriteria: 'RAP source, testing results, stockpile lot records, blending proportions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.05. RAP traceability records.'
    },
    {
      description: 'Submit tack coat application records',
      acceptanceCriteria: 'Tack coat type, application rate, areas covered, curing verification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.11. Tack coat application documentation.'
    },
    {
      description: 'Submit final defects inspection report',
      acceptanceCriteria: 'Joint inspection with Superintendent; any defects identified and rectified; final sign-off',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407. Final inspection with Superintendent.'
    },
    {
      description: 'Submit weather and ambient condition records during paving',
      acceptanceCriteria: 'Daily weather logs including temperature, wind, rainfall; conditions confirmed suitable for each placement session',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.12. Weather records for each paving session.'
    },
    {
      description: 'Submit roller calibration and operation records',
      acceptanceCriteria: 'Roller types, operating speeds, vibration settings, number of passes per rolling pattern',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407.13. Roller operation records.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; density compliant; no outstanding nonconformances; lot accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Section 407. Final lot acceptance by Superintendent.'
    }
  ]
}

// =============================================================================
// TEMPLATE 6: OPEN GRADED ASPHALT OGA (VicRoads Sec 417)
// VicRoads Section 417 (Open Graded Asphalt) - v5, 27/12/2018
// Note: Section 417 has been marked as Superseded on the VicRoads portal.
// OGA requirements may now be consolidated into Section 407 v17. This template
// references the last published standalone Section 417 version.
// =============================================================================

const vicOGATemplate = {
  name: 'Open Graded Asphalt OGA (VIC)',
  description: 'VIC VicRoads open graded asphalt (OGA) construction per Section 417 (v5, 27/12/2018 -- last published standalone version, now superseded). OGA is a functional wearing course with high air voids (18-22%) providing spray reduction and noise benefits. Uses polymer modified binder (PMB) per ATS 3110.',
  activityType: 'asphalt',
  specificationReference: 'Sec 417',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit mix design for OGA registered in accordance with RC 500.01, including aggregate grading, binder type/content, and design air voids',
      acceptanceCriteria: 'Mix registered with VicRoads/DTP per RC 500.01; PMB type compliant with ATS 3110; design air voids typically 18-22%',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.01 / RC 201.01 or RC 201.12',
      notes: 'Clause 417.04. Mix must be registered at least 2 months prior to supply. Only "General" registered mixes unless Superintendent approves otherwise. OGA typically uses polymer modified binder (A10E or S45R PMB).'
    },
    {
      description: 'Submit Quality Plan for OGA works including placement procedures, plant details, rolling patterns, joint treatment methods, and testing schedule',
      acceptanceCriteria: 'Quality Plan addresses all requirements of Section 417; approved by Superintendent prior to works commencing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 417.03. Must include proposed lot sizes, testing frequencies, corrective action procedures.'
    },
    {
      description: 'Submit evidence that asphalt plant is capable of producing OGA to registered mix design including calibration records and plant trial results',
      acceptanceCriteria: 'Plant production trial demonstrates consistent mix within registered tolerances; binder drain-down test results within limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2891.3.3 (fibre content if applicable) / Schellenberg drain-down test',
      notes: 'Clause 417.04. OGA is sensitive to production temperature -- plant must demonstrate temperature control capability. Drain-down at production temperature must not exceed 0.3% by mass.'
    },
    {
      description: 'Verify source and quality of coarse aggregate for OGA including polished stone value, Los Angeles abrasion, and particle shape',
      acceptanceCriteria: 'Aggregate compliant with Section 801 and RC 500.01 requirements; PSV >= 45 for wearing course; LA abrasion <= 30%; flakiness index within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.40 (PSV) / AS 1141.23 (LA) / AS 1141.15 (Flakiness)',
      notes: 'Clause 417.05. OGA requires premium aggregate due to open texture and direct tyre contact. Aggregate must comply with VicRoads Section 801.'
    },
    {
      description: 'Verify polymer modified binder (PMB) compliance with specification requirements and ATS 3110',
      acceptanceCriteria: 'PMB meets ATS 3110 Class A10E or S45R; softening point, elastic recovery, and viscosity within specified ranges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AGPT/T101 (sampling PMB)',
      notes: 'Clause 417.05. OGA requires PMB to resist binder drain-down and provide durable adhesion in open matrix.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect underlying pavement surface (tack coat substrate) for compliance with level and condition requirements prior to OGA placement',
      acceptanceCriteria: 'Substrate surface within level tolerances per Section 407; free of loose material, dust, and standing water; any repairs completed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.06. The wearing course beneath OGA is critical as it is the structural layer. OGA sits on top as a functional layer only. Superintendent to be notified.'
    },
    {
      description: 'Apply tack coat to substrate surface at specified rate and verify uniform coverage and curing',
      acceptanceCriteria: 'Tack coat applied uniformly at rate specified in design (typically 0.2-0.4 L/m2 residual); adequately cured/broken before OGA placement; no excess pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.06. Tack coat adhesion is critical for OGA -- delamination is a common failure mode.'
    },

    // =========================================================================
    // TRIAL SECTION / FIRST PRODUCTION
    // =========================================================================
    {
      description: 'Construct trial section of OGA to demonstrate compliance with mix design, placement procedures, and compaction capability',
      acceptanceCriteria: 'Trial section meets all specification requirements including air voids, permeability, texture depth, and compaction; Superintendent approves trial results before main works proceed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 317.01 / permeability test',
      notes: 'Clause 417.07. Trial section typically 200-500 m length. Must demonstrate achievable compaction, acceptable texture depth, and adequate permeability.'
    },
    {
      description: 'Verify OGA temperature at first load delivery to site and confirm within placement temperature range',
      acceptanceCriteria: 'OGA temperature at delivery within recommended range for PMB type; typically 140-170 deg C depending on binder; not below minimum placement temperature',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Infrared thermometer / calibrated probe',
      notes: 'Clause 417.08. OGA is more sensitive to temperature than DGA. Too hot causes drain-down; too cold prevents compaction. Superintendent to be notified.'
    },

    // =========================================================================
    // DURING PLACEMENT
    // =========================================================================
    {
      description: 'Monitor paver operation for consistent speed, screed settings, material feed, and head of material in hopper',
      acceptanceCriteria: 'Paver speed consistent (typically 3-5 m/min for OGA); screed temperature adequate; continuous material feed; no segregation visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.08. OGA is prone to segregation due to open grading. Paver hopper must be kept at least half full at all times.'
    },
    {
      description: 'Monitor asphalt temperature during placement at regular intervals behind the paver screed',
      acceptanceCriteria: 'Mat temperature within specified range; no areas below minimum placement temperature; temperature recorded at minimum every 100 m or per load',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Infrared thermometer',
      notes: 'Clause 417.08. Temperature monitoring critical for OGA. Low temperature areas indicate potential compaction deficiency.'
    },
    {
      description: 'Monitor weather conditions during OGA placement to ensure compliance with specification limits',
      acceptanceCriteria: 'Air temperature >= 10 deg C; no rain or standing water on surface; wind speed within acceptable limits; pavement surface temperature >= 10 deg C',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 417.07. OGA must not be placed in rain or on wet surfaces. Minimum temperatures may be higher than DGA due to open texture cooling rapidly.'
    },
    {
      description: 'Verify rolling pattern and compaction procedures in accordance with approved Quality Plan and trial section results',
      acceptanceCriteria: 'Rolling pattern matches approved procedure; static steel roller used (no vibration for OGA); number of passes as per trial; no displacement or cracking of mat',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.08. OGA is typically compacted with static steel rollers only -- pneumatic or vibratory rollers can crush the open matrix.'
    },
    {
      description: 'Verify longitudinal and transverse joint construction for OGA including overlap, temperature, and compaction at joints',
      acceptanceCriteria: 'Joints properly formed with minimal cold joint exposure; hot joint preferred where possible; no segregation or ravelling at joints; joints rolled within temperature requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.08. OGA joints are particularly vulnerable to ravelling. Cold longitudinal joints should be cut back to sound material and tack coated.'
    },

    // =========================================================================
    // COMPACTION AND DENSITY TESTING
    // =========================================================================
    {
      description: 'Determine lot boundaries for compaction testing in accordance with specification and approved lot sizes',
      acceptanceCriteria: 'Lot size as specified (typically 300-500 tonnes or area-based); lot boundaries identified and documented; minimum 6 test locations per lot per RC 316.00',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 316.00',
      notes: 'Clause 417.09. Where total OGA quantity exceeds 300 tonnes, compaction tested on lot basis.'
    },
    {
      description: 'Extract cores and test for in-situ air voids and density of compacted OGA',
      acceptanceCriteria: 'Characteristic in-situ air voids (CAV) within specified range; OGA design air voids typically 18-22%; CAV = AV + (0.92 x S_AV) per RC 500.05',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / AS 2891.14.5 / RC 500.05',
      notes: 'Clause 417.09. OGA is unique -- high air voids are required for permeability function. Both too-high and too-low air voids are problematic.'
    },

    // =========================================================================
    // PERMEABILITY TESTING
    // =========================================================================
    {
      description: 'Test permeability of compacted OGA to confirm adequate drainage function',
      acceptanceCriteria: 'Permeability meets specification minimum; visual confirmation of water draining through OGA layer; no ponding on surface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Falling head permeameter or equivalent',
      notes: 'Clause 417.09. Permeability is the primary functional requirement for OGA. Insufficient permeability defeats the purpose of OGA. Superintendent to be notified.'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Measure surface texture depth of completed OGA using sand patch method',
      acceptanceCriteria: 'Mean texture depth (MTD) >= 1.0 mm; measured at frequency of 1 per 200 m per lane; no areas with excessively smooth or rough texture',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 317.01 (Sand Patch Method)',
      notes: 'Clause 417.09. OGA should have high macro-texture for spray reduction and noise benefits.'
    },
    {
      description: 'Verify surface level of completed OGA against design levels at specified intervals',
      acceptanceCriteria: 'Surface level within +/-10 mm of design level at any point; no localised depressions exceeding 5 mm under 3 m straightedge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / 3m straightedge',
      notes: 'Clause 417.09. Surface levels checked at centreline, edges, and crown.'
    },
    {
      description: 'Verify thickness of OGA layer from core measurements against design thickness',
      acceptanceCriteria: 'Mean thickness not less than design thickness; no individual core less than design minus 5 mm; OGA wearing course typically 30-45 mm thick',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core measurement',
      notes: 'Clause 417.09. Thickness from cores taken for density testing. Deficient thickness may compromise permeability function.'
    },

    // =========================================================================
    // BINDER AND MIX COMPLIANCE TESTING
    // =========================================================================
    {
      description: 'Sample and test OGA production mix for binder content compliance at specified frequency',
      acceptanceCriteria: 'Binder content within +/-0.3% of registered mix design; tested at minimum 1 per sublot or per 250-500 tonnes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.2.1 (Ignition method) or solvent extraction',
      notes: 'Clause 417.09. OGA binder content is critical -- too low causes ravelling, too high causes drain-down. Typical OGA binder content 4.5-5.5%.'
    },
    {
      description: 'Sample and test OGA production mix for aggregate grading compliance at specified frequency',
      acceptanceCriteria: 'Aggregate grading within registered mix design envelopes; tested at minimum 1 per sublot; no excess fines (passing 0.075 mm sieve)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11 (Sieve analysis)',
      notes: 'Clause 417.09. Excess fines in OGA will block the air voids and reduce permeability.'
    },
    {
      description: 'Conduct binder drain-down test on OGA production mix to confirm resistance to binder migration',
      acceptanceCriteria: 'Binder drain-down not exceeding 0.3% by mass at maximum production temperature; tested at plant start-up and when production temperature changes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Schellenberg drain-down test',
      notes: 'Clause 417.05. Drain-down is a characteristic risk for OGA. Test at proposed maximum production temperature.'
    },

    // =========================================================================
    // TRAFFIC MANAGEMENT AND CURING
    // =========================================================================
    {
      description: 'Implement traffic management on completed OGA including speed restrictions during initial trafficking period',
      acceptanceCriteria: 'Speed limit reduced to 60 km/h (or as specified) for initial period; no heavy vehicles until Superintendent approval; surface protected from contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 417.10. OGA requires careful initial trafficking to embed aggregate and develop stable surface.'
    },
    {
      description: 'Inspect OGA surface after initial trafficking for evidence of ravelling, delamination, or aggregate loss',
      acceptanceCriteria: 'No excessive stone loss or ravelling; no delamination from substrate; no fat spots or bleeding; surface draining freely',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 417.10. Post-trafficking inspection critical for OGA. Superintendent to be notified.'
    },

    // =========================================================================
    // DOCUMENTATION AND HANDOVER
    // =========================================================================
    {
      description: 'Compile and submit all production, placement, and testing records for each lot of OGA',
      acceptanceCriteria: 'Complete records including: mix design certificates, production temperatures, placement records, core results, texture depth, permeability, surface levels, as-built survey',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 417.11. All test results and inspection records compiled in lot folders and submitted to Superintendent.'
    },
    {
      description: 'Verify defects liability requirements and provide maintenance instructions for OGA surface',
      acceptanceCriteria: 'Defects liability period as per contract; maintenance requirements for OGA documented (cleaning of voids, avoiding sealcoat, etc.)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General contract requirement. OGA requires periodic high-pressure cleaning to maintain permeability. Surface must not be overlaid with slurry seal or fog coat.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results within specification; all hold points released; all non-conformances resolved or accepted; as-built survey complete; lot accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Clause 417.11. Final lot acceptance by Superintendent.'
    }
  ]
}

// =============================================================================
// TEMPLATE 7: STONE MASTIC ASPHALT SMA (VicRoads Sec 404)
// VicRoads Section 404 (Stone Mastic Asphalt) - v6, 29/08/2018
// Note: Section 404 has been marked as Superseded on the VicRoads portal.
// SMA requirements may now be consolidated into Section 407 v17. This template
// references the last published standalone Section 404 version.
// =============================================================================

const vicSMATemplate = {
  name: 'Stone Mastic Asphalt SMA (VIC)',
  description: 'VIC VicRoads stone mastic asphalt (SMA) construction per Section 404 (v6, 29/08/2018 -- last published standalone version, now superseded). SMA is a gap-graded mix with 70-80% coarse aggregate, 8-12% filler, 6-7% binder, and 0.3% cellulose fibre. Uses PMB per ATS 3110. Design air voids 3-4%.',
  activityType: 'asphalt',
  specificationReference: 'Sec 404',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit mix design for SMA registered in accordance with RC 500.01, including aggregate grading, binder type/content, fibre type/content, and design air voids',
      acceptanceCriteria: 'Mix registered with VicRoads/DTP per RC 500.01; design air voids 3-4%; binder content typically 6.0-7.0%; fibre content 0.3% by mass of total mix; PMB compliant with ATS 3110',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.01 / RC 201.01 or RC 201.12',
      notes: 'Clause 404.04. SMA is a gap-graded mix with 70-80% coarse aggregate. VP and Size 7 mm SMA were added to RC 500.01 in July 2023.'
    },
    {
      description: 'Submit Quality Plan for SMA works including placement procedures, plant details, rolling patterns, joint treatment, fibre dosing procedures, and testing schedule',
      acceptanceCriteria: 'Quality Plan addresses all requirements of Section 404; includes fibre storage and dosing procedures; approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 404.03. SMA requires specific attention to fibre dosing accuracy and prevention of binder drain-down.'
    },
    {
      description: 'Submit binder drain-down test results from plant production trial demonstrating SMA mix stability',
      acceptanceCriteria: 'Binder drain-down not exceeding 0.3% by mass at maximum production temperature; drain-down sensitivity demonstrated at temperature range',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Schellenberg drain-down test',
      notes: 'Clause 404.04. Drain-down testing must be at the proposed maximum production temperature. Lower targets (e.g. 0.15%) may be specified for high-stress applications.'
    },
    {
      description: 'Verify source and quality of coarse aggregate for SMA including crushing value, polished stone value, and particle shape',
      acceptanceCriteria: 'Aggregate compliant with Section 801; PSV >= 50 for high-stress applications; crushed faces >= 98%; flakiness index per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.40 (PSV) / AS 1141.23 (LA) / AS 1141.15 (Flakiness)',
      notes: 'Clause 404.05. SMA performance depends on stone-on-stone contact of coarse aggregate. Premium aggregate quality essential.'
    },
    {
      description: 'Verify polymer modified binder (PMB) compliance with ATS 3110 and specification requirements',
      acceptanceCriteria: 'PMB meets ATS 3110 specified class; typically A10E or higher modification for SMA; softening point, elastic recovery, viscosity within ranges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AGPT/T101',
      notes: 'Clause 404.05. SMA requires PMB to achieve mastic binding and resist drain-down. VicRoads moved to PMB from 1999 for improved fatigue performance.'
    },
    {
      description: 'Verify fibre type, quality certification, and dosing system calibration for SMA production',
      acceptanceCriteria: 'Cellulose or mineral fibre meeting specification; fibre content 0.3% by mass (+/- 0.05%); dosing system calibrated and verified; fibre stored dry and uncontaminated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.3.3',
      notes: 'Clause 404.05. Fibre is essential to prevent binder drain-down in SMA. Must be measured per RC 500.16. Superintendent to be notified.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect underlying surface for compliance with level and condition requirements prior to SMA placement',
      acceptanceCriteria: 'Substrate surface within specified level tolerances; free of loose material, dust, oil, and water; any milled surfaces cleaned; repairs completed and accepted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.06. Substrate must provide stable, uniform platform for SMA. Superintendent to be notified.'
    },
    {
      description: 'Apply tack coat to substrate surface at specified rate and verify uniform coverage',
      acceptanceCriteria: 'Tack coat applied at design rate (typically 0.2-0.4 L/m2 residual); uniform coverage; adequately broken/cured before SMA placement; no excess pooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.06. Tack coat rate may need adjustment for milled surfaces (higher rate) vs existing asphalt (standard rate).'
    },

    // =========================================================================
    // TRIAL SECTION / FIRST PRODUCTION
    // =========================================================================
    {
      description: 'Construct trial section of SMA to demonstrate compliance with mix design, placement, compaction, and finished surface quality',
      acceptanceCriteria: 'Trial section meets all specification requirements: air voids, density, texture depth, drain-down control, surface appearance; Superintendent approves before main production',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 317.01',
      notes: 'Clause 404.07. Trial section typically 200-500 m. Must demonstrate compaction can achieve target density without crushing aggregate skeleton.'
    },
    {
      description: 'Verify SMA delivery temperature at first load arrival and confirm within specified placement range',
      acceptanceCriteria: 'Mix temperature at delivery within specified range for PMB type used; typically 150-175 deg C; not exceeding maximum to avoid drain-down; not below minimum for compaction',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Infrared thermometer / calibrated probe',
      notes: 'Clause 404.08. SMA temperature control is critical -- excessive temperature causes drain-down even with fibres. Superintendent to be notified.'
    },

    // =========================================================================
    // DURING PLACEMENT
    // =========================================================================
    {
      description: 'Monitor paver operation including consistent speed, screed settings, material feed rate, and hopper level',
      acceptanceCriteria: 'Paver operating at consistent speed; screed adequately heated; continuous material feed; no visible segregation; hopper maintained at adequate level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.08. SMA can segregate in the paver hopper. Material transfer vehicle (MTV) recommended for large operations.'
    },
    {
      description: 'Monitor mat temperature during placement at regular intervals behind paver screed',
      acceptanceCriteria: 'Mat temperature within specified range; recorded at minimum every load or 100 m; no cold spots below minimum placement temperature',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Infrared thermometer',
      notes: 'Clause 404.08. Temperature monitoring frequency increased for SMA due to drain-down sensitivity.'
    },
    {
      description: 'Monitor weather conditions during SMA placement',
      acceptanceCriteria: 'Air temperature >= 5 deg C; no rain; pavement surface dry; wind speed within limits to prevent rapid mat cooling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 404.07. SMA may have slightly more restrictive limits than DGA due to gap-graded mix compaction requirements.'
    },
    {
      description: 'Verify rolling pattern and compaction procedures match approved Quality Plan and trial section results',
      acceptanceCriteria: 'Rolling pattern as approved; typically static steel followed by limited pneumatic; correct number of passes; no displacement of aggregate skeleton; surface closed but not over-compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.08. SMA compaction is delicate -- over-rolling crushes the stone skeleton and reduces surface texture.'
    },
    {
      description: 'Verify longitudinal and transverse joint construction including cutting back cold edges, tack coating, and compaction',
      acceptanceCriteria: 'Cold joints cut back to sound material; tack coat applied to joint face; hot-side overlap adequate; joint compacted within temperature window; no open or segregated joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.08. SMA joints require careful execution. Gap-graded mix makes cold joints more visible and potentially weaker.'
    },

    // =========================================================================
    // COMPACTION AND DENSITY TESTING
    // =========================================================================
    {
      description: 'Determine lot boundaries for SMA compaction testing',
      acceptanceCriteria: 'Lot size as specified (typically 300-1000 tonnes or area-based); lot boundaries clearly identified; minimum 6 test locations per lot per RC 316.00',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 316.00',
      notes: 'Clause 404.09. Where total SMA quantity exceeds 300 tonnes, compaction shall be tested on a lot basis.'
    },
    {
      description: 'Extract cores and test in-situ air voids and density of compacted SMA',
      acceptanceCriteria: 'Characteristic in-situ air voids (CAV) within specified range; SMA design air voids 3-4%; field voids typically 3-6% acceptable; Characteristic Density Ratio per RC 500.05',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / AS 2891.14.5 / RC 500.05',
      notes: 'Clause 404.09. Both characteristic density ratio and characteristic field air voids to be reported. CAV = AV + (0.92 x S_AV).'
    },

    // =========================================================================
    // SURFACE QUALITY
    // =========================================================================
    {
      description: 'Measure surface texture depth of completed SMA using sand patch method',
      acceptanceCriteria: 'Mean texture depth (MTD) >= 0.7 mm for standard SMA; measured per RC 317.01 at specified frequency; consistent texture across full width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 317.01 (Sand Patch Method)',
      notes: 'Clause 404.09. SMA should have higher macro-texture than DGA but lower than OGA. Over-compaction reduces texture.'
    },
    {
      description: 'Assess surface for binder-rich (fat) spots indicating drain-down or flushing during placement',
      acceptanceCriteria: 'No visible fat spots or binder-rich areas exceeding specified limits; uniform surface appearance; no bleeding under trafficking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.09. Fat spots in SMA indicate either drain-down or over-compaction forcing mastic to the surface.'
    },
    {
      description: 'Verify surface level of completed SMA against design levels',
      acceptanceCriteria: 'Surface level within +/-5 mm of design level at crown and edges; no localised depressions exceeding 5 mm under 3 m straightedge; crossfall within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / 3m straightedge',
      notes: 'Clause 404.09. Surface levels checked at centreline, edge of seal, and quarter points.'
    },
    {
      description: 'Verify SMA layer thickness from core measurements against design thickness',
      acceptanceCriteria: 'Mean thickness not less than design thickness; no individual core less than design minus 5 mm; SMA wearing course typically 40-50 mm thick',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core measurement',
      notes: 'Clause 404.09. Thickness determined from density cores. SMA10 and SMA14 have corresponding minimum layer thicknesses.'
    },

    // =========================================================================
    // PRODUCTION MIX COMPLIANCE
    // =========================================================================
    {
      description: 'Sample and test SMA production mix for binder content at specified frequency',
      acceptanceCriteria: 'Binder content within +/-0.3% of registered mix design; tested at minimum 1 per sublot or per 250-500 tonnes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.2.1 (Ignition method)',
      notes: 'Clause 404.09. SMA binder content typically 6.0-7.0%. Higher than DGA due to mastic formation.'
    },
    {
      description: 'Sample and test SMA production mix for aggregate grading at specified frequency',
      acceptanceCriteria: 'Aggregate grading within registered mix design envelopes; gap grading maintained; VMA within specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11 (Sieve analysis)',
      notes: 'Clause 404.09. SMA gap grading must be maintained -- excess mid-range sizes disrupt stone-on-stone contact.'
    },
    {
      description: 'Verify fibre content in SMA production mix samples at specified frequency',
      acceptanceCriteria: 'Fibre content 0.3% +/- 0.05% by mass of total mix; tested per AS 2891.3.3; consistent dosing demonstrated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.3.3',
      notes: 'Clause 404.09. Fibre content must be measured and reported per RC 500.16 when asphalt contains added cellulose fibres.'
    },

    // =========================================================================
    // TRAFFIC MANAGEMENT AND CURING
    // =========================================================================
    {
      description: 'Implement traffic management on completed SMA including initial speed restrictions',
      acceptanceCriteria: 'Speed restrictions applied as specified; no heavy braking/turning loads until surface stabilised; surface protected from contamination and damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 404.10. SMA develops its final texture and stability under initial trafficking.'
    },
    {
      description: 'Inspect SMA surface after initial trafficking period for defects including ravelling, fat spots, and delamination',
      acceptanceCriteria: 'No excessive aggregate loss; no delamination; no widespread fat spots; texture depth maintained; surface draining uniformly',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 404.10. Post-trafficking inspection verifies SMA is performing as intended. Superintendent to be notified.'
    },

    // =========================================================================
    // DOCUMENTATION AND HANDOVER
    // =========================================================================
    {
      description: 'Compile and submit all production, placement, and testing records for each SMA lot',
      acceptanceCriteria: 'Complete records including: mix design, fibre dosing records, production temperatures, placement records, core results (density, air voids, thickness), texture depth, surface levels',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 404.11. Records include fibre delivery dockets and dosing calibration records specific to SMA production.'
    },
    {
      description: 'Verify skid resistance of completed SMA surface if required by specification',
      acceptanceCriteria: 'Skid Resistance Value (SRV) >= 60 or as specified; tested using approved method; adequate friction for road geometry and traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'VicRoads approved SRV method',
      notes: 'TN-060. VicRoads specifies SRV >= 60 for skid resistant surfacing at specific locations (curves, intersections, approaches).'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results within specification limits; all hold points released; all non-conformances resolved; as-built survey complete; fibre content verified; lot accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Clause 404.11. Final lot acceptance by Superintendent.'
    }
  ]
}

// =============================================================================
// TEMPLATE 8: SPRAYED BITUMINOUS SURFACING (VicRoads Sec 408)
// VicRoads Section 408 (Sprayed Bituminous Surfacings) - v13, 26/08/2022
// Covers: Primer, Primerseal (Initial Seal), Single/Single Seal,
//         Double/Double Seal, Reseal, Geotextile Reinforced Seal
// =============================================================================

const vicSprayedSealTemplate = {
  name: 'Sprayed Bituminous Surfacing (VIC)',
  description: 'VIC VicRoads sprayed bituminous surfacing per Section 408 (v13, 26/08/2022). Covers primer, primerseal (initial seal), single/single seal, double/double seal, reseal, and geotextile reinforced seal. Design per Austroads AGPT-04K. Supported by Guide to Section 408, TB-45 (Surfacing Manual), and RC 500.09 (Aggregate Testing).',
  activityType: 'asphalt',
  specificationReference: 'Sec 408',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Seal Design for the sprayed bituminous surfacing including binder type, application rate, aggregate size, treatment type, and design in accordance with Austroads AGPT-04K',
      acceptanceCriteria: 'Seal design compliant with AGPT-04K methodology; binder type and application rate per Table 408.191; aggregate size and spread rate appropriate for traffic and climate; Superintendent approval received',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 408.04. Design application rates determined to nearest 0.1 L/m2. Traffic data, surface condition, climate zone all factor into design.'
    },
    {
      description: 'Submit Quality Plan for sprayed sealing works including proposed equipment, operator qualifications, weather monitoring, application procedures, and traffic management',
      acceptanceCriteria: 'Quality Plan addresses all Section 408 requirements; approved by Superintendent; includes contingency for weather changes and equipment breakdown',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 408.03. Quality Plan must detail binder heating, sprayer calibration, aggregate spreader calibration, and rolling procedures.'
    },
    {
      description: 'Submit aggregate test results demonstrating compliance with specification requirements for the proposed aggregate source',
      acceptanceCriteria: 'Aggregate tested per RC 500.09; size, shape, cleanliness, stripping resistance, and durability all within specification limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 500.09 (Testing Aggregates for Sprayed Bituminous Surfacing)',
      notes: 'Clause 408.05. Aggregate quality is fundamental to seal performance. Testing includes: flakiness, ACV/TFV, stripping, dust ratio, sand equivalent.'
    },
    {
      description: 'Verify binder supply documentation including type, grade, source, and compliance certificates',
      acceptanceCriteria: 'Binder type matches seal design (cutback bitumen, emulsion, PMB, or crumb rubber modified); compliance with relevant AS/ATS; flash point verified at least 10 deg C above maximum spraying temperature per ASTM D276',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'ASTM D276 (flash point)',
      notes: 'Clause 408.05. For initial seals (primerseals), binder shall be suitable cutback bitumen, emulsion, or 9% crumb rubber modified binder.'
    },

    // =========================================================================
    // EQUIPMENT VERIFICATION
    // =========================================================================
    {
      description: 'Verify calibration of bitumen sprayer including spray bar uniformity, application rate accuracy, and temperature control',
      acceptanceCriteria: 'Sprayer calibrated within +/-5% of design application rate; uniform transverse distribution; nozzles clean and at correct angle; temperature gauge calibrated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Sprayer calibration test (tray test)',
      notes: 'Clause 408.08. Sprayer calibration is critical -- uneven binder distribution causes fatty or dry patches. Superintendent to be notified.'
    },
    {
      description: 'Verify calibration of aggregate spreader for uniform coverage at design spread rate',
      acceptanceCriteria: 'Spreader delivers uniform aggregate across full width; spread rate within +/-10% of design; forward-facing operator (per specification); no gaps or heavy spots',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tray test or area measurement',
      notes: 'Clause 408.08. Specification requires operator of aggregate spreading plant to face in direction of travel. Superintendent to be notified.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect pavement surface condition and preparation prior to primer/seal application',
      acceptanceCriteria: 'Surface shaped to required crossfall and profile; free of loose material, dust, and vegetation; surface moisture condition suitable; any potholes or defects repaired',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.06. Surface pre-treatment per Tables 408.152 and 408.153. Refer also TR-209 for new granular pavement preparation. Superintendent to be notified.'
    },
    {
      description: 'Verify surface temperature of pavement meets minimum requirements before binder application',
      acceptanceCriteria: 'Pavement surface temperature >= 15 deg C for standard sealing; >= 25 deg C for night works on geotextile reinforced seals; measured by contact or infrared thermometer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Contact thermometer / infrared thermometer',
      notes: 'Clause 408.07. Binder shall not be applied until receiving surface temperature meets requirements.'
    },
    {
      description: 'Apply light water spray ahead of primer or primerseal application as required',
      acceptanceCriteria: 'Consistent water spray across full width of proposed seal; no pooling or dry areas; water spray applied immediately ahead of binder application',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08(c). Light water spray precedes application of either primer or primerseal.'
    },

    // =========================================================================
    // PRIMER APPLICATION (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'Apply primer to granular pavement surface at specified application rate',
      acceptanceCriteria: 'Primer (cutback bitumen or approved emulsion) applied at design rate per specification; uniform application; penetration into pavement surface achieved; no pooling or run-off',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08(c). Primer must be water resistant and provide strong bond. Superintendent to be notified.'
    },
    {
      description: 'Allow primer to cure for minimum specified period before seal application',
      acceptanceCriteria: 'Primer cured for minimum period (typically 7-14 days depending on conditions); surface stable under traffic; no tacky areas remaining; penetration adequate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08(c). Curing time depends on temperature, humidity, and primer type.'
    },

    // =========================================================================
    // SEAL APPLICATION - BINDER SPRAYING
    // =========================================================================
    {
      description: 'Verify binder temperature at sprayer immediately before application',
      acceptanceCriteria: 'Binder temperature within specified range for binder type; not exceeding maximum (flash point minus 10 deg C); temperature recorded and documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Calibrated thermometer on sprayer',
      notes: 'Clause 408.08. Correct binder viscosity at application depends on temperature.'
    },
    {
      description: 'Monitor binder application rate during spraying and verify compliance with seal design rate',
      acceptanceCriteria: 'Binder application rate within +/-0.05 L/m2 of design rate; uniform transverse distribution; consistent longitudinal rate; no misses, double sprays, or edge issues',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Area/volume calculation / tray test verification',
      notes: 'Clause 408.08. Application rate checked by measurement of area covered versus binder used. Superintendent to be notified.'
    },
    {
      description: 'Verify transverse joins in binder application are properly managed (paper overlay method or equivalent)',
      acceptanceCriteria: 'Transverse joins have clean edges; no double application; no gaps; paper strip method or approved alternative used; joins not visible in final surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08. Paper overlay at transverse stops prevents double spraying.'
    },

    // =========================================================================
    // SEAL APPLICATION - AGGREGATE SPREADING
    // =========================================================================
    {
      description: 'Spread aggregate immediately following binder application at specified rate within maximum time delay',
      acceptanceCriteria: 'Aggregate spread within 30 seconds of binder application; uniform one-stone-thick coverage; spread rate per design; no bare patches or double coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08. Delay between binder application and aggregate spreading must be minimised.'
    },
    {
      description: 'Monitor aggregate spread rate and uniformity across seal width',
      acceptanceCriteria: 'Spread rate within +/-10% of design; uniform single stone layer; no clumps or bare areas; aggregate oriented with least dimension vertical where practicable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08. Aggregate spread rate based on ALD (average least dimension) and voids calculation per AGPT-04K.'
    },

    // =========================================================================
    // ROLLING AND EMBEDMENT
    // =========================================================================
    {
      description: 'Commence initial rolling of aggregate immediately after spreading to achieve embedment',
      acceptanceCriteria: 'Multi-tyre roller commences within 2 minutes of aggregate spreading; minimum 3 passes initially; aggregate oriented and seated in binder; no crushing of aggregate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08. Initial rolling critical for aggregate retention. Pneumatic tyre roller preferred.'
    },
    {
      description: 'Continue rolling to achieve required aggregate embedment depth',
      acceptanceCriteria: 'Aggregate embedded to 50-70% of ALD (average least dimension); uniform embedment across width; no stripping or displacement; adequate binder contact with aggregate faces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.09. Under-embedded aggregate will strip; over-embedded causes flushing.'
    },

    // =========================================================================
    // SECOND APPLICATION (DOUBLE SEAL ONLY)
    // =========================================================================
    {
      description: 'For double/double seals: apply second binder coat at specified rate after first application has been rolled',
      acceptanceCriteria: 'Second binder application rate per design (typically lower than first); uniform application; first aggregate layer adequately embedded before second application',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Area/volume calculation',
      notes: 'Clause 408.08. Double seals have a second, smaller aggregate size applied over the first. Superintendent to be notified.'
    },
    {
      description: 'For double/double seals: spread second (smaller) aggregate and roll to achieve embedment',
      acceptanceCriteria: 'Smaller aggregate size spread uniformly at design rate; rolled to embed in second binder coat; no displacement of first aggregate layer; interlocking achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08. Second aggregate typically one size smaller (e.g. 7 mm over 14 mm).'
    },

    // =========================================================================
    // WEATHER MONITORING
    // =========================================================================
    {
      description: 'Monitor weather conditions throughout sealing operations and cease work if conditions deteriorate beyond specification limits',
      acceptanceCriteria: 'No rain during application or before initial set; air temperature >= 10 deg C; pavement surface temperature >= 15 deg C; wind speed not causing spray drift; cease work and protect surface if conditions change',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 408.07. Weather monitoring is continuous during sealing. Imminent rain is the most critical risk.'
    },

    // =========================================================================
    // POST-APPLICATION QUALITY
    // =========================================================================
    {
      description: 'Assess surface texture of completed seal by visual inspection and measurement where required',
      acceptanceCriteria: 'Surface texture uniform and consistent; texture depth assessed per RC 317.01 if directed by Superintendent; compliance with Table 408.152 in marginal cases',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 317.01 (Sand Patch) -- in marginal cases',
      notes: 'Clause 408.09. Acceptance based on visual assessment primarily. RC 317.01 used in marginal/disputed cases.'
    },
    {
      description: 'Assess aggregate retention by visual inspection during and after initial trafficking',
      acceptanceCriteria: 'No excessive stone loss exceeding specified limits per Table 408.153; aggregate firmly embedded; no widespread stripping; isolated loose stones swept and removed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.09. Aggregate retention assessed against Table 408.153 criteria.'
    },
    {
      description: 'Assess surface for bleeding/flushing (binder rising to surface) particularly in wheel paths',
      acceptanceCriteria: 'No visible bleeding or flushing; binder not exceeding aggregate surface level; uniform appearance; no fat spots or wet-look areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.09. Bleeding indicates excess binder, insufficient aggregate, or over-embedment.'
    },

    // =========================================================================
    // TRAFFIC MANAGEMENT
    // =========================================================================
    {
      description: 'Implement post-seal traffic management including speed restrictions and sweeping programme',
      acceptanceCriteria: 'Speed limit reduced (typically 40-60 km/h) for minimum period after seal; loose stone swept regularly; pilot vehicle used if required; duration of restrictions per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 408.10. Traffic management critical for new seals. Excessive speed causes windscreen damage and stone loss.'
    },
    {
      description: 'Conduct sweeping of loose aggregate from seal surface at specified intervals',
      acceptanceCriteria: 'Excess loose aggregate removed by sweeping; sweeping method does not damage seal; timing of sweeps per specification; aggregate recycled or removed from site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.10. Sweeping too early can damage seal; too late allows loose stone to accumulate.'
    },

    // =========================================================================
    // GEOTEXTILE REINFORCED SEAL (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'For geotextile reinforced seals: verify geotextile material and placement prior to binder application',
      acceptanceCriteria: 'Geotextile type and weight as specified; placed flat without wrinkles or folds; adequate overlap at joins; substrate preparation complete; binder application rate adjusted for geotextile absorption',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 408.08 and TB-38. Geotextile reinforced seals require higher binder application rate. Superintendent to be notified.'
    },

    // =========================================================================
    // DOCUMENTATION AND HANDOVER
    // =========================================================================
    {
      description: 'Compile and submit all seal design, application, and quality records',
      acceptanceCriteria: 'Complete records including: seal design, binder delivery/temperature records, application rates (actual vs design), aggregate delivery dockets, weather records, rolling records, post-seal inspection reports',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 408.11. All records submitted to Superintendent. Include photographic record of key stages.'
    },
    {
      description: 'Conduct final surface inspection after post-seal monitoring/maintenance period',
      acceptanceCriteria: 'Seal surface performing satisfactorily; adequate texture depth; no excessive stripping, bleeding, or fatting; aggregate retention stable; surface draining correctly',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'RC 317.01 if directed',
      notes: 'Clause 408.11. Final inspection typically at end of maintenance period. Superintendent to be notified.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All test results and inspections within specification; all hold points released; texture and retention acceptable; no unresolved non-conformances; lot accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Clause 408.11. Final lot acceptance by Superintendent.'
    }
  ]
}

// =============================================================================
// TEMPLATE 32: WARM MIX ASPHALT / RECYCLED (VicRoads Sec 407/TN107)
// VicRoads Section 407 (Hot Mix Asphalt) + TN 107 (Use of Recycled Materials)
// Note: Section 409 (Warm Mix Asphalt) has been RETIRED and incorporated
// into Section 407. WMA is now a production temperature variant within Sec 407.
// RAP up to 50% permitted per TN 107. RCGS permitted in DGA wearing courses.
// =============================================================================

const vicWMARecycledTemplate = {
  name: 'Warm Mix Asphalt / Recycled (VIC)',
  description: 'VIC VicRoads warm mix asphalt and recycled asphalt per Section 407 (Section 409 retired and incorporated) and TN 107 (Use of Recycled Materials, July 2023). WMA is a production temperature variant of hot mix asphalt with same performance requirements. RAP up to 50% permitted per TN 107. Recycled crushed glass sand (RCGS) permitted in DGA wearing courses per 2023 update. WMA can reduce carbon footprint by up to 40%.',
  activityType: 'asphalt',
  specificationReference: 'Sec 407/TN107',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit asphalt mix design including WMA additive and/or RAP content registered per RC 500.01',
      acceptanceCriteria: 'Mix design registered per RC 500.01; includes WMA technology type and additive (if WMA); RAP content percentage and source documented; mix design demonstrates compliance with Section 407 volumetric and performance requirements at reduced production temperature (for WMA)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RC 500.01',
      notes: 'Section 407, RC 500.01. Mix design must be registered and approved. WMA mix design must demonstrate equivalent performance to HMA at lower production temperatures.'
    },
    {
      description: 'Verify RAP source and characterisation (if RAP used)',
      acceptanceCriteria: 'RAP source identified; RAP stockpile characterisation including grading, binder content, binder properties (penetration, softening point) and aggregate properties; RAP processing (crushing, screening) documented; RAP percentage within approved limits (up to 50% per TN 107)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891 (binder content, grading)',
      notes: 'TN 107. RAP up to 50% permitted. RAP characterisation required for mix design and quality control.'
    },
    {
      description: 'Verify recycled crushed glass sand (RCGS) content (if used)',
      acceptanceCriteria: 'RCGS source approved; particle size distribution within specification; glass content within limits; RCGS percentage in mix within approved limits per TN 107 (2023 update permits use in all DGA wearing courses); health and safety provisions for glass handling documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grading, glass content',
      notes: 'TN 107 (2023 update). RCGS permitted as sand replacement in DGA wearing courses for all traffic levels.'
    },
    {
      description: 'Verify WMA additive or technology (if WMA)',
      acceptanceCriteria: 'WMA technology type documented (chemical additive, organic/wax additive, foaming, or other); additive dosage rate per manufacturer recommendation; product data sheets submitted; additive storage and handling requirements addressed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407. WMA additive must be compatible with binder and aggregates in mix design.'
    },
    {
      description: 'Verify asphalt plant capability for WMA and/or RAP production',
      acceptanceCriteria: 'Plant capable of achieving specified WMA production temperature (typically 20-40 deg C below conventional HMA); RAP feed system operational and calibrated; temperature monitoring at discharge; plant production rate adequate; emissions within limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407, TN 107. Plant capability verification before production commences. Superintendent to be notified.'
    },
    {
      description: 'Conduct trial mix production (if required)',
      acceptanceCriteria: 'Trial production at specified production temperature; volumetric properties meet Section 407 requirements; workability adequate for placement and compaction; compaction trial on representative section demonstrates density achievement; trial results documented',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891 series',
      notes: 'Section 407. Trial production may be required to verify mix performance at WMA temperatures. Superintendent to be notified.'
    },

    // =========================================================================
    // PRODUCTION
    // =========================================================================
    {
      description: 'Monitor asphalt production temperature',
      acceptanceCriteria: 'Production temperature within specified range for WMA (typically 110-140 deg C, depending on WMA technology) or HMA with RAP (per Section 407 requirements); temperature recorded for each load; out-of-range loads rejected or assessed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Thermocouple/IR thermometer',
      notes: 'Section 407. WMA production temperature is lower than conventional HMA (typically 150-180 deg C). Correct temperature is critical for WMA workability and binder properties.'
    },
    {
      description: 'Verify RAP dosing rate and uniformity during production',
      acceptanceCriteria: 'RAP feed rate monitored and within specified tolerance of target percentage; RAP distribution uniform throughout mix; no RAP clumping or segregation; RAP heating adequate to mobilise binder',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TN 107. RAP dosing accuracy affects mix properties. Feed rate monitoring critical.'
    },
    {
      description: 'Production quality control -- sampling and testing',
      acceptanceCriteria: 'Asphalt sampled at specified frequency per Section 407; samples tested for binder content, grading, volumetric properties (air voids, VMA, VFB); results within specification limits; lot-based acceptance per Section 173',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891 series (binder content, grading, Marshall/gyratory)',
      notes: 'Section 407/173. Standard asphalt QC testing applies equally to WMA and RAP mixes.'
    },
    {
      description: 'Verify delivery temperature at point of discharge',
      acceptanceCriteria: 'Asphalt temperature at truck discharge within specified range; temperature recorded for each load; loads below minimum temperature rejected; time-temperature relationship from plant to site managed to maintain adequate placement temperature',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Thermocouple/IR thermometer',
      notes: 'Section 407. Delivery temperature monitoring ensures workability for placement and compaction.'
    },

    // =========================================================================
    // PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Verify surface preparation before placement',
      acceptanceCriteria: 'Surface clean, dry and free of loose material; tack coat applied at specified rate and broken (if applicable); joints in existing pavement prepared per Section 407; temperature of receiving surface suitable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407. Standard surface preparation applies to WMA and RAP mixes. Superintendent to be notified.'
    },
    {
      description: 'Place asphalt with paver to specified levels and cross-fall',
      acceptanceCriteria: 'Paver operating within specified speed and screed settings; mat thickness uniform and at design level; surface regular and free from segregation, dragging, tearing; joints constructed per specification; placement temperature adequate for compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 407. WMA may have slightly different compaction window due to lower temperatures -- placement must be efficient.'
    },
    {
      description: 'Compact asphalt to specified density',
      acceptanceCriteria: 'Rolling pattern and sequence as approved; compaction commences while asphalt temperature is adequate (WMA has narrower compaction window than HMA); nuclear gauge or core density results meet Section 407 density requirements; number of roller passes documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Nuclear density gauge / AS/NZS 2891.9.2',
      notes: 'Section 407. WMA compaction window may be reduced compared to HMA -- timely compaction is critical.'
    },
    {
      description: 'Verify layer thickness',
      acceptanceCriteria: 'Layer thickness verified by level survey or core measurement; thickness within design tolerance per Section 407; deficient areas assessed for acceptance or corrective action',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey/core measurement',
      notes: 'Section 407. Standard thickness requirements apply to WMA and RAP mixes.'
    },
    {
      description: 'Test surface texture and ride quality',
      acceptanceCriteria: 'Surface texture meets Section 407 requirements for specified mix type; ride quality (where required) meets Section 180 requirements; macro-texture measured by sand patch or equivalent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.13.1 (Sand Patch) / RC 317.01, straightedge (Section 180)',
      notes: 'Section 407/180. Surface quality requirements apply equally to WMA/RAP and conventional mixes.'
    },
    {
      description: 'Take conformance cores for density, thickness and air voids',
      acceptanceCriteria: 'Cores taken at specified frequency per Section 173; core density, air voids and thickness assessed against specification limits; lot acceptance criteria applied; results documented per lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.8 (density/air voids from cores)',
      notes: 'Section 407/173. Core testing is the primary acceptance method for asphalt density and air voids.'
    },

    // =========================================================================
    // DOCUMENTATION & ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile RAP/recycled content documentation',
      acceptanceCriteria: 'RAP source records, RAP characterisation test results, actual RAP percentage in each production lot documented; RCGS content (if used) recorded; recycled content meets any project sustainability targets',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TN 107. Recycled content documentation supports sustainability reporting requirements.'
    },
    {
      description: 'Compile WMA production records',
      acceptanceCriteria: 'WMA additive usage records, production temperatures, energy consumption records (if monitoring carbon reduction) documented; comparison with equivalent HMA production data (if required)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407. WMA production records support sustainability and performance verification.'
    },
    {
      description: 'Assess lot conformance and submit results',
      acceptanceCriteria: 'All test results compiled by lot; lot acceptance criteria per Section 173 applied; conforming and non-conforming lots identified; non-conforming lots assessed for acceptance, price reduction or removal; lot summary submitted to Superintendent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 407/173. Standard lot-based acceptance applies.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'Surface finish acceptable; ride quality meets requirements; all test results submitted and compliant; density, thickness and volumetric properties within specification; as-built records complete; lot accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Section 407. Final lot acceptance by Superintendent.'
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Asphalt')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicDGATemplate)
    await seedTemplate(vicOGATemplate)
    await seedTemplate(vicSMATemplate)
    await seedTemplate(vicSprayedSealTemplate)
    await seedTemplate(vicWMARecycledTemplate)

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
