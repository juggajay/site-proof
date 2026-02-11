/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Drainage
 *
 * Creates global ITP templates for QLD drainage activities.
 * Templates: Pipes (MRTS03), Pits (MRTS03/70), Box Culverts (MRTS03/24/70),
 *            Subsoil (MRTS03), Kerb & Channel (MRTS03/70)
 *
 * Run with: node scripts/seed-itp-templates-qld-drainage.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// QLD PIPE INSTALLATION (MRTS03)
// =============================================================================

const qldPipeInstallationTemplate = {
  name: 'Drainage - Pipe Installation (QLD)',
  description: 'TMR pipe culvert installation including RCP and PVC pipes per MRTS03 (March 2025) and AS/NZS 3725:2007. Covers trench excavation, bedding, pipe laying, jointing, backfill, CCTV inspection, and as-built survey.',
  activityType: 'drainage',
  specificationReference: 'TMR MRTS03 / AS/NZS 3725:2007',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & PLANNING
    // =========================================================================
    {
      description: 'Submit Drainage Construction Procedures including pipe laying sequence, equipment, bedding/backfill methodology, joint sealing method, and testing plan',
      acceptanceCriteria: 'Procedures approved by Administrator prior to any drainage works commencing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 MRTS03 -- No drainage works to commence until construction procedures accepted by Administrator'
    },
    {
      description: 'Submit Inspection and Test Plan (ITP) for drainage pipe installation covering all hold points, witness points, test methods, and frequencies',
      acceptanceCriteria: 'ITP accepted by Administrator; aligned with MRTS50 quality system requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.1 MRTS50 -- Separate ITP required for structures/drainage as per MRTS50'
    },
    {
      description: 'Submit shop drawings and pipe schedule showing pipe types, classes, sizes, lengths, joint types, and invert levels',
      acceptanceCriteria: 'Shop drawings reviewed and accepted; pipe classes match design loads per AS/NZS 3725',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS03 -- Submit minimum 14 days prior to pipe procurement'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify pipe supply from TMR Registered Supplier (for RCP) or approved manufacturer (PVC/other)',
      acceptanceCriteria: 'Supplier holds current TMR Registration Certificate for precast concrete products; or material certificates for non-concrete pipes',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS24 Clause 4 -- Precast concrete pipe must be from Registered Supplier per TMR Registration Scheme'
    },
    {
      description: 'Inspect pipes on delivery for damage, dimensional compliance, and marking (class, size, date of manufacture)',
      acceptanceCriteria: 'No visible cracks, chips, or damage; dimensions within AS 4058 / AS 1597 tolerances; pipes clearly marked with class and date',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 8 MRTS03 -- Reject any damaged or non-compliant pipes; record batch numbers'
    },
    {
      description: 'Verify pipe strength class matches design requirements per AS/NZS 3725 load analysis and specified support type (HS1/HS2/HS3)',
      acceptanceCriteria: 'Pipe class certified to meet or exceed design loads for the specified installation condition and support type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS/NZS 3725 Clause 3 -- Support type typically HS2 within road reserves; HS3 for high embankments'
    },
    {
      description: 'Verify bedding material complies with specification requirements (grading, plasticity, particle size)',
      acceptanceCriteria: 'Material compliant with MRTS03 bedding requirements; grading within specified envelope; PI within limits; free of organic matter and oversized particles',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1 (particle size), AS 1289.3.3.1 (plasticity index)',
      notes: 'Clause 12.2 MRTS03 -- Bedding material must be tested and approved before use'
    },
    {
      description: 'Verify joint sealing materials (rubber rings, sealants, lubricant) comply with specifications and are within shelf life',
      acceptanceCriteria: 'Materials comply with AS 4058 joint requirements; rubber rings to manufacturer specification; lubricant compatible with rubber ring material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 12.3.4.1 MRTS03 -- Joint materials must be stored and handled per manufacturer requirements'
    },
    {
      description: 'Confirm all bedding and backfill materials used are free from deleterious materials (organics, sulfates, aggressive chemicals)',
      acceptanceCriteria: 'Material free from organics, sulfates above specified limit, and any material that could cause pipe degradation; pH within acceptable range for pipe material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 series (chemical testing if required by project)',
      notes: 'Clause 12.2 MRTS03 -- Particularly important for aggressive soil conditions'
    },

    // =========================================================================
    // TRENCH EXCAVATION
    // =========================================================================
    {
      description: 'Verify set-out of pipe alignment and invert levels from survey datum',
      acceptanceCriteria: 'Pipe centreline set out within +/-50 mm horizontal and invert levels within +/-10 mm of design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- Tolerances section; survey by licensed surveyor or competent person under direction'
    },
    {
      description: 'Inspect trench excavation for correct width, depth, side slope stability, and removal of unsuitable material',
      acceptanceCriteria: 'Trench width provides minimum clearance per AS/NZS 3725 (typically 300 mm each side of pipe); trench base free of rock, debris, and soft material; sides stable and supported where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.1 MRTS03 -- Trench to be excavated in accordance with approved construction procedures'
    },
    {
      description: 'Address groundwater/dewatering if encountered -- confirm dewatering system adequate and does not undermine trench stability',
      acceptanceCriteria: 'Trench base dry and stable at time of pipe laying; dewatering does not cause settlement of adjacent structures; discharge compliant with environmental approvals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.1 MRTS03 -- Dewatering to be addressed in construction procedures'
    },

    // =========================================================================
    // FOUNDATION & BEDDING
    // =========================================================================
    {
      description: 'Inspect foundation/trench base prior to bedding placement -- confirm no unsuitable material, correct level, and adequate bearing capacity',
      acceptanceCriteria: 'Foundation base firm and uniform; no soft spots, standing water, or organic material; level within +/-25 mm of design subgrade level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.1 MRTS03 -- Administrator to be notified 1 working day prior to inspection'
    },
    {
      description: 'Place and compact bedding material to specified depth and compaction standard',
      acceptanceCriteria: 'Bedding depth as specified on drawings (typically 100-150 mm); compacted to minimum 95% Standard Compaction (cohesive) or Density Index >= 65 (non-cohesive) per AS/NZS 3725; uniform support across full pipe width',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q142A (MDD), TMR Q141A/B (insitu density)',
      notes: 'Clause 12.3.2 MRTS03 -- Hold Point: bedding must be inspected and accepted before pipe placement. Compaction 95% for HS3, 90% for HS2 per AS/NZS 3725'
    },
    {
      description: 'Shape bedding cradle to provide uniform support under pipe barrel (not bell/socket)',
      acceptanceCriteria: 'Cradle shaped to provide contact over minimum 50% of pipe circumference (per support type); bell/socket holes excavated to prevent point loading; no hard spots or voids under pipe',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.2 MRTS03 -- Bedding must be shaped immediately before pipe laying to prevent disturbance'
    },

    // =========================================================================
    // PIPE LAYING & JOINTING
    // =========================================================================
    {
      description: 'Inspect pipe laying sequence -- confirm pipes laid to correct line and grade, with spigot end pointing downstream',
      acceptanceCriteria: 'Pipes laid from downstream to upstream (unless otherwise specified); spigot pointing downstream; invert level within +/-10 mm of design at each pipe joint; horizontal alignment within +/-50 mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- Administrator to be notified to witness pipe laying; 1 working day notice'
    },
    {
      description: 'Verify concrete pipe joints are properly assembled -- rubber ring seated, spigot fully home, joint gap uniform',
      acceptanceCriteria: 'Rubber ring correctly seated in groove without twisting or displacement; spigot pushed fully home (assembly mark aligned); joint gap uniform around circumference (+/-3 mm variation); no visible gap or misalignment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4.1 MRTS03 -- Concrete pipe jointing per AS 4058; use appropriate lubricant on rubber ring'
    },
    {
      description: 'Verify PVC pipe joints are properly assembled (if PVC pipes specified) -- solvent cement or rubber ring joints as designed',
      acceptanceCriteria: 'Joints assembled per AS/NZS 2032; solvent cement fully cured before backfilling; rubber ring joints pushed fully home; no visible gaps or angular deflection beyond manufacturer limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- PVC installation to comply with AS/NZS 2032'
    },
    {
      description: 'Check angular deflection at joints does not exceed manufacturer allowable limits',
      acceptanceCriteria: 'Angular deflection at each joint within manufacturer specified limits (typically max 1-2 degrees per joint for RCP; varies by pipe size and joint type)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'AS/NZS 3725 Clause 5 -- Maximum deflection must not cause joint leakage or structural distress'
    },
    {
      description: 'Verify pipe alignment (horizontal and vertical) does not exhibit noticeable irregularities; confirm positive drainage slope along entire length',
      acceptanceCriteria: 'No abrupt changes in alignment; horizontal alignment within +/-50 mm; vertical alignment (invert) within +/-10 mm of design grade; positive drainage slope maintained -- no flat spots or adverse falls',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- Culverts shall have a positive drainage slope along the whole of their length. Survey required.'
    },

    // =========================================================================
    // HAUNCH ZONE
    // =========================================================================
    {
      description: 'Place and compact haunch zone material symmetrically on both sides of pipe from bedding level to pipe springline',
      acceptanceCriteria: 'Haunch zone material placed in layers not exceeding 150 mm loose thickness; compacted to specified density (HS2: 90% Standard; HS3: 95% Standard); material placed evenly on both sides to prevent pipe displacement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q142A (MDD), TMR Q141A/B (insitu density)',
      notes: 'Clause 12.3.5 MRTS03 -- Critical zone for pipe structural performance. Hold Point: haunch compaction must be verified before proceeding to side zone. HS2 bedding factor = 2.5 (per TN187)'
    },
    {
      description: 'Verify haunch material is placed carefully to avoid pipe displacement -- hand-placed and compacted using light mechanical equipment only',
      acceptanceCriteria: 'No displacement of pipe from line or grade during haunch placement; compaction by hand tamper, vibrating plate, or light mechanical means only -- no heavy rollers within 300 mm of pipe',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.5 MRTS03 -- Care required to avoid disturbing pipe position per AS/NZS 3725'
    },

    // =========================================================================
    // SIDE ZONE & OVERLAY ZONE
    // =========================================================================
    {
      description: 'Place and compact side zone material from springline to top of pipe (overlay zone) in uniform layers',
      acceptanceCriteria: 'Side zone material placed in layers not exceeding 150 mm loose thickness; compacted to specified density (typically 95% Standard Compaction); overlay zone extends minimum 300 mm above pipe crown',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q142A (MDD), TMR Q141A/B (insitu density)',
      notes: 'Clause 12.3.5 MRTS03 -- Side and overlay zone compaction per AS/NZS 3725 support type requirements'
    },
    {
      description: 'Verify minimum cover above pipe crown is maintained before allowing construction traffic',
      acceptanceCriteria: 'Minimum 300 mm compacted cover above pipe crown (or as specified) before any construction traffic crosses trench; minimum 600 mm for heavy construction traffic unless protection measures in place',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.5 MRTS03 -- No construction traffic over pipes until minimum cover achieved. Hold Point.'
    },

    // =========================================================================
    // TRENCH BACKFILL
    // =========================================================================
    {
      description: 'Place and compact trench backfill above overlay zone in uniform layers to finished surface level',
      acceptanceCriteria: 'Backfill placed in layers not exceeding 200 mm compacted thickness (or 300 mm for cohesionless material); compaction to minimum 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); compaction testing at specified frequency',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q142A (MDD), TMR Q141A/B (insitu density), AS 1289.5.4.1',
      notes: 'Clause 12.3.5 MRTS03 / Clause 19 MRTS04 -- Backfill compaction requirements as per MRTS04 General Earthworks. Administrator to be given opportunity to witness.'
    },
    {
      description: 'Perform compaction testing of trench backfill at specified frequency and locations',
      acceptanceCriteria: 'Minimum 1 density test per drainage line per compacted layer (or per 50 lineal metres, whichever is more frequent); all results >= 95% Standard MDD; moisture content within OMC +0% to +3% range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD reference), AS 1289.2.1.1 (moisture)',
      notes: 'Testing frequency per MRTS04 and MRTS50 quality system requirements'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'Perform CCTV inspection of completed pipeline prior to acceptance',
      acceptanceCriteria: 'CCTV inspection conducted by qualified operator; continuous recording of entire pipeline; no structural defects (cracks, displaced joints, infiltration); joint gaps within tolerance; no debris or obstructions; pipe profile smooth and continuous',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV inspection per WSA 05 / council requirements',
      notes: 'MRTS03 -- CCTV required prior to on-maintenance acceptance. All pipework to be CCTV inspected. Report to be submitted to Administrator.'
    },
    {
      description: 'Perform mandrel testing of flexible pipes (PVC, HDPE) to verify pipe has not deflected beyond limits',
      acceptanceCriteria: 'Mandrel passes through full length of each pipe run without obstruction; mandrel diameter = 95% of internal pipe diameter (i.e., max 5% deflection); no blockages or restrictions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Mandrel test per AS/NZS 2032 or project specification',
      notes: 'Typically required for PVC/HDPE pipes only. Mandrel size to be approved by Administrator. Test after backfill compaction complete.'
    },
    {
      description: 'Perform water tightness/infiltration test if specified in contract',
      acceptanceCriteria: 'No visible leakage at joints under test conditions; infiltration rate not exceeding specified limit (typically 0.05 L/mm diameter/km/hour for gravity pipes); test duration minimum 30 minutes',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Water tightness test per AS/NZS 3725 Supplement 1 or project specification',
      notes: 'Not always required for stormwater drainage -- confirm with project specification. More common for sewer/pressure pipes.'
    },

    // =========================================================================
    // FINAL VERIFICATION
    // =========================================================================
    {
      description: 'Conduct as-built survey of completed pipeline -- inverts, obvert levels, pit locations, pipe sizes',
      acceptanceCriteria: 'As-built survey completed by licensed surveyor; invert levels within +/-10 mm of design; horizontal alignment within +/-50 mm; all pipe sizes, classes, and joint types recorded; survey certified and signed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- As-built survey required for all drainage works'
    },
    {
      description: 'Verify pipe connections to pits/chambers are properly made with flexible or rigid connectors as specified',
      acceptanceCriteria: 'Connections watertight; flexible connectors (if specified) installed with correct compression; no protrusion of pipe into pit obstructing flow; haunching around connection complete and stable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- Pipe-to-pit connections must be inspected before backfilling'
    },
    {
      description: 'Verify trench reinstatement/surface restoration is complete and compliant',
      acceptanceCriteria: 'Surface restoration to match surrounding surface level (+/-10 mm); no settlement or depressions; pavement reinstatement (if applicable) to relevant pavement specification; topsoil and seeding in unpaved areas',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reinstatement to comply with MRTS04 / pavement specifications as applicable'
    },
    {
      description: 'Verify end structures (headwalls, wingwalls, outlet protection) are constructed in accordance with drawings and MRTS03',
      acceptanceCriteria: 'End structures constructed to design dimensions; concrete grade and finish as specified; scour protection in place; no visible defects; connections to pipe watertight',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- End structures per MRTS03 and relevant standard drawings (SD1300 series)'
    },
    {
      description: 'Verify protection of completed pipeline from construction traffic damage until pavement/surface is constructed',
      acceptanceCriteria: 'Pipeline clearly marked on surface; adequate cover maintained; no heavy equipment operating within 1 m of pipeline without protection measures; no stockpiling directly above pipeline',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Contractor responsibility to protect completed work until final acceptance'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit conformance documentation package including all test results, CCTV reports, survey data, and material certificates',
      acceptanceCriteria: 'Complete documentation package submitted and accepted by Administrator; all hold points released; all test results conforming; CCTV report showing no defects; as-built survey certified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS50 -- Conformance package required before acceptance of drainage works'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD PITS & CHAMBERS (MRTS03/MRTS70)
// =============================================================================

const qldPitsChambersTemplate = {
  name: 'Drainage - Pits & Chambers (QLD)',
  description: 'TMR pit and chamber construction including precast and cast-in-situ options per MRTS03 (March 2025) and MRTS70 (July 2022). Covers foundation, formwork, concrete, connections, benching, and backfill.',
  activityType: 'drainage',
  specificationReference: 'TMR MRTS03 / MRTS70',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit construction procedures for pit and chamber construction including formwork, concrete, precast installation, and connection details',
      acceptanceCriteria: 'Procedures approved by Administrator; include formwork design, concrete placement method, curing regime, and quality control measures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 MRTS03 -- Construction procedures to be submitted and accepted before work commences'
    },
    {
      description: 'Submit concrete mix design for cast-in-situ pit/chamber construction (if applicable)',
      acceptanceCriteria: 'Mix design approved by Administrator per MRTS70; target strength >= specified f\'c (typically 32 MPa for drainage structures); slump within specified range; W/C ratio within limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'TMR Q458 (concrete trial mix)',
      notes: 'Clause 15.1 / 17.6.1 MRTS70 -- Hold Point 1: mix design approval before any concrete placement'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify precast pit/chamber components from TMR Registered Supplier (if precast)',
      acceptanceCriteria: 'Supplier holds current TMR Registration; components comply with MRTS03 and relevant AS standards; delivery dockets and quality certificates provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS24 Clause 4 -- Precast concrete products must be from Registered Suppliers'
    },
    {
      description: 'Inspect precast components on delivery for damage, dimensional compliance, and lifting point integrity',
      acceptanceCriteria: 'No visible cracks, chips, or spalling; dimensions within tolerance; lifting points intact and certified per AS 3850.3; step irons/ladders factory-installed where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Inspect 100% of precast components on delivery'
    },
    {
      description: 'Verify reinforcement steel, formwork materials, and concrete constituents for cast-in-situ construction',
      acceptanceCriteria: 'Reinforcement compliant with AS/NZS 4671; mill certificates provided; formwork materials adequate for class of finish required; concrete materials per approved mix design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6 MRTS70 / MRTS59 -- Material compliance before use'
    },

    // =========================================================================
    // FOUNDATION & EXCAVATION
    // =========================================================================
    {
      description: 'Inspect pit/chamber excavation for correct dimensions, depth, and founding conditions',
      acceptanceCriteria: 'Excavation dimensions match design with adequate working space; founding level firm and stable; no soft spots or standing water; no undermining of adjacent structures',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Administrator to be given opportunity to inspect excavation'
    },
    {
      description: 'Place and compact foundation bedding for pit/chamber base',
      acceptanceCriteria: 'Bedding material placed to specified depth (typically 150 mm minimum); compacted to 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); level within +/-10 mm; smooth surface free from irregularities',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD)',
      notes: 'Clause 18 MRTS03 -- Foundation bedding shall be compacted to not less than 95% Standard Compaction. Hold Point before placement of structure.'
    },

    // =========================================================================
    // CONSTRUCTION -- PRECAST PITS
    // =========================================================================
    {
      description: 'Set precast base/well sections on prepared bedding -- verify level, plumb, and orientation',
      acceptanceCriteria: 'Base section level within +/-5 mm; plumb within H/200; orientation correct for pipe connections; seating even on bedding -- no rocking',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18.2 MRTS03 -- Administrator notified to witness placement of precast sections'
    },
    {
      description: 'Verify jointing between precast sections -- mortar or sealant applied as specified',
      acceptanceCriteria: 'Joint material applied to full contact surface; mortar joints minimum 10 mm thick, tooled smooth; rubber gasket joints compressed per manufacturer specification; no voids or gaps visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18.2 MRTS03 -- Joint treatment per MRTS03 and manufacturer requirements'
    },

    // =========================================================================
    // CONSTRUCTION -- CAST-IN-SITU PITS
    // =========================================================================
    {
      description: 'Inspect formwork prior to concrete placement -- dimensions, bracing, cleanliness, release agent',
      acceptanceCriteria: 'Formwork dimensions match drawings +/-5 mm; formwork rigid, braced, and watertight; clean and release agent applied; blockouts for pipe connections correctly positioned',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 11.3 / 17.2 MRTS70 -- Hold Point 12 MRTS70: formwork and reinforcement inspection before concrete placement'
    },
    {
      description: 'Inspect reinforcement fixing prior to concrete placement -- bar size, spacing, cover, laps, and tie wire',
      acceptanceCriteria: 'Bar sizes and spacing per drawings; cover spacers in place providing minimum specified cover (typically 40-50 mm for drainage structures); lap lengths per AS 3600; all intersections tied; no displaced or missing bars',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 11.3 / 17.2 MRTS70 -- Hold Point: reinforcement must be inspected and approved by Administrator before concrete pour'
    },
    {
      description: 'Place concrete in pit/chamber walls and base -- monitor slump, placement method, and vibration',
      acceptanceCriteria: 'Concrete slump within approved range (+/-15 mm of nominated slump per MRTS70); concrete vibrated to full compaction; no honeycombing or cold joints; concrete placed within allowable time from batching (typically 90 min)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (slump), AS 1012.9 (compressive strength cylinders)',
      notes: 'Clause 17.7 / 17.8 MRTS70 -- Administrator notified 24 hours prior to concrete placement'
    },
    {
      description: 'Cast and cure test cylinders from concrete used in pit/chamber construction',
      acceptanceCriteria: 'Minimum 1 set of 3 cylinders per pour (or per 50 m3); cylinders made per AS 1012.8.1; cured at 23+/-2 degC; 28-day compressive strength >= f\'c characteristic strength',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8.1 (making cylinders), AS 1012.9 (compressive strength)',
      notes: 'Clause 12 MRTS70 -- Strength acceptance per MRTS70 statistical criteria'
    },
    {
      description: 'Cure concrete in accordance with specification requirements',
      acceptanceCriteria: 'Concrete kept moist for minimum 7 days (or equivalent curing compound applied immediately after finishing); no visible drying or surface dusting during curing period',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13 MRTS70 -- Curing per MRTS70 requirements'
    },

    // =========================================================================
    // COVER SLABS & GRATES
    // =========================================================================
    {
      description: 'Install cover slabs (precast or cast-in-situ) -- verify level flush with surrounding surface',
      acceptanceCriteria: 'Cover slab seated firmly on pit walls; mortar bed even; top surface flush with surrounding pavement/kerb within +/-5 mm; no rocking; load rating matches design (Class D for road, Class C for footpath)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Cover slab level critical for traffic safety'
    },
    {
      description: 'Install grates (where specified) -- verify correct grate type, orientation, and secure fixing',
      acceptanceCriteria: 'Grate type, size, and load class as per drawings; orientation correct (bars perpendicular to traffic flow for bicycle safety where required); grate seated firmly; locking mechanism engaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Standard drawing reference SD1307 series -- Grate installation per TMR standard drawings'
    },

    // =========================================================================
    // PIPE CONNECTIONS
    // =========================================================================
    {
      description: 'Verify pipe connections through pit walls -- correct invert levels, proper sealing, no protrusion obstructing flow',
      acceptanceCriteria: 'Pipe inverts at correct level per design (+/-10 mm); flexible connector or mortar seal watertight; pipe not protruding into pit more than 25 mm (or flush as specified); benching directs flow smoothly through pit',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Hold Point: pipe connections must be inspected before backfilling around pit'
    },
    {
      description: 'Construct internal benching/channelling to direct flow through pit',
      acceptanceCriteria: 'Benching smooth and uniform; channel shape matches pipe diameter; benching slopes at minimum 1:10 (10%) toward channel; surface finished smooth with steel trowel; concrete grade as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Benching to provide smooth hydraulic transition'
    },

    // =========================================================================
    // STEP IRONS & SAFETY
    // =========================================================================
    {
      description: 'Install step irons (where specified) at correct spacing and alignment',
      acceptanceCriteria: 'Step irons installed at uniform vertical spacing (typically 300 mm centres); alternating left/right pattern; securely fixed (grouted or cast-in); step irons corrosion resistant (galvanised or polypropylene coated); protruding minimum 100 mm from wall face',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 / TMR standard drawing SD1307 series -- Step irons for chambers >= 1.2 m deep'
    },

    // =========================================================================
    // BACKFILL & COMPLETION
    // =========================================================================
    {
      description: 'Backfill around pit/chamber in uniform layers with approved material',
      acceptanceCriteria: 'Backfill placed in layers not exceeding 200 mm compacted thickness; compacted to 95% Standard MDD; material placed evenly around structure to prevent lateral displacement; no heavy equipment operating within 1 m of structure during backfill',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD)',
      notes: 'Clause 18 MRTS03 / Clause 19 MRTS04 -- Backfill compaction per MRTS04 requirements'
    },
    {
      description: 'Perform formwork stripping at appropriate time (cast-in-situ pits)',
      acceptanceCriteria: 'Formwork not stripped until concrete achieves minimum strength (typically >= 40% f\'c or 24 hours, whichever is later); surfaces inspected immediately after stripping for defects; any honeycombing or defects repaired per MRTS70',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13.3 / 17.18 MRTS70 -- Hold Point on stripping load-bearing formwork; witness point for side forms'
    },

    // =========================================================================
    // FINAL VERIFICATION
    // =========================================================================
    {
      description: 'Conduct as-built survey of completed pits/chambers',
      acceptanceCriteria: 'Survey confirms pit locations, invert levels, lid levels, and connection details match design (within tolerances); survey certified by licensed surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- As-built records required for all drainage structures'
    },
    {
      description: 'Visual inspection of completed pit/chamber interior -- cleanliness, finish, structural integrity',
      acceptanceCriteria: 'Interior clean and free of debris; no visible cracks, honeycombing, or structural defects; joints sealed; step irons secure; benching smooth; no standing water (drains freely)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Final inspection before acceptance'
    },
    {
      description: 'Verify pit identification marking as required (pit number, invert levels on lid)',
      acceptanceCriteria: 'Pit identification marked as per project requirements; lid type and load rating visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Project-specific requirement -- confirm marking standard with Administrator'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit conformance documentation package for pit/chamber construction',
      acceptanceCriteria: 'Complete package including: concrete test results, material certificates, formwork inspection records, reinforcement inspection records, as-built survey, photographs, and conformance statement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS50 -- Documentation required for final acceptance'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD BOX CULVERTS (MRTS03/MRTS24/MRTS70)
// =============================================================================

const qldBoxCulvertsTemplate = {
  name: 'Drainage - Box Culverts (QLD)',
  description: 'TMR box culvert construction including precast RCBC and cast-in-situ options per MRTS03 (March 2025), MRTS24 (July 2025), and MRTS70 (July 2022). Covers foundation, placement, jointing, waterproofing, backfill, and post-construction verification.',
  activityType: 'drainage',
  specificationReference: 'TMR MRTS03 / MRTS24 / MRTS70',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & PLANNING
    // =========================================================================
    {
      description: 'Submit Box Culvert Construction Procedures including foundation preparation, placement/casting sequence, jointing method, backfill methodology, and waterproofing plan',
      acceptanceCriteria: 'Procedures approved by Administrator; includes lifting plan for precast units, crane capacity verification, and traffic management during installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 MRTS03 / MRTS50 -- No box culvert works to commence until procedures accepted'
    },
    {
      description: 'Submit ITP for box culvert works covering all hold points, witness points, test methods, and frequencies',
      acceptanceCriteria: 'ITP accepted by Administrator; aligned with MRTS50; covers foundation, placement, jointing, backfill, and waterproofing phases',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.1 MRTS50 -- Separate ITP required for structures'
    },
    {
      description: 'Submit concrete mix design for cast-in-situ box culvert construction (if applicable)',
      acceptanceCriteria: 'Mix design approved per MRTS70; target strength >= specified f\'c (typically 40 MPa for box culverts); W/C ratio, cement content, and admixtures within specification limits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'TMR Q458',
      notes: 'Clause 15.1 / 17.6.1 MRTS70 -- Hold Point: concrete mix approval required before placement'
    },
    {
      description: 'Submit design drawings and calculations (if design-and-construct) or confirm shop drawings match design intent',
      acceptanceCriteria: 'Drawings reviewed and accepted by Administrator; structural adequacy confirmed; dimensions, reinforcement, joint details, and waterproofing specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Submit minimum 28 days prior to construction; RPEQ certification required for design-and-construct'
    },

    // =========================================================================
    // MATERIAL VERIFICATION -- PRECAST
    // =========================================================================
    {
      description: 'Verify precast box culvert units supplied by TMR Registered Supplier',
      acceptanceCriteria: 'Supplier holds current TMR Registration Certificate for precast concrete box culverts per MRTS24; manufacturing QA records available on request',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS24 Clause 4 -- Precast concrete culvert components shall be manufactured only by a Registered Supplier'
    },
    {
      description: 'Inspect precast box culvert units on delivery -- dimensional check, surface condition, lifting points',
      acceptanceCriteria: 'Internal dimensions not less than 95% of nominal dimensions specified on drawings; no visible cracks, chips, or structural damage; lifting points certified per AS 3850.3; units clearly marked with batch/date',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS24 Hold Point 1 -- Internal dimensions and effective cross-sectional waterway area verification'
    },
    {
      description: 'Verify concrete strength of precast units meets specification via manufacturer test certificates',
      acceptanceCriteria: '28-day compressive strength certificates confirm f\'c >= specified characteristic strength (typically 40-50 MPa); no individual result < 0.85 f\'c',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012.9 (compressive strength -- manufacturer records)',
      notes: 'MRTS24 / MRTS70 -- Manufacturer responsible for strength compliance; certificates required per unit'
    },
    {
      description: 'Verify joint sealing materials -- mortar, grout, gaskets, and sealant comply with specifications',
      acceptanceCriteria: 'Cementitious grout for staple joints >= 50 MPa at 28 days; rubber gaskets to manufacturer specification; sealant compatible with concrete surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS24 -- Staple joint grout must achieve minimum 50 MPa'
    },

    // =========================================================================
    // MATERIAL VERIFICATION -- CAST-IN-SITU
    // =========================================================================
    {
      description: 'Verify reinforcement steel for cast-in-situ box culvert -- bar scheduling, quantity, grade',
      acceptanceCriteria: 'Reinforcement compliant with AS/NZS 4671; mill certificates for each batch; bar sizes and quantities match bar schedule; bars free from excessive rust, oil, or contaminants',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS59 / MRTS71 -- Material compliance before use'
    },
    {
      description: 'Verify formwork system for cast-in-situ box culvert construction',
      acceptanceCriteria: 'Formwork design adequate for concrete loads (check against AS 3610); formwork clean, dimensionally accurate, and watertight; release agent applied; sufficient bracing and support',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 11 MRTS70 -- Formwork per AS 3610 and MRTS70'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Strip and prepare culvert foundation -- remove unsuitable material, confirm natural ground bearing capacity',
      acceptanceCriteria: 'Foundation excavated to design level; all topsoil, organic material, and soft ground removed; founding material has adequate bearing capacity; no standing water',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.1 MRTS03 -- Administrator notified to inspect foundation excavation; 3 working days notice'
    },
    {
      description: 'Inspect foundation excavation at design level -- verify soil conditions match geotechnical report',
      acceptanceCriteria: 'Foundation soil conditions consistent with geotechnical investigation; no unexpected soft zones, voids, or groundwater; founding level as per design; any variations reported to Administrator for direction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13.3.4.1 MRTS04 -- Hold Point: No culvert foundation to be covered until Administrator inspects and accepts (3 days notice)'
    },
    {
      description: 'Place and compact foundation bedding to design level and grade',
      acceptanceCriteria: 'Bedding material placed to specified depth (typically 150-200 mm); compacted to 95% Standard MDD (cohesive) or Density Index >= 65 (non-cohesive); level within +/-10 mm; surface smooth and provides continuous even support',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD)',
      notes: 'Clause 12.3.2 MRTS03 / Clause 18 -- Foundation bedding is a Hold Point. Bedding tolerance +/-10 mm level, +/-50 mm line.'
    },
    {
      description: 'Construct concrete blinding/levelling pad if specified on drawings',
      acceptanceCriteria: 'Blinding concrete placed to correct thickness and level; concrete grade as specified (typically 20 MPa lean mix); surface finished level +/-5 mm; cured adequately before culvert placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Blinding not always required -- check drawings. If specified, must be cured before placing culvert units.'
    },

    // =========================================================================
    // PRECAST BOX CULVERT PLACEMENT
    // =========================================================================
    {
      description: 'Verify crane capacity and lifting plan for precast unit placement',
      acceptanceCriteria: 'Crane capacity verified for maximum unit weight at maximum radius; lifting plan approved; lifting points on culvert units inspected before each lift; tag lines and safety exclusion zone established',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 3850.3 -- Lifting design for precast elements; crane to have current certification'
    },
    {
      description: 'Place first precast box culvert unit -- verify alignment, level, and orientation',
      acceptanceCriteria: 'Unit placed on prepared bedding without damage; unit level within +/-5 mm (transverse) and +/-10 mm (longitudinal); aligned to survey marks; orientation correct (flow direction)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- Hold Point: first unit placement; Administrator inspection required before continuing'
    },
    {
      description: 'Place subsequent precast units -- verify joint alignment and culvert continuity',
      acceptanceCriteria: 'Units placed in sequence from downstream to upstream (unless otherwise directed); joint faces clean and aligned; horizontal and vertical alignment within tolerances per MRTS03; positive drainage slope maintained throughout',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- Culverts shall have positive drainage slope along whole length'
    },
    {
      description: 'Verify overall culvert alignment (horizontal and vertical) after all units placed',
      acceptanceCriteria: 'Horizontal alignment within +/-50 mm; vertical (invert) alignment within +/-10 mm at each joint; no abrupt changes in alignment; internal waterway profile smooth and continuous',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- Hold Point: alignment survey before jointing is completed'
    },

    // =========================================================================
    // JOINTING
    // =========================================================================
    {
      description: 'Construct staple joints between precast box culvert units',
      acceptanceCriteria: 'Galvanised bar anchors placed in aligned preformed recesses; bar anchors grouted with approved cementitious grout (>= 50 MPa at 28 days); mortar seatings for link slabs placed; four bar anchors per 1.2 m slab section',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS24 -- Staple joints with galvanised bars and cementitious grout; link slabs simply supported on mortar seatings'
    },
    {
      description: 'Seal joints between culvert units -- apply external joint sealant/waterproof membrane if specified',
      acceptanceCriteria: 'Joint sealant or membrane applied per manufacturer instructions; full coverage across joint width; no gaps, bubbles, or disbonded areas; sealant compatible with concrete and groundwater conditions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 12.3.4 MRTS03 -- External joint treatment to prevent water ingress; check project specification for membrane requirements'
    },
    {
      description: 'Verify internal joint finish -- no protrusions or steps that could obstruct flow or catch debris',
      acceptanceCriteria: 'Internal joint faces flush within 5 mm step; no mortar or sealant protruding into waterway; internal surface smooth and continuous',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Internal joint quality affects hydraulic performance and maintenance access'
    },

    // =========================================================================
    // CAST-IN-SITU BOX CULVERT CONSTRUCTION
    // =========================================================================
    {
      description: 'Inspect base slab formwork and reinforcement prior to base concrete pour',
      acceptanceCriteria: 'Formwork level, dimensionally accurate, and watertight; reinforcement per drawings -- bar size, spacing, cover, and laps correct; cover spacers at maximum 1.0 m centres; starter bars for walls correctly positioned; waterstops installed at construction joints',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 11.3 / 17.2 MRTS70 -- Hold Point: formwork and reinforcement inspection before concrete'
    },
    {
      description: 'Place and finish base slab concrete',
      acceptanceCriteria: 'Concrete slump within approved range; concrete vibrated to full compaction; surface finished to specified level (+/-5 mm); no honeycombing or cold joints; construction joint treatment prepared for wall pour; curing commenced immediately',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (slump), AS 1012.8.1/9 (strength cylinders)',
      notes: 'Clause 17.7 MRTS70 -- Witness Point: 24 hours notice for major pours'
    },
    {
      description: 'Inspect wall and soffit formwork and reinforcement prior to wall/roof pour',
      acceptanceCriteria: 'All formwork dimensionally accurate, braced, and clean; reinforcement per drawings; cover correct; waterstops at construction joints; haunch/chamfer formwork in place; blockouts for pipes in correct positions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 11.3 / 17.2 MRTS70 -- Hold Point: formwork and reo inspection for each pour stage'
    },
    {
      description: 'Place wall and roof slab concrete',
      acceptanceCriteria: 'Concrete placed in continuous operation; slump within range; vibrated to full compaction; no cold joints; roof slab finished to correct level and crossfall; curing commenced immediately',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (slump), AS 1012.8.1/9 (strength cylinders)',
      notes: 'Clause 17.7 MRTS70 -- Witness Point: 24 hours notice'
    },
    {
      description: 'Strip formwork at appropriate time',
      acceptanceCriteria: 'Formwork not stripped until concrete achieves minimum strength (typically >= 40% f\'c for non-load-bearing forms, >= 75% f\'c for load-bearing soffits); surfaces inspected for defects; any honeycombing repaired per MRTS70',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (early age strength from site-cured cylinders)',
      notes: 'Clause 13.3 / 17.18 MRTS70 -- Hold Point: structural formwork stripping requires strength confirmation'
    },

    // =========================================================================
    // WATERPROOFING
    // =========================================================================
    {
      description: 'Apply waterproofing membrane to external surfaces if specified on drawings',
      acceptanceCriteria: 'Membrane applied to clean, dry concrete surface; full coverage with correct overlap at joints and edges; membrane type and application per manufacturer specification; no punctures, tears, or disbonded areas',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Project-specific requirement -- check drawings for waterproofing extent and type'
    },
    {
      description: 'Install protection board over waterproofing membrane before backfilling',
      acceptanceCriteria: 'Protection board installed full height of waterproofed surface; no exposed membrane areas; board securely held in place until backfill placed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Protection board prevents backfill from damaging waterproofing membrane'
    },

    // =========================================================================
    // END STRUCTURES
    // =========================================================================
    {
      description: 'Construct headwalls, wingwalls, and apron slabs per drawings and MRTS03',
      acceptanceCriteria: 'End structures constructed to design dimensions; concrete grade as specified; reinforcement per drawings; scour protection and energy dissipation measures in place; transitions to embankment smooth',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- End structures per MRTS03 and TMR standard drawings (SD1300 series)'
    },
    {
      description: 'Install scour protection (rock, concrete, or geotextile) at inlet and outlet as specified',
      acceptanceCriteria: 'Scour protection type, extent, and thickness per drawings; rock size and grading per specification; geotextile underlayer installed (if specified); extends to design limits upstream and downstream',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 18 MRTS03 -- Scour protection critical for culvert longevity'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Place and compact structural backfill around and over box culvert in uniform layers',
      acceptanceCriteria: 'Backfill placed symmetrically on both sides to prevent lateral displacement; layers not exceeding 200 mm compacted thickness; compacted to 95% Standard MDD; no heavy rollers within 1.0 m of culvert walls until cover >= 600 mm',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD)',
      notes: 'Clause 12.3.5 MRTS03 / Clause 19 MRTS04 -- Hold Point: backfill compaction around structures. Symmetrical placement essential.'
    },
    {
      description: 'Verify minimum cover over culvert before allowing construction traffic',
      acceptanceCriteria: 'Minimum cover as specified on drawings (typically 600 mm minimum, or greater for heavy construction traffic); compaction confirmed by testing; surface level recorded',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B',
      notes: 'Clause 12.3.5 MRTS03 -- Hold Point: no construction traffic until minimum cover achieved and compacted'
    },
    {
      description: 'Complete embankment fill over culvert to subgrade level',
      acceptanceCriteria: 'Fill placed in layers per MRTS04; compaction to 95% Standard MDD (general fill) or 97% MDD (subgrade zone); no differential settlement; level surveys confirm design profile',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B, TMR Q142A, AS 1289.5.4.1',
      notes: 'Clause 15 MRTS04 -- Embankment fill compaction per MRTS04 General Earthworks'
    },

    // =========================================================================
    // POST-CONSTRUCTION VERIFICATION
    // =========================================================================
    {
      description: 'Conduct internal inspection of completed box culvert -- cleanliness, alignment, joint integrity',
      acceptanceCriteria: 'Interior clean and free of debris; no visible cracks wider than 0.2 mm; joints sealed and watertight; no evidence of ground water infiltration; alignment smooth and continuous; invert clean and free-draining',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Walk-through inspection for culverts large enough to enter safely; CCTV for smaller culverts'
    },
    {
      description: 'Conduct CCTV inspection if culvert size precludes safe personnel entry',
      acceptanceCriteria: 'Continuous CCTV recording of entire culvert length; no structural defects; joints intact; no infiltration; clear waterway maintained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV inspection per WSA 05 or project specification',
      notes: 'Required for culverts where personnel entry is not safe; recording submitted to Administrator'
    },
    {
      description: 'Conduct as-built survey of completed box culvert installation',
      acceptanceCriteria: 'Survey confirms: invert levels +/-10 mm, horizontal alignment +/-50 mm, internal dimensions >= 95% of nominal, cover depth matches design; survey certified by licensed surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- As-built survey required; MRTS24 requires effective waterway area >= 95% of nominal'
    },
    {
      description: 'Verify culvert hydraulic performance -- confirm no ponding at inlet, free flow through culvert',
      acceptanceCriteria: 'Water drains freely through culvert under normal conditions; no ponding at inlet beyond design tailwater; no scour or erosion visible at outlet; no debris accumulation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Visual check during first rainfall event if possible; otherwise verify by grade and alignment survey'
    },

    // =========================================================================
    // CONCRETE TESTING & QUALITY RECORDS
    // =========================================================================
    {
      description: 'Verify all concrete test results (28-day cylinders) meet specification requirements',
      acceptanceCriteria: 'All cylinder strengths >= f\'c characteristic strength; no individual result < 0.85 f\'c (or per MRTS70 statistical criteria); mean strength per lot >= target strength',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Clause 12 MRTS70 -- Results must be reviewed and accepted before final acceptance of structure'
    },
    {
      description: 'Verify all compaction test results for foundation, bedding, and backfill',
      acceptanceCriteria: 'All density test results >= specified minimum (95% Std MDD for general, 97% for subgrade zone); no individual test below 93% Std MDD; moisture content within specified range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B, TMR Q142A',
      notes: 'Compile all compaction results for conformance report'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit complete conformance documentation package for box culvert construction',
      acceptanceCriteria: 'Package includes: concrete test results, compaction test results, material certificates (precast or reinforcement), formwork inspection records, reinforcement inspection records, waterproofing records, as-built survey, CCTV report, photographs, and conformance statement signed by Contractor\'s representative',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS50 -- Complete documentation package required before final acceptance'
    },
    {
      description: 'Submit maintenance requirements and access provisions for completed culvert',
      acceptanceCriteria: 'Maintenance access points identified; debris management plan if applicable; safety requirements for personnel entry documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically required for culverts with maintenance access chambers'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD SUBSOIL DRAINS (MRTS03)
// =============================================================================

const qldSubsoilDrainsTemplate = {
  name: 'Drainage - Subsoil/Subsurface Drainage (QLD)',
  description: 'TMR subsoil and subsurface drainage installation per MRTS03 (March 2025), Clauses 27-29. Covers trench excavation, geotextile wrapping, filter aggregate, pipe laying, outlet connections, and functional testing.',
  activityType: 'drainage',
  specificationReference: 'TMR MRTS03 (Clauses 27-29)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit construction procedures for subsoil drainage installation including trench excavation, filter material placement, pipe grade control, and geotextile wrapping methodology',
      acceptanceCriteria: 'Procedures approved by Administrator; include equipment, material handling, and quality control measures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 MRTS03 / MRTS50 -- Procedures to be accepted before commencing subsoil drainage works'
    },
    {
      description: 'Submit ITP for subsoil drainage works',
      acceptanceCriteria: 'ITP accepted by Administrator; covers material verification, trench excavation, pipe laying, filter placement, geotextile wrapping, and outlet connections',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.1 MRTS50 -- ITP required for drainage works'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify subsoil drainage pipe material, size, and perforation pattern comply with specification',
      acceptanceCriteria: 'Pipe type as specified (typically slotted PVC, corrugated polyethylene, or ag pipe); diameter as per drawings; perforations/slots in correct pattern; material certificates provided; pipe undamaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 27.2.1 MRTS03 -- Drainage pipe material and type per specification'
    },
    {
      description: 'Verify filter/drainage aggregate material complies with grading requirements',
      acceptanceCriteria: 'Filter material grading within specified envelope (per MRTS03 or project specification); free from fines, clay, organic material; typically single-sized gravel or crushed rock; particle size distribution tested',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1 (particle size distribution)',
      notes: 'Clause 27.2.4 MRTS03 -- Filter aggregate must be tested and approved before use. Hold Point for material compliance.'
    },
    {
      description: 'Verify geotextile material complies with specification (if geotextile-wrapped drain specified)',
      acceptanceCriteria: 'Geotextile type, grade, and properties per specification (typically nonwoven, grab tensile strength, apparent opening size, and permittivity within specified ranges); manufacturer test certificates provided; material undamaged and within shelf life',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 27.2.3 MRTS03 -- Geotextile to comply with MRTS03 requirements and manufacturer specification'
    },
    {
      description: 'Verify strip filter drain material if used in lieu of or supplementary to aggregate filter',
      acceptanceCriteria: 'Strip filter drain material type and grade as specified; manufacturer certificates provided; drainage capacity meets design requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 27.2.2 MRTS03 -- Strip filter drains as alternative to granular filter'
    },

    // =========================================================================
    // TRENCH EXCAVATION
    // =========================================================================
    {
      description: 'Set out trench alignment from survey datum -- confirm line, grade, and outlet location',
      acceptanceCriteria: 'Trench centreline set out from design alignment; invert grade confirmed; outlet location and connection point identified; minimum cover to subgrade surface maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Set-out by survey'
    },
    {
      description: 'Excavate trench to specified width and depth -- maintain grade and side stability',
      acceptanceCriteria: 'Trench width as specified (typically 300-450 mm for standard subsoil drain); depth provides correct pipe invert level with positive grade to outlet; trench base firm and even; sides stable; no slumping or caving',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Administrator may witness trench excavation; typically notified 1 working day prior'
    },
    {
      description: 'Confirm trench invert grade provides continuous positive fall to outlet -- no flat spots or adverse grades',
      acceptanceCriteria: 'Minimum grade as specified on drawings (typically >= 0.5% or 1:200 minimum); verified by level survey or laser grade; no ponding points; grade confirmed at maximum 10 m intervals',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Hold Point: pipe grade verification before pipe placement. Correct grade is critical for subsoil drain function.'
    },

    // =========================================================================
    // GEOTEXTILE & FILTER PLACEMENT
    // =========================================================================
    {
      description: 'Install geotextile lining in trench (if geotextile-wrapped drain specified) before placing pipe and aggregate',
      acceptanceCriteria: 'Geotextile placed with sufficient width to wrap around aggregate envelope with minimum 300 mm overlap at top; no tears, holes, or contamination; geotextile held against trench sides during placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27.2.3 MRTS03 -- Geotextile overlap at top must be secured before backfilling'
    },
    {
      description: 'Place initial layer of filter aggregate in trench bottom before pipe placement',
      acceptanceCriteria: 'Minimum 50-75 mm depth of filter aggregate placed on geotextile (or trench base if no geotextile); aggregate graded to specification; provides even support for pipe',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Aggregate bedding under pipe for uniform support'
    },

    // =========================================================================
    // PIPE INSTALLATION
    // =========================================================================
    {
      description: 'Lay subsoil drainage pipe on aggregate bedding to correct alignment and grade',
      acceptanceCriteria: 'Pipe laid to grade with perforations/slots facing down (unless otherwise specified); joints properly connected (push-fit or manufacturer connection); no kinks, bends beyond minimum radius, or damage; pipe supported continuously on aggregate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Witness Point: Administrator may inspect pipe laying and grade'
    },
    {
      description: 'Place remaining filter aggregate around and over pipe to specified depth',
      acceptanceCriteria: 'Aggregate placed to surround pipe with minimum 75 mm on sides and 150 mm above pipe crown (or as specified); aggregate carefully placed to avoid displacing pipe; no voids or bridging',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Aggregate envelope must provide full surround drainage'
    },
    {
      description: 'Fold geotextile over aggregate envelope and secure overlap (if geotextile-wrapped drain)',
      acceptanceCriteria: 'Geotextile folded over with minimum 300 mm overlap (or as specified); overlap facing upstream/uphill to prevent soil migration into overlap; geotextile in full contact with aggregate; no tears or gaps',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27.2.3 MRTS03 -- Overlap direction critical to prevent soil intrusion'
    },

    // =========================================================================
    // OUTLET CONNECTIONS
    // =========================================================================
    {
      description: 'Construct outlet connection from subsoil drain to stormwater pit, open drain, or daylight outlet',
      acceptanceCriteria: 'Outlet connection complete and watertight; invert level correct to allow free drainage; flap valve or vermin screen installed (if specified); outlet protected from erosion and damage; no backflow path from stormwater system into subsoil drain',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 27 MRTS03 -- Hold Point: outlet connection must be inspected and approved. Critical for drain function.'
    },

    // =========================================================================
    // BACKFILL & COMPLETION
    // =========================================================================
    {
      description: 'Backfill trench above filter envelope with approved material',
      acceptanceCriteria: 'Backfill material as specified (may be selected fill or site-won material); placed in layers; compacted to 95% Standard MDD (cohesive) or specified density; no damage to geotextile or pipe during compaction; compaction equipment appropriate for trench width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q141A/B (insitu density), TMR Q142A (MDD)',
      notes: 'Clause 27 MRTS03 / Clause 19 MRTS04 -- Backfill compaction per MRTS04'
    },

    // =========================================================================
    // FINAL VERIFICATION
    // =========================================================================
    {
      description: 'Conduct functional test of completed subsoil drain -- verify water flows freely to outlet',
      acceptanceCriteria: 'Water introduced at upstream end of drain discharges at outlet within reasonable time; flow rate consistent with drain capacity; no ponding or blockages; outlet functioning correctly',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Simple functional flow test to confirm drain operates as designed'
    },
    {
      description: 'Conduct as-built survey of subsoil drain alignment, grades, and outlet locations',
      acceptanceCriteria: 'Survey confirms pipe alignment, invert levels, aggregate envelope extents, and outlet location match design; survey certified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 54 MRTS03 -- As-built records for subsoil drainage'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Submit conformance documentation package for subsoil drainage works',
      acceptanceCriteria: 'Package includes: material test certificates (aggregate grading, geotextile properties), pipe certificates, compaction test results, as-built survey, photographs, and conformance statement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS50 -- Documentation package for acceptance'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
    }
  ]
}

