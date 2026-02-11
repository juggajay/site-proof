/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Road Furniture
 *
 * Creates global ITP templates for QLD road furniture activities.
 * Templates: Wire Rope (MRTS14), W-Beam (MRTS14), Concrete Barrier (MRTS14/70),
 *            Pavement Marking (MRTS45), Fencing (MRTS14/15)
 *
 * Run with: node scripts/seed-itp-templates-qld-road-furniture.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 17: STEEL WIRE ROPE SAFETY BARRIER (MRTS14)
// Based on: TMR MRTS14 Road Furniture, AS/NZS 3845.1:2015, MASH
// =============================================================================

const qldWireRopeBarrierTemplate = {
  name: 'Steel Wire Rope Safety Barrier',
  description: 'TMR wire rope barrier installation including system acceptance, post/cable installation, tensioning, end terminals, and delineation per MRTS14 Road Furniture. Covers proprietary MASH-tested systems (e.g. Brifen, MashFlex).',
  activityType: 'road_furniture',
  specificationReference: 'TMR MRTS14 Road Furniture',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-CONSTRUCTION PLANNING
    // =========================================================================
    {
      description: 'Verify wire rope barrier system is listed on TMR Accepted Road Safety Barrier Systems register (MASH TL-3 or TL-4 as specified)',
      acceptanceCriteria: 'System appears on current TMR accepted list with correct test level; Austroads TCU reviewed and conditions noted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Only TMR-accepted MASH-compliant systems permitted. Check current TMR Accepted Barrier Systems register.'
    },
    {
      description: 'Submit manufacturer\'s installation manual and product-specific Installation Checklist / Inspection and Test Plan to Administrator for review',
      acceptanceCriteria: 'Manual is current edition for the accepted system; all installation requirements documented; Compliance Audit Report template available',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Cl. 5.2 - Construction procedures must be submitted and accepted prior to commencement.'
    },
    {
      description: 'Confirm installer holds current Austroads Safety Hardware Training and Accreditation Scheme (ASHTAS) accreditation for the specific wire rope barrier system',
      acceptanceCriteria: 'Current ASHTAS certificate sighted; installer competency verified for specific product',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TMR requires ASHTAS accreditation for installation of road safety barrier systems.'
    },
    {
      description: 'Review design documentation including barrier layout, post spacing, terminal locations, anchor block positions, and transitions to other barrier types',
      acceptanceCriteria: 'Design compliant with TMR Road Planning and Design Manual; deflection zones clear of hazards; correct system selected for speed zone and offset',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Design documentation governs installation details.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Inspect wire rope cables upon delivery - verify correct diameter, grade, galvanising, and quantity per manufacturer\'s specification',
      acceptanceCriteria: 'Cables match manufacturer\'s specification (typically 3-strand or 4-strand system); galvanising certification provided; no damage, kinks, or corrosion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typical systems: Brifen (4-rope), MashFlex (4-rope). Cable heights per manufacturer (e.g. Brifen: 355mm, 530mm, 710mm, 890mm).'
    },
    {
      description: 'Inspect steel posts upon delivery - verify correct size, length, material grade, galvanising, and post sockets/sleeves',
      acceptanceCriteria: 'Posts match manufacturer\'s specification; galvanising to AS/NZS 4680; no damage or deformation; sockets/sleeves correct type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Tubular posts placed within plastic sockets for ease of removal following impacts.'
    },
    {
      description: 'Verify all ancillary components received - anchor assemblies, end terminals, turnbuckles, cable clamps, splice fittings, delineators, post caps',
      acceptanceCriteria: 'All components match manufacturer\'s parts list for the specified system configuration; no substitutions without approval',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'End terminals must be MASH-tested and listed on TMR accepted register as compatible with the barrier system.'
    },

    // =========================================================================
    // SITE PREPARATION & SETOUT
    // =========================================================================
    {
      description: 'Complete Dial Before You Dig (DBYD) enquiry and locate all underground services in barrier installation corridor',
      acceptanceCriteria: 'DBYD enquiry completed; all services located, marked, and protected; clearance distances verified per service authority requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mandatory prior to any ground disturbance for post installation.'
    },
    {
      description: 'Survey and mark post locations, anchor block positions, and terminal locations in accordance with design documentation',
      acceptanceCriteria: 'Post spacing per manufacturer\'s specification (typically 1.6m to 8.0m depending on system and location); alignment tolerance +/-25mm from design line; offset from edge of travelled way as specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Construction survey per MRTS56',
      notes: 'MRTS56 Construction Surveying applies. Post spacing varies by system and location (tighter at curves, transitions).'
    },

    // =========================================================================
    // ANCHOR BLOCK INSTALLATION
    // =========================================================================
    {
      description: 'Excavate and construct anchor block foundations at system terminals and intermediate anchor locations',
      acceptanceCriteria: 'Excavation to design depth and dimensions; concrete foundation to specified strength (typically 32 MPa); anchor bolts positioned per manufacturer\'s drawing; concrete cure time met before cable tensioning',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Concrete compressive strength AS 1012.9',
      notes: 'Anchor blocks must achieve specified concrete strength before cable tensioning commences. Anchor depth per manufacturer (typically 1.5m-3.0m).'
    },
    {
      description: 'Verify anchor block alignment, level, and bolt positions against design',
      acceptanceCriteria: 'Position within +/-10mm of design; bolts plumb and at correct spacing; concrete free of defects',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: 'Survey check',
      notes: 'Critical for cable alignment and tension transfer.'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Install post sockets/sleeves into pre-drilled or excavated holes with concrete surround per manufacturer\'s specification',
      acceptanceCriteria: 'Socket depth per manufacturer (varies by system); socket plumb (+/-2 degrees); concrete surround placed and compacted; socket orientation correct (cable side aligned to design)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Socket systems (e.g. Brifen) allow post replacement after impacts. Socket must be plumb with 3-inch side directly on string line parallel to centreline.'
    },
    {
      description: 'Allow concrete in post sockets to cure to specified strength before inserting posts',
      acceptanceCriteria: 'Minimum 7-day cure (or as specified by manufacturer); concrete strength verified if early loading required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Do not insert posts or tension cables until socket concrete has achieved required strength.'
    },
    {
      description: 'Insert posts into sockets and verify post height, alignment, and vertical plumb',
      acceptanceCriteria: 'Post top height per manufacturer\'s specification; posts plumb within +/-2 degrees; post line smooth and consistent; cable slots at correct heights',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Post tops should follow a smooth line in undulating country per MRTS14.'
    },

    // =========================================================================
    // CABLE INSTALLATION & TENSIONING
    // =========================================================================
    {
      description: 'Thread cables through posts in correct sequence and at correct heights per manufacturer\'s specification',
      acceptanceCriteria: 'Correct number of cables (3 or 4 per system type); cables at specified heights; cables properly seated in post guides/slots; no kinks, damage, or crossed cables',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cable heights critical for crash performance. Typical 4-cable heights: 355mm, 530mm, 710mm, 890mm (Brifen).'
    },
    {
      description: 'Tension cables to manufacturer\'s specified tension at the ambient temperature using calibrated tensioning equipment',
      acceptanceCriteria: 'Cable tension within manufacturer\'s specified range (typically 20-30 kN at 20 deg C, adjusted for ambient temperature); tension measured with calibrated load cell or dynamometer; all cables uniformly tensioned',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Cable tension measurement with calibrated equipment',
      notes: 'Tension is temperature-dependent. Manufacturer provides tension vs. temperature chart. Over-tensioning can cause post/anchor failure; under-tensioning reduces crash performance.'
    },
    {
      description: 'Verify cable tension at each anchor point and at intermediate check points after full system tensioning',
      acceptanceCriteria: 'Tension readings within +/-5% of target at all check points; no cable slippage at anchors or clamps; turnbuckles within adjustment range',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'test',
      testType: 'Cable tension measurement',
      notes: 'Re-check tension after 24-48 hours to confirm no relaxation.'
    },

    // =========================================================================
    // END TERMINAL INSTALLATION
    // =========================================================================
    {
      description: 'Install end terminals (energy-absorbing terminals) at each system end in accordance with manufacturer\'s specification',
      acceptanceCriteria: 'Terminal type matches TMR-accepted configuration; foundation and anchor per manufacturer\'s drawing; all components correctly assembled; terminal head at correct height and orientation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'End terminals are independently crash-tested. Must be MASH-tested terminal compatible with barrier system (e.g. MashFlex requires MashFlex Terminal).'
    },
    {
      description: 'Verify end terminal clear zone and approach conditions',
      acceptanceCriteria: 'No fixed objects within terminal deflection zone; approach grading smooth and traversable; terminal visible to approaching traffic; no obstructions that could interfere with terminal operation',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Terminal must be able to function as designed - flare-out or anchor depending on terminal type.'
    },

    // =========================================================================
    // DELINEATION & FINISHING
    // =========================================================================
    {
      description: 'Install delineators/reflectors on posts at specified spacing and heights per TMR requirements',
      acceptanceCriteria: 'Delineator type, colour, and spacing per TMR TRUM Volume 3 and design documentation; reflectors securely attached; visible from required distance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per MRTS14 and TMR TRUM Vol 3 - Signing and Pavement Marking requirements.'
    },
    {
      description: 'Install post caps and any additional protective hardware',
      acceptanceCriteria: 'All post caps fitted; no exposed sharp edges; system appears complete and uniform',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Safety requirement - exposed post tops can be hazardous.'
    },

    // =========================================================================
    // FINAL INSPECTION & HANDOVER
    // =========================================================================
    {
      description: 'Complete full-length visual inspection of installed wire rope barrier system',
      acceptanceCriteria: 'All posts vertical and aligned; cables taut and at correct heights; no sagging between posts; anchor blocks undamaged; terminals correctly installed; delineation complete; no debris or construction materials remaining',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Walk-through inspection of full barrier length.'
    },
    {
      description: 'Perform final cable tension check across full system',
      acceptanceCriteria: 'All cables within specified tension range adjusted for ambient temperature; no relaxation beyond tolerance; system ready for traffic loading',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Cable tension measurement',
      notes: 'Final tension verification before system is opened to traffic.'
    },
    {
      description: 'Submit Compliance Audit Report signed by Contractor\'s Representative and Licensed Supplier certifying installation per manufacturer\'s manual',
      acceptanceCriteria: 'Signed compliance audit report; installation checklist complete; all hold points released; as-built survey provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TMR requirement - Compliance Audit Report must certify products installed per manufacturer\'s installation manual.'
    },
    {
      description: 'Provide as-built survey and documentation package including post locations, cable tensions, component serial numbers, and maintenance schedule',
      acceptanceCriteria: 'As-built survey within specified tolerances; all documentation complete and indexed; maintenance schedule per manufacturer\'s recommendations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey per MRTS56',
      notes: 'Documentation required for ongoing maintenance and post-impact repair.'
    }
  ]
}

