/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Asphalt
 *
 * Creates global ITP templates for QLD asphalt and surfacing activities.
 * Templates: DGA (MRTS30), Sprayed Seals (MRTS11), Priming (MRTS11),
 *            SMA (MRTS30), EME2 (MRTS32/102)
 *
 * Run with: node scripts/seed-itp-templates-qld-asphalt.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: ASPHALT SURFACING / DGA (MRTS30)
// Dense Graded Asphalt - March 2024 edition
// Key change: WMA additive now mandatory, manufacturing temp reduced by 20 deg C
// =============================================================================

const qldAsphaltDGATemplate = {
  name: 'Asphalt Surfacing / DGA (QLD)',
  description: 'QLD TMR dense graded asphalt (DGA) construction per MRTS30 (March 2024). Covers mix design, production, placement, compaction, and acceptance testing. Includes mandatory WMA additive and reduced manufacturing temperatures per March 2024 amendment.',
  activityType: 'asphalt',
  specificationReference: 'TMR MRTS30 Asphalt Pavements (March 2024)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN APPROVAL
    // =========================================================================
    {
      description: 'Submit Asphalt Quality Plan (AQP) including production, placement, and compaction procedures',
      acceptanceCriteria: 'AQP accepted by Administrator; addresses sampling, test frequencies, temperature control, compaction plan; complies with MRTS50 Clause 6',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 5.2.1 / MRTS50 — Hold Point 1. No asphalt work to commence until AQP accepted.'
    },
    {
      description: 'Submit approved Asphalt Mix Design Certificate for each nominated mix',
      acceptanceCriteria: 'Mix design registered per TN148 (Asphalt Mix Design Registration); includes WMA additive type (wax-based or surfactant-based); volumetric properties within MRTS30 requirements; binder content, grading, and air voids confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2891 series (mix design)',
      notes: 'MRTS30 Clause 7.4.1 — Hold Point 2: No asphalt to be placed until approved Asphalt Mix Design Certificate provided. WMA additive mandatory per March 2024 amendment.'
    },
    {
      description: 'Perform Tensile Strength Ratio (TSR) moisture sensitivity test on mix',
      acceptanceCriteria: 'TSR >= 80%; if failing, halt production until cause addressed and Administrator approves restart',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q314 (TSR — 6 pairs Marshall specimens, wet vs dry)',
      notes: 'MRTS30 Clause 7.2.5 — Hold Point 1: Production Re-start after TSR Failure. Cannot recommence manufacturing until cause addressed.'
    },
    {
      description: 'Verify non-standard mix acceptance (if JMF deviation proposed)',
      acceptanceCriteria: 'Administrator expressly accepts nonconforming mix design for use; documented approval obtained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 7.4.1 — Hold Point 3: Use of Non-Standard Mix requires explicit Administrator acceptance.'
    },
    {
      description: 'Verify laboratory air voids of DGA mix design specimens',
      acceptanceCriteria: 'Lab-compacted air voids 4-6% for AC (dense graded) at 120 gyrations; JMF binder content tolerance +/-0.3%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.8 (bulk density) & AS/NZS 2891.7 (max theoretical density)',
      notes: 'MRTS30 — Volumetric properties must meet JMF tolerances. Air voids range differs from SMA (3-5%).'
    },

    // =========================================================================
    // UNDERLYING SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Proof roll base/subgrade prior to asphalt placement',
      acceptanceCriteria: 'No visible deformation, rutting, or pumping under loaded roller; any yielding areas reworked and re-tested',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q723 (Proof Roll Test)',
      notes: 'MRTS30 Clause 8.2.2 — Witness Point: Proof rolling of base/subgrade. 24 hours notice before paving.'
    },
    {
      description: 'Verify paving over weak substrate approval (if applicable)',
      acceptanceCriteria: 'If underlying layer deemed weak or nonconforming, corrective measures implemented and Administrator approval obtained before paving',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 8.2.2 — Hold Point 4: Paving over Weak Substrate. Do not pave until corrective measures approved.'
    },
    {
      description: 'Mark and treat all cracks >= 3mm on existing surface (for overlays)',
      acceptanceCriteria: 'All cracks >= 3mm marked, sealed, or filled; Administrator may inspect marked crack map before work starts',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8.2.3 — Witness Point: Crack Treatment Mark-out for asphalt overlays.'
    },
    {
      description: 'Mark fabric strip locations (if strain-alleviating fabric specified)',
      acceptanceCriteria: 'Areas to receive fabric marked per design; fabric installed over joints or wide cracks as specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8.2.4 — Witness Point: Fabric Strip Locations. Before fabric placement.'
    },
    {
      description: 'Apply tack coat at specified rate and verify coverage',
      acceptanceCriteria: 'Tack coat type and rate per MRTS30; uniform coverage with no bare spots or pooling; cured (tacky, not wet) before paving commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8.2 — Tack coat critical for bond between layers. Allow to break before paving.'
    },

    // =========================================================================
    // WEATHER & TEMPERATURE CONDITIONS
    // =========================================================================
    {
      description: 'Verify weather conditions suitable for paving',
      acceptanceCriteria: 'Pavement surface temperature >= 10 deg C; no rain falling or imminent; wind speed acceptable for placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 8.7 — Record temperatures. Do not pave in rain or on wet surface.'
    },

    // =========================================================================
    // PLACEMENT TRIAL
    // =========================================================================
    {
      description: 'Construct asphalt placement trial section for new mix or paving method',
      acceptanceCriteria: 'Trial section completed and assessed as acceptable for ride, compaction, joints, and texture; Administrator approves before full-scale paving',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core testing per AS/NZS 2891',
      notes: 'MRTS30 Clause 8.11 — Hold Point 7: Placement Trial & Nominated Mix. Full-scale paving held until trial section accepted.'
    },

    // =========================================================================
    // ASPHALT PRODUCTION & DELIVERY
    // =========================================================================
    {
      description: 'Monitor asphalt manufacturing temperature at plant (WMA-reduced)',
      acceptanceCriteria: 'Manufacturing temperature within WMA-mandated range: typically 120-140 deg C for conventional binder DGA (reduced 20 deg C from pre-March 2024). Temperature recorded for each batch.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 March 2024 — WMA mandate reduces max manufacturing temperature by 20 deg C. All mixes must contain WMA additive. Overheating degrades binder and WMA additive.'
    },
    {
      description: 'Perform production sampling for grading and binder content',
      acceptanceCriteria: 'Minimum 1 set of samples per lot (~400t or 1 day paving); grading within JMF envelope; binder content within +/-0.3% of design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 (extraction/grading)',
      notes: 'MRTS30 — Production QC sampling per AQP. JMF compliance monitoring.'
    },
    {
      description: 'Check asphalt temperature on arrival at paving site',
      acceptanceCriteria: 'Mix temperature >= minimum placement temperature (typically >= 110 deg C for WMA DGA); temperature measured for each truck; reject loads below minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 8.7 — Hold Point 6 triggered if placement outside specified temperature range. Record temperature for every load.'
    },
    {
      description: 'Verify nonconforming temperature approval (if paving at marginal conditions)',
      acceptanceCriteria: 'If Contractor wishes to pave at temperature outside specification, work held until Administrator approves special measures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 8.7 — Hold Point 6: Nonconforming Temperature. Asphalt shall not be placed outside specified range without approval.'
    },
    {
      description: 'Visually inspect mix for segregation or contamination',
      acceptanceCriteria: 'Homogeneous appearance; no segregation, balling, or foreign material; no excessive fumes indicating overheating',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — Reject segregated or contaminated loads on arrival.'
    },

    // =========================================================================
    // ASPHALT LAYER THICKNESS
    // =========================================================================
    {
      description: 'Verify nonconforming layer thickness approval (if applicable)',
      acceptanceCriteria: 'If asphalt layer to be placed thicker or thinner than specified limits, Administrator approval obtained prior to placement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 8.6.2 — Hold Point 5: Nonconforming Layer Thickness. Approval required before placement.'
    },

    // =========================================================================
    // PAVING OPERATIONS
    // =========================================================================
    {
      description: 'Monitor paver operation and mat quality',
      acceptanceCriteria: 'Paver at constant speed; screed heated; no stops causing cold joints; continuous material supply; surface uniform with no tearing, dragging, or segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8 — Monitor placement continuously. Paver stops cause mat defects.'
    },
    {
      description: 'Verify layer thickness during placement (loose and compacted)',
      acceptanceCriteria: 'Design thickness achieved; not more than 5mm below design per core; combined course thickness meets overall design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — Depth pins or paver sensor for ongoing verification during placement.'
    },
    {
      description: 'Construct longitudinal and transverse joints',
      acceptanceCriteria: 'Longitudinal joints offset from lane line; cut back vertical face on cold joints; tack coat applied to joint faces; joints smooth with no bump or depression > 3mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — Joint construction critical for waterproofing and ride quality. Hot-lapped joints preferred.'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Perform breakdown, intermediate, and finish rolling',
      acceptanceCriteria: 'Rolling pattern per approved AQP and trial section; compaction completed while mat temperature above minimum (typically > 80 deg C); no over-rolling; roller marks removed by finish rolling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — Compaction must achieve >= 93% of Refusal Density. Cannot achieve density once cold.'
    },
    {
      description: 'Monitor compaction density with gauge readings behind roller (pattern establishment)',
      acceptanceCriteria: 'Density gauge readings confirm rolling pattern achieves target density; document at least one full density curve at paving start for each mix',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 — Establish rolling pattern at start of each paving session. Spot-check density thereafter.'
    },

    // =========================================================================
    // ACCEPTANCE TESTING — CORING
    // =========================================================================
    {
      description: 'Extract cores at stratified random locations for density and thickness',
      acceptanceCriteria: 'Minimum 3 cores per lot (~500t or ~3000m2); cores extracted at random stratified locations per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q311 (core bulk density) & AS/NZS 2891.8/9 (voids calculation)',
      notes: 'MRTS30 — Stratified random core locations. Results reported within 3 days of laying for timely corrective action.'
    },
    {
      description: 'Submit in-situ air voids results from cores',
      acceptanceCriteria: 'In-situ air voids 3-7% for dense graded asphalt; no individual core < 2% (flushing risk) or > 8% (permeability/raveling risk); lot average within conformance limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q311 / AS/NZS 2891.8 (voids calculation)',
      notes: 'MRTS30 — Insitu air voids are primary acceptance criterion. Nonconforming lots subject to removal/replacement or pay deduction.'
    },
    {
      description: 'Verify layer thickness from cores',
      acceptanceCriteria: 'Layer thickness not more than 5mm below design; combined asphalt course thickness meets overall design; no cumulative under-run',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.1.4.2 (core thickness measurement)',
      notes: 'MRTS30 — Thickness verified from acceptance cores. Areas with ponding or high spots > 5mm corrected.'
    },
    {
      description: 'Verify bond to underlying layer from cores',
      acceptanceCriteria: 'Cores show asphalt fully adhered to base (>= 90% bond area); no delamination or clean separation visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core visual inspection',
      notes: 'MRTS30 — Debonded areas to be cut out and replaced or drilled and injected with bitumen per spec.'
    },

    // =========================================================================
    // SURFACE VERIFICATION
    // =========================================================================
    {
      description: 'Check surface regularity with straightedge',
      acceptanceCriteria: 'Surface level tolerance +/-5mm (individual), +/-3mm mean deviation; 3m straightedge check every 20m, 3 points across lane width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: '3m straightedge',
      notes: 'MRTS30 — Surface regularity check. No ponding areas. Correct deviations by diamond grinding or rework.'
    },
    {
      description: 'Verify surface texture depth',
      acceptanceCriteria: 'Texture depth meets minimum specification; uniform across lane width; no segregation or binder flushing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T250 (Sand Patch test)',
      notes: 'MRTS30 — Texture depth for skid resistance verification.'
    },
    {
      description: 'Perform ride quality assessment (IRI or profilograph)',
      acceptanceCriteria: 'IRI or Profile Index within specification limits; no localised roughness exceeding limits; crossfall per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'ARRB Walking Profiler / Profilograph',
      notes: 'MRTS30 — Ride quality assessed after completion, before opening to traffic. IRI per Annexure.'
    },
    {
      description: 'Inspect finished surface for defects (segregation, cracking, dragging)',
      acceptanceCriteria: 'No significant segregation exposing coarse aggregate clusters; no cracking; no drag marks; surface texture uniform; any defective areas repaired or replaced',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — Visual assessment of surface quality. Segregated areas must be cut out and replaced.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile and submit lot conformance documentation',
      acceptanceCriteria: 'All batch tickets, production QC results, core results, survey data, temperature records, and inspection photos complete and compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 / MRTS50 — Full lot documentation package for conformance assessment.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; density compliant; no outstanding nonconformances; lot accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS30 — Final lot acceptance by Administrator. Pay schedule applied for any nonconformances.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: SPRAYED BITUMINOUS SURFACING (MRTS11)
// Sprayed seal / chip seal work - July 2025 edition
// =============================================================================

const qldSprayedSealsTemplate = {
  name: 'Sprayed Bituminous Surfacing (QLD)',
  description: 'QLD TMR sprayed bituminous treatments (seals, reseals, enrichments) per MRTS11 (July 2025). Covers binder preparation, cover aggregate, spraying operations, rolling, and acceptance testing. Standalone template separated from asphalt for usability.',
  activityType: 'asphalt',
  specificationReference: 'TMR MRTS11 Sprayed Bituminous Treatments (July 2025)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Construction Procedures for sprayed seal works including equipment, binder type, application rates, and contingency plans',
      acceptanceCriteria: 'Procedures accepted by Administrator per MRTS50 Clause 6; equipment calibration current; operator qualifications confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 5 / MRTS50 — No sealing work to commence until procedures accepted.'
    },
    {
      description: 'Receive notification of Designed Spray Rate and Designed Spread Rate from Administrator',
      acceptanceCriteria: 'Spray rate and spread rate designed per TN175 and Austroads AGPT04K; rates appropriate for traffic, pavement type, and aggregate size; confirmed by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Spraying operations shall not commence until the Contractor has been notified by the Administrator of the Designed Spray Rate and Designed Spread Rate.'
    },

    // =========================================================================
    // EQUIPMENT & MATERIALS VERIFICATION
    // =========================================================================
    {
      description: 'Verify sprayer has current TMR Calibration Certificate and spray bar is calibrated',
      acceptanceCriteria: 'Current TMR Calibration Certificate provided; sprayer bar calibrated within specified period; nozzle condition inspected and satisfactory; spray pattern uniform',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Sprayer calibration test',
      notes: 'MRTS11 Clause 9 / 11.2 — Witness Point: Sprayer and Plant Check. Calibration Certificate must be current. 1-3 days prior notice.'
    },
    {
      description: 'Verify cover aggregate condition — dry, clean, and conforming to specification',
      acceptanceCriteria: 'Aggregate compliant with specification; moisture content < 1%; dust content < 1%; PSD within grading envelope; stockpiled on clean, drained surface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11 (PSD), AS 1141.5 (fines content)',
      notes: 'MRTS11 Clause 8.2 — Witness Point: Cover Aggregate Condition. Wet or dusty aggregate causes adhesion failure.'
    },
    {
      description: 'Verify binder type and grade comply with specification',
      acceptanceCriteria: 'Binder grade matches design (e.g. C170 residual bitumen, polymer modified binder per MRTS18 if specified); supply certificate provided; binder not degraded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 6 — Binder type specified by Administrator. Grades per AS 2008.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Perform Ball Penetration Test on pavement surface to verify readiness for sealing',
      acceptanceCriteria: 'Ball penetration <= 3.0mm on high-traffic roads (> 2000 v/l/d); ball penetration <= 4.0mm on low-traffic roads (<= 2000 v/l/d); if exceeded, additional rolling or drying required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T251 (Ball Penetration Test)',
      notes: 'MRTS11 Table 6.2 — Hold Point: Ball penetration results forwarded to Administrator. Work held until results acceptable.'
    },
    {
      description: 'Sweep pavement surface to expose larger particles and remove loose material',
      acceptanceCriteria: 'Surface swept until larger aggregate particles slightly exposed; no loose material, mud, or vegetation; surface damage repaired',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 8 — Surface preparation critical for binder adhesion and penetration.'
    },

    // =========================================================================
    // WEATHER & TEMPERATURE CHECKS
    // =========================================================================
    {
      description: 'Check and record pavement surface and air temperature before spraying',
      acceptanceCriteria: 'Pavement surface temperature >= minimum per Annexure MRTS11.1 (typically >= 15 deg C for seal); no rain falling or imminent; wind speed not excessive',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'IR thermometer (surface), thermometer (air)',
      notes: 'MRTS11 Clause 11.2 — All operations completed before surface temp drops below minimum. Cold weather measures require Administrator approval per TN186.'
    },
    {
      description: 'Confirm no rain forecast within minimum curing period after spraying',
      acceptanceCriteria: 'Weather forecast checked; no rain expected for minimum 24 hours; contingency plan in place',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 / TN186 — Rainfall during or within 1 hour after spraying is a verification-required event.'
    },

    // =========================================================================
    // BINDER PREPARATION & TEMPERATURE
    // =========================================================================
    {
      description: 'Verify binder temperature at delivery and in sprayer',
      acceptanceCriteria: 'Binder temperature within specified range for grade (e.g. 160 +/- 15 deg C for Class 170 bitumen); no overheating that reduces viscosity',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Thermometer (binder temperature)',
      notes: 'MRTS11 Clause 8.3.1 / 8.3.2 — Witness Point: Binder Temperature at Delivery. Observe heating in sprayer within safe limits.'
    },
    {
      description: 'Verify no overheating or prolonged heating of bitumen in sprayer',
      acceptanceCriteria: 'Binder not heated above maximum safe temperature; heating duration within manufacturer limits; thermometer readings recorded',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 8.3.2 — Witness Point: Heating of Bitumen. Overheating degrades binder properties.'
    },
    {
      description: 'Take binder sample from sprayer for quality assurance testing',
      acceptanceCriteria: '4L sample per tanker load; sample collected at sprayer bar for viscosity/penetration testing; labelled and stored per lab requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2008 (binder grading) / viscosity / penetration',
      notes: 'MRTS11 — One binder sample per tanker load for QA testing.'
    },

    // =========================================================================
    // SPRAYING OPERATIONS
    // =========================================================================
    {
      description: 'Confirm sufficient cover aggregate at site and spreading trucks on standby',
      acceptanceCriteria: 'Aggregate stockpile sufficient for planned spray area; aggregate dry and clean; spreading trucks loaded and ready; no delay between binder spray and aggregate spread',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 11.1 — Witness Point: Aggregate Availability. Aggregate must be available before spraying commences.'
    },
    {
      description: 'Apply binder at designed spray rate',
      acceptanceCriteria: 'Application rate within +/-10% of designed spray rate; uniform coverage with no missed strips, pools, or dry patches; spray applied in direction of traffic; overlap at joins within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T234 (tray test — binder application rate)',
      notes: 'MRTS11 Clause 10 — Document spraying pressure, temperature, and speed for each run. Spray log submitted to Administrator daily.'
    },
    {
      description: 'Verify field binder application rate by tray test',
      acceptanceCriteria: 'Field tray test result within +/-10% of designed spray rate; minimum 1 tray test per 500m of spray run',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T234 (tray test)',
      notes: 'MRTS11 — Tray test provides verification of actual application rate. Trays placed and weighed per AG:PT/T234.'
    },

    // =========================================================================
    // AGGREGATE SPREADING & ROLLING
    // =========================================================================
    {
      description: 'Spread cover aggregate immediately after binder application',
      acceptanceCriteria: 'Cover aggregate spread within 15 minutes of binder application; spread rate within +/-10% of designed spread rate; uniform coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 — Aggregate spreading must commence as soon as possible after binder spraying. No portion left uncovered > 15 minutes.'
    },
    {
      description: 'Verify aggregate spread rate by square patch test',
      acceptanceCriteria: 'Spread rate within +/-10% of design; minimum 3 x 1m2 areas per 500m of spray run checked; count/weigh stone to verify rate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Square patch test (1m2 areas weighed)',
      notes: 'MRTS11 — Aggregate spread rate verification. Record any adjustments to spreader gates.'
    },
    {
      description: 'Verify cover aggregate loaded dry and clean into spreading trucks',
      acceptanceCriteria: 'Aggregate loaded dry and clean; trucks commence spreading immediately after binder spraying; no delays',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 14.1 — Witness Point: Loading of Spreader Trucks during seal operation.'
    },
    {
      description: 'Roll seal with multi-tyred roller to embed aggregate into binder',
      acceptanceCriteria: 'Rolling commences immediately after aggregate spread; uniform embedment approximately 70% target; no over-rolling causing binder flushing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 14 — Rolling essential for aggregate embedment and binder adhesion.'
    },
    {
      description: 'Verify cold weather measures (if applicable)',
      acceptanceCriteria: 'If sealing in cold conditions, Contractor additional measures (heating, extended rolling) require Administrator permission and are observed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 11.3 — Witness Point: Cold Weather Measures. Additional measures during cold-weather seal.'
    },

    // =========================================================================
    // POST-APPLICATION INSPECTION & TESTING
    // =========================================================================
    {
      description: 'Inspect completed seal within 24 hours for uniformity and defects',
      acceptanceCriteria: 'Uniform aggregate embedment across full width; no excessive bleeding; no missed binder strips; no patchy coverage; no loose aggregate causing hazard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 — Full-length visual inspection within 24 hours of sealing.'
    },
    {
      description: 'Perform sweep test at 7 days to verify aggregate adhesion',
      acceptanceCriteria: 'Sweep test at 5 random locations per km; stone loss < 5% by mass indicates good adhesion; excessive whip-off requires re-sealing or sand patching',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Sweep test (200mm square, vigorously brushed)',
      notes: 'MRTS11 — Sweep test after initial trafficking. Nonconforming areas require remedial treatment.'
    },
    {
      description: 'Verify bitumen adhesion (aggregate stripping test) per source',
      acceptanceCriteria: 'Qualitative assessment shows minimal stripping; adequate binder adhesion to aggregate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q205 / Austroads T236 (bitumen adhesion)',
      notes: 'MRTS11 — Aggregate stripping test per aggregate source. Qualitative assessment.'
    },
    {
      description: 'Check surface texture depth of completed seal',
      acceptanceCriteria: 'Texture depth >= minimum specified (e.g. >= 1.2mm Sand Patch for 14mm aggregate seal); adequate skid resistance; 3 locations per lane-km',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T250 (Sand Patch test)',
      notes: 'MRTS11 — Texture depth verification for skid resistance.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Complete daily spray log including all operations parameters',
      acceptanceCriteria: 'Spray log complete with binder type, temperature, spray rate, spread rate, area covered, weather conditions, and equipment details; submitted to Administrator daily',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Daily spray log is a mandatory record.'
    },
    {
      description: 'Submit lot conformance report with all test results and inspection records',
      acceptanceCriteria: 'All test results (tray tests, binder samples, ball penetration, texture depth, sweep tests) compiled; conformance demonstrated; nonconformances documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 — Conformance report for each lot of sealing work.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; seal uniformity acceptable; lot accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS11 — Final lot acceptance by Administrator.'
    }
  ]
}