// =============================================================================
// QLD KERB & CHANNEL (MRTS03/MRTS70)
// =============================================================================

const qldKerbChannelTemplate = {
  name: 'Drainage - Kerb & Channel (QLD)',
  description: 'TMR kerb and channel construction (cast-in-place concrete) per MRTS03 Sections 20-21 (March 2025) and MRTS70 (July 2022). Covers subgrade preparation, formwork/slipform, concrete placement, joints, finishing, curing, and testing. Profiles per TMR SD1033.',
  activityType: 'drainage',
  specificationReference: 'TMR MRTS03 (Sections 20-21) / MRTS70 / SD1033',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & PLANNING
    // =========================================================================
    {
      description: 'Review Drawings, standard drawings (SD1033 Kerb and Channel Profiles), and specification requirements for kerb type, alignment, and levels',
      acceptanceCriteria: 'Kerb type (barrier, semi-mountable, mountable, Type 1-11 per SD1033) confirmed; alignment and levels consistent with Drawings and road design; transitions comply with SD1033 (min 1.5 m transition length)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 20.1 MRTS03 / SD1033 -- Kerb types and profiles per TMR Standard Drawing SD1033. July 2020 amendment corrected Type 6/7 dimension and Type 10/11 radius.'
    },
    {
      description: 'Submit construction procedure for cast-in-place kerb and channel including concrete mix, placement method, and curing regime',
      acceptanceCriteria: 'Procedure submitted and accepted; concrete mix design compliant with MRTS70; placement method (slipform or fixed-form) specified; curing method and duration documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 20 MRTS03 / MRTS70 -- Construction procedure to address materials, method, and quality control.'
    },
    {
      description: 'Verify concrete mix design complies with MRTS70 for kerb and channel application',
      acceptanceCriteria: 'Concrete grade minimum N25 (or as specified); maximum aggregate size 20 mm (or as specified for slipform); slump within specified range; mix design certificate and trial mix results provided',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete mix design verification per MRTS70 / AS 1379',
      notes: 'Section 20.2 MRTS03 / MRTS70 -- Concrete materials and mix design must comply with MRTS70 Concrete.'
    },

    // =========================================================================
    // SUBGRADE & SET-OUT
    // =========================================================================
    {
      description: 'Prepare subgrade/foundation for kerb and channel placement',
      acceptanceCriteria: 'Subgrade trimmed to design levels +/-20 mm; surface compacted and stable; soft spots identified and treated; free of organic material, mud, and standing water; subgrade moistened before concrete placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Subgrade preparation requirements. Subgrade must support kerb without settlement.'
    },
    {
      description: 'Set out alignment and levels for kerb and channel with survey control',
      acceptanceCriteria: 'Alignment set out per design plan; levels confirmed at 5 m intervals (or closer on curves); string lines or formwork set to correct line and grade; transitions between kerb types per SD1033',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 20.3 MRTS03 / MRTS56 Construction Surveying -- Survey tolerances apply.'
    },

    // =========================================================================
    // FORMWORK / SLIPFORM SETUP
    // =========================================================================
    {
      description: 'Install formwork (fixed-form method) or verify slipform machine setup and calibration',
      acceptanceCriteria: 'Fixed forms: rigidly supported, clean, oiled, set to correct line/grade/cross-section; joints tight. Slipform: machine calibrated to correct profile, speed, and vibration settings; trial section completed where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Formwork or slipform setup verified before concrete placement.'
    },
    {
      description: 'Verify reinforcement placement where specified (dowels at structures, mesh in kerb returns, etc.)',
      acceptanceCriteria: 'Reinforcement type, size, spacing, and cover as per Drawings; dowels at junction with structures installed and grouted per specification; cover blocks/chairs maintaining minimum cover',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Reinforcement typically at kerb returns, transitions, and junctions with structures.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT & FINISHING
    // =========================================================================
    {
      description: 'Place and compact concrete for kerb and channel',
      acceptanceCriteria: 'Concrete placed within specified time from batching (typically 60 min or per MRTS70); concrete consolidated by vibration without segregation; slipform placement at consistent speed; no cold joints; concrete temperature within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 / MRTS70 -- Concrete placement requirements. Slipform must produce consistent profile without slumping.'
    },
    {
      description: 'Form expansion joints at specified spacings and at fixed structures',
      acceptanceCriteria: 'Expansion joints at maximum 18 m centres (or as specified); joints at all junctions with fixed structures (pits, headwalls); joint filler material compliant (typically 12 mm compressible filler); joint sealant applied per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Expansion joint spacing per specification. Joint sealant per MRTS03 requirements.'
    },
    {
      description: 'Form contraction joints at specified spacings',
      acceptanceCriteria: 'Contraction joints at maximum 3 m centres (or as specified); formed by saw-cutting or tooling to minimum depth of 1/3 kerb thickness; joints straight and uniform; saw-cut within specified time after placement (typically 4-24 hours)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Contraction joint spacing per specification.'
    },
    {
      description: 'Finish exposed concrete surfaces to specified texture and profile',
      acceptanceCriteria: 'Exposed surfaces finished with steel trowel or broom finish as specified; edges and arrises neatly formed; profile matches SD1033 cross-section within tolerance; no honeycombing, surface defects, or excess laitance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 / SD1033 -- Surface finish requirements. Channel invert to be smooth for water flow.'
    },

    // =========================================================================
    // CURING & PROTECTION
    // =========================================================================
    {
      description: 'Apply curing compound or curing membrane to all exposed concrete surfaces immediately after finishing',
      acceptanceCriteria: 'Curing compound applied uniformly at manufacturer specified rate; curing maintained for minimum 7 days (or as per MRTS70); concrete protected from premature drying, wind, rain, and traffic damage during curing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 / MRTS70 -- Curing requirements per MRTS70 Concrete. Curing compound type to be approved.'
    },
    {
      description: 'Seal joints with approved joint sealant',
      acceptanceCriteria: 'Joint sealant applied to clean, dry joints; sealant type approved by Administrator; sealant recessed below surface as specified; full joint depth sealed; no gaps or voids',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Joint sealing requirements.'
    },
    {
      description: 'Protect completed kerb from traffic and construction damage during curing period',
      acceptanceCriteria: 'Barriers or delineation installed to prevent vehicle and pedestrian traffic on kerb during curing; minimum 7-day protection period (or as specified); any damage repaired or kerb replaced at Contractor cost',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Protection during curing. Damaged kerb may need to be removed and replaced.'
    },

    // =========================================================================
    // CONCRETE TESTING
    // =========================================================================
    {
      description: 'Sample concrete for compressive strength testing during placement',
      acceptanceCriteria: 'Concrete test cylinders sampled per MRTS70 frequency requirements (typically 1 set per 50 m3 or 1 per day, whichever is more frequent); 7-day and 28-day compressive strength results meet specified grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8.1 (compressive strength cylinders), AS 1012.3.1 (slump test)',
      notes: 'Section 20.4 MRTS03 / MRTS70 -- Testing frequency per MRTS70.'
    },
    {
      description: 'Conduct slump test on concrete at point of placement',
      acceptanceCriteria: 'Slump within specified range for kerb application (typically 40-80 mm for fixed form, as specified for slipform); concrete rejected if outside tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (concrete slump test)',
      notes: 'Section 20.4 MRTS03 / MRTS70 -- Slump tested at point of delivery/placement.'
    },

    // =========================================================================
    // DIMENSIONAL & ALIGNMENT VERIFICATION
    // =========================================================================
    {
      description: 'Check completed kerb alignment against design horizontal and vertical alignment',
      acceptanceCriteria: 'Horizontal alignment: +/-10 mm from design line; Vertical level: +/-10 mm from design level; no abrupt changes in alignment; transitions smooth and uniform',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 20.4 MRTS03 -- Tolerances per specification.'
    },
    {
      description: 'Check completed kerb cross-section dimensions against SD1033 profile',
      acceptanceCriteria: 'Cross-section dimensions within +/-5 mm of specified profile; kerb height, channel width, and lip dimensions per SD1033; no deformation or slumping of profile',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Physical measurement with template gauge',
      notes: 'Section 20.4 MRTS03 / SD1033 -- Profile template or measurement at regular intervals.'
    },
    {
      description: 'Conduct water test on completed channel to verify flow and gradient',
      acceptanceCriteria: 'Water flows continuously along channel without ponding; no low points that trap water; flow grade consistent with design; joints do not leak excessively',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Water flow test per MRTS03',
      notes: 'Section 20.4 MRTS03 -- Water testing of completed channel. Administrator to be notified.'
    },

    // =========================================================================
    // BACKFILL & PRECAST OPTIONS
    // =========================================================================
    {
      description: 'Backfill behind kerb and compact to specification',
      acceptanceCriteria: 'Backfill material approved; placed and compacted in layers; compacted to 95% standard dry density ratio (or as specified); backfill level to design profile; no voids behind kerb',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 20.3 MRTS03 -- Backfill compaction per MRTS04 General Earthworks requirements.'
    },
    {
      description: 'Verify precast kerb units (where used) comply with material and dimensional requirements',
      acceptanceCriteria: 'Precast units comply with AS/NZS 4455 (or as specified); supplier quality records and test certificates provided; units free of defects (cracks, spalling, dimensional non-conformance); units match specified profile',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 4456 series (masonry unit tests)',
      notes: 'Section 21 MRTS03 -- Precast concrete blocks/kerb units. Material certification required.'
    },
    {
      description: 'Install precast kerb units on prepared bedding with correct alignment and jointing',
      acceptanceCriteria: 'Units laid on compacted bedding; joints mortared (1:3 cement:sand or as specified); alignment and level tolerances per Section 20 requirements; units stable and level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 21.3 MRTS03 -- Precast kerb installation requirements. Mortar per MRTS03 (cement mortar: 1 part Type GP cement to 3 parts fine aggregate).'
    },

    // =========================================================================
    // FINAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify final kerb works conform to Drawings including transitions, drop kerbs, vehicle crossovers, and connections to structures',
      acceptanceCriteria: 'All kerb elements constructed per Drawings; transitions between kerb types smooth and per SD1033; vehicle crossovers at correct locations with correct profile; connections to pits and structures sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Sections 20-21 MRTS03 / SD1033 -- Final inspection of completed kerb works. Administrator to verify conformance to Drawings.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation including concrete test results, survey data, joint records, and photographs',
      acceptanceCriteria: 'Complete documentation package submitted; all test results conforming; as-built survey showing alignment and levels; photo record of construction stages',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5 MRTS50 -- Documentation required for acceptance of kerb works'
    },
    {
      description: 'Lot conformance review and sign-off by Administrator',
      acceptanceCriteria: 'All criteria met, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator'
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Drainage')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldPipeInstallationTemplate)
    await seedTemplate(qldPitsChambersTemplate)
    await seedTemplate(qldBoxCulvertsTemplate)
    await seedTemplate(qldSubsoilDrainsTemplate)
    await seedTemplate(qldKerbChannelTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 drainage templates)')
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
