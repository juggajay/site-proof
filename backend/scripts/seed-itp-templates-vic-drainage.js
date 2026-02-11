/**
 * Seed Script: VIC (VicRoads) ITP Templates - Drainage
 *
 * Creates global ITP templates for VIC drainage activities.
 * Templates: Pipe Installation (Sec 701), Pits & Chambers (Sec 705),
 *            Culverts (Sec 610/BTN016), Subsoil/Subsurface (Sec 702),
 *            Kerb & Channel (Sec 703)
 *
 * Run with: node scripts/seed-itp-templates-vic-drainage.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// VIC PIPE INSTALLATION (VicRoads Sec 701)
// =============================================================================

const vicPipeInstallationTemplate = {
  name: 'Drainage - Pipe Installation (VIC)',
  description: 'VicRoads pipe installation for underground stormwater drains per Section 701 (February 2023). Covers RCP (AS 4058), FRC (AS 4139), PVC, HDPE, and corrugated metal pipes. Includes trench excavation, bedding, pipe laying, jointing, backfill, CCTV inspection (WSA 05:2020), and as-built survey.',
  activityType: 'drainage',
  specificationReference: 'Sec 701',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for pipe installation works',
      acceptanceCriteria: 'All current revision drawings, Section 701, and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.01 — Contractor to confirm scope and referenced standards'
    },
    {
      description: 'Confirm culvert positions with Superintendent prior to excavation',
      acceptanceCriteria: 'All culvert positions marked and confirmed; written approval or release received',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.05 — Contractor shall confirm position of all culverts with Superintendent prior to excavation'
    },
    {
      description: 'Verify service location — dial-before-you-dig and potholing of existing services',
      acceptanceCriteria: 'DBYD plans obtained; all services within excavation zone potholed and marked; clearances confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — confirm no conflicts with existing services'
    },
    {
      description: 'Verify traffic management and safety plans are in place',
      acceptanceCriteria: 'Approved traffic management plan (TMP) on site; barriers and signage installed per plan',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General OH&S / WorkSafe requirement'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify pipe material compliance — RCP pipes to AS 4058, FRC pipes to AS 4139',
      acceptanceCriteria: 'Manufacturer certificates confirming compliance with AS 4058 (RCP) or AS 4139 (FRC); 100-year design life for FRC; rubber ring joints to AS 1646',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4058 / AS 4139',
      notes: 'Cl 701.04 — Portland cement precast reinforced concrete pipes per AS 4058; FRC rigid pipes per AS 4139 with 100-year design life'
    },
    {
      description: 'Verify pipe material compliance — PVC pipes to AS/NZS 1254 or HDPE pipes to AS/NZS 5065',
      acceptanceCriteria: 'Manufacturer certificates confirming pipe class, material grade, and compliance with applicable standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1254 (PVC) / AS/NZS 5065 (HDPE)',
      notes: 'Cl 701.04 — Flexible pipe materials as specified in drawings'
    },
    {
      description: 'Verify corrugated metal culvert material compliance (if applicable)',
      acceptanceCriteria: 'Manufacturer certificates per AS 1761, AS 1762, AS/NZS 2041; galvanising thickness verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1761 / AS 1762 / AS/NZS 2041',
      notes: 'Cl 701.04 — Corrugated metal culverts where specified'
    },
    {
      description: 'Inspect pipe delivery — check for damage, cracks, and dimensional accuracy',
      acceptanceCriteria: 'No cracks >0.2 mm (RCP) or >0.1 mm (FRC); design diameter minimum 95% of nominal size; no visible damage, spalling, or exposed reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.04 / 701.25 — Pre-laying rejection: cracks >0.2 mm (RCP), >0.1 mm (FRC)'
    },
    {
      description: 'Verify bedding material compliance — grading and plasticity',
      acceptanceCriteria: 'Material conforms to Table 701.041; Plasticity Index max 20%; free from perishable matter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / AS 1289 (grading, PI)',
      notes: 'Cl 701.04 — Test frequency per Table 701.231: 1 per 1,000 tonnes for grading/plasticity'
    },
    {
      description: 'Verify select backfill material compliance',
      acceptanceCriteria: 'Material conforms to Table 701.042; free from perishable matter; Plasticity Index max 20%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / AS 1289',
      notes: 'Cl 701.04 — Test frequency per Table 701.231'
    },

    // =========================================================================
    // EXCAVATION
    // =========================================================================
    {
      description: 'Verify trench excavation dimensions and clearances',
      acceptanceCriteria: 'Trench width provides clearances per Table 701.101: 300-600 mm for rigid pipes, 300-1000 mm for corrugated metal pipes; trench bottom firm and stable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.10 — Trench clearance limits per Table 701.101'
    },
    {
      description: 'Verify trench support and shoring (where required)',
      acceptanceCriteria: 'Shoring installed per approved method; excavation faces stable; compliant with OH&S regulations for depth >1.5 m',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'General excavation safety requirements — WorkSafe Victoria'
    },
    {
      description: 'Verify excavation dewatering — trench free from standing water',
      acceptanceCriteria: 'Trench dewatered; no standing water at formation level; dewatering method does not disturb foundation material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.10 — Foundation must provide continuous support'
    },
    {
      description: 'Verify construction loading restrictions over existing/adjacent culverts',
      acceptanceCriteria: 'Construction loading complies with Table 701.091 requirements for axle range and culvert type; no unauthorised loads crossing installed culverts',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.09 — Construction loading requirements per Table 701.091'
    },

    // =========================================================================
    // BEDDING
    // =========================================================================
    {
      description: 'Inspect bedding preparation — formation level, grade, and compaction',
      acceptanceCriteria: 'Formation trimmed to correct level; no soft spots or loose material; grade per design (min 1:250); depressions for sockets provided where required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.11 — Bedding layer to be verified before pipe laying commences. Superintendent to inspect and release.'
    },
    {
      description: 'Verify bedding layer thickness and material placement',
      acceptanceCriteria: 'Bedding compacted thickness: 100 mm (pipe dia. <1500 mm) or 200 mm (pipe dia. >=1500 mm); material per Table 701.041',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.11 — Bedding thickness per specification; additional 30% layer height after sections positioned. Superintendent to witness.'
    },
    {
      description: 'Verify bedding compaction',
      acceptanceCriteria: 'Compacted to refusal using hand-held mechanical equipment; uniform density across trench width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 500.05 / RC 316.00',
      notes: 'Cl 701.15 — Compacted to refusal using hand-held mechanical equipment'
    },

    // =========================================================================
    // PIPE LAYING
    // =========================================================================
    {
      description: 'Verify pipe laying — socket orientation and alignment',
      acceptanceCriteria: 'Socket ends facing upstream; pipes fully entered into sockets; top of pipe marked within 5 degrees of vertical axis',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Socket ends facing upstream, fully entered; pipe marked within 5 degrees of vertical axis'
    },
    {
      description: 'Verify pipe bedding contact — lower portion in continuous contact with foundation',
      acceptanceCriteria: 'Pipe supported along full length on bedding; lower portion in continuous contact; no rocking or voids under pipe',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Lower portion continuous contact with foundation for full length'
    },
    {
      description: 'Verify multiple row culvert spacing (where applicable)',
      acceptanceCriteria: 'Spacing between pipes per Table 701.121: varies D/2 to 1.2 m depending on pipe type and diameter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Multiple row culvert spacing per Table 701.121'
    },
    {
      description: 'Verify pipe grade and alignment to design',
      acceptanceCriteria: 'Plan location of pits: +/-100 mm; invert level at pits: +/-50 mm; pipe grade departure: +/-10 mm per 10 m (min grade 1:250); entry pit offset to kerb: +/-20 mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / laser level',
      notes: 'Cl 701.05 — Conformity tolerances for pipe grade and position. Superintendent to witness.'
    },

    // =========================================================================
    // JOINTING
    // =========================================================================
    {
      description: 'Verify rubber ring joint assembly — RCP pipes',
      acceptanceCriteria: 'Rubber rings to AS 1646; joints fully entered; ring correctly seated; no displacement or extrusion of seal; joint gap within manufacturer tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.04 / 701.12 — Rubber ring joints per AS 1646'
    },
    {
      description: 'Verify flexible pipe jointing — PVC/HDPE',
      acceptanceCriteria: 'Joints assembled per manufacturer instructions; solvent cement joints (PVC) or electrofusion/butt welding (HDPE) per AS 2032 or manufacturer specification; no visible gaps or leaks',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Joints per applicable pipe standard and manufacturer recommendations'
    },
    {
      description: 'Verify connections at pits — pipe-to-pit junction',
      acceptanceCriteria: 'Pipe penetration through pit wall sealed with flexible joint or cementitious mortar; pipe supported at pit connection; no projections into pit flow channel exceeding 50 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 / Section 705 — Connection of pipe to pit structure'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Inspect select backfill placement — material and layer thickness',
      acceptanceCriteria: 'Select backfill placed to design subgrade level or 0.3 m above top of culvert (whichever is greater); maximum loose layer thickness 150 mm; material per Table 701.042',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.15 — Select backfill to 0.3 m above top of culvert minimum. Superintendent to witness.'
    },
    {
      description: 'Verify select backfill compaction',
      acceptanceCriteria: 'Minimum 97% density ratio (DR); materials with >=2.5% swell: maintain 92% moisture ratio; tested per Table 701.231',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 500.05',
      notes: 'Cl 701.15 — Min 97% density ratio; 150 mm max loose layer thickness'
    },
    {
      description: 'Verify ordinary backfill placement and compaction (above select backfill zone)',
      acceptanceCriteria: 'Ordinary backfill placed above select backfill zone; compacted in max 150 mm loose layers; PI max 20%; compaction to 95% standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00',
      notes: 'Cl 701.15 — Ordinary backfill acceptable above 0.3 m cover'
    },
    {
      description: 'Verify symmetrical backfill placement around pipe',
      acceptanceCriteria: 'Backfill placed equally on both sides of pipe; maximum level difference between sides not exceeding 300 mm; no concentrated loads applied during backfill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.15 — Even placement to prevent pipe displacement'
    },

    // =========================================================================
    // FILL CONSTRUCTION FOR CULVERTS IN FILL
    // =========================================================================
    {
      description: 'Verify fill construction adjacent to culvert prior to trench excavation (culverts in fill)',
      acceptanceCriteria: 'Fill constructed and compacted to subgrade level or 0.3 m above top of proposed culvert (whichever is lower) for min 6 m clear on each side of proposed trench',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / Survey',
      notes: 'Cl 701.10 — Fill construction before trench excavation for culverts in fill. Superintendent to inspect and release.'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'Mandrel / deflection testing of flexible pipes (PVC, HDPE)',
      acceptanceCriteria: 'Maximum 5% deflection from nominal internal diameter; mandrel passes full length without obstruction; tested after completion of backfill and before pavement construction',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Mandrel / deflection gauge test',
      notes: 'Cl 701.24 — Post-installation deflection testing for flexible pipes; industry standard 5% max deflection. Superintendent to witness.'
    },
    {
      description: 'CCTV inspection of installed drainage',
      acceptanceCriteria: 'CCTV inspection by independent testing organisation after earthworks to subgrade level; reporting per WSA 05:2020 (Conduit Inspection Reporting Code); structural grading 1 and service grading 1; no obstructions or waste material; CCTV footage and PDF report submitted on USB',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.24 — CCTV inspection after completion of earthworks to subgrade level; prior to construction of pavement layers. Superintendent to witness.'
    },
    {
      description: 'Assess CCTV defect findings — rigid pipes (RCP)',
      acceptanceCriteria: 'Post-laying non-conformance limits: cracks >0.5 mm, spalling, exposed reinforcement require assessment; removal required for longitudinal cracks >2 mm or circumferential cracks >3 mm with lateral displacement >3 mm, or circumferential cracks >4 mm (partial)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.25 — Defective sections removed and replaced; re-inspected after remediation. Superintendent to review and release.'
    },
    {
      description: 'Assess CCTV defect findings — FRC pipes',
      acceptanceCriteria: 'Post-laying: any defect triggers removal unless Superintendent approves repair; pre-laying rejection: cracks >0.1 mm',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.25 — FRC pipes: any post-laying defect triggers removal unless Superintendent approves. Superintendent to review and release.'
    },
    {
      description: 'Water tightness / joint integrity test (where specified)',
      acceptanceCriteria: 'Joints tested per AS 4058 Appendix C (RCP) or AS 2032 (PVC); no visible leakage at joints; test pressure and duration per project specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Water tightness test per applicable standard',
      notes: 'Where specified by project requirements; method varies by pipe material. Superintendent to witness.'
    },

    // =========================================================================
    // REPAIR PROCEDURES (IF REQUIRED)
    // =========================================================================
    {
      description: 'Superintendent approval of repair materials and procedures (if required)',
      acceptanceCriteria: 'Repair method and materials documented and approved by Superintendent before any repair work commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.25 — No repairs undertaken without Superintendent approval of materials and procedures'
    },
    {
      description: 'Verify completed repairs and re-inspect',
      acceptanceCriteria: 'Repaired sections meet original acceptance criteria; CCTV re-inspection of repaired sections; defect-free',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.25 — Defective sections re-inspected after remediation. Superintendent to witness.'
    },

    // =========================================================================
    // PRE-PAVEMENT APPROVAL
    // =========================================================================
    {
      description: 'Superintendent approval before pavement layer construction',
      acceptanceCriteria: 'All CCTV inspections complete and accepted; all defects remediated; all test results compliant; as-built survey complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.24 — Superintendent approval required before pavement layer construction'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built survey of installed drainage',
      acceptanceCriteria: 'As-built survey showing pipe inverts, pit locations, grades, and cover depths; survey by registered surveyor; submitted in required format',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed documentation'
    },
    {
      description: 'Compile and submit quality records package',
      acceptanceCriteria: 'Complete package including: pipe certificates, bedding/backfill test results, compaction test results, CCTV reports and footage, mandrel test results (flexible pipes), survey data, photos, non-conformance records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — all records retained for project handover'
    },
    {
      description: 'Submit manufacturer warranties for pipe materials',
      acceptanceCriteria: 'Warranties covering design life (100 years for FRC, 50-100 years for RCP per AS 4058); warranty documentation filed with quality records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.04 — Design life requirements per pipe type'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Superintendent',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC PITS & CHAMBERS (VicRoads Sec 705)
// =============================================================================

const vicPitsChambersTemplate = {
  name: 'Drainage - Pits & Chambers (VIC)',
  description: 'VicRoads drainage pit and chamber construction per Section 705 (June 2021) and BTN 033. Covers precast and cast-in-situ options including foundation, formwork, concrete (VR330/32 steel RC, VR450/50 FRC), connections, benching, covers/grates (AS 3996), step irons, and backfill.',
  activityType: 'drainage',
  specificationReference: 'Sec 705',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, Section 705, BTN 033, and standard drawings for pit type',
      acceptanceCriteria: 'All current revision drawings reviewed; correct pit type identified (SD 1001-1441 series); specification requirements confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 705.01 — Verify pit type, dimensions, and invert levels per SD 1001 and SD 1002'
    },
    {
      description: 'Verify pit locations per approved drawings',
      acceptanceCriteria: 'Pit locations set out per drawings; entry pit offset to kerb/barriers: +/-20 mm; plan location of other pits: +/-100 mm (per Section 701 tolerances)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.05 — Location tolerances apply to all pit structures'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify concrete compliance — precast or cast-in-situ',
      acceptanceCriteria: 'Concrete grade: min VR330/32 (steel-reinforced pits) or min VR450/50 (FRC precast pits) per Table 705.041; mix design registered with VicRoads',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 705.04 / Table 705.041 — Minimum concrete grades; mix designs require VicRoads registration'
    },
    {
      description: 'Verify reinforcement compliance (steel-reinforced pits)',
      acceptanceCriteria: 'Reinforcement per drawings; grade, size, spacing, and cover per Section 610 and design requirements; cover minimum per exposure classification B1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'BTN 033 — Minimum exposure classification B1 for RC drainage pits'
    },
    {
      description: 'Verify FRC precast pit compliance — fibre properties and concrete properties',
      acceptanceCriteria: 'Synthetic fibre: tensile strength >550 MPa, modulus >5.0 GPa, specific gravity >0.91, aspect ratio 70-170; FRC concrete: average residual strength >1.0 MPa, flexural toughness >4.5 MPa, Re3 factor >40%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'FRC testing per Section 705',
      notes: 'Cl 705.08 — FRC precast pits: prototype testing of 2 units per AS 5100 required'
    },
    {
      description: 'Verify covers, grates, lids, and lintels compliance',
      acceptanceCriteria: 'Covers and grates per AS 3996; correct load rating for location (Class D for roads, Class C for footways); steel components hot-dip galvanised to AS/NZS 4680',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 705.04 — Covers per drawings; steel grates/covers galvanised to AS/NZS 4680'
    },
    {
      description: 'Verify step iron material compliance (pits >1.0 m deep)',
      acceptanceCriteria: 'Steel grade AS/NZS 3679.1 Grade 250 or AS/NZS 4671 Grade N500; hot-dip galvanised min 600 microns coating thickness; design per AS 1657',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 705.04 — Step irons required for pits deeper than 1.0 m; min 600 micron galvanising'
    },
    {
      description: 'Inspect precast pit units on delivery — check for damage and defects',
      acceptanceCriteria: 'No visible cracks, spalling, honeycombing, or damage; dimensions within tolerance; Class 2 surface finish per Section 610',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.06-08 — Surface finish: Class 2 per Section 610; minor imperfections per Section 689'
    },

    // =========================================================================
    // EXCAVATION
    // =========================================================================
    {
      description: 'Verify pit excavation dimensions',
      acceptanceCriteria: 'Excavation provides min 400 mm clearance from precast pit faces; formation level correct; sides stable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.05 — 400 mm clearance for precast pits from excavation faces'
    },
    {
      description: 'Verify pit foundation preparation and bedding',
      acceptanceCriteria: 'Bedding: min 80 mm on clay or min 150 mm on rock; compacted level base; no soft spots',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.05 — Min 80 mm bedding on clay, 150 mm on rock. Superintendent to inspect and release.'
    },

    // =========================================================================
    // CONSTRUCTION — PRECAST PITS
    // =========================================================================
    {
      description: 'Verify precast pit placement — level, plumb, and orientation',
      acceptanceCriteria: 'Pit set level and plumb; orientation matches inlet/outlet pipe alignments; base at correct invert level (+/-50 mm per Section 701)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.06 — Precast pit placement per drawings and standard drawings. Superintendent to witness.'
    },
    {
      description: 'Verify pit section joint sealing (multi-section precast pits)',
      acceptanceCriteria: 'Joints between precast sections sealed with approved mortar or sealant; no voids; watertight',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.06 — Joint sealing between precast sections'
    },

    // =========================================================================
    // CONSTRUCTION — CAST-IN-SITU PITS
    // =========================================================================
    {
      description: 'Inspect formwork prior to concrete placement (cast-in-situ pits)',
      acceptanceCriteria: 'Formwork per Section 610 requirements; correct dimensions per SD drawings; rigid, plumb, clean, and oiled; reinforcement in place with correct cover',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.06 / Section 610 — Formwork inspection before concrete pour. Superintendent to inspect and release.'
    },
    {
      description: 'Verify reinforcement placement (cast-in-situ pits)',
      acceptanceCriteria: 'Reinforcement per design drawings; correct grade, size, spacing; cover per Section 610 for exposure class B1 minimum; bar chairs and spacers in place; laps per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 610 / BTN 033 — Reinforcement inspection before concrete pour. Superintendent to inspect and release.'
    },
    {
      description: 'Verify concrete placement, compaction, and curing (cast-in-situ pits)',
      acceptanceCriteria: 'Concrete temperature 10-32 deg C at placement; max layer thickness 350 mm; vibrated until air bubbles cease; cured per Table 610.231 (min 6-9 days depending on cement type and temperature)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete cylinder testing per Section 610',
      notes: 'Section 610 — Concrete placement temperature, vibration, and curing requirements. Superintendent to witness.'
    },
    {
      description: 'Concrete compressive strength verification',
      acceptanceCriteria: '28-day strength: average >= specified grade AND all cylinders >= 90% of specified; VPV max 13% (vibrated cylinders), 14% (rodded), 16% (cores); sampling per Table 610.161',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 / Section 610',
      notes: 'Section 610 Cl 610.16 — Sampling frequency per Table 610.161; accept if avg >= spec AND all >= 90% spec'
    },

    // =========================================================================
    // CONNECTIONS & PENETRATIONS
    // =========================================================================
    {
      description: 'Verify pipe penetrations — holes cut (not broken)',
      acceptanceCriteria: 'Stormwater drain holes: 150 mm diameter; weepholes: 50 mm between midpoint and top of drain; holes cut cleanly with +/-50 mm tolerance on diameter; no cracking to pit structure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.09-10 — Holes cut, not broken; +/-50 mm diameter tolerance'
    },
    {
      description: 'Verify pipe-to-pit connections sealed',
      acceptanceCriteria: 'Connections sealed with cementitious mortar per Cl 610.32 or approved flexible connector; no voids around pipe; watertight seal',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.10 — Cementitious mortar joints per Cl 610.32'
    },
    {
      description: 'Verify 48-hour curing period before backfill (mortar joints)',
      acceptanceCriteria: 'Minimum 48 hours curing time achieved for cementitious mortar connections before any backfill placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 705.10 — 48-hour curing minimum before backfill'
    },

    // =========================================================================
    // FLOOR SHAPING & INVERTS
    // =========================================================================
    {
      description: 'Verify pit floor shaping — invert channel',
      acceptanceCriteria: 'Pit floors smoothly shaped from inlets to outlet for height of one-third of outlet pipe diameter; no obstructions to flow; smooth transition',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.11 — Floor shaped from inlets to outlet for 1/3 outlet pipe diameter height. Superintendent to witness.'
    },

    // =========================================================================
    // COVERS, GRATES & STEP IRONS
    // =========================================================================
    {
      description: 'Verify cover/grate installation — level and seating',
      acceptanceCriteria: 'Frame cast into pit top or bedded on 5 mm mortar; perimeter level tolerance: +/-10 mm from design; kerb line tolerance: +/-10 mm; correct load rating confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.12 — Perimeter level tolerance +/-10 mm; kerb line tolerance +/-10 mm'
    },
    {
      description: 'Verify step iron installation (pits >1.0 m deep)',
      acceptanceCriteria: 'Step irons horizontal; equidistant spacing; not obstructing openings; water cannot discharge onto steps; galvanised min 600 microns',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.04 — Horizontal installation; equidistant spacing; no obstruction of openings'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Verify pit backfill — material and compaction',
      acceptanceCriteria: 'Max 300 mm loose layer thickness; compacted to refusal using hand-held mechanical equipment; symmetrical filling around pit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 500.05',
      notes: 'Cl 705.13 — Max 300 mm loose layer; compacted to refusal with hand-held equipment'
    },

    // =========================================================================
    // SURFACE FINISH & REPAIRS
    // =========================================================================
    {
      description: 'Verify surface finish and repair compliance',
      acceptanceCriteria: 'Class 2 finish per Section 610; no epoxy materials for patch repair; repaired surfaces match surrounding texture and colour',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 705.14 — Class 2 finish; epoxy prohibited for patch repair; match surrounding finish'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built survey of pit locations and invert levels',
      acceptanceCriteria: 'Survey showing pit locations, invert levels, cover levels, and pipe connections; per SD 1002 format requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed records per SD 1002'
    },
    {
      description: 'Compile and submit quality records for pit construction',
      acceptanceCriteria: 'Complete package including: concrete test results, precast certificates, cover/grate certificates, reinforcement certificates, compaction results, photos, NCRs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — quality records for handover'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Superintendent',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC CULVERTS (VicRoads Sec 610/BTN016)
// =============================================================================

const vicCulvertsTemplate = {
  name: 'Drainage - Culverts (VIC)',
  description: 'VicRoads culvert construction (box culverts, pipe culverts, headwalls/wingwalls) per Section 701, Section 610, and BTN 016 (v2.0 June 2023). Covers pipe culverts (AS 4058/AS 4139), precast box culverts (AS 1597.1/1597.2), cast-in-situ concrete (VR450/50), endwalls/wingwalls (SD 1700-1990 series), and post-installation inspection.',
  activityType: 'drainage',
  specificationReference: 'Sec 610/BTN016',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, Section 701, Section 610, BTN 016, and applicable standard drawings',
      acceptanceCriteria: 'All current revision drawings reviewed; culvert type confirmed (pipe culvert, minor BCU, or major BCU); correct SD drawings identified from SD 1700-1990 series',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'BTN 016 / Cl 701.01 — Confirm classification (minor vs major BCU) and applicable standards. Minor BCU: single span <1.8 m AND total waterway area <3 m2.'
    },
    {
      description: 'Confirm culvert positions with Superintendent prior to excavation',
      acceptanceCriteria: 'All culvert positions marked; alignment confirmed with Superintendent; written approval received',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.05 — Contractor shall confirm position of all culverts with Superintendent prior to excavation'
    },
    {
      description: 'Verify service location and geotechnical conditions at culvert site',
      acceptanceCriteria: 'DBYD plans obtained; services potholed; foundation conditions confirmed suitable per design assumptions; no unexpected groundwater',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General pre-construction verification'
    },
    {
      description: 'Verify traffic management and environmental controls',
      acceptanceCriteria: 'TMP approved and implemented; erosion and sediment controls in place; waterway management plan (if applicable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — environmental and traffic management'
    },

    // =========================================================================
    // MATERIAL VERIFICATION — PIPE CULVERTS
    // =========================================================================
    {
      description: 'Verify pipe culvert material compliance',
      acceptanceCriteria: 'RCP per AS 4058; FRC per AS 4139 (100-year design life); corrugated metal per AS 1761/1762/AS/NZS 2041; rubber ring joints per AS 1646; certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4058 / AS 4139 / AS 1761',
      notes: 'Cl 701.04 — Pipe material certificates per applicable standard'
    },
    {
      description: 'Inspect pipe culvert units on delivery',
      acceptanceCriteria: 'No cracks >0.2 mm (RCP) or >0.1 mm (FRC); correct class and diameter; no damage, spalling, or exposed reinforcement; min 95% nominal diameter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.04 / 701.25 — Pre-laying rejection criteria'
    },

    // =========================================================================
    // MATERIAL VERIFICATION — BOX CULVERTS
    // =========================================================================
    {
      description: 'Verify precast box culvert unit compliance',
      acceptanceCriteria: 'Designed per AS 1597.2 (major BCU) or AS 1597.1 (minor); concrete grade min VR450/50 (VR470/55 for livestock underpasses); manufacturer certificates and design drawings provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1597.1 / AS 1597.2',
      notes: 'BTN 016 — Min VR450/50; VR470/55 for livestock; designed per AS 1597.2'
    },
    {
      description: 'Inspect precast box culvert units on delivery',
      acceptanceCriteria: 'No cracking, spalling, or honeycombing; smooth continuous internal surfaces (for water-conveying culverts); dimensions within tolerance per AS 1597',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'BTN 016 — Walls must be smooth continuous surface in direction of water flow'
    },
    {
      description: 'Verify joint sealing materials for box culverts',
      acceptanceCriteria: 'Joint sealant approved for application; compatible with concrete; flexible to accommodate movement; manufacturer data sheet provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'BTN 016 — Shear keys sealed; vertical joints sealed to prevent water escape and fill penetration'
    },

    // =========================================================================
    // MATERIAL VERIFICATION — HEADWALLS / ENDWALLS / WINGWALLS
    // =========================================================================
    {
      description: 'Verify concrete and reinforcement for headwall/endwall/wingwall construction',
      acceptanceCriteria: 'Concrete grade per Section 610 and design requirements (min VR330/32 for mass concrete, VR400/40 for reinforced); reinforcement per drawings; formwork materials suitable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 610 — Concrete per applicable grade; SD 1811-1981 for endwall/wingwall types'
    },
    {
      description: 'Verify bedding material compliance',
      acceptanceCriteria: 'Bedding material per Table 701.041 (pipe culverts) or compacted Class 3 FCR 20 mm to 97% MDD (box culverts); PI max 20%; test certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / AS 1289',
      notes: 'Cl 701.04 / BTN 016 — Bedding material compliance'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Verify foundation excavation — level, dimensions, bearing capacity',
      acceptanceCriteria: 'Excavation to correct level per design; formation stable and free from soft spots; dimensions accommodate bedding plus culvert width plus clearances; no water ponding',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.10 — Foundation preparation; formation must provide adequate bearing. Superintendent to inspect and release.'
    },
    {
      description: 'Verify foundation treatment (where required — rock, soft ground)',
      acceptanceCriteria: 'Rock trimmed to 150 mm below culvert soffit and replaced with bedding; soft ground treated as per Superintendent direction; foundation proof-rolled where required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.10 — Foundation treatment for adverse conditions. Superintendent to inspect and release.'
    },

    // =========================================================================
    // BEDDING — PIPE CULVERTS
    // =========================================================================
    {
      description: 'Verify pipe culvert bedding installation',
      acceptanceCriteria: 'Bedding thickness: 100 mm (dia. <1500 mm) or 200 mm (dia. >=1500 mm); compacted to refusal; grade correct; socket recesses provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.11 — Bedding verified before pipe laying commences. Superintendent to inspect and release.'
    },

    // =========================================================================
    // BEDDING — BOX CULVERTS
    // =========================================================================
    {
      description: 'Verify box culvert base slab bedding',
      acceptanceCriteria: 'Base slab bedding min 200 mm wider than outer face; compacted Class 3 FCR 20 mm to 97% MDD; level and uniform',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 500.05',
      notes: 'BTN 016 — Base slab bedding minimum dimensions; compacted bedding required. Superintendent to inspect and release.'
    },
    {
      description: 'Verify base slab construction (cast-in-situ box culverts)',
      acceptanceCriteria: 'Base slab formed, reinforced, and cast per Section 610; concrete grade min VR450/50; width min 100 mm wider than outer face of culvert units',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete testing per Section 610',
      notes: 'BTN 016 — Base slab min 100 mm wider than outer face of culvert/underpass units. Superintendent to inspect and release.'
    },

    // =========================================================================
    // PLACEMENT — PIPE CULVERTS
    // =========================================================================
    {
      description: 'Verify pipe culvert laying — alignment, grade, and jointing',
      acceptanceCriteria: 'Socket ends upstream; fully entered joints; grade per design (min 1:250); top marked within 5 deg of vertical; spacing per Table 701.121 (multiple rows)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Pipe laying requirements per Section 701. Superintendent to witness.'
    },
    {
      description: 'Verify rubber ring joint integrity — pipe culverts',
      acceptanceCriteria: 'Rubber rings per AS 1646; correctly seated; fully entered; no extrusion; joint gap within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.12 — Joint assembly per AS 1646'
    },

    // =========================================================================
    // PLACEMENT — BOX CULVERTS
    // =========================================================================
    {
      description: 'Verify precast box culvert unit placement — level, alignment, and seating',
      acceptanceCriteria: 'Units placed on prepared base slab/bedding; level and aligned per design; crown units installed on cement mortar bed in base slab recess',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'BTN 016 — Precast units placed on prepared base; crown units in base slab recess. Superintendent to witness.'
    },
    {
      description: 'Verify box culvert joint sealing',
      acceptanceCriteria: 'Shear keys in base slab sealed; vertical joints between units sealed to prevent water escape and fill material penetration; sealant fully fills joint',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'BTN 016 — Shear keys sealed; vertical joints sealed; prevent water escape and fill penetration. Superintendent to witness.'
    },
    {
      description: 'Verify gaps between walls and base slab recess packed with mortar',
      acceptanceCriteria: 'All gaps between side walls and sides of recess packed with cement mortar; mortar fully fills voids; smooth internal finish',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'BTN 016 — Gaps packed with cement mortar'
    },

    // =========================================================================
    // WATERPROOFING
    // =========================================================================
    {
      description: 'Verify waterproofing membrane application (where specified)',
      acceptanceCriteria: 'Membrane type as specified in design; applied to clean, dry surfaces; laps per manufacturer requirements; no punctures or tears; protection board installed before backfill',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Where specified by design — waterproofing membrane application and protection. Superintendent to witness.'
    },

    // =========================================================================
    // HEADWALL / ENDWALL / WINGWALL CONSTRUCTION
    // =========================================================================
    {
      description: 'Verify endwall/wingwall type selection per SD drawings',
      acceptanceCriteria: 'Correct endwall/wingwall type per SD 1700 selection guide and design drawings; mass concrete or reinforced concrete per applicable SD (1811-1981 series)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'SD 1700 — Culvert Inlet and Outlet Structures Selection Guide'
    },
    {
      description: 'Inspect formwork and reinforcement for headwall/wingwall (before concrete pour)',
      acceptanceCriteria: 'Formwork per Section 610; correct dimensions per applicable SD drawing; reinforcement placed per design with correct cover; dowels/starter bars from culvert connected',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 610 — Formwork and reinforcement inspection before pour. Superintendent to inspect and release.'
    },
    {
      description: 'Verify concrete placement and curing — headwall/wingwall',
      acceptanceCriteria: 'Concrete grade per design (min VR330/32 mass, VR400/40 reinforced); temperature 10-32 deg C; vibrated; cured per Table 610.231 (min 6-9 days); construction joints per Cl 610',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete cylinder testing per Section 610',
      notes: 'Section 610 — Concrete placement, vibration, and curing; construction joints per specification. Superintendent to witness.'
    },
    {
      description: 'Verify concrete compressive strength — headwall/wingwall',
      acceptanceCriteria: '28-day: average >= specified AND all >= 90% of specified; VPV max per Section 610',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 / Section 610',
      notes: 'Section 610 Cl 610.16 — Strength acceptance criteria'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Verify select backfill placement around culvert',
      acceptanceCriteria: 'Select backfill to design subgrade level or 0.3 m above top of culvert (whichever is greater); max 150 mm loose layers; placed equally on both sides with max 600 mm level difference between sides',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 701.15 — Select backfill zone; symmetrical placement. Superintendent to witness.'
    },
    {
      description: 'Verify select backfill compaction — culvert zone',
      acceptanceCriteria: 'Min 97% density ratio; 150 mm max loose layer thickness; hand-held compaction equipment only within 600 mm of culvert; materials with >=2.5% swell maintain 92% moisture ratio',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00 / RC 500.05',
      notes: 'Cl 701.15 — Min 97% density ratio; hand-held equipment near culvert'
    },
    {
      description: 'Verify removal of bracing and formwork before backfilling',
      acceptanceCriteria: 'All temporary bracing, formwork, and supports removed from within and around culvert before backfill commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'General requirement — remove temporary works before backfill'
    },
    {
      description: 'Verify ordinary backfill placement and compaction above select zone',
      acceptanceCriteria: 'Ordinary backfill placed in 150 mm max loose layers; compacted to min 95% DR; PI max 20%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00',
      notes: 'Cl 701.15 — Ordinary backfill above select zone'
    },

    // =========================================================================
    // SCOUR PROTECTION & APRONS
    // =========================================================================
    {
      description: 'Verify scour protection at culvert inlet and outlet',
      acceptanceCriteria: 'Scour protection type, extent, and material per design drawings and SD 1700 selection guide; rock beaching/riprap size and grading per specification; apron dimensions per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 1700 — Culvert inlet/outlet structure selection; scour protection per design. Superintendent to witness.'
    },
    {
      description: 'Verify energy dissipator construction (where specified)',
      acceptanceCriteria: 'Energy dissipator type and dimensions per design; concrete grade and reinforcement per Section 610; correct invert level and alignment',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Where specified — energy dissipation structure at culvert outlet. Superintendent to witness.'
    },

    // =========================================================================
    // APPROACH SLABS (WHERE SPECIFIED)
    // =========================================================================
    {
      description: 'Verify approach slab construction (where specified)',
      acceptanceCriteria: 'Approach slab per BTN 011 and design requirements; concrete grade per specification; reinforcement per design; connection to culvert per drawings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete testing per Section 610',
      notes: 'BTN 011 — Approach slabs; where specified for major culverts. Superintendent to witness.'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING — PIPE CULVERTS
    // =========================================================================
    {
      description: 'CCTV inspection of pipe culvert',
      acceptanceCriteria: 'CCTV by independent testing organisation; reporting per WSA 05:2020; structural grade 1, service grade 1; no obstructions; full footage submitted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.24 — CCTV inspection after earthworks to subgrade; before pavement construction. Superintendent to witness.'
    },
    {
      description: 'Assess CCTV defect findings — pipe culverts',
      acceptanceCriteria: 'Per Cl 701.25 defect limits: removal for longitudinal cracks >2 mm; circumferential >3 mm with displacement >3 mm; circumferential >4 mm (partial)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV per WSA 05:2020',
      notes: 'Cl 701.25 — Defect assessment and remediation requirements. Superintendent to review and release.'
    },

    // =========================================================================
    // POST-INSTALLATION — BOX CULVERTS
    // =========================================================================
    {
      description: 'Internal inspection of box culvert — visual assessment',
      acceptanceCriteria: 'Internal surfaces inspected for cracking, joint integrity, water ingress; smooth continuous flow surfaces; no debris or construction waste; joints fully sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'BTN 016 — Internal inspection of completed box culvert. Superintendent to witness.'
    },
    {
      description: 'Verify culvert structural tolerance compliance',
      acceptanceCriteria: 'Tolerances per Section 610 — allowable deviations from drawing dimensions; no structural distress',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / measurement',
      notes: 'Section 610 Cl 610.36 — Structural tolerances'
    },

    // =========================================================================
    // REPAIR PROCEDURES
    // =========================================================================
    {
      description: 'Superintendent approval of repair procedures (if required)',
      acceptanceCriteria: 'Repair method and materials approved by Superintendent before commencement; documented method statement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.25 — No repairs without Superintendent approval'
    },
    {
      description: 'Verify completed repairs and re-inspect',
      acceptanceCriteria: 'Repaired areas meet original specification; re-inspection (CCTV for pipe culverts, visual for box culverts) confirms compliance',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV or visual',
      notes: 'Cl 701.25 — Re-inspection after remediation. Superintendent to witness.'
    },

    // =========================================================================
    // PRE-PAVEMENT / HANDOVER
    // =========================================================================
    {
      description: 'Superintendent approval before pavement construction over culvert',
      acceptanceCriteria: 'All inspections complete; all test results compliant; all defects remediated; CCTV accepted; backfill compaction verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 701.24 — Superintendent approval before pavement layers'
    },
    {
      description: 'Submit as-built survey of culvert installation',
      acceptanceCriteria: 'As-built survey showing culvert inverts, alignment, cover depth, headwall positions, and connections; by registered surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed documentation'
    },
    {
      description: 'Submit culvert waterway capacity confirmation',
      acceptanceCriteria: 'Constructed waterway area and alignment match design requirements; no encroachments reducing capacity',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'BTN 016 — Confirm constructed waterway matches design'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Compile and submit quality records package — culvert works',
      acceptanceCriteria: 'Complete package: pipe/unit certificates, concrete test results, reinforcement certificates, bedding/backfill tests, compaction results, CCTV reports, survey data, photos, NCRs, Superintendent releases',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — comprehensive quality records for handover'
    },
    {
      description: 'Submit structural certificates for major box culverts (where required)',
      acceptanceCriteria: 'Design certificate and construction compliance certificate from qualified structural engineer; confirms as-built complies with design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'BTN 016 — Major BCU may require structural certification'
    },
    {
      description: 'Verify guardrail / safety barrier installation at culvert (where specified)',
      acceptanceCriteria: 'Safety barriers per design drawings and VicRoads accepted safety barrier products list; correct end treatments; installation certificates',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Where specified — safety barrier at culvert headwalls. Superintendent to witness.'
    },
    {
      description: 'Verify culvert marker posts and signage (where required)',
      acceptanceCriteria: 'Culvert markers installed per design; correct type, height, and reflectivity; visible from road',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Where specified — culvert identification signage'
    },
    {
      description: 'Verify drainage channel/battering at culvert inlet and outlet',
      acceptanceCriteria: 'Channel battering graded to culvert per design; no ponding upstream; outlet channel directs flow away from embankment; erosion protection in place',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 1700 series — inlet/outlet channel grading and protection'
    },
    {
      description: 'Verify rock beaching / riprap placement at inlet and outlet',
      acceptanceCriteria: 'Rock size and grading per design specification; extent matches drawings; rock keyed into foundation; no gaps allowing undermining; filter layer in place (where specified)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Design requirement — scour protection rock beaching/riprap. Superintendent to witness.'
    },
    {
      description: 'Final visual inspection of completed culvert installation',
      acceptanceCriteria: 'All components complete and compliant; no outstanding defects; site cleaned; temporary works removed; flow path unobstructed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'General requirement — final completion inspection. Superintendent to witness.'
    },
    {
      description: 'Submit manufacturer warranties for culvert units and components',
      acceptanceCriteria: 'Warranties covering design life per applicable standard; filed with quality records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — warranty documentation'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Superintendent',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC SUBSOIL/SUBSURFACE DRAINAGE (VicRoads Sec 702)
// =============================================================================

const vicSubsoilDrainageTemplate = {
  name: 'Drainage - Subsoil/Subsurface (VIC)',
  description: 'VicRoads subsurface drainage installation per Section 702 (February 2023). Covers Category 1/2/3 drain pipes, granular filter materials (Table 702.051), geotextile filters (Table 702.061), geocomposite drains, trench excavation, pipe laying, filter placement, access points, outlet connections, and flushing test.',
  activityType: 'drainage',
  specificationReference: 'Sec 702',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, Section 702, and standard drawings (SD 1601-1641) for subsurface drain type and layout',
      acceptanceCriteria: 'All current revision drawings reviewed; correct drain type identified per SD 1601; drain alignment, grade, outlets, and access points confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 702.01 — Scope covers supply and installation of subsurface drainage pipes, geocomposite drains, and filter materials'
    },
    {
      description: 'Verify service locations along subsurface drain alignment',
      acceptanceCriteria: 'DBYD plans obtained; existing services identified and marked; no conflicts with drain alignment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General pre-construction verification'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify subsurface drain pipe compliance',
      acceptanceCriteria: 'Category 1: perforated plastics Class 1000 or precast concrete Class 2; Category 2: perforated plastics Class 400; Category 3: geocomposite drains; manufacturer certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 702.04 — Pipe categories; Category 1 may substitute for Category 2'
    },
    {
      description: 'Verify granular filter material compliance',
      acceptanceCriteria: 'Hard, durable, clean sand/gravel/crushed rock; free from clay balls and organic matter; pH 6.0-8.0; Sand Equivalent min 80; grading per Table 702.051',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 / RC 316.00',
      notes: 'Cl 702.05 — Filter material per Table 702.051 (A1-A6 first stage, B1-B4 second stage)'
    },
    {
      description: 'Verify geotextile filter compliance',
      acceptanceCriteria: 'First stage: robustness 900, EOS 85-230 microns, elongation >=45%; Second stage (nonwoven): robustness 600-900, EOS 125-350 microns, elongation >=20%; Second stage (knitted seamless): EOS 125-350 microns, elongation >=50%; synthetic fibre stabilised against UV',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Manufacturer test certificates per Table 702.061',
      notes: 'Cl 702.06 — Geotextile per Table 702.061; polypropylene, polyethylene, or polyester'
    },
    {
      description: 'Verify no-fines concrete compliance (where specified)',
      acceptanceCriteria: 'No-fines concrete mix per specification; placed and compacted within 1 hour of mixing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 702.09 — No-fines concrete placed within 1 hour of mixing'
    },

    // =========================================================================
    // TRENCH EXCAVATION
    // =========================================================================
    {
      description: 'Verify trench excavation — depth, width, and grade',
      acceptanceCriteria: 'Trench bottom compacted and not more than 50 mm below specified invert level; no departures from grade allowing ponding of water; trench width per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.08 — Trench bottom max 50 mm below specified invert; no ponding'
    },
    {
      description: 'Inspect trench base prior to bedding and pipe placement',
      acceptanceCriteria: 'Trench base firm, stable, compacted, and free from loose material and standing water; grade correct for drain fall',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.08 — Inspector shall be notified at least 24 hours prior to base inspection. Superintendent to inspect and release.'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Verify drain depth — minimum 200 mm below subgrade',
      acceptanceCriteria: 'Pipe invert at least 200 mm below subgrade level; grade not flatter than 1 in 250',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.09 — Min 200 mm below subgrade; min grade 1:250'
    },
    {
      description: 'Verify bedding layer placement',
      acceptanceCriteria: 'Granular filter material bedding: 25-50 mm thickness placed across trench bottom; uniform and level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.09 — Bedding 25-50 mm granular filter material'
    },
    {
      description: 'Verify pipe placement — grade and alignment',
      acceptanceCriteria: 'Pipe invert: not more than 25 mm from specified level; not more than 50 mm from specified line; grade changes not exceeding 10 mm in any 3 m length; perforations facing down (where applicable)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.03 — Invert tolerance +/-25 mm from level, +/-50 mm from line; grade change max 10 mm per 3 m. Superintendent to witness.'
    },
    {
      description: 'Verify geotextile wrapping installation (first stage filter)',
      acceptanceCriteria: 'Geotextile laps: min 900 mm longitudinally, min 150 mm transversely for first stage; no tears, punctures, or contamination; wrapped continuously with no gaps',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.09 — First stage geotextile laps: 900 mm longitudinal, 150 mm transverse'
    },
    {
      description: 'Verify geotextile wrapping installation (second stage filter)',
      acceptanceCriteria: 'Geotextile laps: min 300 mm for second stage; fully enveloping granular filter and pipe; no gaps or untucked edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.09 — Second stage geotextile lap: 300 mm'
    },
    {
      description: 'Verify granular filter material placement and compaction',
      acceptanceCriteria: 'Filter material placed per design cross-section (SD 1601 drain types); correct grading type per Table 702.051; compacted around pipe without disturbing alignment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.09 / SD 1601 — Filter material per specified drain type cross-section'
    },

    // =========================================================================
    // ACCESS POINTS & OUTLETS
    // =========================================================================
    {
      description: 'Verify access points at run beginning and end',
      acceptanceCriteria: 'Access points provided at beginning and end of each drain run; inspection openings at 100-150 m intervals; flushout risers same diameter as pipe (min 100 mm for geocomposite); inspection pit min 600 mm diameter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 702.10 — Access points at run ends; inspection openings 100-150 m intervals; flushout riser min dia. = pipe dia.; inspection pit min 600 mm'
    },
    {
      description: 'Verify outlet connections — discharge to pit or daylight outlet',
      acceptanceCriteria: 'Outlet connection to pit per SD 1611 or daylight outlet per design; outlet protected from blockage; positive fall to outlet; connection sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 1611 — Subsurface drain pits; outlet connection per design. Superintendent to witness.'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'Flushing test of completed subsurface drain',
      acceptanceCriteria: 'Drain flushed with water; water flows freely from inlet to outlet; no blockages; witnessed by representative nominated by Superintendent',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Flushing test',
      notes: 'Cl 702.09 — Flushing test witnessed by representative nominated by Superintendent'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Compile and submit quality records package — subsurface drainage',
      acceptanceCriteria: 'Complete package: pipe certificates, filter material test results (grading, unsound rock, sand equivalent, pH per Table 702.131), geotextile certificates, flushing test records, as-built survey, photos',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — test frequencies per Table 702.131'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Superintendent',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
    }
  ]
}

// =============================================================================
// VIC KERB & CHANNEL (VicRoads Sec 703)
// =============================================================================

const vicKerbChannelTemplate = {
  name: 'Drainage - Kerb & Channel (VIC)',
  description: 'VicRoads kerb and channel construction per Section 703 v14 (August 2021). Covers concrete paving for kerbs, channels, footpaths, and edgings. Kerb profiles per SD 2001 (Barrier, Semi-Mountable, Mountable), SD 2100-2103. Concrete per AS 1379, kerbs per AS 2876. Includes extruded and hand-placed methods, subgrade preparation, formwork, concrete placement, finishing, joints, curing, and dimensional verification.',
  activityType: 'drainage',
  specificationReference: 'Sec 703',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for kerb and channel works',
      acceptanceCriteria: 'All current revision drawings, Section 703, SD 2001 (kerb profiles), SD 2100-2103 (kerb details), and AS 2876 reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 703.01 / 703.04 — Section 703 specifies requirements for portland cement and geopolymer binder concrete for kerbs, channels, edgings, footpaths, and surfacings. Kerb shall comply with AS 2876.'
    },
    {
      description: 'Submit concrete mix design for kerb and channel works',
      acceptanceCriteria: 'Mix design compliant with AS 1379; strength grade per Table 703.111 — N25 for traffic routes (or N20 for local streets); minimum cementitious material content 320 kg/m3 for traffic routes, 280 kg/m3 for local streets; air-entraining admixtures prohibited unless Superintendent approved; no calcium chloride-based admixtures',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379',
      notes: 'Cl 703.05, 703.07 — Concrete grades: N20 (20 MPa), N25 (25 MPa), N32 (32 MPa). Mix design approved before production. Superintendent to review and release.'
    },
    {
      description: 'Verify kerb extrusion machine or formwork is suitable and calibrated',
      acceptanceCriteria: 'Extrusion machine producing correct kerb profile per SD 2001; mould plates clean and undamaged; speed calibrated for consistent output; OR formwork set to correct kerb profile, clean, oiled, and rigid',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.04 / 703.12 — Trial length of extruded kerb to verify profile before production.'
    },

    // =========================================================================
    // SUBGRADE PREPARATION
    // =========================================================================
    {
      description: 'Inspect subgrade preparation for kerb and channel',
      acceptanceCriteria: 'Subgrade trimmed to design level within +/-10 mm; subgrade compacted and firm; surface free of soft spots, organic material, and standing water; subgrade shape matches underside of kerb profile; any required subbase placed and compacted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703 — Subgrade must provide uniform support for kerb. Soft spots require over-excavation and replacement. Superintendent to witness.'
    },
    {
      description: 'Verify kerb alignment string line or machine guidance',
      acceptanceCriteria: 'String line or guidance system set to correct horizontal alignment and vertical grade; check against design drawings; transitions and curves correctly set out; alignment pegs at maximum 10 m intervals on straights and 5 m on curves',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703 — Alignment to be verified before commencement of kerb placement.'
    },

    // =========================================================================
    // FORMWORK (NON-EXTRUDED KERB)
    // =========================================================================
    {
      description: 'Inspect formwork for hand-placed kerb and channel',
      acceptanceCriteria: 'Formwork compliant with AS 3610; forms set to correct profile per SD 2001; forms to correct line and level; joints in formwork prevent mortar loss; forms rigid and adequately staked; forms clean and oiled; formwork checked for expansion/contraction joint locations',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.12 — Formwork shall comply with AS 3610. Forms not stripped until minimum times per AS 3610 Table 5.4.1 have elapsed. Superintendent to witness.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT AND FINISHING
    // =========================================================================
    {
      description: 'Verify weather conditions before concrete placement',
      acceptanceCriteria: 'Ambient temperature between 5 deg C and 35 deg C; no rain or forecast rain; wind not excessive for curing; concrete temperature within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 703.09 — Reference Section 610 weather restrictions with modified curing provisions.'
    },
    {
      description: 'Place and compact concrete for kerb and channel',
      acceptanceCriteria: 'Concrete placed without segregation; compacted by vibration or tamping per Cl 703.08; no voids, honeycombing, or surface defects; kerb profile maintained throughout placement; extruded kerb slump appropriate for machine (typically 15-30 mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.08 — Concrete shall be tamped, vibrated, and surface finished.'
    },
    {
      description: 'Finish kerb and channel surfaces',
      acceptanceCriteria: 'Exposed surfaces finished smooth and free of blemishes; lip of kerb sharp and well-defined; channel surface smooth with correct cross-fall for drainage; no trowel marks, tears, or rough patches; finish consistent throughout',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.08 — Surface finish for unformed surfaces per specification.'
    },
    {
      description: 'Conduct concrete conformance sampling',
      acceptanceCriteria: 'Minimum one sample per 50 m3 placed per day (per Cl 703.11); slump tested per AS 1012.3.1; compressive strength cylinders cast and tested at 7 and 28 days; results meet specified strength grade per Table 703.111',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (Slump) / AS 1012.8.1 / AS 1012.9 (Strength)',
      notes: 'Cl 703.11 — Testing frequency: minimum 1 sample per 50 m3 per day.'
    },

    // =========================================================================
    // JOINTS
    // =========================================================================
    {
      description: 'Install contraction joints at specified spacing',
      acceptanceCriteria: 'Contraction joints at maximum 3.0 m intervals (or as specified); joints formed by saw-cutting, tooling, or pre-formed strip; joint depth minimum one-third of kerb depth; joints clean and sealed (if required)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703 / AS 2876 — Joint spacing controls cracking.'
    },
    {
      description: 'Install expansion joints at specified locations',
      acceptanceCriteria: 'Expansion joints at maximum 30 m intervals and at structures, junctions, and changes in direction; compressible filler board full depth; filler flush with channel surface; sealed if specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703 — Expansion joints accommodate thermal movement and settlement.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing to kerb and channel immediately after finishing',
      acceptanceCriteria: 'Curing commenced immediately after finishing; minimum 7 days curing for traffic routes, 3 days for edgings; acceptable methods: water, wet hessian, polyethylene sheeting, or approved curing compound applied at specified rate; curing membrane/covering maintained intact for full curing period',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.10 — Curing of geopolymer concrete per manufacturer placement guidelines in addition to above. Superintendent to witness.'
    },

    // =========================================================================
    // DIMENSIONAL TOLERANCES
    // =========================================================================
    {
      description: 'Verify kerb and channel dimensions and profile',
      acceptanceCriteria: 'Kerb profile matches SD 2001 (barrier, semi-mountable, or mountable type as specified); dimensions within tolerances specified in AS 2876; lip height, face width, and channel width per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Profile template / measurement',
      notes: 'Cl 703.04 / AS 2876 — Profile check at random locations.'
    },
    {
      description: 'Verify kerb alignment (line) and level',
      acceptanceCriteria: 'Maximum 10 mm deviation from design line; maximum 10 mm deviation from design level; maximum 5 mm deviation under 3 m straightedge in any direction; no abrupt changes in alignment or grade',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'String line / survey / 3 m straightedge',
      notes: 'Cl 703.14 — Tolerances: +/-10 mm line/level, 5 mm straightedge. Superintendent to witness.'
    },
    {
      description: 'Verify channel drainage performance',
      acceptanceCriteria: 'Channel cross-fall drains freely to gutter; no ponding in channel; water flows to inlet pits without obstruction; transitions between kerb types smooth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Functional check that kerb and channel system drains correctly.'
    },

    // =========================================================================
    // REINFORCEMENT AND STEEL (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Inspect steel reinforcement in kerb and channel (where specified)',
      acceptanceCriteria: 'Reinforcement per AS/NZS 4671; minimum 50 mm concrete cover (per Cl 703.13); no wire chairs for support; reinforcement clean and properly tied; lap lengths per specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.13 — Wire chairs prohibited. 50 mm minimum cover requirement. Superintendent to witness.'
    },

    // =========================================================================
    // FINAL INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed kerb and channel for defects',
      acceptanceCriteria: 'No cracking, spalling, or surface defects; kerb lip sharp and consistent; joints correctly formed and sealed; curing complete; alignment and level within tolerances; backfill placed and compacted behind kerb; kerb not damaged by construction traffic',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703 — Final visual inspection of completed work. Superintendent to witness.'
    },
    {
      description: 'Submit kerb and channel records — as-built survey and test results',
      acceptanceCriteria: 'As-built survey of kerb alignment and level; concrete strength test results; construction records including dates, weather, concrete batches, and joint locations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Final handover documentation.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Superintendent',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent'
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Drainage')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicPipeInstallationTemplate)
    await seedTemplate(vicPitsChambersTemplate)
    await seedTemplate(vicCulvertsTemplate)
    await seedTemplate(vicSubsoilDrainageTemplate)
    await seedTemplate(vicKerbChannelTemplate)

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