// =============================================================================
// TEMPLATE 3: PRIMING AND PRIMERSEALING (MRTS11)
// Initial seals on new pavement surfaces - July 2025 edition
// =============================================================================

const qldPrimingTemplate = {
  name: 'Priming and Primersealing (QLD)',
  description: 'QLD TMR priming and primersealing (initial seals) per MRTS11 (July 2025). Covers surface preparation, ball penetration testing, prime coat application, primerseal operations, and curing. Prime coat provides moisture barrier and adhesion; primerseal combines priming and sealing in one operation.',
  activityType: 'asphalt',
  specificationReference: 'TMR MRTS11 Sprayed Bituminous Treatments (July 2025) / TN175 / Austroads AGPT04K',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Construction Procedures for priming/primersealing works including equipment, binder type, application rates, and weather contingency plans',
      acceptanceCriteria: 'Procedures accepted by Administrator per MRTS50 Clause 6; equipment calibration current; operator qualifications confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 5 / MRTS50 — Hold Point: Work not to commence until procedures accepted.'
    },
    {
      description: 'Receive notification of Designed Spray Rate and Designed Spread Rate from Administrator',
      acceptanceCriteria: 'Spray rate and spread rate designed per TN175 and Austroads AGPT04K; rates appropriate for pavement type, traffic level, and aggregate size',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Spraying operations shall not commence until Contractor notified by Administrator of Designed Spray Rate and Designed Spread Rate.'
    },
    {
      description: 'Verify sprayer has current TMR Calibration Certificate',
      acceptanceCriteria: 'Current TMR Calibration Certificate; spray bar calibrated; nozzle condition satisfactory; spray pattern uniform',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Sprayer calibration test',
      notes: 'MRTS11 Clause 9 / 11.2 — Witness Point: Sprayer and Plant Check.'
    },

    // =========================================================================
    // SURFACE PREPARATION (PAVEMENT BASE)
    // =========================================================================
    {
      description: 'Verify underlying pavement base layer accepted (compaction, level, thickness testing passed)',
      acceptanceCriteria: 'All base layer conformance testing complete and passed per MRTS05/MRTS08; lot acceptance obtained; no outstanding nonconformances',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Base layer must be accepted before priming. Cross-reference to pavement ITP.'
    },
    {
      description: 'Perform Ball Penetration Test on pavement surface',
      acceptanceCriteria: 'Ball penetration <= 3.0mm on high-traffic roads (> 2000 v/l/d); <= 4.0mm on low-traffic roads (<= 2000 v/l/d); if exceeded, additional rolling or drying required before sealing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T251 (Ball Penetration Test)',
      notes: 'MRTS11 Table 6.2 — Hold Point: Ball penetration results forwarded to Administrator. Work held until acceptable.'
    },
    {
      description: 'Sweep pavement surface with road broom to expose larger particles and remove loose material',
      acceptanceCriteria: 'Surface swept until larger aggregate particles slightly exposed; no excessive erosion of fines; no loose material, mud, or vegetation; surface damage repaired',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 8 — Surface preparation critical for binder adhesion and penetration.'
    },
    {
      description: 'Apply light watering to dry/dusty pavement surface prior to spraying (if required)',
      acceptanceCriteria: 'Surface lightly dampened but not saturated; no ponding water; watering applied just before binder spray to suppress dust',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 8 — Light watering only. Excessive moisture prevents binder adhesion.'
    },

    // =========================================================================
    // WEATHER & TEMPERATURE CHECKS
    // =========================================================================
    {
      description: 'Check and record pavement surface and air temperature before spraying',
      acceptanceCriteria: 'Pavement surface temperature >= minimum per Annexure MRTS11.1 (typically >= 10 deg C for prime, >= 15 deg C for primerseal); no rain; wind speed acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'IR thermometer (surface), thermometer (air)',
      notes: 'MRTS11 Clause 11.2 — Temperatures recorded hourly during operations. Cold weather measures per TN186 require Administrator approval.'
    },
    {
      description: 'Confirm no rain forecast within minimum curing period',
      acceptanceCriteria: 'Weather forecast checked; no rain expected for minimum 24 hours for primerseal; contingency plan in place',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 / TN186 — Rainfall during or within 1 hour after spraying is a verification-required event.'
    },

    // =========================================================================
    // BINDER PREPARATION
    // =========================================================================
    {
      description: 'Verify binder type and grade for prime/primerseal',
      acceptanceCriteria: 'Binder grade matches design (e.g. AMC cutback grades per AS 2157 for primes, C170 residual bitumen for primerseals); supply certificate provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 Clause 6 — Binder type specified by Administrator. Cutback bitumen grades per AS 2157 for primes.'
    },
    {
      description: 'Verify binder temperature at delivery and in sprayer',
      acceptanceCriteria: 'Binder temperature within specified range for grade (e.g. 160 +/-15 deg C for Class 170); no overheating',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Thermometer (binder temperature)',
      notes: 'MRTS11 Clause 8.3.1 / 8.3.2 — Witness Point: Binder Temperature. Observe heating within safe limits.'
    },
    {
      description: 'Take binder sample from sprayer for QA testing',
      acceptanceCriteria: '4L sample per tanker load; collected at sprayer bar; labelled and stored per laboratory requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2008 (binder grading) / viscosity / penetration',
      notes: 'MRTS11 — One binder sample per tanker load for QA testing.'
    },

    // =========================================================================
    // COVER AGGREGATE VERIFICATION (PRIMERSEAL ONLY)
    // =========================================================================
    {
      description: 'Verify cover aggregate compliance for primerseal (if primerseal specified)',
      acceptanceCriteria: 'Aggregate compliant; moisture content < 1%; dust content < 1%; PSD within grading envelope; stockpiled on clean drained surface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141.11 (PSD), AS 1141.5 (fines content)',
      notes: 'MRTS11 Clause 8.2 — Witness Point: Cover Aggregate Condition. Wet or dusty aggregate causes adhesion failure.'
    },

    // =========================================================================
    // PRIME COAT APPLICATION
    // =========================================================================
    {
      description: 'Apply prime coat at designed spray rate',
      acceptanceCriteria: 'Application rate within +/-10% of designed spray rate; uniform coverage with no missed strips, pools, or dry patches; typically 0.5-1.5 L/m2 for cutback primes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T234 (tray test — binder application rate)',
      notes: 'MRTS11 Clause 10 — Prime coat application rates vary by binder type and pavement surface finish.'
    },
    {
      description: 'Verify field application rate by tray test',
      acceptanceCriteria: 'Field tray test result within +/-10% of designed spray rate; minimum 1 tray test per 500m of spray run',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T234 (tray test)',
      notes: 'MRTS11 — Tray test verifies actual application rate.'
    },
    {
      description: 'Monitor prime coat curing — penetration and surface drying',
      acceptanceCriteria: 'Prime penetration into base 5-10mm typical; surface cured until no longer tacky (minimum 3 days for cutback primes); no tracking by traffic; no rain damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 — Curing time varies with weather and base material. Protect from traffic and rain during curing.'
    },

    // =========================================================================
    // PRIMERSEAL APPLICATION (IF COMBINED INITIAL SEAL)
    // =========================================================================
    {
      description: 'Confirm sufficient cover aggregate at site and spreading trucks on standby (primerseal)',
      acceptanceCriteria: 'Aggregate stockpile sufficient; aggregate dry and clean; spreading trucks loaded and ready; no delay between spray and spread',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 11.1 — Witness Point: Aggregate Availability. Must be available before spraying.'
    },
    {
      description: 'Apply binder at designed spray rate for primerseal',
      acceptanceCriteria: 'Application rate within +/-10% of designed spray rate; uniform coverage; sprayer bar height and speed consistent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T234 (tray test)',
      notes: 'MRTS11 Clause 10 — Document spraying pressure, temperature, and speed. Daily spray log to Administrator.'
    },
    {
      description: 'Spread cover aggregate immediately after binder application',
      acceptanceCriteria: 'Cover aggregate spread within 15 minutes of binder application; spread rate within +/-10% of design; uniform coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 — Aggregate spreading must commence as soon as possible after binder spraying.'
    },
    {
      description: 'Verify aggregate spread rate by square patch test',
      acceptanceCriteria: 'Spread rate within +/-10% of design; minimum 3 x 1m2 areas per 500m checked',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Square patch test (1m2 areas weighed)',
      notes: 'MRTS11 — Aggregate spread rate verification.'
    },
    {
      description: 'Roll primerseal with multi-tyred roller to embed aggregate',
      acceptanceCriteria: 'Rolling immediately after aggregate spread; uniform embedment approximately 70% target; no over-rolling causing binder flushing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 Clause 14 — Rolling essential for aggregate embedment.'
    },

    // =========================================================================
    // POST-APPLICATION & TRAFFIC CONTROL
    // =========================================================================
    {
      description: 'Inspect completed prime/primerseal within 24 hours for uniformity',
      acceptanceCriteria: 'Uniform coverage; no excessive bleeding; no strips of missed binder; no patchy coverage; no loose aggregate causing hazard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS11 — Full-length visual inspection within 24 hours.'
    },
    {
      description: 'Implement traffic control on primersealed surface',
      acceptanceCriteria: 'Speed limited (typically 40-60 km/h) during initial embedment period; loose stone swept and removed; bleeding areas addressed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Traffic management plan for initial seal during embedment period.'
    },
    {
      description: 'Perform sweep test at 7 days to verify aggregate adhesion (primerseal)',
      acceptanceCriteria: 'Sweep test at 5 random locations per km; stone loss < 5% by mass; excessive whip-off requires remedial treatment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Sweep test (200mm square, vigorously brushed)',
      notes: 'MRTS11 — Sweep test after initial trafficking. Nonconforming areas remediated.'
    },
    {
      description: 'Check surface texture depth of completed primerseal',
      acceptanceCriteria: 'Texture depth >= minimum specified (e.g. >= 1.2mm Sand Patch for 14mm aggregate); adequate skid resistance for interim trafficking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T250 (Sand Patch test)',
      notes: 'MRTS11 — Texture depth verification for primerseal used as temporary running surface.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Complete daily spray log for each day of operations',
      acceptanceCriteria: 'Spray log complete with binder type, temperature, spray rate, spread rate, area covered, weather conditions, equipment details; submitted daily',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS11 — Daily spray log is mandatory record.'
    },
    {
      description: 'Submit lot conformance report with all test results and inspection records',
      acceptanceCriteria: 'All test results (tray tests, binder samples, ball penetration, texture depth) compiled; conformance demonstrated; nonconformances documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 — Conformance report for each lot of priming/primersealing work.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'Prime/primerseal acceptable; lot accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS11 — Final lot acceptance. Release for subsequent layer.'
    }
  ]
}

