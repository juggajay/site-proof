/**
 * Seed Script: VIC (VicRoads) ITP Templates - Road Furniture
 *
 * Creates global ITP templates for VIC road furniture activities.
 * Templates: Wire Rope Safety Barrier (Sec 711), W-Beam Guard Fence (Sec 708),
 *            Concrete Barrier (Sec 610/BTN001), Pavement Marking (Sec 721/722),
 *            Fencing incl. Noise Walls (Sec 707/765)
 *
 * Run with: node scripts/seed-itp-templates-vic-road-furniture.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 17: WIRE ROPE SAFETY BARRIER (VicRoads Sec 711)
// Based on: VicRoads Section 711, SD 4302/4303/4311/3573, AS/NZS 3845, NCHRP 350/MASH
// =============================================================================

const vicWireRopeBarrierTemplate = {
  name: 'Wire Rope Safety Barrier (WRSB)',
  description: 'VicRoads wire rope safety barrier installation including product compliance, post foundations, side-load testing, cable installation, tensioning, end terminals, delineation, and compliance audit per Section 711. Four wire rope proprietary system meeting NCHRP 350 TL-4 (main sections) and TL-3 (terminals).',
  activityType: 'road_furniture',
  specificationReference: 'Sec 711',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for WRSB installation',
      acceptanceCriteria: 'All current revision drawings, Section 711, SD 4311, SD 3573, and manufacturer installation manual reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 711.01. Section 711 covers supply and installation of WRSB systems and associated works. Sections 703, 708, and 812 are referenced.'
    },
    {
      description: 'Submit product compliance documentation for WRSB system and components -- minimum 14 days before installation',
      acceptanceCriteria: 'Compliance certificates confirming WRSB system meets NCHRP Report 350 Test Level 4 (main sections) and Test Level 3 (terminals) plus AS/NZS 3845 conformance; certificates for all components submitted and accepted by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'NCHRP 350 / MASH; AS/NZS 3845',
      notes: 'Cl 711.03, 711.05. WRSB must be a four wire rope proprietary system. Installation cannot proceed without Superintendent acceptance of compliance documentation.'
    },
    {
      description: 'Verify WRSB system is on DTP Accepted Safety Barrier Products list (RDN 06-04)',
      acceptanceCriteria: 'WRSB system (including terminals) listed on current VicRoads/DTP Road Design Note 06-04 -- Accepted Safety Barrier Products',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 711.03. Only accepted proprietary systems may be installed on VicRoads roads.'
    },
    {
      description: 'Verify material certificates -- posts, wire ropes, fittings, galvanising, and powder coating',
      acceptanceCriteria: 'Posts hot-dip galvanized per AS/NZS 4680 or pre-galvanized (Z600 or ZM275 coating); powder coating thermosetting polyester (Heritage Green or white, low gloss) if specified; all posts permanently marked with manufacturer identification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4680',
      notes: 'Cl 711.04, 711.06. All ferrous components to be galvanized. Wire ropes supplied on reels, protected from damage during storage and handling.'
    },

    // =========================================================================
    // POST FOUNDATIONS
    // =========================================================================
    {
      description: 'Confirm post foundation type based on geotechnical conditions',
      acceptanceCriteria: 'Manufacturer\'s default anchor used unless geotechnical investigation justifies alternative; any deviation from standard foundations approved in writing by manufacturer and Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 711.07. Foundation construction requires Superintendent inspection. Non-standard foundations require proof engineering.'
    },
    {
      description: 'Inspect post foundation construction before casting (concrete foundations)',
      acceptanceCriteria: 'Excavation to correct depth and dimensions; foundation form or void former correctly positioned; concrete grade N25 for post foundations, N32 for anchor blocks; reinforcement (if required) correctly placed with minimum cover',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 711.07. Concrete requirements: post foundations N25 grade; anchor blocks N32 grade. Foundation must comply with Section 703 for concrete.'
    },
    {
      description: 'Conduct side-load testing of post foundations before wire rope installation',
      acceptanceCriteria: '10 kN force applied at 45 degrees, 600mm above ground level; footing movement must not exceed 3mm at ground level; test conducted on a sample of posts (typically all posts, or as specified by manufacturer)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Side-load test per Cl 711.07',
      notes: 'Cl 711.07. Side-load testing required BEFORE wire rope installation. Failure requires remediation and retesting.'
    },

    // =========================================================================
    // POST AND ALIGNMENT
    // =========================================================================
    {
      description: 'Install posts to correct alignment, spacing, and plumb',
      acceptanceCriteria: 'Posts installed per drawings and manufacturer specifications; post spacing within +/-25mm of design; posts vertical within tolerance; minimum 1m offset from batter hinge points (unless reduced with manufacturer written advice and side-load testing)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 711.07, 711.08. Batter offset is critical for barrier performance.'
    },
    {
      description: 'Submit pegged alignment for Superintendent review (minimum 5 working days)',
      acceptanceCriteria: 'Pegged alignment of WRSB reviewed and accepted by Superintendent; alignment matches design drawings and sight distance requirements; minimum 5 working days allowed for review',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey',
      notes: 'Cl 711.07. Pegged alignment requires Superintendent review -- minimum 5 working days for acceptance before installation proceeds.'
    },

    // =========================================================================
    // CABLE INSTALLATION AND TENSIONING
    // =========================================================================
    {
      description: 'Install wire ropes to manufacturer\'s requirements',
      acceptanceCriteria: 'Wire ropes installed without twisting, kinking, or damage; ropes threaded through posts in correct sequence; all fittings installed per manufacturer\'s manual; rope ends properly terminated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 711.07. No twisting allowed during installation.'
    },
    {
      description: 'Tension wire ropes per manufacturer\'s temperature/tension relationship',
      acceptanceCriteria: 'Wire ropes tensioned to correct tension for ambient temperature per manufacturer\'s chart; tension measured and recorded for each rope; tensioning report submitted within 7 days',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tension measurement',
      notes: 'Cl 711.07. Tension varies with temperature -- manufacturer provides relationship chart. Report required within 7 days of tensioning.'
    },

    // =========================================================================
    // ANCHOR BLOCKS AND END TERMINALS
    // =========================================================================
    {
      description: 'Inspect anchor block construction',
      acceptanceCriteria: 'Anchor blocks constructed per SD drawings and manufacturer details; concrete grade N32; dimensions per design; reinforcement correctly placed; wire rope anchorage fittings correctly cast in',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 711.07. N32 concrete required for anchor blocks. Superintendent to inspect before casting.'
    },
    {
      description: 'Inspect end terminal installation',
      acceptanceCriteria: 'End terminals installed per manufacturer\'s details and accepted product documentation; terminal type matches NCHRP 350 / MASH Test Level 3 certification; terminal correctly aligned with approach traffic; runout area clear of obstructions per SD 3573',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3573. End terminals are critical safety elements requiring Superintendent approval.'
    },

    // =========================================================================
    // DELINEATION AND FINISHING
    // =========================================================================
    {
      description: 'Install delineators on WRSB posts',
      acceptanceCriteria: 'Delineators installed per drawings; correct colour (red left side, white right side two-way, yellow right side one-way); spacing as specified; retroreflective material Class 1A per AS/NZS 1906.2; minimum 100cm2 area; securely attached',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Similar to Section 708 delineator requirements. Delineators typically at 15m spacing.'
    },
    {
      description: 'Verify WRSB tolerances on completed installation',
      acceptanceCriteria: 'Vertical height +/-20mm from design line; longitudinal line +/-20mm in plan view; post spacing +/-25mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey measurement',
      notes: 'Cl 711.08. Final dimensional check of completed barrier.'
    },
    {
      description: 'Conduct compliance audit by Licensed Supplier before Practical Completion',
      acceptanceCriteria: 'Audit conducted by Licensed Supplier of the WRSB system; Certificate of Compliance issued for each WRSB section; all defects rectified before certificate issuance',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Compliance audit per Cl 711.09',
      notes: 'Cl 711.09. Mandatory pre-Practical Completion audit. Certificate must be issued before work is accepted.'
    },
    {
      description: 'Submit manufacturer\'s installation checklists for all WRSB sections',
      acceptanceCriteria: 'Completed checklists for every section of installed WRSB; signed by installer and manufacturer\'s representative (if applicable); all items confirmed compliant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 711.09. Part of final handover documentation.'
    }
  ]
}

// =============================================================================
// TEMPLATE 18: W-BEAM GUARD FENCE (VicRoads Sec 708)
// Based on: VicRoads Section 708, SD 3661/3671, SD 3544/3545/3562, AS/NZS 1594, AS/NZS 4680
// =============================================================================

const vicWBeamGuardFenceTemplate = {
  name: 'W-Beam Guard Fence (Steel Beam Guard Fence)',
  description: 'VicRoads steel beam guard fence (W-beam) installation including material verification, post installation and foundation testing, rail erection, bolt torque, end terminals (trailing and leading), delineation, and compliance audit per Section 708. References SD 3661, SD 3671, SD 3544, SD 3545, SD 3562, SD 3503.',
  activityType: 'road_furniture',
  specificationReference: 'Sec 708',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for guard fence installation',
      acceptanceCriteria: 'All current revision drawings, Section 708, SD 3661/3671, terminal drawings (SD 3544/3545/3562), and manufacturer instructions reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 708.01. Section 708 covers supply and installation of steel beam guard fence (W-beam) systems. References Sections 703 and 812.'
    },
    {
      description: 'Submit material test certificates for W-beam rails, posts, fittings, and galvanising -- minimum 14 days before installation',
      acceptanceCriteria: 'W-beams: AS/NZS 1594 Grade HA350 (350 MPa yield, 430 MPa tensile); posts and blocks: Grade HA250, 6.0mm thickness; terminal sections: Grade HA350; all ferrous components hot-dip galvanized per AS/NZS 4680; certificates received and accepted before materials used',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1594; AS/NZS 4680',
      notes: 'Cl 708. Compliance documentation required minimum 14 days before installation. Superintendent must accept before work proceeds.'
    },
    {
      description: 'Verify guard fence system is on DTP Accepted Safety Barrier Products list (RDN 06-04)',
      acceptanceCriteria: 'Guard fence system (including terminals) listed on current VicRoads/DTP Road Design Note 06-04',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 708. Only accepted products may be installed.'
    },

    // =========================================================================
    // POST INSTALLATION
    // =========================================================================
    {
      description: 'Install posts to correct depth, alignment, spacing, and plumb',
      acceptanceCriteria: 'Posts driven or placed in holes to specified depth; holes backfilled in 100mm compacted layers; 75mm minimum clearance from post back to hole face in rock; post spacing per SD 3661/3671; posts plumb within +/-15mm vertical deviation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 708. Posts driven or installed in prepared holes. Non-standard post lengths require Superintendent approval with proof engineering.'
    },
    {
      description: 'Conduct post foundation compliance check',
      acceptanceCriteria: 'Foundation displacement at ground level does not exceed 3mm when 1 kN force is applied horizontally at ground level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Foundation load test',
      notes: 'Cl 708. Foundation compliance achieved when displacement does not exceed 3mm under 1 kN force.'
    },
    {
      description: 'Install concrete maintenance strip at post bases (where specified)',
      acceptanceCriteria: 'Concrete maintenance strip installed per SD 3503; concrete grade N20 minimum; 75mm depth on 75mm compacted Class 3 crushed rock base; strip width and extent per drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3503 / Cl 708. Maintenance strip required where specified to prevent vegetation growth around posts.'
    },

    // =========================================================================
    // RAIL INSTALLATION
    // =========================================================================
    {
      description: 'Install W-beam rails to correct height, alignment, and overlap direction',
      acceptanceCriteria: 'Rail height per SD 3661 (typically 730mm from ground to top of W-beam); rails lapped with exposed ends facing away from approaching traffic; all bolt holes aligned; no forced fits or deformation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 708, SD 3661. Lap direction is critical for barrier performance -- exposed ends must face away from traffic.'
    },
    {
      description: 'Tighten all bolts -- splice bolts and post bolts',
      acceptanceCriteria: 'All bolts snug-tightened per AS 4100; splice bolts M16/M20 Class 8.8 and Class 5; post bolts M20 Class 4.6; all bolts set flush with W-beam on traffic side; no protruding bolt heads on traffic face',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Torque wrench / snug-tight check',
      notes: 'Cl 708. All bolts shall be fully tightened. Bolt head orientation critical -- flush on traffic side.'
    },

    // =========================================================================
    // END TREATMENTS (TERMINALS)
    // =========================================================================
    {
      description: 'Install trailing terminal per manufacturer\'s details',
      acceptanceCriteria: 'Terminal type per RDN 06-04 accepted products; terminal installed per SD 3544 and SD 3562 component details; all components correctly assembled and bolted; cable connection (if applicable) nuts tightened to minimum 50 Nm torque; runway area graded per SD 3571; no obstructions in runout area per SD 3545',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Torque measurement (cable nuts)',
      notes: 'SD 3544, SD 3545, SD 3562. Wire rope end treatment nuts tightened to minimum 50 Nm. Tension maintained throughout project completion. No twisting during installation.'
    },
    {
      description: 'Install leading terminal / energy-absorbing end treatment',
      acceptanceCriteria: 'Energy-absorbing terminal type per RDN 06-04; installed per manufacturer\'s details; all components correctly assembled; clear runout area per SD 3545',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Leading terminals face oncoming traffic and must be energy-absorbing or gating type.'
    },

    // =========================================================================
    // DELINEATION
    // =========================================================================
    {
      description: 'Install delineators/reflectors on guard fence',
      acceptanceCriteria: '100cm2 minimum of Class 1A retroreflective material per AS/NZS 1906.2; spacing at 15m intervals; colour: red on left side, white on right side (two-way road), yellow on right side (one-way road); no delineators installed beyond 4m offset from traffic lane; delineators securely attached and visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 708. Delineator configuration and spacing as specified.'
    },

    // =========================================================================
    // FINAL INSPECTION
    // =========================================================================
    {
      description: 'Verify completed guard fence tolerances',
      acceptanceCriteria: 'Plan position: +/-20mm; vertical profile line: +/-10mm; horizontal alignment: +/-20mm; post vertical deviation: +/-15mm; post-to-block orientation: +0mm / -15mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey measurement',
      notes: 'Cl 708. Final dimensional check.'
    },
    {
      description: 'Inspect completed guard fence -- visual and functional check',
      acceptanceCriteria: 'All components installed and complete; no damaged or missing components; galvanising intact (any damage repaired by regalvanising or two coats zinc-rich paint plus one coat aluminium paint); rail continuous with correct overlaps; bolts tight; terminals complete; delineators installed; grassed areas (if applicable) achieving 90% coverage within 3 months',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 708. Damaged galvanising must be repaired. Contractor maintains grassed areas during defects liability period.'
    },
    {
      description: 'Submit manufacturer\'s installation checklists and compliance audit',
      acceptanceCriteria: 'Completed installation checklists signed by installer; compliance audit by licensed supplier where required; all defects rectified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Compliance audit',
      notes: 'Cl 708. Required before Practical Completion.'
    }
  ]
}

// =============================================================================
// TEMPLATE 19: CONCRETE BARRIER (VicRoads Sec 610/BTN001)
// Based on: VicRoads SD 3901-3906, Section 610/703, BTN 001 v2.2, Detail Sheet F-Shape
// =============================================================================

const vicConcreteBarrierTemplate = {
  name: 'Concrete Barrier (F-Shape / New Jersey)',
  description: 'VicRoads concrete barrier construction including precast, cast-in-place, and slipform methods. Covers foundation preparation, reinforcement, formwork, concrete placement, curing, precast segment placement, joints and connections, delineation, and final inspection per SD 3901-3906, Sections 610/703, and BTN 001 (Traffic Barriers for Structures).',
  activityType: 'road_furniture',
  specificationReference: 'Sec 610/BTN001',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for concrete barrier works',
      acceptanceCriteria: 'All current revision drawings, SD 3901-3906, BTN 001, Detail Sheet for F-Shape Barrier, and Sections 610/703 reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'SD 3901 specifies F-Shape barrier profile; SD 3902 covers installation. Barrier must meet MASH TL-3, TL-4, or TL-5 as specified.'
    },
    {
      description: 'Verify barrier product is on DTP Accepted Safety Barrier Products list (RDN 06-04)',
      acceptanceCriteria: 'Barrier system (including connections) listed on current VicRoads/DTP RDN 06-04; test level matches design requirement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RDN 06-04 / Detail Sheet. Only accepted barrier systems may be used.'
    },
    {
      description: 'Submit concrete mix design for barrier construction',
      acceptanceCriteria: 'Mix design compliant with Section 610 or 703 as applicable; strength grade typically N32 or N40; mix registered per RC 500.02; exposure class and cover per design',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379; RC 500.02',
      notes: 'Cl 610 / 703. Structural concrete for barriers typically requires higher strength grade. Superintendent approval required.'
    },

    // =========================================================================
    // FOUNDATION
    // =========================================================================
    {
      description: 'Inspect foundation preparation -- subgrade, base, or structure',
      acceptanceCriteria: 'Foundation prepared to correct level, compacted, and free of loose material; for cast-in-place barriers on bridges, foundation interface cleaned and keyed/roughened; for ground-level barriers, foundation base per SD 3902',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3902. Foundation type depends on application -- bridge deck, road shoulder, median. Terminal anchor footing minimum 3m long x 0.25m deep reinforced concrete (unless otherwise restrained).'
    },
    {
      description: 'Inspect terminal anchor footing construction',
      acceptanceCriteria: 'Anchor footing excavated to correct dimensions (minimum 3m long x 0.25m deep per Detail Sheet); reinforcement placed per design; N32 concrete or as specified; formed to correct profile',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Detail Sheet. Terminal anchor required unless barrier is otherwise restrained.'
    },

    // =========================================================================
    // FORMWORK AND REINFORCEMENT (CAST-IN-PLACE)
    // =========================================================================
    {
      description: 'Inspect formwork for cast-in-place barrier -- profile, alignment, and rigidity',
      acceptanceCriteria: 'Formwork matches F-Shape profile per SD 3901; forms set to correct alignment and level; forms rigid, clean, and oiled; joints sealed against mortar loss; chamfers installed where specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3901. F-Shape profile dimensions must be exact for barrier performance.'
    },
    {
      description: 'Inspect reinforcing steel placement',
      acceptanceCriteria: 'Reinforcement per design drawings; bar sizes, spacing, and configuration correct; minimum cover achieved (typically 40-50mm per exposure class); bars tied at intersections; bar chairs stable; splice lengths per AS/NZS 4671; reinforcement clean and free from contaminants',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 611 / design drawings. Superintendent must inspect reinforcement before concrete placement.'
    },
    {
      description: 'Verify embedment of anchor bolts, dowels, and connection hardware (if applicable)',
      acceptanceCriteria: 'Anchor bolts / dowels positioned per design; embedment depth correct; bolts plumb and aligned; templates secured against movement during concrete placement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3902, SD 3904. Connection hardware for pin-and-loop or other connection systems must be correctly cast in.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT AND CURING (CAST-IN-PLACE)
    // =========================================================================
    {
      description: 'Place, compact, and finish concrete barrier',
      acceptanceCriteria: 'Concrete placed in layers not exceeding 600mm; vibrated to full compaction without segregation; top surface finished smooth; F-Shape profile maintained; no honeycombing, cold joints, or surface defects',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 610 / 703. Continuous placement preferred within each barrier segment.'
    },
    {
      description: 'Conduct concrete conformance sampling',
      acceptanceCriteria: 'Samples taken per Section 703 (minimum 1 per 50m3/day); slump tested per AS 1012.3.1; strength cylinders cast per AS 1012.1 and tested at 7 and 28 days; results meet specified strength grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 series',
      notes: 'Cl 703.11. Record all batch tickets and test results.'
    },
    {
      description: 'Cure concrete barrier for minimum period',
      acceptanceCriteria: 'Curing commenced immediately after finishing; minimum 7 days curing per Section 703.10; curing compound or wet curing method applied; membrane protected from damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 703.10. Acceptable methods: water, wet hessian, polyethylene sheeting, approved curing compound.'
    },

    // =========================================================================
    // PRECAST BARRIER PLACEMENT
    // =========================================================================
    {
      description: 'Inspect precast barrier segments before placement',
      acceptanceCriteria: 'Precast segments manufactured per SD 3903; F-Shape profile per SD 3901; no cracks, chips, or honeycombing; all connection hardware (pin-and-loop or other) undamaged and correctly positioned; lifting inserts intact',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3903. Precast barriers must be inspected before delivery to site.'
    },
    {
      description: 'Place precast barrier segments to correct alignment and level',
      acceptanceCriteria: 'Barrier segments placed on prepared foundation; segments aligned with adjacent segments; connections made per SD 3904 (pin-and-loop or as specified); no gaps between segments exceeding tolerance; barrier line smooth without kinks',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Survey',
      notes: 'SD 3902, SD 3904. Adequate anchorage required per test level and site conditions.'
    },

    // =========================================================================
    // SLIPFORM BARRIER
    // =========================================================================
    {
      description: 'Inspect slipform barrier paving operation and profile',
      acceptanceCriteria: 'Slipform paver producing correct F-Shape profile per SD 3901; barrier cross-section consistent; alignment per design; concrete fully compacted; surface finish acceptable; no slumping or distortion',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Profile template check',
      notes: 'SD 3906. Slipform construction per SD 3906 -- Installation and Construction details.'
    },

    // =========================================================================
    // JOINTS AND CONNECTIONS
    // =========================================================================
    {
      description: 'Inspect barrier joints and connections',
      acceptanceCriteria: 'Construction joints and expansion joints at correct locations; joint sealant applied per specification; pin-and-loop connections per SD 3904 correctly installed; dowels (if any) aligned and grouted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3904. Joint details depend on barrier type (cast-in-place, precast, or slipform).'
    },

    // =========================================================================
    // DELINEATION AND FINISHING
    // =========================================================================
    {
      description: 'Install delineators on concrete barrier',
      acceptanceCriteria: 'Delineators installed per SD 3905; correct colour configuration; spacing as specified; retroreflective material Class 1A per AS/NZS 1906.2; securely fixed; visible to approaching traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3905. Delineation is critical for night-time visibility.'
    },
    {
      description: 'Final inspection of completed concrete barrier',
      acceptanceCriteria: 'Barrier profile correct per SD 3901; alignment smooth and continuous; all joints sealed; connections secure; delineators installed; foundation adequate; no structural defects; barrier adequately anchored per test level',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3901-3906. Barrier must be adequately anchored based on test level and site conditions per Detail Sheet.'
    }
  ]
}

// =============================================================================
// TEMPLATE 20: PAVEMENT MARKING (VicRoads Sec 721/722)
// Based on: VicRoads Section 721/722/710, RC 424.01, AS 4049, AS/NZS 2009, AS 1742.2
// =============================================================================

const vicPavementMarkingTemplate = {
  name: 'Pavement Marking',
  description: 'VicRoads pavement marking including thermoplastic, waterborne paint, and cold-applied markings, glass bead application, raised pavement markers (RPMs), retroreflectivity testing, and geometric compliance per Sections 721, 722, and 710. Test Method RC 424.01 for retroreflectivity measurement.',
  activityType: 'road_furniture',
  specificationReference: 'Sec 721/722',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for pavement marking works',
      acceptanceCriteria: 'All current revision drawings, Sections 721, 722, 710, and VicRoads Linemarking Guide reviewed and available on site; marking plan showing line types, colours, widths, and RPM locations confirmed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 721.01. Confirm marking materials (thermoplastic, waterborne paint, cold-applied plastic) and line types (longitudinal, transverse, symbols).'
    },
    {
      description: 'Submit material compliance certificates for marking materials and glass beads',
      acceptanceCriteria: 'Marking materials compliant with AS 4049.1 (solvent-borne paint), AS 4049.2 (thermoplastic), or AS 4049.3 (waterborne paint) as applicable; glass beads compliant with AS/NZS 2009; APAS certification (AP-S0041 series) current; certificates submitted before work commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4049 series; AS/NZS 2009',
      notes: 'Cl 721. Materials must have current certification. Superintendent acceptance required before application.'
    },
    {
      description: 'Verify contractor\'s equipment -- marking machine, bead dispenser, and pre-heater (thermoplastic)',
      acceptanceCriteria: 'Marking machine calibrated for correct application rate and line width; bead dispenser calibrated for correct drop-on rate; thermoplastic pre-heater operational (material temperature per manufacturer requirements, typically 180-220C); equipment clean and functional',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 721. Equipment calibration records to be available on site.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Inspect pavement surface condition before marking',
      acceptanceCriteria: 'Surface clean, dry, and free from dust, dirt, oil, grease, loose material, and curing compound residue; surface temperature above dew point; existing markings removed if required (per TN 112 -- Removal of Pavement Markings); surface defects (potholes, cracks) repaired before marking',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 721 / TN 112. Surface preparation is critical for marking adhesion. Wet surfaces will cause adhesion failure.'
    },
    {
      description: 'Remove existing pavement markings (where specified)',
      acceptanceCriteria: 'Existing markings removed by approved method (grinding, water blasting, or chemical removal per TN 112); no damage to pavement surface; no ghosting (residual marking visible); surface cleaned after removal',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'TN 112 -- Technical Note for Removal of Pavement Markings. Method must not damage the road surface.'
    },

    // =========================================================================
    // MARKING APPLICATION -- THERMOPLASTIC
    // =========================================================================
    {
      description: 'Apply thermoplastic marking to specified dimensions, colour, and pattern',
      acceptanceCriteria: 'Line width, length, gap spacing per design/AS 1742.2; colour (white or yellow) per specification; material applied at correct temperature (per manufacturer, typically 180-220C); uniform thickness across line width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 721. Thermoplastic material complying with AS 4049.2.'
    },
    {
      description: 'Verify thermoplastic film thickness',
      acceptanceCriteria: 'Spray-applied thermoplastic: 1.0-2.0mm wet film thickness (WFT) +/- manufacturer tolerance; extruded/preformed thermoplastic: 2.5mm +/- 0.5mm WFT; profiled markings per specific profile dimensions; measured by wet film gauge during application',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Wet film thickness gauge',
      notes: 'Cl 721. Thickness measurement during application at regular intervals.'
    },
    {
      description: 'Verify glass bead application rate on thermoplastic markings',
      acceptanceCriteria: 'Drop-on glass beads applied at minimum 400 g/m2 for spray-applied or minimum 300 g/m2 for preformed; beads Type B-HR or D-HR per AS/NZS 2009; beads embedded to approximately 60% diameter; uniform distribution across line width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Bead rate check (collection tray method)',
      notes: 'Cl 721. Bead drop-on rate critical for retroreflectivity. Glass beads must have adhesion coating for retention.'
    },

    // =========================================================================
    // MARKING APPLICATION -- WATERBORNE PAINT
    // =========================================================================
    {
      description: 'Apply waterborne paint marking to specified dimensions, colour, and pattern',
      acceptanceCriteria: 'Line dimensions per design/AS 1742.2; colour per specification; paint compliant with AS 4049.3; applied at correct wet film thickness (typically 0.4-0.6mm WFT)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 721. Waterborne paint for temporary or low-traffic applications, or as re-marking material.'
    },
    {
      description: 'Verify glass bead application rate on paint markings',
      acceptanceCriteria: 'Drop-on glass beads applied at specified rate per AS/NZS 2009 (Type B or D); beads applied immediately while paint is wet; uniform distribution',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Bead rate check',
      notes: 'Cl 721. Beads must be applied while paint is still wet for proper embedment.'
    },

    // =========================================================================
    // RAISED PAVEMENT MARKERS (RPMs)
    // =========================================================================
    {
      description: 'Inspect pavement surface preparation at RPM locations',
      acceptanceCriteria: 'Surface clean and dry at each RPM location; surface ground/abraded if required for adhesion; adhesive type per specification (typically two-part epoxy or bituminous adhesive)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 710. Surface preparation critical for RPM adhesion and longevity.'
    },
    {
      description: 'Install raised pavement markers to correct alignment, spacing, and type',
      acceptanceCriteria: 'RPM type per design (unidirectional, bidirectional, or non-reflective); colour per specification (white, yellow, or red); spacing per design/AS 1742.2; RPMs aligned within +/-25mm of design line; RPMs level and firmly bonded; adhesive fully cured before opening to traffic',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 710. RPM alignment and spacing critical for lane guidance especially at night and in wet conditions.'
    },
    {
      description: 'Conduct adhesion check on installed RPMs (pull-off test or hammer test)',
      acceptanceCriteria: 'RPMs firmly bonded to pavement surface; adhesion test passed (if required by specification -- typically visual/manual check or pull-off test); no rocking, spinning, or lifting of RPMs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Adhesion test',
      notes: 'Cl 710. Deficient adhesion requires removal and re-installation.'
    },

    // =========================================================================
    // RETROREFLECTIVITY TESTING
    // =========================================================================
    {
      description: 'Conduct retroreflectivity testing of completed pavement markings',
      acceptanceCriteria: 'Retroreflectivity measured per RC 424.01 using Mirolux 30 reflectometer (or equivalent); white markings: minimum 150 mcd/m2/lux (typical intervention level); initial application on new markings may require higher minimum (350 mcd/m2/lux for new thermoplastic); yellow markings: minimum values per specification; mean of 4 readings per 2-5m section',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 424.01 (Retroreflectivity of Pavement Markings)',
      notes: 'RC 424.01. Retroreflected luminance measured in mcd/m2/lux. Mean retroreflectivity (MR) = mean of 4 individual readings at evenly spaced positions over 2-5m length or within 1m2. Australian standard intervention level is 150 mcd/m2/lux; initial acceptance values are typically higher.'
    },
    {
      description: 'Conduct retroreflectivity testing of raised pavement markers',
      acceptanceCriteria: 'RPM retroreflectivity per AS/NZS 1906.2 or product certification; retroreflective lens clean, undamaged, and visible; colour correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Visual / Product certification',
      notes: 'Cl 710. RPM retroreflectivity verified by product certification and visual check.'
    },

    // =========================================================================
    // FINAL INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed marking layout against design drawings',
      acceptanceCriteria: 'All line markings, symbols, arrows, and text installed per design; line widths correct (typically 80mm, 100mm, or 150mm per line type); gap and dash lengths per AS 1742.2; no overspray or irregular edges; marking colours correct',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 721. As-built marking layout to be verified against design.'
    },
    {
      description: 'Inspect marking adhesion (tape pull test or visual check)',
      acceptanceCriteria: 'Markings firmly bonded to pavement surface; no peeling, flaking, or lifting; tape pull test (if required) shows adequate adhesion; markings intact under traffic',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Tape pull test',
      notes: 'Cl 721. Adhesion failures require re-application.'
    },
    {
      description: 'Verify all RPMs installed, aligned, and correctly coloured',
      acceptanceCriteria: 'All RPMs per marking plan installed; alignment within +/-25mm; spacing correct; colours correct; all RPMs firmly bonded; no missing or damaged RPMs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 710. Final check of RPM installation.'
    },
    {
      description: 'Submit marking records and test results',
      acceptanceCriteria: 'Records include: material batch numbers, application dates, ambient conditions, equipment calibration records, retroreflectivity test results, bead application rates, and as-applied layout',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cl 721. Complete marking records for handover.'
    }
  ]
}

// =============================================================================
// TEMPLATE 22: FENCING INCL. NOISE WALLS (VicRoads Sec 707/765)
// Based on: VicRoads Section 707/765, BTN 007, SD 3101-3161, AS 1725, AS 2082, AS 5100.3
// =============================================================================

const vicFencingTemplate = {
  name: 'Fencing incl. Noise Walls',
  description: 'VicRoads fencing installation covering boundary fencing (post and wire, chain wire mesh), gates, and noise attenuation walls per Section 707 (Fencing), Section 765 (Noise Attenuation Walls), and BTN 007. Fence types include Type A (post and wire), Type B (sheep fence), Type H (wire mesh), Type K (chain wire mesh). Standard Drawings SD 3101-3161.',
  activityType: 'road_furniture',
  specificationReference: 'Sec 707/765',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / PLANNING
    // =========================================================================
    {
      description: 'Review approved drawings, specification, and project ITP for fencing and noise wall works',
      acceptanceCriteria: 'All current revision drawings, Sections 707 and/or 765, BTN 007 (if noise walls), and relevant Standard Drawings (SD 3101-3161) reviewed and available on site',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 707 covers supply and quality of materials, preparation, removal of existing fencing, supply and installation of all fencing materials including gates and connections.'
    },
    {
      description: 'Submit material certificates for fencing components',
      acceptanceCriteria: 'Timber posts: hardwood per AS 2082 (untreated) or treated per specification; steel posts and fittings: galvanized per AS/NZS 4680; wire: galvanized per relevant standard; chain wire mesh per AS 1725; certificates for all materials submitted before use',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2082; AS 1725; AS/NZS 4680',
      notes: 'Cl 707. Materials of correct dimensions, manufacture, quality, and structural grade per specification.'
    },
    {
      description: 'Submit design documentation for noise walls (if applicable)',
      acceptanceCriteria: 'Noise wall design per BTN 007 and Section 765; design calculations for wind loading (AS 5100.3), earthquake resistance, and thermal expansion; acoustic performance documentation; design life compliance (posts and structural components: 50 years minimum; panels and fixings: 30 years minimum; anchorages on bridges: 100 years)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 5100.3; BTN 007',
      notes: 'Cl 765 / BTN 007. Noise walls must meet structural and acoustic requirements. Sound transmission loss at least 10 dB below diffracted sound level at top of barrier.'
    },

    // =========================================================================
    // FENCING -- POST INSTALLATION
    // =========================================================================
    {
      description: 'Set out fence line and mark post locations',
      acceptanceCriteria: 'Fence line set out per design drawings; post locations marked at correct spacing; corner, end, and gate post locations identified; alignment verified; any conflicts with underground services resolved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707. All posts shall be set in line so that the tops line up uniformly without sudden dips or irregularities.'
    },
    {
      description: 'Install fence posts to correct depth, alignment, and plumb',
      acceptanceCriteria: 'Posts installed to depth shown on drawings; posts plumb and aligned; timber posts driven or set in prepared holes; steel posts installed per standard drawings; end, corner, and gate posts braced as shown on drawings; line posts braced at maximum 120m intervals',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707. Bracing required for end, corner, and gate posts.'
    },
    {
      description: 'Install concrete footings for fence posts (where specified)',
      acceptanceCriteria: 'Concrete footings to dimensions shown on drawings; concrete minimum 20 MPa strength; top of concrete crowned to shed water; footing surrounding post fully; concrete cured before wire tensioning',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707. Minimum 20 MPa concrete for fence post footings.'
    },

    // =========================================================================
    // FENCING -- WIRE AND MESH INSTALLATION
    // =========================================================================
    {
      description: 'Install wire strands and tension wires (post and wire fences)',
      acceptanceCriteria: 'Wire strands installed per SD 3101/3111; wires strained using approved friction-type wire strainer with non-scarring grip and calibrating springs; tension as specified on drawings or per manufacturer\'s recommended maximum; wires evenly spaced and taut; no kinks or damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Tension gauge',
      notes: 'Cl 707. Strainer must incorporate tension gauge with calibrating springs for measurement.'
    },
    {
      description: 'Install chain wire mesh (Type K or similar)',
      acceptanceCriteria: 'Chain wire mesh per AS 1725; mesh tightened and secured to posts and line wires; mesh fastened to line posts and line wires with 2.5mm diameter galvanized tie wire or clips at maximum 400mm intervals on posts and 500mm intervals on wires; fastened to end, corner, and gate posts by lacing through each outer mesh with 2.5mm galvanized tie wire',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707 / SD 3131. Chain wire installed on specified side of fence per drawings.'
    },
    {
      description: 'Install barbed wire topping (where specified)',
      acceptanceCriteria: 'Barbed wire installed on extension arms at top of fence; correct number of strands per specification; wire strained and secured; no sagging',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'SD 3131. Barbed wire topping for security fencing.'
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
      notes: 'Cl 707. Gates hung with galvanized hinges, able to swing freely. Gate posts must be sturdy enough to support gate weight.'
    },

    // =========================================================================
    // NOISE WALL -- POST INSTALLATION
    // =========================================================================
    {
      description: 'Install noise wall posts and foundations',
      acceptanceCriteria: 'Post foundations per design (typically bored piers or cast-in foundations); foundation depth and diameter per geotechnical design; concrete grade per Section 610/703; posts installed plumb and to correct spacing; post type (steel or concrete) per design; anchorage per AS 5100.3',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 765 / BTN 007. Foundation design must comply with AS 5100.3 and BTN 023 standards.'
    },
    {
      description: 'Inspect noise wall post alignment before panel installation',
      acceptanceCriteria: 'Posts vertical within tolerance; spacing correct for panel dimensions; posts at correct height; all post foundations cured and stable; posts aligned in plan and elevation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Survey',
      notes: 'Cl 765. Post alignment critical for panel fit.'
    },

    // =========================================================================
    // NOISE WALL -- PANEL INSTALLATION
    // =========================================================================
    {
      description: 'Install noise wall panels',
      acceptanceCriteria: 'Panels installed per design drawings; panel type (concrete, timber, composite, or transparent) per specification; panels seated correctly in post channels; all fixings and fasteners installed and tightened; no gaps between panels exceeding specification; transparent panels angled outwards by minimum 7 degrees (to reduce headlight reflection and facilitate cleaning); panels undamaged during handling and installation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 765 / BTN 007. Transparent/translucent panels near roads must be angled outward minimum 7 degrees.'
    },
    {
      description: 'Verify noise wall acoustic performance (if testing required)',
      acceptanceCriteria: 'Noise wall meets minimum area density per Section 765; sound transmission loss at least 10 dB below diffracted sound level at top of barrier; acoustic testing (if required) confirms compliance with design performance specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Acoustic measurement',
      notes: 'Cl 765. Acoustic compliance may be by design certification or field testing.'
    },

    // =========================================================================
    // FINISHING AND FINAL INSPECTION
    // =========================================================================
    {
      description: 'Inspect completed fencing -- alignment, tension, condition',
      acceptanceCriteria: 'Fence line straight and aligned; no dips or irregularities in top line; all wires/mesh taut; posts plumb; bracing secure; concrete footings crowned; galvanising intact; no damaged components; fence height per design',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707. Visual inspection of completed fence.'
    },
    {
      description: 'Inspect completed noise wall -- structural and visual',
      acceptanceCriteria: 'All panels installed and secure; no cracks, chips, or damage; fixings complete; post alignment correct; no gaps between panels; wall height per design; delineators installed (if required); drainage provisions functional',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 765. Panels must resist scratching, UV weathering, and discolouration. Timber generally not recommended for durability.'
    },
    {
      description: 'Inspect connections to existing fencing',
      acceptanceCriteria: 'New fence connected to existing fence per specification; join secure and neat; no gaps or weak points; existing fence undamaged during connection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cl 707. Connections at interfaces with existing fencing.'
    },
    {
      description: 'Submit as-built records and material certificates',
      acceptanceCriteria: 'As-built survey of fence/wall alignment; material certificates; noise wall design certification; construction records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Final handover documentation.'
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Road Furniture')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicWireRopeBarrierTemplate)
    await seedTemplate(vicWBeamGuardFenceTemplate)
    await seedTemplate(vicConcreteBarrierTemplate)
    await seedTemplate(vicPavementMarkingTemplate)
    await seedTemplate(vicFencingTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (5 road furniture templates)')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Templates created:')
    console.log('  17. Wire Rope Safety Barrier (Sec 711) - 17 items')
    console.log('  18. W-Beam Guard Fence (Sec 708) - 14 items')
    console.log('  19. Concrete Barrier (Sec 610/BTN001) - 17 items')
    console.log('  20. Pavement Marking (Sec 721/722) - 19 items')
    console.log('  22. Fencing incl. Noise Walls (Sec 707/765) - 18 items')
    console.log('')
    console.log('To use these templates:')
    console.log('1. Create a project with specificationSet = "VicRoads (VIC)"')
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
