/**
 * Seed Script: SA (DIT) ITP Templates - Road Furniture
 *
 * Creates global ITP templates for SA road furniture activities.
 * Templates: Wire Rope Safety Barrier (RD-BF-C2), W-Beam Guard Fence (RD-BF-C1),
 *            Concrete Barrier (RD-BF-C3), Pavement Marking (RD-LM-C1/S1),
 *            Fencing (RD-BF-C4)
 *
 * Run with: node scripts/seed-itp-templates-sa-road-furniture.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: WIRE ROPE SAFETY BARRIER (DIT RD-BF-C2)
// Based on: DIT RD-BF-C2 (formerly Part R43), RD-BF-D1, SD3502, SD3503, MASH/ASBAP
// =============================================================================

const saWireRopeBarrierTemplate = {
  name: 'Wire Rope Safety Barrier (DIT RD-BF-C2)',
  description: 'DIT Wire Rope Safety Barrier Systems per RD-BF-C2 (formerly Part R43). Covers DIT Approved Products, manufacturer supervision, post installation, cable tensioning, anchor blocks, and MASH-compliant end terminals.',
  activityType: 'road_furniture',
  specificationReference: 'RD-BF-C2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for WRSB installation',
      acceptanceCriteria: 'All current revision drawings, RD-BF-C2, RD-BF-D1 (Design of Roadside Safety Barriers), SD3502, SD3503, and manufacturer installation manual reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2 (formerly Part R43). Covers supply and installation of WRSB systems. Design requirements per RD-BF-D1. Principal\'s Authorised Person to confirm scope before work commences.'
    },
    {
      description: 'Submit product details confirming WRSB system is on DIT Approved Products list',
      acceptanceCriteria: 'WRSB system confirmed as a DIT accepted/approved product per DIT Approved Products list (KNet #13401680, updated July 2025); product compliance documentation submitted to and accepted by Principal\'s Authorised Person prior to installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. WRSB must be a DIT accepted/approved product. Installation cannot proceed without Principal\'s Authorised Person acceptance of product documentation. DIT Approved Products list maintained centrally.'
    },
    {
      description: 'Verify Technical Conditions of Use (TCU) compliance for the specific WRSB product',
      acceptanceCriteria: 'Product-specific TCU issued by DIT reviewed and all conditions identified; any site-specific deviations from TCU documented and approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. DIT issues product-specific TCUs (e.g., TCU for Mashflex Wire Rope Barrier - Permanent, dated March 2022). All TCU conditions must be met.'
    },
    {
      description: 'Verify MASH Test Level certification for WRSB system and end terminals via ASBAP',
      acceptanceCriteria: 'WRSB system and end terminals certified to MASH Test Level as specified in design (typically TL-3 or TL-4); certification confirmed through Austroads National Safety Barrier Assessment Panel (ASBAP) records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'MASH via ASBAP',
      notes: 'RD-BF-C2 / RD-BF-D1. All safety barrier products must be assessed and recommended by ASBAP for the specified MASH Test Level.'
    },
    {
      description: 'Verify manufacturer\'s supervisor nominated and available for installation',
      acceptanceCriteria: 'Person with experience in the manufacturer\'s barrier installation nominated in writing; supervisor confirmed available to be on site at all times during installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. Barrier products must be installed under constant supervision of a person experienced in the manufacturer\'s barrier installation. Supervisor must be on site at all times during installation.'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Verify material certificates -- posts, wire ropes, fittings, and galvanising',
      acceptanceCriteria: 'All ferrous components galvanized per applicable standard; wire ropes supplied on reels and protected from damage; material certificates provided for posts, ropes, fittings, and anchorage components',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. All material certificates to be submitted to Principal\'s Authorised Person. Wire ropes must be protected during storage and handling.'
    },
    {
      description: 'Inspect post foundation type and preparation',
      acceptanceCriteria: 'Foundation type confirmed per manufacturer\'s instructions and DIT standard drawings; excavation to correct depth and dimensions; any deviation from standard foundations approved by manufacturer and Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C2. Post foundations must comply with manufacturer\'s requirements and DIT standard drawings. Non-standard foundations require written approval.'
    },
    {
      description: 'Principal\'s Authorised Person approval of post foundation construction before casting',
      acceptanceCriteria: 'Post foundations inspected and approved by Principal\'s Authorised Person before casting or backfilling; concrete grade and reinforcement (if required) verified; foundation form or void former correctly positioned',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. Foundation construction requires Principal\'s Authorised Person inspection and approval before proceeding.'
    },
    {
      description: 'Install posts per manufacturer instructions and DIT standard drawings',
      acceptanceCriteria: 'Posts installed at correct spacing, depth, and alignment per manufacturer\'s instructions and DIT standard drawings; posts plumb within tolerance; minimum offset from batter hinge points maintained per SD3502',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C2. SD3502 provides guard fence and wire rope safety barrier offset guidelines. Manufacturer\'s supervisor must be present during installation.'
    },
    {
      description: 'Verify post alignment survey against design',
      acceptanceCriteria: 'Post alignment surveyed and compared to design drawings; alignment within specified tolerances; sight distance requirements satisfied; survey results submitted to Principal\'s Authorised Person',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'RD-BF-C2 / RD-BF-D1. Alignment must satisfy barrier performance and sight distance requirements.'
    },

    // =========================================================================
    // CABLE INSTALLATION AND TENSIONING
    // =========================================================================
    {
      description: 'Install wire ropes per manufacturer\'s requirements',
      acceptanceCriteria: 'Wire ropes installed without twisting, kinking, or damage; ropes threaded through posts in correct sequence per manufacturer\'s manual; all fittings installed correctly; rope ends properly terminated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C2. No twisting or damage permitted during installation. Manufacturer\'s supervisor must oversee rope installation.'
    },
    {
      description: 'Verify cable tensioning per manufacturer\'s specifications and DIT requirements',
      acceptanceCriteria: 'Wire ropes tensioned to correct tension for ambient temperature per manufacturer\'s tension/temperature chart; tension measured and recorded for each rope; tensioning compliant with both manufacturer\'s specifications and DIT requirements',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tension measurement',
      notes: 'RD-BF-C2. Cable tensioning must comply with manufacturer\'s specifications AND DIT requirements. Rope tension must be verified post-installation. Temperature affects required tension.'
    },

    // =========================================================================
    // ANCHOR BLOCKS AND END TERMINALS
    // =========================================================================
    {
      description: 'Inspect anchor block construction',
      acceptanceCriteria: 'Anchor blocks constructed per manufacturer\'s details and DIT standard drawings; concrete grade as specified; dimensions per design; wire rope anchorage fittings correctly cast in; reinforcement placed correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C2. Anchor blocks are critical structural elements. Principal\'s Authorised Person to inspect before casting.'
    },
    {
      description: 'Inspect end terminal installation -- MASH Test Level compliant (ASBAP approved)',
      acceptanceCriteria: 'End terminals installed per manufacturer\'s details; terminal type meets MASH Test Level as nominated by ASBAP; terminal correctly aligned with approach traffic; runout area clear of obstructions; installation supervised by manufacturer\'s representative',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'MASH compliance via ASBAP',
      notes: 'RD-BF-C2 / RD-BF-D1. End terminals must comply with MASH Test Level requirements as nominated by ASBAP. Critical safety element requiring Principal\'s Authorised Person approval.'
    },

    // =========================================================================
    // CONCRETE MAINTENANCE STRIPS
    // =========================================================================
    {
      description: 'Install concrete maintenance strip at post bases per SD3503 (where specified)',
      acceptanceCriteria: 'Concrete maintenance strip installed per SD3503; concrete grade, depth, and width per standard drawing; strip extends full length as specified; surface finished to shed water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD3503 - Concrete Maintenance Strips for Guard Fence and WRSB. Required where specified to prevent vegetation growth around posts.'
    },

    // =========================================================================
    // DELINEATION AND FINISHING
    // =========================================================================
    {
      description: 'Install delineators on WRSB posts per DIT barrier design specification',
      acceptanceCriteria: 'Delineators installed per DIT standard drawings and RD-BF-D1 requirements; correct colour configuration; spacing as specified; retroreflective material compliant; securely attached',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-D1. Delineation must comply with DIT standard drawings and barrier design specification.'
    },
    {
      description: 'Verify completed WRSB alignment and tolerances',
      acceptanceCriteria: 'Vertical height, longitudinal alignment, and post spacing all within specified tolerances; barrier line smooth and continuous; no kinks or discontinuities',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey measurement',
      notes: 'RD-BF-C2. Final dimensional check of completed barrier installation.'
    },
    {
      description: 'Visual inspection of completed WRSB installation',
      acceptanceCriteria: 'All components installed and complete; no damaged or missing components; galvanising intact; cables correctly tensioned; terminals complete; delineators installed; no debris or hazards in barrier zone',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C2. Visual inspection to confirm complete and defect-free installation.'
    },
    {
      description: 'Submit manufacturer\'s installation compliance certificate and checklists',
      acceptanceCriteria: 'Completed installation checklists signed by installer and manufacturer\'s supervisor; compliance certificate issued for each WRSB section; all defects rectified; documentation submitted to Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. Manufacturer\'s supervisor must confirm installation compliance. Part of final handover documentation to Principal\'s Authorised Person.'
    },
    {
      description: 'Submit as-built survey and records to Principal\'s Authorised Person',
      acceptanceCriteria: 'As-built survey of WRSB alignment; tensioning records; material certificates; TCU compliance confirmation; product compliance documentation; all records collated and submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C2. Complete handover documentation package for Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: W-BEAM GUARD FENCE (DIT RD-BF-C1)
// Based on: DIT RD-BF-C1 (formerly Part R42), RD-BF-D1, AS 1594, AS 3569, AS/ISO 9001
// =============================================================================

const saWBeamGuardFenceTemplate = {
  name: 'W-Beam Guard Fence (DIT RD-BF-C1)',
  description: 'DIT Steel Beam Safety Barrier Systems per RD-BF-C1 (formerly Part R42). Covers AS 1594 Grade HA350 steel rails, post embedment, rail fixing, end treatments, and delineation.',
  activityType: 'road_furniture',
  specificationReference: 'RD-BF-C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for steel beam safety barrier installation',
      acceptanceCriteria: 'All current revision drawings, RD-BF-C1, RD-BF-D1 (Design of Roadside Safety Barriers), SD3502, SD3503, and manufacturer instructions reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C1 (formerly Part R42). Covers supply and installation of steel beam safety barrier systems including W-beam guard fence. Principal\'s Authorised Person to confirm scope.'
    },
    {
      description: 'Submit product compliance documentation -- DIT Approved Products and material certificates',
      acceptanceCriteria: 'Guard fence system confirmed as DIT accepted product (KNet #13401680); components manufactured under quality system certified to AS/ISO 9001; material test certificates submitted to Principal\'s Authorised Person and accepted prior to installation commencing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/ISO 9001',
      notes: 'RD-BF-C1. Provision of documentation (certificates, test results) constitutes a HOLD POINT prior to installation commencing. Components must be manufactured under AS/ISO 9001 certified quality system.'
    },
    {
      description: 'Verify steel rail compliance -- AS 1594 Grade HA350',
      acceptanceCriteria: 'W-beam rails manufactured from steel complying with AS 1594 Grade HA350; mill certificates provided showing yield strength, tensile strength, and elongation values; all results within specified limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1594 Grade HA350',
      notes: 'RD-BF-C1. Steel rails must comply with AS 1594 Grade HA350.'
    },
    {
      description: 'Verify steel post compliance -- AS 1594 Grade HA300/HU300',
      acceptanceCriteria: 'Steel posts manufactured from steel complying with AS 1594 Grade HA300 and HU300 respectively; mill certificates provided and verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1594 Grade HA300/HU300',
      notes: 'RD-BF-C1. Post steel grade differs from rail steel grade.'
    },
    {
      description: 'Verify hot-dip galvanizing of all steel components',
      acceptanceCriteria: 'All steel components hot-dip galvanized after fabrication; galvanizing certificates provided; coating thickness meets specified minimum; no bare spots, blisters, or surface defects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Hot-dip galvanizing inspection',
      notes: 'RD-BF-C1. All steel components must be hot-dip galvanized after fabrication.'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Verify offset guidelines per SD3502 before post installation',
      acceptanceCriteria: 'Guard fence offset from traffic lane edge verified against SD3502 requirements; minimum offset from batter hinge points confirmed; any non-standard offsets approved by Principal\'s Authorised Person',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey',
      notes: 'SD3502 - Guard Fence and Wire Rope Safety Barrier Offset Guidelines. Offset dimensions critical for barrier performance.'
    },
    {
      description: 'Install posts to correct embedment depth, alignment, spacing, and plumb',
      acceptanceCriteria: 'Posts driven or placed in holes to specified embedment depth per design; post spacing per design drawings; posts plumb within tolerance; holes backfilled in compacted layers where applicable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1. Post embedment depth critical for barrier performance. Non-standard post lengths require Principal\'s Authorised Person approval.'
    },
    {
      description: 'Conduct post foundation compliance check',
      acceptanceCriteria: 'Foundation displacement checked under test load as specified; results within allowable limits; test conducted on sample of posts or all posts as required by specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Foundation load test',
      notes: 'RD-BF-C1. Foundation compliance achieved when displacement does not exceed specified limit under test load.'
    },
    {
      description: 'Install concrete maintenance strip at post bases per SD3503 (where specified)',
      acceptanceCriteria: 'Concrete maintenance strip installed per SD3503; concrete grade, depth, and width per standard drawing; strip extends full length as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD3503 - Concrete Maintenance Strips for Guard Fence and WRSB. Required where specified.'
    },

    // =========================================================================
    // RAIL INSTALLATION AND BOLTING
    // =========================================================================
    {
      description: 'Install W-beam rails to correct height, alignment, and overlap direction',
      acceptanceCriteria: 'Rail height per design drawings; rails lapped with exposed ends facing away from approaching traffic; all bolt holes aligned; no forced fits or deformation of rails',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1. Lap direction is critical for barrier performance -- exposed ends must face away from traffic.'
    },
    {
      description: 'Tighten all splice and post bolts',
      acceptanceCriteria: 'All splice bolts and post bolts fully tightened; bolt head orientation correct (flush on traffic side); bolt grades per specification; no protruding bolt heads on traffic face',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Bolt tightness check',
      notes: 'RD-BF-C1. All bolts shall be fully tightened. Bolt head orientation critical for vehicle deflection performance.'
    },
    {
      description: 'Verify splice connections between rail sections',
      acceptanceCriteria: 'Splice connections made per specification; correct number of bolts installed; splice plates (if applicable) correctly positioned; connection secure with no movement or gaps',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1. Splice connections must maintain barrier continuity and structural integrity.'
    },

    // =========================================================================
    // END TREATMENTS (TERMINALS)
    // =========================================================================
    {
      description: 'Verify terminal installer has attended manufacturer\'s terminal installation training',
      acceptanceCriteria: 'Person supervising terminal installation has attended training in the installation of terminals conducted by the manufacturer; training certificate or evidence provided; supervisor on site at all times during terminal installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C1. Terminals must be installed under the supervision of a person who has attended terminal installation training conducted by the manufacturer. This person must be on site at all times.'
    },
    {
      description: 'Install end terminals -- MASH compliant per ASBAP recommendation',
      acceptanceCriteria: 'End terminals installed per manufacturer\'s details; terminal type meets MASH Test Level as recommended by ASBAP; MELT (Modified Eccentric Loader Terminal) used where practicable; trailing terminals only on departure end where MELT is not practicable; trailing terminals NOT within clear zone of opposing traffic',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'MASH compliance via ASBAP',
      notes: 'RD-BF-C1. Trailing terminals may only be used on departure end where MELT is not practicable due to road condition or terrain. Must NOT be within clear zone of opposing traffic.'
    },
    {
      description: 'Verify wire rope for breakaway cable terminals complies with AS 3569',
      acceptanceCriteria: 'Wire rope (where used in breakaway cable terminals) compliant with AS 3569; certificates provided; rope correctly installed and tensioned',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3569',
      notes: 'RD-BF-C1. Wire rope for breakaway cable terminals must comply with AS 3569.'
    },

    // =========================================================================
    // DELINEATION AND FINISHING
    // =========================================================================
    {
      description: 'Install delineation per DIT standard drawings and RD-BF-D1',
      acceptanceCriteria: 'Delineators installed per DIT standard drawings and barrier design specification RD-BF-D1; correct colour configuration; spacing as specified; retroreflective material compliant; securely attached and visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1 / RD-BF-D1. Delineation must comply with DIT standard drawings and barrier design specification.'
    },
    {
      description: 'Verify completed guard fence alignment survey',
      acceptanceCriteria: 'Plan position, vertical profile, horizontal alignment, and post vertical deviation all within specified tolerances; survey results submitted to Principal\'s Authorised Person',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey measurement',
      notes: 'RD-BF-C1. Final dimensional check of completed guard fence.'
    },
    {
      description: 'Visual and functional inspection of completed guard fence',
      acceptanceCriteria: 'All components installed and complete; no damaged or missing components; galvanising intact (any damage repaired); rail continuous with correct overlaps; bolts tight; terminals complete; delineators installed; motorcycle barrier components installed where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1. Damaged galvanising must be repaired. Motorcycle barrier components (if specified) must also be a DIT accepted product.'
    },
    {
      description: 'Inspect galvanising repair on any damaged components',
      acceptanceCriteria: 'Any galvanising damage identified and repaired by regalvanising or approved zinc-rich paint system; repair method approved by Principal\'s Authorised Person; repaired areas visually inspected',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C1. All damaged galvanising must be repaired to maintain corrosion protection.'
    },
    {
      description: 'Submit as-built records, material certificates, and compliance documentation',
      acceptanceCriteria: 'As-built survey; mill certificates for steel rails and posts; galvanizing certificates; terminal installation records; manufacturer\'s installation checklists; AS/ISO 9001 quality records; all documentation submitted to Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C1. Complete handover documentation package for Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 3: CONCRETE BARRIER (DIT RD-BF-C3)
// Based on: DIT RD-BF-C3, RD-BF-D1, Division CC Concrete, Austroads ATS 4230
// =============================================================================

const saConcreteBarrierTemplate = {
  name: 'Concrete Barrier (DIT RD-BF-C3)',
  description: 'DIT Concrete Safety Barrier installation per RD-BF-C3. Covers foundation preparation, barrier placement or casting, joint treatment, reflectors, and alignment verification.',
  activityType: 'road_furniture',
  specificationReference: 'RD-BF-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for concrete barrier works',
      acceptanceCriteria: 'All current revision drawings, RD-BF-C3, RD-BF-D1, Division CC concrete specifications, and Austroads ATS 4230 reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C3. Covers cast-in-place and precast concrete safety barrier systems including F-type (New Jersey) profiles. Principal\'s Authorised Person to confirm scope.'
    },
    {
      description: 'Verify barrier product is on DIT Approved Products list or has DIT acceptance conditions',
      acceptanceCriteria: 'Barrier system (including connections) listed on DIT Approved Products list (KNet #13401680) or DIT-issued acceptance conditions obtained (e.g., T-LOK 350 F-TYPE acceptance conditions); MASH Test Level confirmed via ASBAP',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'MASH compliance via ASBAP',
      notes: 'RD-BF-C3 / RD-BF-D1. DIT publishes separate acceptance conditions for specific products. Only accepted barrier systems may be installed.'
    },
    {
      description: 'Submit concrete mix design for barrier construction',
      acceptanceCriteria: 'Mix design compliant with DIT Division CC concrete specifications; strength grade as specified in design; exposure class and cover per design; mix design submitted to and accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Division CC concrete specs; Austroads ATS 4230',
      notes: 'RD-BF-C3. Concrete must comply with DIT concrete specifications (Division CC). Principal\'s Authorised Person approval required before placement.'
    },
    {
      description: 'Verify steel reinforcement compliance with Australian Standards',
      acceptanceCriteria: 'Reinforcement complies with relevant Australian Standards; mill certificates provided for all reinforcement; bar sizes, grades, and quantities match design requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4671',
      notes: 'RD-BF-C3. Steel reinforcement must comply with relevant Australian Standards.'
    },

    // =========================================================================
    // FOUNDATION
    // =========================================================================
    {
      description: 'Inspect foundation preparation -- subgrade, base, or structure',
      acceptanceCriteria: 'Foundation prepared to correct level, compacted, and free of loose material; foundation type as specified (ground-level, bridge deck, or median); for cast-in-place barriers, interface cleaned and keyed/roughened where required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Foundation preparation must comply with specification requirements. Principal\'s Authorised Person to inspect before barrier construction.'
    },
    {
      description: 'Inspect terminal anchor footing construction (where required)',
      acceptanceCriteria: 'Anchor footing excavated to correct dimensions per design; reinforcement placed per design; concrete grade as specified; formed to correct profile',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Terminal anchor required where barrier is not otherwise restrained.'
    },

    // =========================================================================
    // FORMWORK AND REINFORCEMENT (CAST-IN-PLACE)
    // =========================================================================
    {
      description: 'Inspect formwork for cast-in-place barrier -- F-type profile, alignment, and rigidity',
      acceptanceCriteria: 'Formwork matches F-type (New Jersey) profile per specification and design drawings; forms set to correct alignment and level; forms rigid, clean, and oiled; joints sealed; chamfers installed where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. F-type profile dimensions must be exact for barrier to perform to MASH Test Level.'
    },
    {
      description: 'Inspect reinforcing steel placement before concrete pour',
      acceptanceCriteria: 'Reinforcement per design drawings; bar sizes, spacing, and configuration correct; minimum cover achieved per exposure class; bars tied at intersections; bar chairs stable; splice lengths per AS/NZS 4671; reinforcement clean',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Principal\'s Authorised Person must inspect reinforcement before concrete placement.'
    },
    {
      description: 'Verify embedment of anchor bolts, dowels, and connection hardware',
      acceptanceCriteria: 'Anchor bolts, dowels, and connection hardware positioned per design; embedment depth correct; bolts plumb and aligned; templates secured against movement during concrete placement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Connection hardware must be correctly cast in for precast-to-cast-in-place connections or barrier-to-structure connections.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT AND CURING
    // =========================================================================
    {
      description: 'Place, compact, and finish concrete barrier',
      acceptanceCriteria: 'Concrete placed per DIT Division CC requirements; vibrated to full compaction without segregation; F-type profile maintained; top surface finished smooth; no honeycombing, cold joints, or surface defects',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3 / Division CC. Continuous placement preferred within each barrier segment.'
    },
    {
      description: 'Conduct concrete conformance sampling and testing',
      acceptanceCriteria: 'Samples taken per DIT concrete specification requirements; slump tested; strength cylinders cast and tested at specified ages; results meet specified strength grade; all batch tickets retained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 series; Austroads ATS 4230',
      notes: 'RD-BF-C3 / Division CC / Austroads ATS 4230. Concrete sampling and testing per Australian Standards and Austroads test methods.'
    },
    {
      description: 'Cure concrete barrier for minimum period',
      acceptanceCriteria: 'Curing commenced immediately after finishing; minimum curing period per DIT concrete specification; approved curing method applied; membrane protected from damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3 / Division CC. Acceptable methods per DIT concrete specification requirements.'
    },

    // =========================================================================
    // PRECAST BARRIER PLACEMENT
    // =========================================================================
    {
      description: 'Inspect precast barrier segments before placement',
      acceptanceCriteria: 'Precast segments manufactured per specification; F-type profile per design; no cracks, chips, or honeycombing; connection hardware undamaged and correctly positioned; lifting inserts intact; manufacturer\'s quality certificates provided',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Precast segments must be inspected before delivery to site.'
    },
    {
      description: 'Place precast barrier segments to correct alignment and level',
      acceptanceCriteria: 'Barrier segments placed on prepared foundation; segments aligned with adjacent segments; connections made per specification; no gaps exceeding tolerance; barrier line smooth without kinks; adequate anchorage per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Survey',
      notes: 'RD-BF-C3. Adequate anchorage required per MASH Test Level and site conditions.'
    },

    // =========================================================================
    // JOINTS AND CONNECTIONS
    // =========================================================================
    {
      description: 'Inspect barrier joints and connections',
      acceptanceCriteria: 'Construction joints and expansion joints at correct locations per design; joint sealant applied per specification; segment connections correctly installed; dowels (if any) aligned and grouted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3. Joint details as per specification and standard drawings.'
    },
    {
      description: 'Verify barrier-to-structure connection details (where barrier connects to bridge or structure)',
      acceptanceCriteria: 'Connection details per design drawings; anchor bolts, dowels, or cast-in connections correctly installed; transition from barrier to structure smooth and continuous; no impact on structural integrity',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3 / RD-BF-D1. Barrier-to-structure connections are critical safety details requiring Principal\'s Authorised Person approval.'
    },

    // =========================================================================
    // DELINEATION AND FINISHING
    // =========================================================================
    {
      description: 'Install reflectors and delineation on concrete barrier',
      acceptanceCriteria: 'Reflectors installed per DIT barrier design requirements (RD-BF-D1); correct colour configuration; spacing as specified; retroreflective material compliant; securely fixed and visible to approaching traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3 / RD-BF-D1. Reflectors/delineation must comply with DIT barrier design requirements.'
    },
    {
      description: 'Final inspection of completed concrete barrier -- alignment and structural integrity',
      acceptanceCriteria: 'Barrier profile correct per specification; alignment smooth and continuous; all joints sealed; connections secure; reflectors installed; foundation adequate; no structural defects; barrier adequately anchored per MASH Test Level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C3 / RD-BF-D1. Final inspection by Principal\'s Authorised Person.'
    },
    {
      description: 'Verify barrier alignment survey against design',
      acceptanceCriteria: 'As-built survey of barrier alignment, profile, and height; all dimensions within specified tolerances; survey results submitted to Principal\'s Authorised Person',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey measurement',
      notes: 'RD-BF-C3. Final alignment survey of completed concrete barrier.'
    },
    {
      description: 'Submit as-built records, concrete test results, and compliance documentation',
      acceptanceCriteria: 'As-built survey; concrete batch tickets and test results; reinforcement certificates; product acceptance documentation; DIT acceptance conditions compliance confirmation; all records submitted to Principal\'s Authorised Person',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C3. Complete handover documentation for Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 4: PAVEMENT MARKING (DIT RD-LM-C1 / RD-LM-S1)
// Based on: DIT RD-LM-C1 (formerly Part R44), RD-LM-S1 (formerly Part R45),
//           DIT Pavement Marking Manual, DPTI Procedure PC108, AS 4049, AS 2009, APAS 0042
// =============================================================================

const saPavementMarkingTemplate = {
  name: 'Pavement Marking (DIT RD-LM-C1/S1)',
  description: 'DIT Pavement marking application including thermoplastic, cold-applied plastic, paint, and raised pavement markers per RD-LM-C1 (Application) and RD-LM-S1 (Materials for Pavement Marking).',
  activityType: 'road_furniture',
  specificationReference: 'RD-LM-C1 / RD-LM-S1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for pavement marking works',
      acceptanceCriteria: 'All current revision drawings, RD-LM-C1, RD-LM-S1, DIT Pavement Marking Manual, and marking plan reviewed and available on site; line types, colours, widths, and RPM locations confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-LM-C1 (formerly Part R44) / RD-LM-S1 (formerly Part R45). Confirm marking materials and line types with Principal\'s Authorised Person. DIT Pavement Marking Manual provides comprehensive guidance.'
    },
    {
      description: 'Submit material compliance certificates -- paint approved to DPTI Procedure PC108',
      acceptanceCriteria: 'Pavement marking paint approved to DPTI Procedure PC108; material compliance certificates submitted to Principal\'s Authorised Person before work commences; APAS certification current',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'DPTI Procedure PC108',
      notes: 'RD-LM-S1 (formerly Part R45). Pavement marking paint must be approved to DPTI Procedure PC108. Principal\'s Authorised Person acceptance required before application.'
    },
    {
      description: 'Submit glass bead compliance certificates -- AS 2009 and APAS 0042',
      acceptanceCriteria: 'Glass beads compliant with AS 2009 and APAS 0042 "Glass Beads for Pavement Marking Paint"; Type B beads (drop-on) deliver minimum 450 mcd/m2/lx retroreflectivity when tested; certificates submitted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2009; APAS 0042',
      notes: 'RD-LM-S1. Glass beads must comply with AS 2009 and APAS 0042. Type B beads must deliver minimum 450 mcd/m2/lx retroreflectivity.'
    },
    {
      description: 'Submit thermoplastic/cold-applied plastic material compliance (where applicable)',
      acceptanceCriteria: 'Thermoplastic material compliant with AS 4049.2; cold-applied plastic compliant with AS 4049.4 (if applicable); compliance certificates and product data sheets submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4049 series',
      notes: 'RD-LM-S1. Material type (thermoplastic, cold-applied plastic, or paint) as specified in the contract.'
    },
    {
      description: 'Verify contractor\'s equipment -- marking machine, bead dispenser, and pre-heater calibration',
      acceptanceCriteria: 'Marking machine calibrated for correct application rate and line width; bead dispenser calibrated for correct drop-on rate; thermoplastic pre-heater operational (material temperature per manufacturer); equipment calibration records available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-LM-C1. Equipment calibration critical for consistent marking quality.'
    },

    {
      description: 'Verify marking layout plan against design before application commences',
      acceptanceCriteria: 'Marking layout plan reviewed and verified against traffic management plan and design drawings; setout marks placed on pavement; line positions, arrow locations, text locations, and RPM positions confirmed by Principal\'s Authorised Person',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-LM-C1. Layout verification before application prevents costly errors. Principal\'s Authorised Person to confirm layout.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect pavement surface condition before marking application',
      acceptanceCriteria: 'Surface clean, dry, and free from dust, dirt, oil, grease, loose material, and curing compound residue; surface temperature above dew point; ambient conditions within specification limits; surface defects repaired',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. Surface preparation required prior to all marking application. Wet or contaminated surfaces cause adhesion failure.'
    },
    {
      description: 'Remove existing pavement markings (where specified)',
      acceptanceCriteria: 'Existing markings removed by approved method; no damage to pavement surface; no ghosting (residual marking visible); surface cleaned after removal',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. Removal method must not damage the road surface.'
    },

    // =========================================================================
    // MARKING APPLICATION -- THERMOPLASTIC / PAINT
    // =========================================================================
    {
      description: 'Apply pavement marking to specified dimensions, colour, and pattern',
      acceptanceCriteria: 'Line width, length, gap spacing per design and AS 1742.2; colour (white or yellow) per specification; material applied at correct temperature and rate per manufacturer requirements; uniform thickness across line width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. Marking material type and application parameters per contract specification.'
    },
    {
      description: 'Verify marking application rate and film thickness',
      acceptanceCriteria: 'Application rate/wet film thickness within specified tolerances for the material type; measured by wet film gauge or collection tray method during application at regular intervals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Wet film thickness / application rate measurement',
      notes: 'RD-LM-C1. Thickness/rate measurement during application critical for marking performance and durability.'
    },
    {
      description: 'Verify glass bead drop-on application rate',
      acceptanceCriteria: 'Drop-on glass beads applied at specified rate per AS 2009; beads embedded to correct depth; uniform distribution across line width; beads applied while marking material is still wet/tacky',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Bead rate check (collection tray method)',
      notes: 'RD-LM-S1. Bead drop-on rate critical for retroreflectivity performance.'
    },
    {
      description: 'Verify anti-skid mixture application (where specified)',
      acceptanceCriteria: 'Anti-skid mixture consists of glass beads and crushed glass in the ratio of 70:30 per RD-LM-S1; applied at correct rate; uniform distribution',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Mix ratio verification',
      notes: 'RD-LM-S1 (formerly Part R45). Anti-skid mixtures must be glass beads and crushed glass in 70:30 ratio.'
    },
    {
      description: 'Verify thermoplastic material temperature during application',
      acceptanceCriteria: 'Material temperature monitored and within manufacturer\'s specified range (typically 180-220C for thermoplastic); temperature recorded at regular intervals; material not overheated or degraded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement',
      notes: 'RD-LM-C1. Overheating degrades thermoplastic material and reduces service life.'
    },
    {
      description: 'Verify ambient conditions during marking application',
      acceptanceCriteria: 'Pavement surface temperature, air temperature, humidity, and wind conditions within specification limits; no application during rain or when rain is imminent; dew point margin maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Weather / temperature records',
      notes: 'RD-LM-C1. Ambient conditions directly affect marking adhesion and curing. Records of conditions during application must be maintained.'
    },

    // =========================================================================
    // RAISED PAVEMENT MARKERS (RPMs / PAVEMENT BARS)
    // =========================================================================
    {
      description: 'Verify raised pavement marker (pavement bar) compliance -- dimensions and material',
      acceptanceCriteria: 'Pavement bars comply with dimensions shown on Attachment R45B [VERIFY]; Size B pavement bars (for 85th percentile speed < 75 km/h) maximum 50mm height; recycled pavement bars minimum 32 MPa compressive strength; recycled bars manufactured yellow or capable of accepting/retaining paint',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Compressive strength (recycled RPMs)',
      notes: 'RD-LM-S1 (formerly Part R45). Size B pavement bars max 50mm height for speeds < 75 km/h. Recycled pavement bars minimum 32 MPa compressive and minimum flexural strength.'
    },
    {
      description: 'Inspect pavement surface preparation at RPM/pavement bar locations',
      acceptanceCriteria: 'Surface clean and dry at each location; surface abraded if required for adhesion; adhesive type per specification (typically two-part epoxy or bituminous)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. Surface preparation critical for RPM adhesion and service life.'
    },
    {
      description: 'Install raised pavement markers/pavement bars to correct alignment, spacing, and type',
      acceptanceCriteria: 'RPM type per design (unidirectional, bidirectional, or non-reflective); colour per specification; spacing per design/AS 1742.2; RPMs aligned within tolerance of design line; RPMs level and firmly bonded; adhesive fully cured before opening to traffic',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. RPM alignment and spacing critical for lane guidance especially at night and in wet conditions.'
    },
    {
      description: 'Conduct adhesion check on installed RPMs',
      acceptanceCriteria: 'RPMs firmly bonded to pavement surface; no rocking, spinning, or lifting; adhesion test passed (if required by specification)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Adhesion test / manual check',
      notes: 'RD-LM-C1. Deficient adhesion requires removal and re-installation.'
    },

    // =========================================================================
    // RETROREFLECTIVITY TESTING
    // =========================================================================
    {
      description: 'Conduct retroreflectivity testing of completed pavement markings',
      acceptanceCriteria: 'Retroreflectivity measured per DIT requirements using approved reflectometer; minimum retroreflectivity values achieved for white and yellow markings as specified; mean of readings per section meets acceptance criteria',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Retroreflectivity measurement (mcd/m2/lux)',
      notes: 'RD-LM-C1 / RD-LM-S1. Type B beads must deliver minimum 450 mcd/m2/lx retroreflectivity. Retroreflected luminance measured in mcd/m2/lux. DIT minimum performance standards apply.'
    },

    // =========================================================================
    // COLOUR AND NIGHT VISIBILITY
    // =========================================================================
    {
      description: 'Verify marking colour compliance',
      acceptanceCriteria: 'Marking colour (white or yellow) verified visually and/or instrumentally per specification; colour within chromaticity limits specified in AS 4049 or DIT requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Colour compliance check',
      notes: 'RD-LM-S1. Marking colour must be consistent and meet specification requirements.'
    },
    {
      description: 'Conduct night visibility check of completed markings and RPMs',
      acceptanceCriteria: 'All markings and RPMs visible under headlight illumination at night; retroreflective performance adequate; no dark spots or gaps in marking continuity; RPM lens surfaces clean and undamaged',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Night visual inspection',
      notes: 'RD-LM-C1. Night visibility check confirms real-world retroreflective performance.'
    },

    // =========================================================================
    // FINAL INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed marking layout against design drawings',
      acceptanceCriteria: 'All line markings, symbols, arrows, and text installed per design; line widths correct; gap and dash lengths per AS 1742.2; no overspray or irregular edges; marking colours correct; all RPMs installed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. As-built marking layout verified against design.'
    },
    {
      description: 'Inspect marking adhesion (tape pull test or visual check)',
      acceptanceCriteria: 'Markings firmly bonded to pavement surface; no peeling, flaking, or lifting; adhesion test passed where required; markings intact under traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tape pull test / adhesion test',
      notes: 'RD-LM-C1. Adhesion failures require re-application.'
    },
    {
      description: 'Verify all RPMs installed, aligned, and correctly coloured',
      acceptanceCriteria: 'All RPMs per marking plan installed; alignment within tolerance; spacing correct; colours correct (white, yellow, or red per design); all RPMs firmly bonded; no missing or damaged RPMs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-LM-C1. Final check of RPM installation completeness and condition.'
    },
    {
      description: 'Submit marking records and test results to Principal\'s Authorised Person',
      acceptanceCriteria: 'Records include: material batch numbers, DPTI Procedure PC108 approval references, application dates, ambient conditions, equipment calibration records, retroreflectivity test results, bead application rates, and as-applied layout',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-LM-C1 / RD-LM-S1. Complete marking records for handover to Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 5: FENCING (DIT RD-BF-C4)
// Based on: DIT RD-BF-C4, AS 1725, AS 2700, AS/NZS 1604.1
// =============================================================================

const saFencingTemplate = {
  name: 'Fencing (DIT RD-BF-C4)',
  description: 'DIT Fencing and Gates per RD-BF-C4. Covers boundary fencing, fauna fencing, property fencing, and gate installation.',
  activityType: 'road_furniture',
  specificationReference: 'RD-BF-C4',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for fencing and gate works',
      acceptanceCriteria: 'All current revision drawings, RD-BF-C4, and project-specific requirements reviewed and available on site; fencing types (ringlock, pedestrian safety, chain-link) and gate locations confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C4. Covers ringlock fencing, pedestrian safety fencing, chain-link fencing, and gates. Principal\'s Authorised Person to confirm scope.'
    },
    {
      description: 'Submit material certificates for fencing components',
      acceptanceCriteria: 'Chain-link fabric per AS 1725; preservative-treated timber per AS/NZS 1604.1; colours per AS 2700 where specified; galvanized steel per applicable standard; pedestrian safety fencing powder coat certification; all certificates submitted before use',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1725; AS/NZS 1604.1; AS 2700',
      notes: 'RD-BF-C4. Reference standards: AS 1725 (chain-link), AS 2700 (colours), AS/NZS 1604.1 (treated timber).'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Set out fence line and mark post locations',
      acceptanceCriteria: 'Fence line set out per design drawings; post locations marked at correct spacing; corner, end, strainer, and gate post locations identified; alignment verified; any conflicts with underground services resolved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Fence alignment per design drawings and property boundaries.'
    },
    {
      description: 'Install fence posts to correct depth, spacing, alignment, and plumb',
      acceptanceCriteria: 'Posts installed to depth shown on drawings; post spacing per specification; posts plumb and aligned; strainer posts installed at end, corner, and gate locations; line posts braced at specified intervals',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Hold Point requirements apply for fencing installation [VERIFY specific hold points in RD-BF-C4]. Principal\'s Authorised Person may inspect.'
    },
    {
      description: 'Install concrete footings for fence posts (where specified)',
      acceptanceCriteria: 'Concrete footings to dimensions shown on drawings; concrete grade per specification; top of footing crowned to shed water; footing surrounding post fully; concrete cured before wire tensioning',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Concrete footings where specified by design.'
    },

    // =========================================================================
    // WIRE / MESH INSTALLATION
    // =========================================================================
    {
      description: 'Install wire strands or ringlock mesh and tension',
      acceptanceCriteria: 'Wire strands or ringlock mesh installed per specification; wires tensioned using approved straining equipment; tension as specified; wires/mesh evenly distributed and taut; no kinks or damage; mesh secured to posts at specified intervals',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Wire and mesh tensioning per specification requirements.'
    },
    {
      description: 'Install chain-link fabric per AS 1725 (where specified)',
      acceptanceCriteria: 'Chain-link fabric per AS 1725; mesh tightened and secured to posts and line wires; fastened with galvanized tie wire or clips at specified intervals; installed on correct side of fence per drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Chain-link fabric must comply with AS 1725.'
    },
    {
      description: 'Install pedestrian safety fencing to 1,200mm height with powder coating (where specified)',
      acceptanceCriteria: 'Pedestrian safety fencing installed to 1,200mm height; all pedestrian safety fencing including welds powder coated; colour per specification (AS 2700 reference); fencing secure and rigid; no sharp edges or hazards',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Pedestrian safety fencing must be 1,200mm height. All fencing including welds must be powder coated.'
    },

    // =========================================================================
    // GATES
    // =========================================================================
    {
      description: 'Install gates at specified locations',
      acceptanceCriteria: 'Gate posts of correct dimensions per drawings; firmly set to specified depth; galvanized hinges securely attached; gate swings freely; latch/lock mechanism operational; gate clears ground when opening; gate does not sag or twist',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Gates must swing freely. Gate posts must be sturdy enough to support gate weight and operation loads.'
    },
    {
      description: 'Verify gate operation and locking mechanism',
      acceptanceCriteria: 'Gate opens and closes smoothly throughout full range; latch engages securely; lock operates correctly (keys provided); gate self-closes (if self-closing type specified); no binding or dragging',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Functional test of gate operation.'
    },

    // =========================================================================
    // STRAINER POSTS AND STAYS
    // =========================================================================
    {
      description: 'Install strainer posts and stays/droppers at correct intervals',
      acceptanceCriteria: 'Strainer (end and corner) posts installed per specification with adequate bracing; droppers/stays installed at specified intervals between posts; stays plumb and wires correctly laced through',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Strainer posts and stays/droppers provide structural support between line posts.'
    },

    // =========================================================================
    // FINISHING AND FINAL INSPECTION
    // =========================================================================
    {
      description: 'Verify fauna fencing provisions (where specified)',
      acceptanceCriteria: 'Fauna fencing mesh size, height, and burial depth per specification; fauna exclusion requirements met; mesh extends below ground level where required to prevent burrowing; no gaps at ground level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Fauna fencing requirements as specified for the project. Mesh size and burial depth vary by target species.'
    },
    {
      description: 'Visual inspection of completed fencing -- alignment, tension, condition',
      acceptanceCriteria: 'Fence line straight and aligned; no dips or irregularities in top line; all wires/mesh taut; posts plumb; bracing secure; concrete footings crowned; galvanising/powder coating intact; no damaged components; fence height per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Visual inspection of completed fence by Principal\'s Authorised Person.'
    },
    {
      description: 'Inspect connections to existing fencing',
      acceptanceCriteria: 'New fence connected to existing fence per specification; join secure and neat; no gaps or weak points; existing fence undamaged during connection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BF-C4. Connections at interfaces with existing fencing must be secure.'
    },
    {
      description: 'Submit as-built records and material certificates to Principal\'s Authorised Person',
      acceptanceCriteria: 'As-built survey of fence alignment; material certificates (AS 1725, AS/NZS 1604.1, powder coat); construction records; gate keys and operation manuals (if applicable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BF-C4. Final handover documentation to Principal\'s Authorised Person.'
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
  console.log(' SA (DIT) ITP Template Seeder - Road Furniture')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saWireRopeBarrierTemplate)
    await seedTemplate(saWBeamGuardFenceTemplate)
    await seedTemplate(saConcreteBarrierTemplate)
    await seedTemplate(saPavementMarkingTemplate)
    await seedTemplate(saFencingTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 road furniture templates)')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Templates created:')
    console.log('  1. Wire Rope Safety Barrier (DIT RD-BF-C2) - 20 items (7H/5W/8S)')
    console.log('  2. W-Beam Guard Fence (DIT RD-BF-C1) - 20 items (3H/6W/11S)')
    console.log('  3. Concrete Barrier (DIT RD-BF-C3) - 20 items (6H/7W/7S)')
    console.log('  4. Pavement Marking (DIT RD-LM-C1/S1) - 25 items (2H/5W/18S)')
    console.log('  5. Fencing (DIT RD-BF-C4) - 15 items (0H/5W/10S)')
    console.log('')
    console.log('To use these templates:')
    console.log('1. Create a project with specificationSet = "DIT (SA)"')
    console.log('2. When fetching templates with includeGlobal=true, these templates will appear')
    console.log('3. Clone them to your project or assign directly to lots')
    console.log('')
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