// =============================================================================
// TEMPLATE 18: W-BEAM STEEL GUARD FENCE / GUARDRAIL (MRTS14)
// Based on: TMR MRTS14 Road Furniture, AS/NZS 3845.1:2015, MASH
// =============================================================================

const qldWBeamGuardrailTemplate = {
  name: 'W-Beam Steel Guard Fence (Guardrail)',
  description: 'TMR W-beam guardrail installation including system acceptance, post driving/installation, rail erection, bolt torque, end terminals, transitions, and delineation per MRTS14 Road Furniture. Covers proprietary MASH-tested systems (e.g. RAMSHIELD, Flexbeam).',
  activityType: 'road_furniture',
  specificationReference: 'TMR MRTS14 Road Furniture',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-CONSTRUCTION PLANNING
    // =========================================================================
    {
      description: 'Verify W-beam guardrail system is listed on TMR Accepted Road Safety Barrier Systems register (MASH TL-3 or TL-4 as specified)',
      acceptanceCriteria: 'System and all components (beam, posts, spacers, terminals, transitions) appear on current TMR accepted list with correct test level',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Public domain steel barriers being phased out; use proprietary MASH-tested systems from TMR register.'
    },
    {
      description: 'Submit manufacturer\'s installation manual, product-specific ITP, and construction procedures to Administrator',
      acceptanceCriteria: 'Current edition manual; all components identified; installation sequence documented; ASHTAS-accredited installer confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Cl. 5.2 - Construction procedures must be accepted before commencement.'
    },
    {
      description: 'Confirm installer holds current ASHTAS accreditation for the specific guardrail system',
      acceptanceCriteria: 'Current ASHTAS certificate sighted for installer personnel',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TMR requires ASHTAS accreditation for safety barrier installation.'
    },
    {
      description: 'Review design documentation including guardrail layout, post spacing, rail height, terminal locations, transitions to other barrier types, and flare rates',
      acceptanceCriteria: 'Design compliant with TMR RPDM; deflection envelope clear; correct system for speed zone and offset; terminal type compatible',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Design must account for deflection distance - typical W-beam deflection 0.6-1.2m at TL-3.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Inspect W-beam rail sections upon delivery - verify profile, length, bolt hole pattern, galvanising',
      acceptanceCriteria: 'W-beam profile per manufacturer (310mm depth typical); hot-dip galvanised to AS/NZS 4680 (minimum 600g/m2); no damage, dents, or galvanising defects; correct bolt hole spacing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'W-beam panels typically 3.81m long with 8 bolt holes. Galvanising certificate required.'
    },
    {
      description: 'Inspect steel posts upon delivery - verify section size, length, material grade, galvanising, and post type (driven or bolt-down)',
      acceptanceCriteria: 'Posts match manufacturer\'s specification (C-section or W-section per system); length for required embedment + rail height; galvanised to AS/NZS 4680; no bending, twisting, or damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Post type must match crash-tested configuration. Standard post length typically 1830mm for 1100mm embedment.'
    },
    {
      description: 'Verify spacer blocks, splice bolts, terminal components, and all ancillary hardware match manufacturer\'s specification',
      acceptanceCriteria: 'Correct spacer type and material (steel, recycled plastic, or timber per manufacturer); bolt grade, size, and quantity correct; terminal components complete; all items from approved manufacturer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'No substitution of components without manufacturer and TMR approval - affects crash performance.'
    },

    // =========================================================================
    // SITE PREPARATION & SETOUT
    // =========================================================================
    {
      description: 'Complete DBYD enquiry and locate all underground services in guardrail corridor',
      acceptanceCriteria: 'DBYD enquiry completed; all services located, marked, and protected',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mandatory prior to post driving/drilling.'
    },
    {
      description: 'Survey and mark post locations, terminal positions, and transition points per design documentation',
      acceptanceCriteria: 'Post spacing per manufacturer (typically 1905mm standard; reduced to 952mm at terminals and curves); alignment tolerance +/-25mm; offset from edge of travelled way as specified in design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Construction survey per MRTS56',
      notes: 'Post spacing is critical to crash performance - must match tested configuration.'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Install posts by driving, drilling, or bolt-down method per manufacturer\'s specification and ground conditions',
      acceptanceCriteria: 'Post embedment depth per manufacturer (typically 1100mm for driven posts); posts plumb within 6mm over post height; correct orientation (strong axis perpendicular to traffic); firm seating in ground',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS14 - Rock may require pre-drilled holes or alternative foundation per manufacturer\'s guidelines.'
    },
    {
      description: 'Verify post embedment depth using measurement from ground level to post top',
      acceptanceCriteria: 'Post top at correct height to achieve specified rail height (730-820mm from ground to top of W-beam); embedment not less than manufacturer\'s minimum; consistent height along installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Direct measurement',
      notes: 'Rail height measured from ground surface to centre of W-beam.'
    },
    {
      description: 'For posts requiring concrete foundations (rock, bridge approaches, bolt-down), verify foundation dimensions, reinforcement, and concrete strength',
      acceptanceCriteria: 'Foundation per manufacturer\'s drawing; concrete minimum 32 MPa; reinforcement as specified; anchor bolts correctly positioned; concrete cured before loading',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete compressive strength AS 1012.9',
      notes: 'Foundation details must match crash-tested configuration.'
    },

    // =========================================================================
    // RAIL INSTALLATION
    // =========================================================================
    {
      description: 'Install W-beam rail sections with correct lap direction (upstream end on traffic face) and bolt through posts with spacer blocks',
      acceptanceCriteria: 'Rail lapped in direction of traffic flow (upstream panel overlaps downstream); all bolt holes aligned; spacer blocks between rail and post face per manufacturer; minimum 8 bolts per splice (or as specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Lap direction critical - incorrect lapping can cause vehicle snagging on rail ends.'
    },
    {
      description: 'Torque all rail splice bolts and post bolts to manufacturer\'s specified values',
      acceptanceCriteria: 'Splice bolts torqued to specification (typically 100-120 Nm); post-to-rail bolts torqued per manufacturer; no missing or loose bolts; bolt threads extending minimum 2 threads past nut',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Calibrated torque wrench',
      notes: 'Some systems require specific bolt torque for designed deformation sequence during impact.'
    },
    {
      description: 'Verify rail height above ground level at regular intervals and at all post locations',
      acceptanceCriteria: 'Rail height (centre of W-beam to ground) within manufacturer\'s specified range (typically 730mm-820mm for MASH TL-3); height varies smoothly over undulations; no abrupt steps at splices',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Direct measurement',
      notes: 'Rail height outside tested range compromises crash performance.'
    },

    // =========================================================================
    // END TREATMENT & TERMINAL INSTALLATION
    // =========================================================================
    {
      description: 'Install end terminals (energy-absorbing or flared) at each guardrail end per manufacturer\'s specification and TMR-accepted configuration',
      acceptanceCriteria: 'Terminal type on TMR accepted list and compatible with guardrail system; foundation and anchorage per manufacturer; all components correctly assembled; terminal head at correct height and position',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Terminal must be independently crash-tested to MASH. Flared terminal requires correct flare rate and anchor.'
    },
    {
      description: 'Verify terminal approach conditions and clear zone',
      acceptanceCriteria: 'Terminal approach grading smooth and traversable; no fixed objects in terminal deflection zone; grading transitions smooth; terminal visible to approaching traffic',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Grading in terminal area must allow vehicle to interact with terminal as tested.'
    },

    // =========================================================================
    // TRANSITIONS
    // =========================================================================
    {
      description: 'Install transitions between W-beam guardrail and other barrier types (concrete barrier, bridge railing, etc.) per TMR standard drawings and manufacturer\'s specification',
      acceptanceCriteria: 'Transition hardware matches TMR-accepted configuration (e.g. SD1470 for thrie beam to concrete barrier); stiffness increases towards rigid barrier; all connections secure; no gaps or steps between barrier faces',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Transitions are independently crash-tested. SD1470 covers concrete terminal to thrie beam guardrail connection.'
    },

    // =========================================================================
    // DELINEATION & FINISHING
    // =========================================================================
    {
      description: 'Install delineators/reflectors on guardrail at specified spacing and heights per TMR requirements',
      acceptanceCriteria: 'Reflectors per TMR TRUM Volume 3; correct colour (white nearside, red offside); spacing per design (typically every 4th post or as specified); securely attached to rail or post',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per MRTS14 and TMR TRUM Vol 3.'
    },
    {
      description: 'Verify no sharp edges, protruding bolts, or hazardous projections along installed guardrail',
      acceptanceCriteria: 'All bolt ends trimmed or capped; no sharp edges on rail ends or splice connections; blockout spacers flush; rail face smooth and continuous',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Safety requirement - exposed hardware can increase injury severity.'
    },

    // =========================================================================
    // FINAL INSPECTION & HANDOVER
    // =========================================================================
    {
      description: 'Complete full-length visual and dimensional inspection of installed W-beam guardrail system',
      acceptanceCriteria: 'Rail alignment smooth and continuous; all posts plumb; rail height within range; all bolts tight; terminals and transitions correctly installed; delineation complete; no construction debris',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Full system walk-through inspection.'
    },
    {
      description: 'Submit Compliance Audit Report signed by Contractor\'s Representative and Licensed Supplier',
      acceptanceCriteria: 'Signed compliance audit report certifying installation per manufacturer\'s manual; all hold points released; installation checklist complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TMR requirement for all proprietary safety barrier installations.'
    },
    {
      description: 'Provide as-built survey, component register, and maintenance information to Administrator',
      acceptanceCriteria: 'As-built survey showing post locations, rail heights, and terminal positions; component register with product serial numbers/batch references; manufacturer\'s maintenance and repair guide provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey per MRTS56',
      notes: 'Required for ongoing maintenance and post-impact repair programming.'
    }
  ]
}