// =============================================================================
// TEMPLATE 4: STONE MASTIC ASPHALT - SMA (MRTS30)
// SMA-specific clauses within MRTS30 - March 2024 edition
// =============================================================================

const qldSMATemplate = {
  name: 'Stone Mastic Asphalt - SMA (QLD)',
  description: 'QLD TMR Stone Mastic Asphalt (SMA) per MRTS30 (March 2024). SMA has distinct requirements within MRTS30 including mandatory cellulose fibre (>= 0.3%), crushed fine aggregate only, no recycled glass fines, PMB binder, lab air voids 3-5%, and drain-down testing. Includes mandatory WMA additive and reduced manufacturing temperatures.',
  activityType: 'asphalt',
  specificationReference: 'TMR MRTS30 Asphalt Pavements — SMA Clauses (March 2024)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // MIX DESIGN
    // =========================================================================
    {
      description: 'Submit SMA mix design for registration per MRTS30 and TN148',
      acceptanceCriteria: 'Mix design registered per TN148; SMA10 or SMA14 nominal size as specified; binder type per MRTS17/MRTS18 (PMB typically required); cellulose fibre content >= 0.3% by mass of mix; WMA additive identified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Mix design per AS/NZS 2891 series',
      notes: 'MRTS30 Clause 7 / TN148 — SMA mix design must be registered before production. Recycled glass fine aggregate prohibited in SMA. WMA additive mandatory.'
    },
    {
      description: 'Verify SMA mix design includes mandatory WMA additive',
      acceptanceCriteria: 'WMA additive (wax-based or surfactant-based) included; additive dosage per manufacturer recommendation; additive does not adversely affect binder or mix properties',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 March 2024 — ALL asphalt mixes must contain WMA additive. Manufacturing temperature reduced by 20 deg C. Registration refused without WMA information.'
    },
    {
      description: 'Perform drain-down test on SMA mix design (Schellenberg method)',
      acceptanceCriteria: 'Drain-down <= 0.3% by mass at elevated temperatures comparable to production, storage, transport, and placement; cellulose fibre content adequate to prevent binder drainage',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Schellenberg drain-down test (AS/NZS 2891)',
      notes: 'MRTS30 — Drain-down critical for SMA. Test at maximum production temperature. Elevated fibre may be needed if drain-down exceeds limit.'
    },
    {
      description: 'Verify laboratory air voids of SMA mix design specimens',
      acceptanceCriteria: 'Lab-compacted air voids 3-5% for SMA (differs from DGA 4-6%); volumetric properties within SMA envelope per MRTS30',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.8 (bulk density) & AS/NZS 2891.7 (max theoretical density)',
      notes: 'MRTS30 — SMA has tighter air void range than DGA due to stone-on-stone contact requirements.'
    },
    {
      description: 'Perform TSR moisture sensitivity test on SMA mix',
      acceptanceCriteria: 'TSR >= 80%; if failing, production must not commence until cause addressed and Administrator approves restart',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q314 (Tensile Strength Ratio)',
      notes: 'MRTS30 Clause 7.2.5 — Hold Point: Production Re-start after TSR Failure.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify coarse aggregate for SMA meets TMR requirements',
      acceptanceCriteria: 'Aggregate from registered quarry; complies with MRTS101; crushed, angular, high polishing resistance (PSV >= specified); grading within SMA envelope; no rounded or water-worn particles',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141 series (aggregate testing)',
      notes: 'MRTS30 / MRTS101 — SMA relies on stone-on-stone contact; aggregate quality critical for rut resistance.'
    },
    {
      description: 'Verify fine aggregate for SMA is manufactured (crushed), not natural sand',
      acceptanceCriteria: 'Fine aggregate for SMA must be crushed; no natural sand permitted; fines comply with MRTS101; no recycled glass fine aggregate in SMA',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 — SMA-specific requirement: fine aggregate must be crushed. Recycled glass fines prohibited.'
    },
    {
      description: 'Verify cellulose fibre material compliance and supply',
      acceptanceCriteria: 'Cellulose fibre content >= 0.3% by mass of mix; fibre compliant with specification; adequate supply secured; fibre dosing system calibrated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 — Cellulose fibre mandatory for SMA to prevent binder drain-down during transport and placement.'
    },
    {
      description: 'Verify binder compliance (PMB for SMA as specified)',
      acceptanceCriteria: 'Binder type and grade per MRTS17/MRTS18; binder test certificates provided; WMA additive incorporated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Binder testing per AS 2008',
      notes: 'MRTS30 / MRTS18 — PMB typically specified for SMA for improved performance.'
    },

    // =========================================================================
    // PRODUCTION SETUP
    // =========================================================================
    {
      description: 'Submit Asphalt Quality Plan (AQP) for SMA production',
      acceptanceCriteria: 'AQP includes sampling, frequencies, test methods; production monitoring; temperature control (reduced 20 deg C per March 2024); fibre dosing verification; drain-down control; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 Clause 5.2 — AQP must be accepted before production. Addresses all SMA-specific requirements.'
    },
    {
      description: 'Verify asphalt plant setup for SMA production (fibre dosing, temperature, mixing time)',
      acceptanceCriteria: 'Fibre dosing system calibrated; plant temperature controls set for WMA-reduced temperatures; mixing time adequate for fibre distribution (longer than DGA); no contamination from previous mix',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — SMA requires longer mixing time for uniform fibre distribution. Plant changeover prevents contamination.'
    },

    // =========================================================================
    // PLACEMENT TRIAL
    // =========================================================================
    {
      description: 'Construct SMA placement trial section',
      acceptanceCriteria: 'Trial section of sufficient length (typically >= 200m); demonstrates compaction, joint construction, surface texture, no drain-down; trial accepted before full-scale paving',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core testing per AS/NZS 2891',
      notes: 'MRTS30 Clause 8.11 — Hold Point 7: Placement trial required for new mix. Administrator witnesses trial.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Verify existing surface prepared and accepted for SMA overlay',
      acceptanceCriteria: 'Surface clean, dry, free of loose material; crack treatment complete (all cracks >= 3mm sealed); profile corrections done; proof rolling passed; tack coat applied at correct rate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8.2 — Hold Point 4: No paving over weak substrate without corrective measures. Proof roll underlying surface.'
    },
    {
      description: 'Apply tack coat at specified rate for SMA layer',
      acceptanceCriteria: 'Tack coat type and rate per MRTS30; uniform coverage; adequate curing (tacky, not wet) before SMA placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Application rate check',
      notes: 'MRTS30 — Tack coat critical for inter-layer bond. SMA relies on bond for structural capacity.'
    },

    // =========================================================================
    // SMA PRODUCTION AND PLACEMENT
    // =========================================================================
    {
      description: 'Monitor SMA production temperature at plant (WMA-reduced)',
      acceptanceCriteria: 'Mix temperature within WMA-mandated range: typically 130-150 deg C for PMB SMA (reduced 20 deg C from pre-March 2024); temperature recorded for each batch/truck; no overheating',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement (plant thermometer)',
      notes: 'MRTS30 March 2024 — WMA mandate reduces maximum temperature. Overheating degrades PMB and fibre.'
    },
    {
      description: 'Perform production sampling for grading, binder content, and fibre content',
      acceptanceCriteria: 'Minimum 1 set per lot (~400t or daily); grading within SMA design envelope; binder content within +/-0.3% of design; fibre content verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 (extraction/grading), AS/NZS 2891.1 (binder content)',
      notes: 'MRTS30 — Production sampling critical for SMA to maintain stone-on-stone contact and prevent drain-down.'
    },
    {
      description: 'Verify SMA mix temperature on arrival at paving site',
      acceptanceCriteria: 'Mix temperature >= minimum placement temperature (typically >= 120 deg C for PMB SMA); temperature measured each truck; reject loads below minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement (IR gun)',
      notes: 'MRTS30 Clause 8.7 — Hold Point 6 triggered if temperature outside specified range.'
    },
    {
      description: 'Monitor SMA placement (paver operation, layer thickness, surface appearance)',
      acceptanceCriteria: 'Layer thickness per design (no more than 5mm below); surface uniform with rich mortar appearance; no visible drain-down; no tearing, dragging, or segregation; joints hot-lapped where possible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — SMA surface should have uniform rich appearance. Visible drain-down during placement indicates fibre/temperature problem.'
    },
    {
      description: 'Verify compaction (rolling pattern, passes, temperature window)',
      acceptanceCriteria: 'Compaction per approved rolling pattern from trial; steel-wheeled roller (no pneumatic tyres on SMA — pick-up risk); compaction completed while mat temperature > 80 deg C; no over-rolling',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 — SMA compaction window typically narrower than DGA. Pneumatic tyres may pick up binder from SMA surface.'
    },

    // =========================================================================
    // TESTING AND COMPLIANCE
    // =========================================================================
    {
      description: 'Extract cores for in-situ air voids and thickness verification',
      acceptanceCriteria: 'Minimum 3 cores per lot; in-situ air voids within 3-7%; layer thickness not more than 5mm below design; results within MRTS30 pay schedule conformance limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q311 (core bulk density), AS/NZS 2891.8 (voids calculation)',
      notes: 'MRTS30 Clause 9 — Lot length typically 100m.'
    },
    {
      description: 'Verify surface texture of completed SMA layer',
      acceptanceCriteria: 'Texture depth >= minimum specified (typically >= 0.5mm for SMA14, >= 0.4mm for SMA10); uniform macrotexture; no flushing or fat spots',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Austroads AG:PT/T250 (Sand Patch test)',
      notes: 'MRTS30 — SMA texture uniform with visible stone matrix pattern. Flushing indicates excess binder or over-compaction.'
    },
    {
      description: 'Inspect completed SMA surface for defects',
      acceptanceCriteria: 'No segregation exposing coarse aggregate clusters; no cracking; no binder drain-down on surface; joints smooth (no bump/depression > 3mm); no loose stone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Visual inspection, straightedge check',
      notes: 'MRTS30 — Segregated or defective areas must be cut out and replaced.'
    },
    {
      description: 'Verify longitudinal profile and ride quality of completed SMA surface',
      acceptanceCriteria: 'Surface level tolerance +/-5mm individual, +/-3mm mean; 3m straightedge <= 5mm; no ponding; crossfall per design; IRI per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Level survey, straightedge, IRI measurement',
      notes: 'MRTS30 — Surface regularity check every 20m, 3 points across lane.'
    },
    {
      description: 'Verify bond between SMA layer and underlying surface',
      acceptanceCriteria: 'Cores show SMA fully adhered to base (>= 90% bond area); no delamination or clean separation; debonded areas cut out and replaced',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core visual inspection',
      notes: 'MRTS30 — Bond failure typically caused by inadequate tack coat or contaminated surface.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit lot compliance assessment for each SMA lot',
      acceptanceCriteria: 'All lot test results compiled; nonconformances identified with proposed disposition; compliance with MRTS30 pay schedule demonstrated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 — Deductions apply to nonconformances in air voids per specification tables (different deduction rates for PMB mixes).'
    },
    {
      description: 'Submit complete SMA lot records package for final acceptance',
      acceptanceCriteria: 'Package includes: mix design registration, AQP, material certificates, production records, temperature records, placement records, core results, surface texture, profile results, compliance assessment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS30 — Complete asphalt quality records required for final acceptance.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; lot accepted by Administrator or pay adjustment applied',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS30 — Final lot acceptance by Administrator.'
    }
  ]
}

