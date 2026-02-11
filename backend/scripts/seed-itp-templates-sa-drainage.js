/**
 * Seed Script: SA (DIT) ITP Templates - Drainage
 *
 * Creates global ITP templates for SA DIT drainage activities.
 * Templates: Pipe Installation (RD-DK-C1), Pits & Chambers (RD-DK-C1),
 *            Culverts (RD-DK-C1/S1), Subsoil/Subsurface (RD-DK-C1/D1),
 *            Kerb & Channel (RD-DK-C2)
 *
 * Run with: node scripts/seed-itp-templates-sa-drainage.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// SA PIPE INSTALLATION (DIT RD-DK-C1)
// =============================================================================

const saPipeInstallationTemplate = {
  name: 'Drainage — Pipe Installation (DIT RD-DK-C1)',
  description: 'DIT stormwater drainage pipe installation including RCP, PVC, HDPE per RD-DK-C1 (Installation of Stormwater Drainage, formerly Part R04). Covers bedding (Sa-C Type C Sand), laying, jointing, backfill per RD-EW-C2, and testing.',
  activityType: 'drainage',
  specificationReference: 'RD-DK-C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for pipe installation works',
      acceptanceCriteria: 'All current revision drawings, RD-DK-C1, RD-EW-C2, RD-DK-S1, and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Contractor to confirm scope and referenced standards including companion specs RD-DK-S1 (Supply of Pipes and Culverts) and RD-EW-C2 (Trench Excavation and Backfill)'
    },
    {
      description: 'Submit construction procedures for pipe installation works',
      acceptanceCriteria: 'Construction procedures submitted and accepted by Principal\'s Authorised Person; covers excavation, bedding, laying, jointing, backfill, and testing methodology',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Construction procedures must be submitted and accepted before work commences. Principal\'s Authorised Person to review and release.'
    },
    {
      description: 'Verify pipe supply conformance — RCP pipes to AS 4058, other pipe types per RD-DK-S1',
      acceptanceCriteria: 'Manufacturer certificates confirming compliance with RD-DK-S1 (Supply of Pipes and Culverts); RCP per AS 4058; UPVC per applicable standard; certificates provided for all pipe types',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4058 / RD-DK-S1',
      notes: 'RD-DK-S1 — All pipes and culverts must comply with supply specification. Metal culverts (AS 2041) and plastic pipes (except TWRPP) are prohibited for DIT stormwater purposes.'
    },
    {
      description: 'Inspect pipe delivery — check for damage, cracks, and dimensional accuracy',
      acceptanceCriteria: 'No visible cracks, spalling, damage, or exposed reinforcement; correct class and diameter confirmed; pipes stored and handled per manufacturer requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-S1 / RD-DK-C1 — Pre-laying inspection of delivered pipe units'
    },
    {
      description: 'Verify bedding material supply compliance — Sa-C Type C Sand certificates',
      acceptanceCriteria: 'Sa-C Type C Sand material test certificates provided; grading and quality confirmed per RD-DK-C1; free from deleterious matter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 (grading)',
      notes: 'RD-DK-C1 — Bedding material must be Sa-C Type C Sand. Material certificates required prior to use.'
    },
    {
      description: 'Verify backfill material supply compliance per RD-EW-C2',
      acceptanceCriteria: 'Backfill material complies with RD-EW-C2 requirements; material test certificates provided; free from deleterious matter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 (grading, PI)',
      notes: 'RD-EW-C2 — Backfill material must comply with trench excavation and backfill specification'
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
      acceptanceCriteria: 'Approved traffic management plan on site; barriers and signage installed per plan',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General OH&S / SafeWork SA requirement'
    },

    // =========================================================================
    // EXCAVATION
    // =========================================================================
    {
      description: 'Verify trench excavation dimensions and compliance per RD-EW-C2',
      acceptanceCriteria: 'Trench excavation compliant with RD-EW-C2 (Trench Excavation and Backfill); correct width, depth, and clearances; trench bottom firm and stable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 — Trench excavation requirements per companion specification'
    },
    {
      description: 'Verify trench support and shoring (where required)',
      acceptanceCriteria: 'Shoring installed per approved method; excavation faces stable; compliant with SafeWork SA regulations for depth >1.5 m',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'General excavation safety requirements — SafeWork SA'
    },
    {
      description: 'Verify excavation dewatering — trench free from standing water',
      acceptanceCriteria: 'Trench dewatered; no standing water at formation level; dewatering method does not disturb foundation material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 — Foundation must provide continuous support; trench free from water'
    },
    {
      description: 'Post-excavation hold point — excavation complete and ready for installation',
      acceptanceCriteria: 'Excavation complete per RD-EW-C2; formation level correct; trench stable and dewatered; ready for bedding and pipe installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Following completion of excavation, a Hold Point applies. Installation must not continue until released by Principal\'s Authorised Person.'
    },

    // =========================================================================
    // BEDDING
    // =========================================================================
    {
      description: 'Verify bedding material compliance — Sa-C Type C Sand',
      acceptanceCriteria: 'Bedding material is Sa-C Type C Sand as specified in RD-DK-C1; material test certificates provided; free from deleterious matter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 (grading)',
      notes: 'RD-DK-C1 — Bedding material must be Sa-C Type C Sand'
    },
    {
      description: 'Verify bedding layer thickness and preparation',
      acceptanceCriteria: 'Minimum compacted bedding depth: 150 mm for pipes >=1500 mm diameter; 125 mm where verification testing is to be undertaken; 100 mm otherwise. Formation trimmed to correct level with socket recesses provided.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Three tiers of minimum bedding depth depending on pipe diameter and testing requirements'
    },
    {
      description: 'Bedding compaction method trial — submit trial results and proposed methodology',
      acceptanceCriteria: 'Trial results and proposed methodology for bedding compaction submitted and accepted; method demonstrated to achieve required compaction without damage to pipes',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction method trial',
      notes: 'RD-DK-C1 — Bedding Compaction Method Hold Point. Contractor must submit trial results and proposed methodology details. This Hold Point must be released before the proposed method is used. Principal\'s Authorised Person to release.'
    },
    {
      description: 'Verify bedding compaction — compacted Sa-C Type C Sand',
      acceptanceCriteria: 'Bedding compacted to specified density using approved method from trial; uniform density across trench width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing',
      notes: 'RD-DK-C1 — Bedding compaction using approved method from hold point release'
    },

    // =========================================================================
    // PIPE LAYING
    // =========================================================================
    {
      description: 'Verify pipe laying — socket orientation (female/socket end upstream)',
      acceptanceCriteria: 'Concrete pipes placed with the female (socket) end facing upstream; pipes fully entered into sockets',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Concrete pipes must be placed with the female (socket) end upstream'
    },
    {
      description: 'Verify lifting hole orientation — positioned uppermost',
      acceptanceCriteria: 'Lifting holes (if present) positioned uppermost during installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Lifting holes must be positioned uppermost'
    },
    {
      description: 'Verify pipe grade and alignment to design',
      acceptanceCriteria: 'Pipe grade and alignment per design drawings; invert levels at correct elevations; continuous support on bedding along full length',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey / laser level',
      notes: 'RD-DK-C1 — Pipe grade and alignment verified by survey. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // JOINTING
    // =========================================================================
    {
      description: 'Verify pipe jointing — per manufacturer instructions',
      acceptanceCriteria: 'Pipes jointed in accordance with manufacturer\'s instructions; joints fully assembled; no displacement of seals; joint gap within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Pipes jointed in accordance with manufacturer\'s instructions'
    },
    {
      description: 'Verify external joint strengthening — 100 mm thick 10 MPa concrete fillet',
      acceptanceCriteria: 'External joint between precast drainage structures and pipes/box culverts strengthened with concrete fillet encircling the culvert — minimum 100 mm thick, minimum 10 MPa concrete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — External joint: concrete fillet encircling culvert, minimum 100 mm thick 10 MPa concrete'
    },
    {
      description: 'Verify internal joint rendering — flush with mortar',
      acceptanceCriteria: 'Internal joint rendered flush with mortar; smooth internal surface; no protrusions or voids at joint',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Internal joint must be rendered flush with mortar'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Verify backfill material and placement per RD-EW-C2',
      acceptanceCriteria: 'Backfill compliant with RD-EW-C2 (Trench Excavation and Backfill); sand backfill compacted alternately on each side of the pipe; all voids suitably backfilled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 / RD-DK-C1 — Sand backfill compacted alternately on each side of the pipe/service'
    },
    {
      description: 'Verify backfill compaction — alternating sides',
      acceptanceCriteria: 'Backfill compacted to specified density ratio per RD-EW-C2; placed in even layers alternately on each side of pipe; no concentrated loads during backfill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing per RD-EW-C2',
      notes: 'RD-EW-C2 — Compaction testing per trench backfill specification'
    },

    // =========================================================================
    // SUBSOIL DRAIN HOLD POINT
    // =========================================================================
    {
      description: 'Subsoil drain placement hold point — prior to backfilling',
      acceptanceCriteria: 'Subsoil drain placed correctly; grade verified; connections checked; ready for backfill',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 (formerly Part R04) — Following placement of subsoil drain and prior to backfilling, a Hold Point applies. Principal\'s Authorised Person to release.'
    },

    // =========================================================================
    // VERIFICATION TESTING
    // =========================================================================
    {
      description: 'Verify bedding compaction — verification testing (where specified)',
      acceptanceCriteria: 'Verification testing of bedding compaction completed per RD-DK-C1 where 125 mm bedding depth applies; results demonstrate adequate compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction verification testing',
      notes: 'RD-DK-C1 — Verification testing referenced for bedding compaction; minimum 125 mm bedding depth applies where verification testing is undertaken'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'CCTV inspection of installed drainage',
      acceptanceCriteria: 'CCTV inspection completed per RD-DK-C1 requirements; no structural defects, obstructions, or waste material; CCTV footage and report submitted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV inspection',
      notes: 'RD-DK-C1 — CCTV inspection requirements specified within specification. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Mandrel testing of flexible pipes (PVC, HDPE) — where applicable',
      acceptanceCriteria: 'Mandrel passes full length without obstruction; maximum deflection within specification limits; tested after completion of backfill',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Mandrel / deflection test',
      notes: 'RD-DK-C1 — Mandrel testing requirements for flexible pipes. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Water tightness test (where specified)',
      acceptanceCriteria: 'Joint integrity confirmed; no visible leakage; test pressure and duration per project specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Water tightness test',
      notes: 'RD-DK-C1 — Where specified by project requirements. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // SURVEY & DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built survey — invert levels and grade compliance',
      acceptanceCriteria: 'As-built survey showing pipe inverts, pit locations, grades, and cover depths; survey by registered surveyor; submitted in required format',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed documentation'
    },
    {
      description: 'Verify invert levels and grade compliance per design',
      acceptanceCriteria: 'Invert levels at pits and key points match design within specified tolerances; pipe grade compliant with design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'RD-DK-C1 — Invert level and grade verification'
    },
    {
      description: 'Compile and submit quality records package',
      acceptanceCriteria: 'Complete package including: pipe supply certificates (RD-DK-S1), bedding material tests, compaction test results, CCTV reports, mandrel test results (flexible pipes), survey data, photos, non-conformance records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — all records retained for project handover per PC-QA1 or PC-QA2'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA PITS & CHAMBERS (DIT RD-DK-C1)
// =============================================================================

const saPitsChambersTemplate = {
  name: 'Drainage — Pits & Chambers (DIT RD-DK-C1)',
  description: 'DIT drainage pits, junction pits, inlet/outlet structures per RD-DK-C1. Covers excavation, formwork, concrete, grates/covers, pipe connections, and invert channels.',
  activityType: 'drainage',
  specificationReference: 'RD-DK-C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for pit construction works',
      acceptanceCriteria: 'All current revision drawings, RD-DK-C1, RD-DK-S1, RD-EW-C2, and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Drainage pit construction is covered within RD-DK-C1 alongside pipe installation. Verify pit type, dimensions, and invert levels per design drawings.'
    },
    {
      description: 'Verify pit locations per approved drawings',
      acceptanceCriteria: 'Pit locations set out per drawings; positions confirmed with Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Location tolerances per specification'
    },
    {
      description: 'Verify precast drainage structure supply conformance per RD-DK-S1',
      acceptanceCriteria: 'Precast drainage structures comply with RD-DK-S1 (Supply of Pipes and Culverts); manufacturer certificates provided; correct type and dimensions confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-S1 — Precast drainage structures must comply with supply specification'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify concrete material compliance for pit construction',
      acceptanceCriteria: 'Concrete grade per specification; mix design submitted and accepted; reinforcement per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Concrete materials for cast-in-situ pit construction'
    },
    {
      description: 'Verify covers, grates, and lids material compliance',
      acceptanceCriteria: 'Covers and grates per design requirements; correct load rating for location; manufacturer certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Covers and grates per design drawings; load rating confirmed for traffic or pedestrian area'
    },

    // =========================================================================
    // EXCAVATION
    // =========================================================================
    {
      description: 'Verify pit excavation dimensions and formation',
      acceptanceCriteria: 'Excavation provides adequate clearance from pit faces; formation level correct; sides stable; excavation per RD-EW-C2',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 — Excavation compliance per trench/excavation specification'
    },
    {
      description: 'Verify pit foundation preparation and bedding',
      acceptanceCriteria: 'Foundation prepared to correct level; compacted; adequate bearing; no soft spots or standing water',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 / RD-EW-C2 — Foundation must provide adequate support for pit structure. Principal\'s Authorised Person to inspect and release.'
    },

    // =========================================================================
    // FORMWORK INSPECTION
    // =========================================================================
    {
      description: 'Inspect formwork and reinforcement prior to concrete placement (cast-in-situ pits)',
      acceptanceCriteria: 'Formwork correct dimensions per design drawings; rigid, plumb, clean, and oiled; reinforcement in place with correct cover; spacers and chairs adequate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Formwork and reinforcement inspection before concrete pour. Principal\'s Authorised Person to inspect and release.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Verify concrete placement, compaction, and curing for pit construction',
      acceptanceCriteria: 'Concrete placed without segregation; vibrated until air bubbles cease; cured per specification; correct grade used',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete testing',
      notes: 'RD-DK-C1 — Concrete placement for cast-in-situ pits. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Concrete compressive strength verification',
      acceptanceCriteria: 'Concrete strength test results comply with specified grade; sampling at required frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 concrete strength testing',
      notes: 'RD-DK-C1 — Strength acceptance criteria per specification'
    },
    {
      description: 'Inspect precast pit units on delivery (precast pits)',
      acceptanceCriteria: 'No visible cracks, spalling, honeycombing, or damage; dimensions within tolerance; units comply with RD-DK-S1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-S1 — Precast pit units must comply with supply specification'
    },
    {
      description: 'Verify precast pit placement — level, plumb, and orientation',
      acceptanceCriteria: 'Pit set level and plumb; orientation matches inlet/outlet pipe alignments; base at correct invert level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Precast pit placement per drawings. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // PIPE CONNECTIONS
    // =========================================================================
    {
      description: 'Verify pipe connection joints — external fillet (100 mm thick 10 MPa concrete)',
      acceptanceCriteria: 'External joint between pit and pipes strengthened with concrete fillet encircling the culvert — minimum 100 mm thick, minimum 10 MPa concrete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — External joint: concrete fillet encircling culvert, minimum 100 mm thick 10 MPa concrete'
    },
    {
      description: 'Verify pipe connection joints — internal render flush with mortar',
      acceptanceCriteria: 'Internal joint rendered flush with mortar; smooth internal surface; no protrusions into flow channel',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Internal joint must be rendered flush with mortar'
    },

    // =========================================================================
    // PIPE PENETRATIONS
    // =========================================================================
    {
      description: 'Verify pipe penetrations — holes cut cleanly (not broken)',
      acceptanceCriteria: 'Pipe penetration holes cut cleanly; no cracking to pit structure; holes sized correctly for pipe diameter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Holes for pipe penetrations cut cleanly, not broken'
    },
    {
      description: 'Verify 48-hour curing period before backfill (mortar joints)',
      acceptanceCriteria: 'Minimum 48 hours curing time achieved for mortar connections before any backfill placement [VERIFY DIT-specific curing requirement]',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Curing period before backfill for mortar joints [VERIFY exact requirement]'
    },

    // =========================================================================
    // GRATE/COVER INSTALLATION
    // =========================================================================
    {
      description: 'Verify grate/cover installation — correct load rating and seating',
      acceptanceCriteria: 'Covers and grates to correct load rating for location; frame securely fixed; level with surrounding surface; seated properly',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Covers and grates per design drawings; correct load rating for traffic or pedestrian area'
    },

    // =========================================================================
    // STEP IRONS & INVERT CHANNELS
    // =========================================================================
    {
      description: 'Verify step iron installation (deep pits)',
      acceptanceCriteria: 'Step irons installed where required; horizontal; equidistant spacing; not obstructing openings; galvanised',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Step irons for deep pits per specification [VERIFY exact depth threshold]'
    },
    {
      description: 'Verify invert channel formation',
      acceptanceCriteria: 'Pit floors smoothly shaped from inlets to outlet; invert channel directs flow; no obstructions; smooth transition',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Invert channel requirements specified within specification. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // SURFACE FINISH
    // =========================================================================
    {
      description: 'Verify pit surface finish and repair compliance',
      acceptanceCriteria: 'Internal surfaces free from honeycombing, blowholes, and defects; repaired surfaces match surrounding texture; no structural defects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Surface finish inspection of completed pit structure'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Verify pit backfill — material and compaction per RD-EW-C2',
      acceptanceCriteria: 'Backfill compacted in even layers per RD-EW-C2; symmetrical filling around pit; compacted to specified density',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing per RD-EW-C2',
      notes: 'RD-EW-C2 — Backfill per trench excavation and backfill specification'
    },

    // =========================================================================
    // SURVEY & DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built survey of pit locations and invert levels',
      acceptanceCriteria: 'Survey showing pit locations, invert levels, cover levels, and pipe connections; by registered surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed records'
    },
    {
      description: 'Compile and submit quality records for pit construction',
      acceptanceCriteria: 'Complete package including: concrete test results, precast certificates (RD-DK-S1), cover/grate certificates, reinforcement certificates, compaction results, photos, NCRs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — quality records for handover per PC-QA1 or PC-QA2'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA CULVERTS (DIT RD-DK-C1/S1)
// =============================================================================

const saCulvertsTemplate = {
  name: 'Drainage — Culverts (DIT RD-DK-C1/S1)',
  description: 'DIT culvert installation including precast box culverts and pipe culverts per RD-DK-C1 and RD-DK-S1 (Supply of Pipes and Culverts). Covers foundation, placement, jointing, waterproofing, and backfill.',
  activityType: 'drainage',
  specificationReference: 'RD-DK-C1 / RD-DK-S1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for culvert installation',
      acceptanceCriteria: 'All current revision drawings, RD-DK-C1, RD-DK-S1, RD-EW-C2, RD-DK-D1 (Road Drainage Design), and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 / RD-DK-S1 — Confirm culvert type (pipe culvert or box culvert), alignment, and applicable standards'
    },
    {
      description: 'Submit construction procedures for culvert installation works',
      acceptanceCriteria: 'Construction procedures submitted and accepted by Principal\'s Authorised Person; covers foundation, placement, jointing, backfill, and testing methodology',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Construction procedures must be submitted and accepted before work commences. Principal\'s Authorised Person to review and release.'
    },
    {
      description: 'Verify service location and geotechnical conditions at culvert site',
      acceptanceCriteria: 'DBYD plans obtained; services potholed; foundation conditions confirmed suitable per design assumptions',
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
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify precast culvert unit supply conformance per RD-DK-S1',
      acceptanceCriteria: 'Box culverts and pipe culverts comply with RD-DK-S1 (Supply of Pipes and Culverts); manufacturer certificates provided; RCP per AS 4058; correct class and dimensions confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4058 / RD-DK-S1',
      notes: 'RD-DK-S1 — Metal culverts (AS 2041) and plastic pipes (except TWRPP) are prohibited for DIT stormwater purposes'
    },
    {
      description: 'Inspect precast culvert units on delivery — check for damage and defects',
      acceptanceCriteria: 'No visible cracks, spalling, honeycombing, or damage; correct class and dimensions; smooth internal surfaces for water-conveying culverts',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-S1 — Pre-installation inspection of delivered culvert units'
    },
    {
      description: 'Verify bedding material compliance — Sa-C Type C Sand',
      acceptanceCriteria: 'Bedding material is Sa-C Type C Sand per RD-DK-C1; material test certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289 (grading)',
      notes: 'RD-DK-C1 — Bedding material for culverts'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Verify foundation excavation — level, dimensions, and bearing capacity',
      acceptanceCriteria: 'Excavation to correct level per design; formation stable and free from soft spots; dimensions accommodate bedding plus culvert width plus clearances; no water ponding',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 / RD-EW-C2 — Foundation preparation; formation must provide adequate bearing. Principal\'s Authorised Person to inspect and release.'
    },
    {
      description: 'Verify foundation treatment (where required — rock, soft ground)',
      acceptanceCriteria: 'Rock trimmed below culvert soffit and replaced with bedding; soft ground treated as directed by Principal\'s Authorised Person; foundation proof-rolled where required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 — Foundation treatment for adverse conditions'
    },

    // =========================================================================
    // BEDDING
    // =========================================================================
    {
      description: 'Verify culvert bedding installation — Sa-C Type C Sand',
      acceptanceCriteria: 'Bedding thickness per RD-DK-C1: 150 mm for pipes >=1500 mm dia, 125 mm where verification testing, 100 mm otherwise; compacted using approved method; grade correct; socket recesses provided for pipe culverts',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Bedding verified before culvert placement commences. Principal\'s Authorised Person to inspect and release.'
    },

    // =========================================================================
    // PLACEMENT / LIFTING
    // =========================================================================
    {
      description: 'Verify pipe culvert laying — socket orientation, alignment, and grade',
      acceptanceCriteria: 'Socket (female) ends facing upstream; pipes fully entered into sockets; lifting holes uppermost; grade per design; continuous support on bedding',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Pipe culvert laying requirements. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Verify precast box culvert unit placement — level, alignment, and seating',
      acceptanceCriteria: 'Units placed on prepared bedding; level and aligned per design; seating uniform; no rocking or gaps under units',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Box culvert placement per specification. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // JOINTING
    // =========================================================================
    {
      description: 'Verify pipe culvert jointing — per manufacturer instructions',
      acceptanceCriteria: 'Pipes jointed in accordance with manufacturer\'s instructions; joints fully assembled; no displacement of seals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Jointing per manufacturer instructions'
    },
    {
      description: 'Verify external joint strengthening — 100 mm thick 10 MPa concrete fillet',
      acceptanceCriteria: 'External joint between precast drainage structures and pipes/box culverts strengthened with concrete fillet encircling the culvert — minimum 100 mm thick, minimum 10 MPa concrete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — External joint: concrete fillet encircling culvert, minimum 100 mm thick 10 MPa concrete'
    },
    {
      description: 'Verify internal joint rendering — flush with mortar',
      acceptanceCriteria: 'Internal joint rendered flush with mortar; smooth internal surface for water flow',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Internal joint must be rendered flush with mortar'
    },

    // =========================================================================
    // WATERPROOFING
    // =========================================================================
    {
      description: 'Verify joint waterproofing and treatment (where specified)',
      acceptanceCriteria: 'Joint treatments applied per RD-DK-C1; waterproofing membrane/sealant applied to joints as specified; no punctures or tears',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Joint treatments specified within specification [VERIFY specific clause]'
    },

    // =========================================================================
    // HEADWALL / WINGWALL
    // =========================================================================
    {
      description: 'Inspect formwork and reinforcement for headwall/wingwall (before concrete pour)',
      acceptanceCriteria: 'Formwork correct dimensions per design drawings; reinforcement placed per design with correct cover; construction joints formed per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 / RD-DK-D1 — Headwall/wingwall design per RD-DK-D1 (Road Drainage Design), construction per RD-DK-C1. Principal\'s Authorised Person to inspect and release.'
    },
    {
      description: 'Verify concrete placement and curing — headwall/wingwall',
      acceptanceCriteria: 'Concrete placed without segregation; vibrated; cured per specification; correct grade; temperature within limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete testing',
      notes: 'RD-DK-C1 — Concrete placement for headwall/wingwall. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Concrete compressive strength verification — headwall/wingwall',
      acceptanceCriteria: 'Concrete strength test results comply with specified grade; sampling at required frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 concrete strength testing',
      notes: 'Strength acceptance criteria per specification'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Post-excavation hold point — before backfilling around culvert',
      acceptanceCriteria: 'Culvert installation complete; joints verified; headwall/wingwall complete and cured; ready for backfill',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Hold Point before backfilling. Principal\'s Authorised Person to release.'
    },
    {
      description: 'Verify backfill placement and compaction per RD-EW-C2',
      acceptanceCriteria: 'Backfill placed in even layers per RD-EW-C2; sand backfill compacted alternately on each side of culvert; compacted to specified density ratio',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing per RD-EW-C2',
      notes: 'RD-EW-C2 — Backfill per trench excavation and backfill specification'
    },

    // =========================================================================
    // SCOUR PROTECTION
    // =========================================================================
    {
      description: 'Verify scour protection at culvert inlet and outlet',
      acceptanceCriteria: 'Scour protection type, extent, and material per design drawings; rock beaching/riprap size and grading per specification; apron dimensions per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-D1 — Scour protection per drainage design. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'CCTV inspection of pipe culvert (where applicable)',
      acceptanceCriteria: 'CCTV inspection completed per RD-DK-C1 requirements; no structural defects, obstructions, or waste material; footage and report submitted',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CCTV inspection',
      notes: 'RD-DK-C1 — CCTV inspection for pipe culverts. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Internal inspection of box culvert — visual assessment',
      acceptanceCriteria: 'Internal surfaces inspected for cracking, joint integrity, water ingress; smooth continuous flow surfaces; no debris or construction waste; joints fully sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Internal inspection of completed box culvert. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Principal\'s Authorised Person approval before pavement construction over culvert',
      acceptanceCriteria: 'All inspections complete; all test results compliant; all defects remediated; backfill compaction verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Approval required before pavement layers. Principal\'s Authorised Person to release.'
    },

    // =========================================================================
    // SURVEY & DOCUMENTATION
    // =========================================================================
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
      description: 'Verify culvert waterway capacity confirmation',
      acceptanceCriteria: 'Constructed waterway area and alignment match design requirements per RD-DK-D1; no encroachments reducing capacity',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-D1 — Confirm constructed waterway matches design'
    },
    {
      description: 'Compile and submit quality records package — culvert works',
      acceptanceCriteria: 'Complete package: unit supply certificates (RD-DK-S1), concrete test results, reinforcement certificates, bedding/backfill tests, compaction results, survey data, photos, NCRs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — comprehensive quality records for handover per PC-QA1 or PC-QA2'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA SUBSOIL/SUBSURFACE DRAINAGE (DIT RD-DK-C1 / RD-DK-D1)
// =============================================================================

const saSubsoilDrainageTemplate = {
  name: 'Drainage — Subsoil/Subsurface (DIT RD-DK-C1)',
  description: 'DIT subsoil and subsurface drainage including agricultural drains, filter drains, and UPVC drain connections per RD-DK-C1 and RD-DK-D1 (Road Drainage Design).',
  activityType: 'drainage',
  specificationReference: 'RD-DK-C1 / RD-DK-D1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for subsurface drainage works',
      acceptanceCriteria: 'All current revision drawings, RD-DK-C1, RD-DK-D1 (Road Drainage Design), RD-EW-C2, RD-PV-D1 (Pavement Design), and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 / RD-DK-D1 — SA DIT does not have a separate standalone specification for subsurface drainage. Requirements are within RD-DK-C1 (construction) and RD-DK-D1 (design), supplemented by RD-PV-D1.'
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
    // TRENCH EXCAVATION
    // =========================================================================
    {
      description: 'Verify trench excavation — depth, width, and grade per RD-EW-C2',
      acceptanceCriteria: 'Trench excavation compliant with RD-EW-C2; correct width, depth per design; trench bottom firm, stable, compacted, and free from standing water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C2 — Trench excavation per companion specification'
    },
    {
      description: 'Inspect trench base prior to filter material and pipe placement',
      acceptanceCriteria: 'Trench base firm, stable, compacted; grade correct for drain fall; free from loose material and standing water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 / RD-EW-C2 — Trench base inspection before installation'
    },

    // =========================================================================
    // MATERIALS
    // =========================================================================
    {
      description: 'Verify filter material and geotextile compliance',
      acceptanceCriteria: 'Filter material and geotextile requirements per Austroads Guide and RD-DK-D1; material certificates provided; free from deleterious matter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-D1 — Filter material and geotextile requirements referenced to Austroads Guide'
    },
    {
      description: 'Verify subsoil drain pipe material compliance',
      acceptanceCriteria: 'Pipe material per specification; correct class and diameter; perforations per requirements; manufacturer certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C1 — Subsoil drain pipe materials per specification'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Verify bedding layer placement in trench',
      acceptanceCriteria: 'Filter material bedding placed across trench bottom to specified thickness; uniform and level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Bedding layer for subsoil drain pipe'
    },
    {
      description: 'Verify pipe grade — correct fall for drainage',
      acceptanceCriteria: 'Pipe grade per design; positive fall to outlet; no sags or reverse grades that would allow ponding',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 / RD-DK-D1 — Pipe grade verification. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Verify filter material/geotextile placement around pipe',
      acceptanceCriteria: 'Filter material or geotextile placed per design cross-section; fully enveloping pipe; no tears, punctures, or contamination; laps per requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-D1 / Austroads Guide — Filter material/geotextile placement'
    },
    {
      description: 'Verify 100 mm UPVC flushout point connections — every 100 metres',
      acceptanceCriteria: '100 mm diameter UPVC pipe connected to the subsoil drain as flushout points at intervals not exceeding 100 metres; connections secure and watertight',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-D1 — Flush-out points every 100 metres consisting of 100 mm diameter UPVC pipe connected to the subsoil drain'
    },
    {
      description: 'Verify drainage connection to pits — intervals not exceeding 250 metres',
      acceptanceCriteria: 'Drainage infrastructure connects to drainage pits at intervals not exceeding 250 metres per RD-DK-D1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-D1 — Drainage infrastructure must connect to drainage pits at intervals not exceeding 250 metres'
    },

    // =========================================================================
    // SUBSOIL DRAIN HOLD POINT
    // =========================================================================
    {
      description: 'Subsoil drain placement hold point — prior to backfilling',
      acceptanceCriteria: 'Subsoil drain placed correctly; grade verified; filter material/geotextile in place; flushout connections installed; ready for backfill',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Following placement of subsoil drain and prior to backfilling, a Hold Point applies. Principal\'s Authorised Person to release.'
    },

    // =========================================================================
    // OUTLET CONNECTION
    // =========================================================================
    {
      description: 'Verify outlet connection to stormwater system',
      acceptanceCriteria: 'Outlet connection to stormwater system per RD-DK-C1; positive fall to outlet; connection sealed; outlet protected from blockage',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C1 — Outlet connection per specification. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'Flow testing of completed subsurface drain',
      acceptanceCriteria: 'Drain flushed with water; water flows freely from inlet to outlet via flushout points; no blockages',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Flow / flushing test',
      notes: 'RD-DK-C1 — Flow testing of completed drain. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Verify backfill placement and compaction per RD-EW-C2',
      acceptanceCriteria: 'Backfill placed in even layers per RD-EW-C2; compacted to specified density; no damage to drain or filter materials during compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing per RD-EW-C2',
      notes: 'RD-EW-C2 — Backfill per trench excavation and backfill specification'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built survey of subsurface drainage installation',
      acceptanceCriteria: 'As-built survey showing drain alignment, invert levels, flushout point locations, pit connections, and cover depths; by registered surveyor',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General requirement — as-constructed documentation'
    },
    {
      description: 'Compile and submit quality records package — subsurface drainage',
      acceptanceCriteria: 'Complete package: pipe certificates, filter material test results, geotextile certificates, flow test records, as-built survey, photos, NCRs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'General QA requirement — quality records for handover per PC-QA1 or PC-QA2'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
    }
  ]
}

// =============================================================================
// SA KERB & CHANNEL (DIT RD-DK-C2)
// =============================================================================

const saKerbChannelTemplate = {
  name: 'Kerb & Channel (DIT RD-DK-C2)',
  description: 'DIT kerb and channel construction including barrier, semi-mountable, and mountable profiles per RD-DK-C2 (Kerbing, formerly Part R05). Covers subgrade preparation, formwork/extrusion, concrete, joints, and curing.',
  activityType: 'drainage',
  specificationReference: 'RD-DK-C2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for kerb and channel works',
      acceptanceCriteria: 'All current revision drawings, RD-DK-C2, AS 2876, and project-specific requirements reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C2 — Scope covers kerb and gutter, kerb ramps, property crossovers, median kerb, side drains, dish drains. Must comply with AS 2876 (Concrete kerbs and channel).'
    },
    {
      description: 'Submit concrete mix design for kerb and channel works',
      acceptanceCriteria: 'Mix design compliant with RD-DK-C2 concrete requirements; strength grade per specification; submitted and accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C2 — Concrete properties and materials requirements defined within specification. Principal\'s Authorised Person to review and release.'
    },
    {
      description: 'Verify kerb profile type — barrier, semi-mountable, or mountable per design',
      acceptanceCriteria: 'Correct kerb profile type confirmed per design drawings; profile template or extrusion mould matches specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C2 — Both manually and machine-placed (extruded) kerbing covered'
    },

    // =========================================================================
    // SUBGRADE PREPARATION
    // =========================================================================
    {
      description: 'Inspect subgrade preparation for kerb and channel',
      acceptanceCriteria: 'Subgrade trimmed to design level; compacted and firm; surface free of soft spots, organic material, and standing water; subgrade shape matches underside of kerb profile',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Preparation and supportive layers specified within specification. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Verify kerb alignment string line or machine guidance',
      acceptanceCriteria: 'String line or guidance system set to correct horizontal alignment and vertical grade; check against design drawings; transitions and curves correctly set out',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Alignment to be verified before commencement of kerb placement'
    },

    // =========================================================================
    // FORMWORK / EXTRUSION SETUP
    // =========================================================================
    {
      description: 'Inspect formwork for hand-placed kerb and channel (or verify extrusion machine setup)',
      acceptanceCriteria: 'Formwork set to correct profile per specification; forms to correct line and level; clean and oiled; OR extrusion machine producing correct kerb profile, mould plates clean and calibrated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 / AS 2876 — Both manually and machine-placed kerbing covered. Must comply with AS 2876. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // CONCRETE SUPPLY & PLACEMENT
    // =========================================================================
    {
      description: 'Verify concrete supply compliance per RD-DK-C2',
      acceptanceCriteria: 'Concrete complies with RD-DK-C2 material requirements; correct grade; delivery dockets confirm compliance; slump within specified range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C2 — Concrete properties and materials requirements defined within specification'
    },
    {
      description: 'Verify reinforcement placement in kerb and channel (where specified)',
      acceptanceCriteria: 'Reinforcement per design drawings; correct grade, size, spacing; minimum cover per specification; reinforcement clean and properly tied',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Reinforcement where specified per design. Principal\'s Authorised Person to witness.'
    },
    {
      description: 'Verify weather conditions before concrete placement',
      acceptanceCriteria: 'Ambient temperature within specified limits; no rain or forecast rain; wind not excessive for curing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-DK-C2 — Weather restrictions for concrete placement'
    },
    {
      description: 'Place and compact concrete for kerb and channel',
      acceptanceCriteria: 'Concrete placed without segregation; compacted by vibration or tamping; no voids, honeycombing, or surface defects; kerb profile maintained throughout placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Concrete placement per specification'
    },

    // =========================================================================
    // FINISHING
    // =========================================================================
    {
      description: 'Finish kerb and channel surfaces',
      acceptanceCriteria: 'Exposed surfaces finished smooth and free of blemishes; lip of kerb sharp and well-defined; channel surface smooth with correct cross-fall for drainage; finish consistent throughout; surface finish per AS 2876',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 / AS 2876 — Surface finish must comply with AS 2876'
    },
    {
      description: 'Conduct concrete conformance sampling',
      acceptanceCriteria: 'Concrete sampled at required frequency; slump tested; compressive strength cylinders cast and tested at required ages; results meet specified strength grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 (Slump / Strength)',
      notes: 'RD-DK-C2 — Testing frequency per specification'
    },

    // =========================================================================
    // JOINT FORMATION
    // =========================================================================
    {
      description: 'Install contraction joints at specified spacing',
      acceptanceCriteria: 'Contraction joints formed per AS 2876; joints at specified intervals; joint depth minimum per specification; joints clean',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 / AS 2876 — Joints in kerbing must be in accordance with AS 2876'
    },
    {
      description: 'Install expansion joints at specified locations',
      acceptanceCriteria: 'Expansion joints at structures, junctions, and changes in direction per AS 2876; compressible filler board full depth; filler flush with channel surface',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 / AS 2876 — Joints in accordance with AS 2876'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing to kerb and channel immediately after finishing',
      acceptanceCriteria: 'Curing commenced immediately after finishing; minimum curing period per specification; acceptable curing method applied and maintained for full curing period',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Curing per specification requirements. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // DIMENSIONAL TOLERANCES & ALIGNMENT SURVEY
    // =========================================================================
    {
      description: 'Verify kerb and channel dimensions and profile',
      acceptanceCriteria: 'Kerb profile matches specified type (barrier, semi-mountable, or mountable); dimensions within tolerances per AS 2876; lip height, face width, and channel width per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Profile template / measurement',
      notes: 'RD-DK-C2 / AS 2876 — Tolerances in accordance with AS 2876'
    },
    {
      description: 'Verify kerb alignment (line) and level by survey',
      acceptanceCriteria: 'Alignment and level within tolerances per AS 2876; no abrupt changes in alignment or grade; kerb and channel drains freely',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'String line / survey',
      notes: 'RD-DK-C2 / AS 2876 — Alignment survey. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // CHANNEL DRAINAGE & BACKFILL
    // =========================================================================
    {
      description: 'Verify channel drainage performance',
      acceptanceCriteria: 'Channel cross-fall drains freely to gutter; no ponding in channel; water flows to inlet pits without obstruction; transitions between kerb types smooth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Functional check that kerb and channel system drains correctly'
    },
    {
      description: 'Verify backfill placement and compaction behind kerb',
      acceptanceCriteria: 'Backfill placed and compacted behind kerb per specification; no voids; kerb adequately supported',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 — Backfill behind kerb per specification'
    },

    // =========================================================================
    // SURFACE FINISH INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed kerb and channel for defects and surface finish',
      acceptanceCriteria: 'No cracking, spalling, or surface defects; kerb lip sharp and consistent; joints correctly formed; curing complete; channel drains freely; kerb not damaged by construction traffic; surface finish compliant with AS 2876',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-DK-C2 / AS 2876 — Final visual inspection. Surface finish must comply with AS 2876. Principal\'s Authorised Person to witness.'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit kerb and channel records — as-built survey and test results',
      acceptanceCriteria: 'As-built survey of kerb alignment and level; concrete strength test results; construction records including dates, weather, concrete batches, and joint locations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Final handover documentation per PC-QA1 or PC-QA2'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off by Principal\'s Authorised Person',
      acceptanceCriteria: 'All criteria met, all hold points released, all test results conforming',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person'
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
  console.log(' SA (DIT) ITP Template Seeder - Drainage')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saPipeInstallationTemplate)
    await seedTemplate(saPitsChambersTemplate)
    await seedTemplate(saCulvertsTemplate)
    await seedTemplate(saSubsoilDrainageTemplate)
    await seedTemplate(saKerbChannelTemplate)

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