// =============================================================================
// TEMPLATE 19: CONCRETE ROAD SAFETY BARRIER (MRTS14/MRTS70)
// Based on: TMR MRTS14 Road Furniture + MRTS70 Concrete, SD1468-SD1486
// =============================================================================

const qldConcreteBarrierTemplate = {
  name: 'Concrete Road Safety Barrier (Single Slope / F-Type)',
  description: 'TMR concrete barrier construction including precast and in-situ (extruded) methods, foundation preparation, reinforcement, concrete placement, joint treatment, transitions, and delineation per MRTS14 Road Furniture and MRTS70 Concrete. References SD1468, SD1469, SD1470, SD1473, SD1486.',
  activityType: 'road_furniture',
  specificationReference: 'TMR MRTS14 Road Furniture + MRTS70 Concrete',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-CONSTRUCTION PLANNING
    // =========================================================================
    {
      description: 'Submit concrete barrier construction procedures and quality plan to Administrator, identifying precast or in-situ (extruded) method',
      acceptanceCriteria: 'Procedures address barrier type (precast or in-situ), concrete mix, reinforcement, formwork/extrusion, joint details, curing, and finishing; procedures accepted by Administrator before work commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Cl. 5.2 - Construction procedures must be submitted and accepted.'
    },
    {
      description: 'Submit concrete mix design for barrier concrete (in-situ or precast production) to Administrator for approval',
      acceptanceCriteria: 'Mix design achieves minimum 32 MPa at 28 days; complies with MRTS70 requirements; mix proportions, cement type, admixtures, and water/cement ratio documented and approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Concrete mix design verification per MRTS70',
      notes: 'MRTS70 HP1 - No concrete to be placed until mix design approved. TMR MRTS14 Barrier Wall typically specified at 32 MPa with 0.9 kg/m3 polyfibre.'
    },
    {
      description: 'For precast barriers, verify precast supplier is TMR-registered and precast manufacturing complies with MRTS24 Manufacture of Precast Concrete Elements',
      acceptanceCriteria: 'Supplier registered with TMR; manufacturing facility inspected; QA system compliant with MRTS24; product certification available',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS24 covers manufacture of precast concrete elements.'
    },
    {
      description: 'Review design documentation including barrier layout, profile type, foundation requirements, joint locations, expansion joint spacing, and transitions',
      acceptanceCriteria: 'Design per SD1468 (extruded median) or SD1473 (precast) as applicable; foundation design adequate for ground conditions; expansion joint spacing per design (typically 12m-18m)',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'SD1468 covers extruded barrier with reinforcing and expansion joint details. SD1473 covers precast installation.'
    },

    // =========================================================================
    // FOUNDATION PREPARATION
    // =========================================================================
    {
      description: 'Excavate and prepare barrier foundation to design level and alignment',
      acceptanceCriteria: 'Foundation level within +/-10mm of design; foundation width sufficient for barrier base; subgrade compacted to minimum 95% standard MDD; no soft spots or unsuitable material',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compaction testing AS 1289.5.4.1; Level survey per MRTS56',
      notes: 'Foundation must provide uniform support. Differential settlement will crack the barrier.'
    },
    {
      description: 'Install dowel bars or starter bars into foundation (for in-situ barriers) or verify pre-cast base connection detail',
      acceptanceCriteria: 'Dowel bar size, spacing, and embedment per design drawing (typically N12 or N16 at 600mm centres); bars clean and correctly positioned; epoxy or grout anchor if into existing concrete',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per SD1468 reinforcing details. Dowel bars transfer lateral load from barrier to foundation.'
    },

    // =========================================================================
    // REINFORCEMENT (IN-SITU BARRIERS)
    // =========================================================================
    {
      description: 'Fix reinforcement steel per design drawings - verify bar sizes, spacing, cover, and lap lengths',
      acceptanceCriteria: 'Bar sizes and spacing per SD1468 or design drawings; minimum concrete cover 40mm (or as specified); lap lengths per AS 3600; bars tied and supported on chairs; reinforcement clean and free of loose rust',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS70 HP12 - Pre-pour inspection of reinforcement. Reinforcement must be inspected and accepted before concrete placement.'
    },
    {
      description: 'Verify reinforcement steel material certificates (mill certificates)',
      acceptanceCriteria: 'Mill certificates provided for each batch of reinforcement; bar grade and properties compliant with AS/NZS 4671 (Grade 500N); no bar substitutions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Per MRTS71 - steel reinforcement requirements.'
    },

    // =========================================================================
    // FORMWORK (IN-SITU CAST BARRIERS)
    // =========================================================================
    {
      description: 'Erect and align formwork for in-situ barrier pour - verify profile shape, dimensions, and alignment',
      acceptanceCriteria: 'Formwork produces correct barrier profile (single slope per TMR standard); formwork rigid and well-braced; internal dimensions within tolerance (+/-3mm); formwork clean and oiled; joints sealed to prevent grout loss',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Dimensional check',
      notes: 'Profile must match TMR single slope dimensions. Total barrier height typically 810mm or 1100mm per design.'
    },
    {
      description: 'For extruded (slipform) barriers, verify extrusion machine setup and trial run',
      acceptanceCriteria: 'Machine produces correct profile shape and dimensions; concrete consistency suitable for extrusion; trial section demonstrates acceptable finish and dimensional compliance; reinforcement placement mechanism functioning correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Dimensional check of trial section',
      notes: 'Extruded barriers require trial section approval before full production.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Pre-pour inspection - verify formwork/extrusion setup, reinforcement, embedments, and joint preparation are ready for concrete placement',
      acceptanceCriteria: 'All formwork secure; reinforcement inspected and approved; construction joints prepared (roughened, clean); expansion joint material positioned; all embedments (lighting conduits, cover plates) correctly placed per SD1469',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS70 HP12 - No concrete until formwork and reinforcement inspected and accepted.'
    },
    {
      description: 'Place, compact, and finish concrete barrier per approved procedures',
      acceptanceCriteria: 'Concrete placed within 90 minutes of batching; slump within specified range (+/-15mm of target); concrete fully compacted with no honeycombing; surface finish as specified; no segregation or cold joints',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: 'Slump test AS 1012.3.1; Temperature AS 1012.8.4',
      notes: 'MRTS70 witness point - Administrator may witness placement. Concrete temperature must be within specification (typically 10-32 deg C).'
    },
    {
      description: 'Cast concrete test cylinders for strength verification',
      acceptanceCriteria: 'Minimum 1 set of 3 cylinders per 50m3 or per pour (whichever is more frequent); cylinders made per AS 1012.8.1; cured per AS 1012.8.2',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete cylinder casting AS 1012.8.1',
      notes: 'Per MRTS70 testing frequency requirements.'
    },
    {
      description: 'Apply curing compound or wet curing to freshly placed concrete barrier',
      acceptanceCriteria: 'Curing commenced within 30 minutes of finishing; curing compound applied at manufacturer\'s rate or wet curing maintained for minimum 7 days; no surface drying or cracking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS70 - Effective curing for specified period. Inadequate curing causes surface cracking.'
    },

    // =========================================================================
    // PRECAST BARRIER INSTALLATION
    // =========================================================================
    {
      description: 'Inspect precast barrier units upon delivery - verify dimensions, profile, reinforcement certification, and concrete strength certification',
      acceptanceCriteria: 'Units match TMR single slope profile dimensions; no damage, cracking, or spalling; concrete strength certificate shows minimum 32 MPa achieved; steel certification provided; units clearly marked with date and batch',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Per MRTS24 and SD1473 - precast barrier installation details.'
    },
    {
      description: 'Place precast barrier units on prepared foundation per SD1473 installation details',
      acceptanceCriteria: 'Units placed on level foundation; connection details (dowel bars, grout pockets, keyways) per SD1473; barrier alignment within +/-10mm of design line; units level and flush at joints',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD1473 - Precast Concrete Barrier Installation Details.'
    },
    {
      description: 'Complete joint connections between precast units - grout dowel pockets, install connection hardware, and seal joints',
      acceptanceCriteria: 'Dowel bars grouted with non-shrink structural grout to full embedment; connection hardware (bolts, plates) torqued per design; joint sealant applied per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Connections must transfer load between units during impact.'
    },

    // =========================================================================
    // JOINTS & SEALANT
    // =========================================================================
    {
      description: 'Form expansion joints at specified locations per design (in-situ barriers) or at designed joint positions (precast)',
      acceptanceCriteria: 'Expansion joint spacing per design (typically 12-18m) per SD1468; joint filler material installed before concrete placement; joint width per design; dowel bars greased/sleeved on one side for movement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD1468 Sheet 2 covers expansion joint details for extruded median barriers.'
    },
    {
      description: 'Apply joint sealant to all expansion joints and construction joints',
      acceptanceCriteria: 'Joint faces clean, dry, and primed (if required); sealant type per specification; sealant tooled to correct profile with no voids, bubbles, or adhesion failure; sealant fully fills joint to design depth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Joint sealant prevents water ingress which causes reinforcement corrosion and foundation erosion.'
    },

    // =========================================================================
    // DELINEATION & FINISHING
    // =========================================================================
    {
      description: 'Install reflective delineators/raised pavement markers on concrete barrier at specified spacing',
      acceptanceCriteria: 'Delineator type and colour per TMR TRUM Volume 3; spacing per design (typically 8-16m or as specified); adhesive bond sound; delineators visible from required distance; correct colour for barrier side (white/red)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per MRTS14 and TMR TRUM Vol 3 delineation requirements.'
    },
    {
      description: 'Install lighting pole cover plates at designated locations per SD1469',
      acceptanceCriteria: 'Cover plates at correct barrier locations for future lighting poles; plates flush with barrier surface; bolted connections per SD1469; plates sealed to prevent water ingress',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD1469 - Cover plates at road lighting poles in concrete barriers. Install even if lighting not yet required.'
    },

    // =========================================================================
    // TRANSITIONS
    // =========================================================================
    {
      description: 'Install transitions between concrete barrier and W-beam/thrie beam guardrail per SD1470/SD1486',
      acceptanceCriteria: 'Transition hardware per SD1470 or SD1486; stiffness transition gradual from flexible to rigid; all connections secure; barrier face alignment continuous through transition; no gaps or steps',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD1470 / SD1486 - Concrete terminal for median barrier with thrie beam guardrail connection.'
    },

    // =========================================================================
    // TESTING & ACCEPTANCE
    // =========================================================================
    {
      description: 'Verify 28-day concrete compressive strength meets specification',
      acceptanceCriteria: 'Average strength of cylinder set >= 32 MPa; no individual cylinder < 28.8 MPa (0.9 x 32); results per MRTS70 statistical acceptance criteria',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Compressive strength AS 1012.9',
      notes: 'MRTS70 strength acceptance criteria. Failing lots may require investigation or remediation.'
    },
    {
      description: 'Perform dimensional survey of completed barrier - check alignment, height, and profile',
      acceptanceCriteria: 'Barrier height within +/-10mm of design; alignment within +/-15mm of design line; profile dimensions within +/-5mm of standard; surface finish Class 3 minimum (or as specified)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey per MRTS56; Profile template check',
      notes: 'Dimensional compliance survey over full barrier length.'
    },

    // =========================================================================
    // FINAL INSPECTION & HANDOVER
    // =========================================================================
    {
      description: 'Complete full-length visual inspection of concrete barrier system',
      acceptanceCriteria: 'No structural cracking, honeycombing, or surface defects; joints sealed; delineation complete; transitions secure; cover plates installed; drainage functioning; no construction debris',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Walk-through inspection of full barrier length.'
    },
    {
      description: 'Repair any surface defects identified during inspection per MRTS70 approved repair method',
      acceptanceCriteria: 'All honeycombing, bug holes, and surface defects repaired per approved method (MRTS70 Cl. 17.12); repairs match surrounding surface colour and texture; structural repairs approved by Administrator',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS70 - Concrete repair methods must be witnessed by Administrator.'
    },
    {
      description: 'Provide as-built survey, concrete test results, reinforcement certificates, and maintenance documentation to Administrator',
      acceptanceCriteria: 'Complete documentation package including as-built survey, all test certificates, material certificates, construction records, and maintenance guide',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Documentation required for asset management and future modifications.'
    }
  ]
}