// =============================================================================
// TEMPLATE 5: EME2 HIGH MODULUS ASPHALT (MRTS32 / MRTS102)
// High Modulus Asphalt EME Class 2 with WMA and RAP provisions
// =============================================================================

const qldEME2Template = {
  name: 'EME2 High Modulus Asphalt (QLD)',
  description: 'QLD TMR High Modulus Asphalt (EME2) per MRTS32 and MRTS102. EME2 is a high modulus asphalt base/binder course for heavy-duty pavements. Includes mandatory WMA additive (MRTS30 March 2024) and RAP provisions (up to 15% per MRTS102 November 2025). Hard grade bitumen with 14mm nominal aggregate.',
  activityType: 'asphalt',
  specificationReference: 'TMR MRTS32 High Modulus Asphalt (EME2) / MRTS102 Reclaimed Asphalt Pavement Material (November 2025)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // MIX DESIGN
    // =========================================================================
    {
      description: 'Submit EME2 mix design for registration per MRTS32 and TN148',
      acceptanceCriteria: 'Mix design registered per TN148; nominal aggregate size 14mm; binder type per MRTS17 (hard grade bitumen); WMA additive (wax-based or surfactant-based) identified; registration will not be accepted without WMA additive information',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Mix design per MRTS32 / AS/NZS 2891',
      notes: 'MRTS32 Clause 7 / TN148 — EME2 is high modulus asphalt EME Class 2 with 14mm nominal aggregate. WMA additive mandatory per MRTS30 March 2024.'
    },
    {
      description: 'Submit RAP material compliance documentation per MRTS102 (if RAP proposed)',
      acceptanceCriteria: 'RAP complies with MRTS102 (November 2025); sourced entirely from asphalt (no foreign materials); aggregates hard, sound, durable per MRTS101; PSD determined after binder removal; RAP content <= 15% by mass',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RAP testing per MRTS102',
      notes: 'MRTS32 Clause 7.1.4 — Up to 15% RAP permitted. RAP free from road base, concrete, coal tar, plastics, brick, timber, scrap rubber, dust, clay, dirt per MRTS102.'
    },
    {
      description: 'Verify EME2 mix design with RAP meets performance requirements (if RAP included)',
      acceptanceCriteria: 'EME2 mixes with up to 15% RAP can be registered based on 0% RAP test results if binder content and PSD are same; otherwise separate verification required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'MRTS32 performance testing',
      notes: 'MRTS32 — Simplified registration path for RAP mixes based on corresponding 0% RAP design.'
    },
    {
      description: 'Perform TSR moisture sensitivity test on EME2 mix',
      acceptanceCriteria: 'TSR >= 80%; if failing, halt production until cause addressed and Administrator approves restart',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q314 (Tensile Strength Ratio)',
      notes: 'MRTS32 / MRTS30 Clause 7.2.5 — Hold Point: TSR failure halts production.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify aggregate compliance for EME2',
      acceptanceCriteria: 'Aggregate from registered quarry; complies with MRTS101; hard grade suitable for high modulus application; grading within EME2 envelope per MRTS32',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1141 series (aggregate testing)',
      notes: 'MRTS32 Clause 7 — EME2 aggregate quality requirements may be more stringent than standard DGA.'
    },
    {
      description: 'Verify binder compliance (hard grade bitumen with WMA additive)',
      acceptanceCriteria: 'Binder grade per MRTS17; hard grade suitable for high modulus; WMA additive at recommended dosage; binder test certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Binder testing per AS 2008',
      notes: 'MRTS32 / MRTS17 — Hard grade bitumen for EME2 to achieve high modulus.'
    },
    {
      description: 'Verify RAP stockpile management and processing per MRTS102 (if using RAP)',
      acceptanceCriteria: 'RAP separated by source/grade; protected from contamination; processed to uniform size; sampling and testing per MRTS102; traceability maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RAP testing per MRTS102',
      notes: 'MRTS102 — RAP processed, stockpiled, and tested per MRTS102. Harmonised with Austroads ATS3135.'
    },

    // =========================================================================
    // PRODUCTION SETUP
    // =========================================================================
    {
      description: 'Submit Asphalt Quality Plan (AQP) for EME2 production',
      acceptanceCriteria: 'AQP includes EME2-specific parameters, reduced manufacturing temperature (WMA mandate), RAP dosing system (if applicable), sampling plan, compliance assessment; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS32 / MRTS30 — AQP must address all EME2-specific requirements including WMA and RAP provisions.'
    },
    {
      description: 'Verify asphalt plant setup for EME2 production (including RAP feed if applicable)',
      acceptanceCriteria: 'Plant configured for EME2; temperature controls set for WMA-reduced temperatures (reduced 20 deg C from pre-March 2024); RAP feed calibrated if applicable; no contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS32 / TN190 — Plant setup verification per TN190 Construction and Trafficking of High Modulus Asphalt.'
    },

    // =========================================================================
    // PLACEMENT TRIAL
    // =========================================================================
    {
      description: 'Construct EME2 placement trial section',
      acceptanceCriteria: 'Trial section demonstrates compaction achievement, layer thickness, joint construction, temperature management; accepted by Administrator before full-scale production',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Core testing per MRTS32',
      notes: 'MRTS32 / MRTS30 Clause 8.11 — Hold Point: Placement trial required. TN190 provides guidance on EME2 construction.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Verify substrate prepared and accepted for EME2 placement',
      acceptanceCriteria: 'Substrate clean, stable, profiled; proof rolling passed; tack coat at correct rate; no weak areas; surface temperature suitable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS30 Clause 8.2 — Substrate acceptance required before paving.'
    },

    // =========================================================================
    // EME2 PRODUCTION AND PLACEMENT
    // =========================================================================
    {
      description: 'Monitor EME2 production temperature (WMA-reduced)',
      acceptanceCriteria: 'Manufacturing temperature within WMA-mandated range (reduced 20 deg C from traditional hot mix: typically 120-140 deg C); temperature recorded for each batch; no overheating',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement (plant thermometer)',
      notes: 'MRTS32 / MRTS30 March 2024 — WMA mandate applies. Manufacturing at lower temperatures reduces emissions.'
    },
    {
      description: 'Perform production sampling for grading, binder content, and RAP content verification',
      acceptanceCriteria: 'Minimum 1 set per lot; grading within EME2 envelope; binder content within +/-0.3% of design; RAP content within design limits (<= 15%)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 2891.3.1 (extraction/grading), AS/NZS 2891.1 (binder content)',
      notes: 'MRTS32 — Production monitoring ensures mix consistency for high modulus performance.'
    },
    {
      description: 'Verify EME2 mix temperature on arrival at paving site',
      acceptanceCriteria: 'Temperature >= minimum placement temperature; recorded for each truck; reject loads below minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement (IR gun)',
      notes: 'MRTS32 / MRTS30 — EME2 typically requires higher compaction effort; adequate temperature essential.'
    },
    {
      description: 'Monitor EME2 placement and compaction',
      acceptanceCriteria: 'Layer thickness per design (typically 50-100mm as base/binder course); compaction per approved rolling pattern; surface uniform; no segregation, tearing, or dragging; joints properly constructed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS32 / TN190 — EME2 typically placed in thick layers as structural base/binder course.'
    },

    // =========================================================================
    // TESTING AND COMPLIANCE
    // =========================================================================
    {
      description: 'Extract cores for in-situ air voids and thickness',
      acceptanceCriteria: 'Minimum 3 cores per lot; in-situ air voids within specified range per MRTS32; layer thickness not more than 5mm below design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q311 (core bulk density), AS/NZS 2891.8 (voids calculation)',
      notes: 'MRTS32 — EME2 compaction requirements may differ from standard DGA.'
    },
    {
      description: 'Verify modulus of EME2 layer (if site modulus testing specified)',
      acceptanceCriteria: 'Modulus meets EME2 design requirements (high modulus performance); testing method and acceptance per project specification or MRTS32',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Modulus testing per MRTS32 (laboratory testing of cores or deflection testing)',
      notes: 'MRTS32 — High modulus is the defining characteristic of EME2. Verification may be required per project specification.'
    },
    {
      description: 'Verify surface profile and level of completed EME2 layer',
      acceptanceCriteria: 'Level tolerance per MRTS30; surface smooth and true; suitable for receiving subsequent layers; no ponding areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Level survey, 3m straightedge',
      notes: 'MRTS32 — EME2 typically used as structural layer under wearing course.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit lot compliance assessment for each EME2 lot',
      acceptanceCriteria: 'All lot test results compiled; compliance demonstrated; nonconformances identified; lot accepted or pay adjustment applied per MRTS30/MRTS32 pay schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS32 — Compliance assessment per MRTS32 specific requirements.'
    },
    {
      description: 'Submit complete EME2 production records including RAP and WMA documentation',
      acceptanceCriteria: 'Records include: mix design registration, AQP, material certificates (RAP per MRTS102, WMA additive documentation), production records, temperature records, core results, compliance assessment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS32 / MRTS102 — Complete records required including RAP traceability and WMA additive compliance.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met; lot accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS32 — Final lot acceptance by Administrator.'
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Asphalt')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldAsphaltDGATemplate)
    await seedTemplate(qldSprayedSealsTemplate)
    await seedTemplate(qldPrimingTemplate)
    await seedTemplate(qldSMATemplate)
    await seedTemplate(qldEME2Template)

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