// =============================================================================
// TEMPLATE 20: PAVEMENT MARKING (MRTS45)
// Based on: TMR MRTS45 Road Surface Delineation, AS 4049, AS 2009, TMR TRUM Vol 3
// =============================================================================

const qldPavementMarkingTemplate = {
  name: 'Pavement Marking - Linemarking and Raised Pavement Markers',
  description: 'TMR pavement marking including paint (waterborne/thermoplastic), raised pavement markers, audio tactile line marking, retroreflectivity testing, and geometric compliance per MRTS45 Road Surface Delineation (harmonised with Austroads ATS 4110).',
  activityType: 'road_furniture',
  specificationReference: 'TMR MRTS45 Road Surface Delineation',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-CONSTRUCTION PLANNING
    // =========================================================================
    {
      description: 'Submit pavement marking construction procedures and quality plan to Administrator including material types, application methods, equipment, and testing schedule',
      acceptanceCriteria: 'Procedures address all marking types (paint, thermoplastic, cold applied plastic, RPMs); equipment listed and calibrated; testing schedule compliant with MRTS45; procedures accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS45 Cl. 5 - Quality system requirements and construction procedures.'
    },
    {
      description: 'Verify pavement marking materials are from TMR-registered or APAS-certified suppliers',
      acceptanceCriteria: 'Paint compliant with AS 4049.3 (waterborne) or AS 4049.2 (thermoplastic) or AS 4049.4 (cold applied); glass beads compliant with AS 2009; supplier APAS certification current; material test certificates provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS45 - Materials must comply with relevant AS 4049 standard. APAS (Australian Paint Approval Scheme) certification through CSIRO.'
    },
    {
      description: 'Verify glass beads type and grade match specification requirements',
      acceptanceCriteria: 'Glass beads Type B, B-HR, C, D, or D-HR per AS 2009 as specified in contract Annexure; bead size distribution within specification; roundness and transparency meet standard; batch certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS45 - Bead type specified in Annexure. HR types have higher retroreflectivity.'
    },
    {
      description: 'Verify raised pavement marker (RPM) type and adhesive comply with specification',
      acceptanceCriteria: 'RPMs on TMR accepted list; retroreflective RPMs comply with AS 1906.3; adhesive type per manufacturer\'s recommendation; material test certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS45 Cl. 5.9.2 - Raised retroreflective pavement markers.'
    },

    // =========================================================================
    // EQUIPMENT CALIBRATION
    // =========================================================================
    {
      description: 'Calibrate and test linemarking application equipment - verify paint flow rate, bead dispenser rate, and line width settings',
      acceptanceCriteria: 'Equipment calibration current; paint application rate meets minimum specified in MRTS45 Table 7.5.2.4; glass bead drop rate meets minimum; line width settings correct for marking types; spray pattern uniform',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Equipment calibration test',
      notes: 'MRTS45 - Equipment calibration must be verified before marking commences.'
    },
    {
      description: 'Verify retroreflectometer is calibrated and within current calibration period',
      acceptanceCriteria: 'Retroreflectometer calibration certificate current (within 12 months); instrument type suitable for road marking measurement; calibration traceable to national standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required for retroreflectivity compliance testing.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect pavement surface condition and confirm suitability for marking application',
      acceptanceCriteria: 'Surface clean, dry, and free of dust, oil, grease, loose material, and curing compound residues; surface temperature within specification range; no standing water; new asphalt or concrete sufficiently cured',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS45 - Surface preparation requirements. Paint adhesion depends critically on surface cleanliness.'
    },
    {
      description: 'Remove existing marking if required (for re-marking or changed layout)',
      acceptanceCriteria: 'Old marking removed by grinding, blasting, or approved method; removal method does not damage pavement surface excessively; surface profile suitable for new marking adhesion; removed material disposed of properly',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS45 - Removal methods specified. Water blasting may not be suitable on some surfaces.'
    },
    {
      description: 'Verify weather conditions are suitable for marking application',
      acceptanceCriteria: 'No rain falling or imminent; pavement surface dry; ambient temperature above 10 deg C; relative humidity below 85%; wind speed within limits for spray application; conditions expected to remain suitable for curing period',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Weather monitoring',
      notes: 'MRTS45 - Weather conditions for application. Marking applied in unsuitable conditions will fail prematurely.'
    },

    // =========================================================================
    // SETOUT
    // =========================================================================
    {
      description: 'Set out marking lines and positions per design documentation and TMR TRUM Volume 3',
      acceptanceCriteria: 'Centre line, edge line, lane line, and special marking positions per design drawings; line positions within +/-25mm of design; curve geometry correct; marking types (continuous, broken, barrier) per traffic management plan',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Survey per MRTS56',
      notes: 'TMR TRUM Volume 3 - Part 1 covers marking patterns and dimensions.'
    },
    {
      description: 'Set out raised pavement marker positions per design documentation',
      acceptanceCriteria: 'RPM positions per TMR TRUM Volume 3 requirements; spacing per design (typically 6m for centre line, 12m for edge line); positions marked on pavement; correct RPM type at each location (reflective colour per lane use)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS45 Cl. 5.9.2, 5.9.3 - RPM placement per TRUM Part 2.'
    },

    // =========================================================================
    // APPLICATION - LONGITUDINAL LINE MARKING
    // =========================================================================
    {
      description: 'Apply paint line marking (waterborne or solvent-based) at specified application rates with glass bead application',
      acceptanceCriteria: 'Paint application rate meets minimum specified in MRTS45 Table 7.5.2.4 (typical minimum 0.35-0.50 L/m2 for waterborne); glass bead application rate per specification; line width per design (100mm or 150mm typical); line edges sharp and uniform',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Application rate check (area method or tray test)',
      notes: 'MRTS45 Table 7.5.2.4 - Minimum paint and bead application rates.'
    },
    {
      description: 'Apply thermoplastic line marking at specified thickness and temperature',
      acceptanceCriteria: 'Thermoplastic thickness meets minimum specified in MRTS45 (typical 2.5-3.0mm for extruded, 1.5-2.0mm for sprayed); application temperature per manufacturer (typically 180-220 deg C); surface adhesion sound; glass beads applied at specified rate; line width per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Wet film thickness gauge; Application rate check',
      notes: 'MRTS45 - Thermoplastic material thickness per specification table.'
    },
    {
      description: 'Verify broken line marking pattern dimensions (mark/gap ratio)',
      acceptanceCriteria: 'Mark length and gap length per TMR TRUM Volume 3 (e.g. 3m mark / 6m gap for lane lines; 1m mark / 3m gap for edge lines); pattern consistent along length; no drift in pattern spacing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tape measurement at regular intervals',
      notes: 'TMR TRUM Volume 3 Part 1 specifies mark and gap dimensions.'
    },

    // =========================================================================
    // APPLICATION - RAISED PAVEMENT MARKERS
    // =========================================================================
    {
      description: 'Prepare RPM installation locations - clean surface and apply adhesive',
      acceptanceCriteria: 'Installation locations clean and dry; adhesive type and quantity per manufacturer\'s recommendation; adhesive applied to both pavement and RPM base (or as directed); pavement temperature suitable for adhesive cure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS45 - RPM installation procedure.'
    },
    {
      description: 'Install raised pavement markers at set-out positions',
      acceptanceCriteria: 'RPMs positioned within +/-25mm of set-out position; correct RPM type at each location (uni-directional or bi-directional as required); RPMs aligned square to direction of travel; adhesive squeezed out indicates full contact; RPMs not placed on joints, cracks, or utility covers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS45 - RPM installation requirements.'
    },
    {
      description: 'Verify RPM adhesion after curing period',
      acceptanceCriteria: 'RPMs firmly bonded to pavement; no movement when tested by hand pressure; adhesive fully cured per manufacturer\'s specification; no RPMs dislodged during initial trafficking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Manual adhesion check',
      notes: 'Check adhesion after minimum cure period before opening to traffic.'
    },

    // =========================================================================
    // APPLICATION - AUDIO TACTILE LINE MARKING (ATLM)
    // =========================================================================
    {
      description: 'Install audio tactile line marking (raised profile marking) at specified locations',
      acceptanceCriteria: 'ATLM profile height per specification (typically 6-8mm); spacing of raised elements per design; material and colour per specification; marking applied over standard line marking; adhesion to pavement surface adequate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Profile height measurement',
      notes: 'MRTS45 - ATLM requirements. ATLM provides auditory and tactile warning to drivers.'
    },

    // =========================================================================
    // TESTING - RETROREFLECTIVITY
    // =========================================================================
    {
      description: 'Measure retroreflectivity of longitudinal line marking between 10 and 20 days after application',
      acceptanceCriteria: 'Minimum retroreflectivity at any single location >= 300 mcd/lux/m2; average of all readings (combined both directions) >= 350 mcd/lux/m2; measured using calibrated retroreflectometer per AS 4049',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Retroreflectivity measurement per AS 4049 / MRTS45',
      notes: 'MRTS45 - Retroreflectivity measured at 10 measurements per line type over 10km, five in each direction. Minimum 300 mcd/lux/m2 individual, 350 mcd/lux/m2 average.'
    },
    {
      description: 'Verify retroreflectivity measurement protocol compliance',
      acceptanceCriteria: 'Measurements taken at specified intervals (10 measurements per line type per 10km, 5 in each direction); instrument calibrated; measurements in both directions of travel; results documented with location references',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'test',
      testType: 'Retroreflectivity measurement',
      notes: 'MRTS45 - Measurement protocol for compliance verification.'
    },

    // =========================================================================
    // GEOMETRIC COMPLIANCE
    // =========================================================================
    {
      description: 'Check geometric tolerances of applied markings at regular intervals',
      acceptanceCriteria: 'Line width within tolerance (+/-5mm); line position within +/-25mm of design; broken line pattern mark/gap within +/-100mm; no visible weaving, wobble, or inconsistent edges',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tape measurement per MRTS45 Annexure intervals',
      notes: 'MRTS45 - Geometric tolerances checked at intervals not greater than specified in Annexure.'
    },

    // =========================================================================
    // FINAL INSPECTION & HANDOVER
    // =========================================================================
    {
      description: 'Complete full-length visual and dimensional inspection of all pavement markings and RPMs',
      acceptanceCriteria: 'All marking types applied per design; no missed sections or incorrect patterns; RPMs at all specified locations; marking colours correct; no over-spray on adjacent surfaces; marking visible in daytime and night conditions',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Inspect during both day and night conditions if possible.'
    },
    {
      description: 'Submit marking compliance documentation including retroreflectivity results, application rates, material certificates, and geometric compliance records',
      acceptanceCriteria: 'All test results within specification; material certificates complete; retroreflectivity results meet minimum requirements; geometric compliance documented; as-applied records provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Complete documentation package for Administrator\'s acceptance.'
    }
  ]
}

// =============================================================================
// TEMPLATE 21: FENCING - BOUNDARY, FAUNA EXCLUSION, AND NOISE WALLS (MRTS14/MRTS15)
// Based on: TMR MRTS14 Road Furniture + MRTS15 Noise Fences, SD1600-SD1615
// =============================================================================

const qldFencingTemplate = {
  name: 'Fencing - Boundary, Fauna Exclusion, and Noise Walls',
  description: 'TMR fencing installation covering boundary rural fencing, chain link fencing, fauna exclusion fencing, and noise fences/walls per MRTS14 Road Furniture and MRTS15 Noise Fences. References SD1600-SD1604, SD1615.',
  activityType: 'road_furniture',
  specificationReference: 'TMR MRTS14 Road Furniture + MRTS15 Noise Fences',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-CONSTRUCTION PLANNING
    // =========================================================================
    {
      description: 'Submit fencing construction procedures to Administrator, identifying fence types, materials, and installation methods for each section',
      acceptanceCriteria: 'Procedures address all fence types in scope (boundary rural, chain link, fauna exclusion, noise wall); materials specified; installation sequence documented; procedures accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Cl. 5.2 - Construction procedures must be submitted and accepted.'
    },
    {
      description: 'For noise fences/walls, submit noise fence design documentation and geotechnical investigation to Administrator not less than 14 business days prior to construction',
      acceptanceCriteria: 'Design documentation includes structural design, foundation details, acoustic performance calculations, material specifications, and geotechnical investigation; design complies with MRTS15; submitted minimum 14 business days before construction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS15 - Design documentation and geotechnical reports required 14 business days prior. Construction shall not commence until design is approved.'
    },
    {
      description: 'Obtain Administrator\'s approval of noise fence design before commencing noise fence construction',
      acceptanceCriteria: 'Written approval from Administrator for noise fence design; all design review comments addressed; any supplementary conditions noted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS15 Hold Point - Noise fence construction shall not commence until granted permission to use the noise fence design.'
    },
    {
      description: 'Review design documentation for boundary/fauna fencing including fence line survey, type per section, gate locations, and special treatments at water crossings and grid locations',
      acceptanceCriteria: 'Fence line clearly defined on design drawings; fence type per section matches specification; gate locations and types identified; water crossing and grid treatments documented; clearance dimensions per standard drawings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Special treatments at water crossings and grids constructed per design documentation or standard drawings.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION (BOUNDARY & FAUNA FENCING)
    // =========================================================================
    {
      description: 'Verify fencing wire and mesh materials upon delivery comply with AS 2423',
      acceptanceCriteria: 'Plain and barbed wire compliant with AS 2423; galvanised coating per specification; wire gauge correct for fence type; mesh type and aperture size correct for fauna fencing; material certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 - Plain and barbed fencing wire shall comply with AS 2423 (Coated steel wire fencing products for terrestrial, aquatic and general use).'
    },
    {
      description: 'Verify fence posts and stays upon delivery - correct size, material, length, and treatment',
      acceptanceCriteria: 'Post type per standard drawing (timber, CHS, or steel as specified); post length suitable for required height + embedment; timber posts treated to H4 or H5; steel posts galvanised to AS/NZS 4680; no damage or defects',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'SD1600 (timber posts), SD1601 (CHS posts), SD1602 (chainwire). Post type as specified in design.'
    },
    {
      description: 'Verify fauna exclusion fencing materials match specification including mesh type, floppy top extension, and apron details',
      acceptanceCriteria: 'Mesh type and aperture per SD1603 (koala proof) or SD1615 (floppy top fauna exclusion) as applicable; mesh height correct; floppy top extension correct length and angle; ground apron material and width correct; all galvanised',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'SD1603 - Koala proof fence and gate; SD1615 - Fauna exclusion fencing, floppy top mesh fence and gate.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION (NOISE FENCE)
    // =========================================================================
    {
      description: 'Verify noise fence/wall materials upon delivery - structural posts, panels, acoustic material, and fasteners',
      acceptanceCriteria: 'Materials match approved noise fence design; steel posts galvanised per specification; panels correct type (timber, precast concrete, composite, or metal acoustic panels per design); acoustic performance rating matches specification; all fasteners corrosion resistant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS15 - Materials per approved design. Noise fences may be constructed on engineering structures (retaining walls, bridges, barriers).'
    },

    // =========================================================================
    // SITE PREPARATION & SETOUT
    // =========================================================================
    {
      description: 'Survey and mark fence line, post locations, gate positions, and special treatment locations',
      acceptanceCriteria: 'Fence line per design; post spacing per standard drawing (typically 3.0-4.0m for rural fence, as designed for noise fence); gate positions correct; corner, strainer, and end post positions marked; special treatments at watercourse crossings and grids identified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Construction survey per MRTS56',
      notes: 'MRTS56 applies. Updated surveying requirements for noise fence footings per MRTS56 (referenced in MRTS15 Nov 2025 update).'
    },
    {
      description: 'Complete DBYD enquiry and locate all underground services along fence line',
      acceptanceCriteria: 'DBYD enquiry completed; all services located and marked; fence post positions adjusted to avoid services where required; protection measures in place',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mandatory prior to any post installation.'
    },

    // =========================================================================
    // SALVAGE / DEMOLITION OF EXISTING FENCING
    // =========================================================================
    {
      description: 'Submit schedule of existing fence items to be salvaged, not less than 7 days prior to commencement of dismantling',
      acceptanceCriteria: 'Schedule lists all items to be salvaged with quantities, locations, and condition assessment; submitted minimum 7 days prior; schedule accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Hold Point - Schedule of items to be salvaged submitted 7 days prior to dismantling.'
    },
    {
      description: 'Submit schedule of existing fence items to be dismantled for re-erection, not less than 7 days prior to commencement of dismantling',
      acceptanceCriteria: 'Schedule lists all items to be re-erected with locations (existing and new), condition assessment, and any replacement components needed; submitted minimum 7 days prior; schedule accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS14 Hold Point - Schedule of items for re-erection submitted 7 days prior to dismantling.'
    },

    // =========================================================================
    // POST INSTALLATION (BOUNDARY & FAUNA FENCING)
    // =========================================================================
    {
      description: 'Install fence posts (driven, concreted, or planted) per standard drawing for fence type',
      acceptanceCriteria: 'Post embedment depth per standard drawing (typically 600mm-900mm depending on fence type and ground conditions); posts plumb (+/-10mm over height); post height correct for fence type; strainer posts braced and anchored per drawing; concrete footings (if required) per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS14 - Erection details and clearance dimensions per design documentation or SD1600-SD1604.'
    },
    {
      description: 'Verify fence post tops follow a smooth line in undulating country',
      acceptanceCriteria: 'Post tops follow smooth profile along fence line; no abrupt steps between adjacent posts; post heights adjusted for terrain to maintain consistent wire heights above ground',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS14 - In undulating country, fencing shall be erected so that post tops follow a smooth line.'
    },

    // =========================================================================
    // POST INSTALLATION (NOISE FENCE)
    // =========================================================================
    {
      description: 'Excavate and construct noise fence post foundations per approved design',
      acceptanceCriteria: 'Foundation dimensions per design; concrete strength per structural design (typically 32 MPa); reinforcement per design; anchor bolts positioned per drawing; foundation level and position per survey',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Concrete compressive strength AS 1012.9; Survey per MRTS56',
      notes: 'MRTS15 - Foundation survey per updated MRTS56 requirements (Nov 2025 edition).'
    },
    {
      description: 'Install noise fence structural posts and verify plumb, alignment, and height',
      acceptanceCriteria: 'Posts plumb within tolerance per structural design; post spacing per design; post top height correct for panel installation; posts securely fixed to foundations; all connections torqued per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Survey / spirit level',
      notes: 'MRTS15 - Critical structural element.'
    },

    // =========================================================================
    // WIRE STRAINING (BOUNDARY & FAUNA FENCING)
    // =========================================================================
    {
      description: 'Strain wires in accordance with manufacturer\'s recommendations and tie to strainer posts, intermediate posts, and droppers',
      acceptanceCriteria: 'Wires strained per manufacturer\'s recommendations; wire tension uniform along fence section; wires tied to strainer posts and assemblies, intermediate posts and droppers with approved ties; wire spacing per standard drawing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS14 - Wires shall be strained in accordance with manufacturer\'s recommendations and tied with approved ties.'
    },
    {
      description: 'Install droppers at specified spacing between posts',
      acceptanceCriteria: 'Dropper spacing per standard drawing (typically 3-5 dropper spaces between posts); droppers vertical; wires correctly clipped to droppers; dropper length matches post/wire configuration',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per SD1600/SD1601 details.'
    },

    // =========================================================================
    // FAUNA EXCLUSION FEATURES
    // =========================================================================
    {
      description: 'Install fauna exclusion mesh from ground level to full height, including ground apron and floppy top (where specified)',
      acceptanceCriteria: 'Mesh secured to posts and wires at maximum 300mm spacing; mesh extends to ground with minimum 300mm turned-out ground apron; apron secured with ground pegs; floppy top extension installed at correct angle per SD1615; no gaps at base or between panels that would allow fauna passage',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD1603 (koala proof) or SD1615 (floppy top fauna exclusion). Gap-free installation critical for fauna exclusion effectiveness.'
    },
    {
      description: 'Verify fauna exclusion fencing integrity at all interfaces - gates, grid crossings, watercourse crossings, changes of direction',
      acceptanceCriteria: 'No gaps exceeding mesh aperture size at any interface; gates properly fitted with fauna-proof seal at base and sides; grid crossings have fauna-proof under-grid treatment; watercourse crossings treated per design; all interfaces inspected for potential fauna bypass',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical inspection - effectiveness of entire fauna exclusion system depends on gap-free integrity at all interfaces.'
    },

    // =========================================================================
    // NOISE FENCE PANEL INSTALLATION
    // =========================================================================
    {
      description: 'Install noise fence panels into post channels/brackets per approved design',
      acceptanceCriteria: 'Panels seated fully in channels/brackets; panel joints sealed per design; panels level and plumb; no gaps between panels that would reduce acoustic performance; panels secured against wind loading per structural design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS15 - Panel installation per approved noise fence design. Gaps compromise acoustic performance.'
    },
    {
      description: 'Seal all panel joints and post-to-panel interfaces to achieve specified acoustic performance',
      acceptanceCriteria: 'Sealant type per specification; all joints sealed with no gaps or voids; sealant adhered to both panel faces; post-to-panel interfaces sealed; no visible daylight through fence when viewed from noise source side',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Visual light test (daylight visibility through fence)',
      notes: 'MRTS15 - Acoustic performance depends on airtight construction.'
    },

    // =========================================================================
    // GATE INSTALLATION
    // =========================================================================
    {
      description: 'Install gates at specified locations per standard drawing - verify operation, clearance, and securing hardware',
      acceptanceCriteria: 'Gate type per design (swing or sliding); gate opening width per specification; gate height matches fence height; hinges, latches, and catches functioning correctly; gate opens and closes freely without binding; lockable where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per SD1600-SD1604 gate details. Gates for fauna fencing must maintain fauna exclusion integrity (SD1603, SD1615).'
    },
    {
      description: 'For fauna exclusion gates, verify fauna-proof seal at gate base and sides when closed',
      acceptanceCriteria: 'Gate base clearance does not exceed mesh aperture size when closed; side seals close gap between gate and post; gate catch holds gate firmly closed; self-closing mechanism fitted if specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Gate must not provide a fauna bypass route when closed.'
    },

    // =========================================================================
    // SPECIAL TREATMENTS
    // =========================================================================
    {
      description: 'Construct special treatments at water crossings as shown in design documentation',
      acceptanceCriteria: 'Water crossing treatment per design documentation (floodgate, suspended fence, or other as specified); treatment secure against stock and fauna; treatment allows water flow without debris accumulation; construction robust against flood events',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS14 - Special treatments at water crossings shall be constructed per design documentation or, where not shown, be made secure against stock.'
    },

    // =========================================================================
    // FINAL INSPECTION & HANDOVER
    // =========================================================================
    {
      description: 'Complete full-length visual inspection of all installed fencing',
      acceptanceCriteria: 'All posts plumb and aligned; wires taut and at correct heights; mesh secured with no gaps; gates operational; fauna exclusion integrity verified; noise fence panels complete and sealed; delineators on fence near road where required; no construction debris',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Walk entire fence line for visual inspection.'
    },
    {
      description: 'For noise fences, verify that as-built fence meets design acoustic performance requirements',
      acceptanceCriteria: 'Fence height and position match acoustic design; no gaps in acoustic barrier; construction verified against approved design; acoustic testing if specified in contract (noise level measurement at receiver)',
      pointType: 'witness',
      responsibleParty: 'superintendent',
      evidenceRequired: 'test',
      testType: 'Acoustic measurement if specified (environmental noise monitoring)',
      notes: 'MRTS15 - Acoustic performance verification may be specified.'
    },
    {
      description: 'Provide as-built survey, material certificates, and documentation package to Administrator',
      acceptanceCriteria: 'As-built survey showing fence alignment, post locations, gate positions, and special treatments; all material certificates; construction records; fauna exclusion compliance certification (if applicable); noise fence design certification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey per MRTS56',
      notes: 'Documentation for asset management and maintenance.'
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Road Furniture')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldWireRopeBarrierTemplate)
    await seedTemplate(qldWBeamGuardrailTemplate)
    await seedTemplate(qldConcreteBarrierTemplate)
    await seedTemplate(qldPavementMarkingTemplate)
    await seedTemplate(qldFencingTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 road furniture templates)')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Templates created:')
    console.log('  1. Steel Wire Rope Safety Barrier (MRTS14) - 25 items')
    console.log('  2. W-Beam Steel Guard Fence / Guardrail (MRTS14) - 23 items')
    console.log('  3. Concrete Road Safety Barrier (MRTS14/MRTS70) - 27 items')
    console.log('  4. Pavement Marking (MRTS45) - 23 items')
    console.log('  5. Fencing - Boundary, Fauna, Noise Walls (MRTS14/MRTS15) - 28 items')
    console.log('')
    console.log('To use these templates:')
    console.log('1. Create a project with specificationSet = "MRTS (QLD)"')
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
