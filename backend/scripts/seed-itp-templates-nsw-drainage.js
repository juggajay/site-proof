/**
 * Seed Script: NSW (TfNSW) Drainage ITP Templates
 *
 * Creates global ITP templates for NSW drainage construction:
 * - Pipe Installation (RCP, PVC, HDPE)
 * - Pit & Chamber Construction
 * - Box Culverts
 * - Subsoil Drainage
 *
 * Run with: node scripts/seed-itp-templates-nsw-drainage.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// NSW PIPE INSTALLATION (TfNSW R11)
// =============================================================================

const nswPipeInstallationTemplate = {
  name: 'Pipe Installation (Stormwater/Drainage)',
  description: 'TfNSW drainage pipe installation including RCP, RCBC, PVC, and HDPE pipes per R11 and related specifications',
  activityType: 'drainage',
  specificationReference: 'TfNSW R11',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit pipe material certifications and compliance',
      acceptanceCriteria: 'Pipes certified to AS 4058 (RCP) / AS 4139 (PVC) / AS 4130 (HDPE)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Manufacturer certificates, load class verification'
    },
    {
      description: 'Submit bedding and backfill material details',
      acceptanceCriteria: 'Materials meet specification requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Sand, crusite, or approved granular material'
    },
    {
      description: 'Submit installation methodology',
      acceptanceCriteria: 'Method addresses trench support, dewatering, bedding, jointing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include safety/shoring plan if depth >1.5m'
    },
    {
      description: 'Verify survey setout of pipe alignment',
      acceptanceCriteria: 'Alignment matches design, pits located correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check before excavation'
    },

    // =========================================================================
    // SERVICE LOCATION
    // =========================================================================
    {
      description: 'Locate and mark existing services (Dial Before You Dig)',
      acceptanceCriteria: 'All services located, potholed where required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'DBYD plans obtained, services marked on ground'
    },
    {
      description: 'Pothole to verify service locations at crossings',
      acceptanceCriteria: 'Services physically located and depth confirmed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before mechanical excavation near services'
    },

    // =========================================================================
    // TRENCH EXCAVATION
    // =========================================================================
    {
      description: 'Excavate trench to design depth and width',
      acceptanceCriteria: 'Trench dimensions per specification (width = OD + 300mm min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Adequate working room for compaction equipment'
    },
    {
      description: 'Install trench shoring/support (if depth >1.5m)',
      acceptanceCriteria: 'Shoring installed per SafeWork requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Safety critical - WHS compliance'
    },
    {
      description: 'Verify trench bottom stability and dewatering',
      acceptanceCriteria: 'Stable foundation, no standing water',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Dewater if groundwater present'
    },

    // =========================================================================
    // BEDDING
    // =========================================================================
    {
      description: 'Place and compact bedding material',
      acceptanceCriteria: 'Bedding type and depth per specification (typically 100mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Uniform thickness, shaped for pipe invert'
    },
    {
      description: 'Form bedding cradle for pipe',
      acceptanceCriteria: 'Cradle shaped to support pipe barrel',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'HS3 or HS4 support as specified'
    },
    {
      description: 'Check bedding level and grade',
      acceptanceCriteria: 'Grade matches design (typically 0.5-1.0% min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check of bedding levels'
    },

    // =========================================================================
    // PIPE INSTALLATION
    // =========================================================================
    {
      description: 'Inspect pipes before installation',
      acceptanceCriteria: 'No cracks, chips, damage, correct class',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject damaged pipes'
    },
    {
      description: 'Lay pipes to line and level',
      acceptanceCriteria: 'Pipes on correct alignment and grade',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - pipe laying'
    },
    {
      description: 'Install pipe joints (rubber ring, solvent weld, or fusion)',
      acceptanceCriteria: 'Joints correctly assembled, full engagement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Follow manufacturer instructions'
    },
    {
      description: 'Check pipe grade with laser or dumpy',
      acceptanceCriteria: 'Grade per design, no bellies or high points',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record invert levels at joints'
    },

    // =========================================================================
    // HAUNCH & SIDE SUPPORT
    // =========================================================================
    {
      description: 'Place and compact haunch material',
      acceptanceCriteria: 'Material placed under pipe haunches and compacted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'CRITICAL for pipe support - no voids under haunches'
    },
    {
      description: 'Place side fill to springline',
      acceptanceCriteria: 'Compacted layers to pipe springline',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Even placement both sides'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Place overlay zone backfill (300mm above crown)',
      acceptanceCriteria: 'Selected material, compacted in layers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No rocks or debris against pipe'
    },
    {
      description: 'Backfill trench to surface',
      acceptanceCriteria: 'Compacted in layers ≤200mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Material type per location (road vs verge)'
    },
    {
      description: 'Perform compaction testing on backfill',
      acceptanceCriteria: '≥95% Standard MDD (or per specification)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 / T166',
      notes: 'Test each lift in road pavement areas'
    },

    // =========================================================================
    // POST-INSTALLATION TESTING
    // =========================================================================
    {
      description: 'Perform CCTV inspection of installed pipeline',
      acceptanceCriteria: 'No defects, cracks, displaced joints, debris',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'CCTV inspection mandatory - provide video and report'
    },
    {
      description: 'Perform mandrel/deflection test (flexible pipes)',
      acceptanceCriteria: 'Deflection ≤5% of internal diameter',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For PVC/HDPE pipes - mandrel must pass freely'
    },
    {
      description: 'Perform water/pressure test (if specified)',
      acceptanceCriteria: 'No leakage above allowable limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Pressure or infiltration test if required'
    },

    // =========================================================================
    // AS-BUILT SURVEY
    // =========================================================================
    {
      description: 'Complete as-built survey',
      acceptanceCriteria: 'Invert levels, alignment, pit locations recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required for asset handover'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'Pipe certs, CCTV, tests, as-built complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Full lot documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All criteria met, CCTV acceptable',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW PIT & CHAMBER CONSTRUCTION
// =============================================================================

const nswPitConstructionTemplate = {
  name: 'Drainage Pit & Chamber Construction',
  description: 'TfNSW drainage pit and chamber construction including inlet pits, junction pits, and access chambers',
  activityType: 'drainage',
  specificationReference: 'TfNSW R11 / Standard Drawings',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK
    // =========================================================================
    {
      description: 'Submit pit/chamber details and material certifications',
      acceptanceCriteria: 'Precast or in-situ design approved, materials certified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Precast certs or in-situ concrete mix design'
    },
    {
      description: 'Verify survey setout of pit locations',
      acceptanceCriteria: 'Locations match design',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check'
    },

    // =========================================================================
    // EXCAVATION & FOUNDATION
    // =========================================================================
    {
      description: 'Excavate pit location to design depth',
      acceptanceCriteria: 'Adequate size for pit and working room',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Shore if required'
    },
    {
      description: 'Prepare foundation/base',
      acceptanceCriteria: 'Stable foundation, compacted base or blinding concrete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Level base for pit installation'
    },

    // =========================================================================
    // PIT INSTALLATION (PRECAST)
    // =========================================================================
    {
      description: 'Inspect precast units before installation',
      acceptanceCriteria: 'No cracks, damage, correct size/type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject damaged units'
    },
    {
      description: 'Install pit base/floor',
      acceptanceCriteria: 'Level, correct orientation for pipe connections',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Set to design invert level'
    },
    {
      description: 'Install pit walls/risers',
      acceptanceCriteria: 'Plumb, joints sealed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Mortar or rubber ring joints'
    },
    {
      description: 'Form/core pipe openings',
      acceptanceCriteria: 'Openings at correct level and size',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Core or form for pipe entry'
    },

    // =========================================================================
    // PIPE CONNECTIONS
    // =========================================================================
    {
      description: 'Connect pipes to pit',
      acceptanceCriteria: 'Pipes properly connected, flexible joints if required',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - pipe/pit connection'
    },
    {
      description: 'Seal pipe/pit joints',
      acceptanceCriteria: 'Watertight seal (mortar, flexible sealant)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No infiltration'
    },
    {
      description: 'Form benching/inverts',
      acceptanceCriteria: 'Smooth benching to direct flow, no ponding',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Concrete or preformed benching'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Backfill around pit in compacted layers',
      acceptanceCriteria: 'Compacted layers, no voids',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Even backfill all sides'
    },

    // =========================================================================
    // GRATE/LID INSTALLATION
    // =========================================================================
    {
      description: 'Set pit frame and grate/lid to level',
      acceptanceCriteria: 'Frame level with finished surface, grate seated correctly',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Correct class for traffic loading'
    },
    {
      description: 'Verify grate/lid load rating',
      acceptanceCriteria: 'Class D (road) or Class B (footpath) as required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check markings on grate'
    },

    // =========================================================================
    // INLET TREATMENT (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Install inlet grate/lintel',
      acceptanceCriteria: 'Kerb inlet formed correctly, grate installed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'For kerb inlet pits'
    },

    // =========================================================================
    // VERIFICATION
    // =========================================================================
    {
      description: 'Check pit levels (invert, lid)',
      acceptanceCriteria: 'Invert and lid levels match design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification'
    },
    {
      description: 'Inspect internal condition',
      acceptanceCriteria: 'Clean, no debris, benching correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Final internal inspection'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile pit conformance documentation',
      acceptanceCriteria: 'Certificates, photos, survey complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot records'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All criteria met',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW BOX CULVERT CONSTRUCTION
// =============================================================================

const nswBoxCulvertTemplate = {
  name: 'Box Culvert Construction',
  description: 'TfNSW box culvert construction including precast and in-situ reinforced concrete box culverts',
  activityType: 'drainage',
  specificationReference: 'TfNSW R11 / B80',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / DESIGN
    // =========================================================================
    {
      description: 'Submit shop drawings and design verification',
      acceptanceCriteria: 'Design certified, shop drawings approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Structural design certification required'
    },
    {
      description: 'Submit precast unit certifications (if precast)',
      acceptanceCriteria: 'Units certified to AS 1597, load class verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Manufacturer QA certificates'
    },
    {
      description: 'Submit concrete mix design (if in-situ)',
      acceptanceCriteria: 'Mix achieves strength and durability requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically N32-N40 with durability exposure class'
    },
    {
      description: 'Submit construction methodology',
      acceptanceCriteria: 'Method addresses excavation, dewatering, installation sequence',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Including traffic management if applicable'
    },

    // =========================================================================
    // EXCAVATION & FOUNDATION
    // =========================================================================
    {
      description: 'Excavate to design level',
      acceptanceCriteria: 'Excavation to design depth, suitable material exposed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check for unsuitable material'
    },
    {
      description: 'Verify foundation bearing capacity',
      acceptanceCriteria: 'Foundation meets design bearing capacity',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Geotechnical inspection if required'
    },
    {
      description: 'Place foundation/levelling pad',
      acceptanceCriteria: 'Concrete levelling pad or compacted crushed rock',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Level to design grade'
    },

    // =========================================================================
    // PRECAST INSTALLATION
    // =========================================================================
    {
      description: 'Inspect precast units on delivery',
      acceptanceCriteria: 'No cracks, chips, damage, correct type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject damaged units'
    },
    {
      description: 'Install culvert base/floor units',
      acceptanceCriteria: 'Units level, aligned, on correct grade',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - base installation'
    },
    {
      description: 'Install culvert wall and top units',
      acceptanceCriteria: 'Units correctly positioned, joints aligned',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Follow manufacturer sequence'
    },
    {
      description: 'Seal joints between units',
      acceptanceCriteria: 'Joints sealed watertight (mortar, sealant, gaskets)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per specification requirements'
    },

    // =========================================================================
    // IN-SITU CONSTRUCTION (ALTERNATIVE)
    // =========================================================================
    {
      description: 'Install reinforcement (base slab)',
      acceptanceCriteria: 'Steel size, spacing, cover per drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - reinforcement inspection'
    },
    {
      description: 'Pour base slab concrete',
      acceptanceCriteria: 'Concrete placed, vibrated, finished',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - base pour'
    },
    {
      description: 'Install wall formwork and reinforcement',
      acceptanceCriteria: 'Forms aligned, steel correct',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - wall steel inspection'
    },
    {
      description: 'Pour wall concrete',
      acceptanceCriteria: 'Concrete placed in lifts, vibrated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Monitor pour rate'
    },
    {
      description: 'Install top slab formwork and reinforcement',
      acceptanceCriteria: 'Forms supported, steel correct',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - top slab steel inspection'
    },
    {
      description: 'Pour top slab concrete',
      acceptanceCriteria: 'Concrete placed, vibrated, cured',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - top slab pour'
    },

    // =========================================================================
    // CONCRETE TESTING
    // =========================================================================
    {
      description: 'Collect concrete test specimens',
      acceptanceCriteria: 'Cylinders cast per frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 1 set per 50m³ or per pour'
    },
    {
      description: 'Submit 7-day strength results',
      acceptanceCriteria: 'Trending toward 28-day requirement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Early indication'
    },
    {
      description: 'Submit 28-day strength results',
      acceptanceCriteria: 'Compressive strength ≥ specified (N32-N40)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Hold point - final strength verification'
    },

    // =========================================================================
    // HEADWALLS & WINGWALLS
    // =========================================================================
    {
      description: 'Construct headwalls and wingwalls',
      acceptanceCriteria: 'Dimensions and reinforcement per drawings',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'At inlet and outlet'
    },
    {
      description: 'Install apron slab and erosion protection',
      acceptanceCriteria: 'Apron and scour protection per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Rock, concrete, or approved material'
    },

    // =========================================================================
    // WATERPROOFING & BACKFILL
    // =========================================================================
    {
      description: 'Apply waterproofing membrane (if specified)',
      acceptanceCriteria: 'Membrane applied to external surfaces',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before backfilling'
    },
    {
      description: 'Backfill around culvert in compacted layers',
      acceptanceCriteria: 'Compacted layers, equal fill both sides',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Avoid unequal loading'
    },
    {
      description: 'Perform compaction testing on backfill',
      acceptanceCriteria: '≥95% Standard MDD',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173',
      notes: 'Test each lift'
    },

    // =========================================================================
    // VERIFICATION
    // =========================================================================
    {
      description: 'Inspect internal condition of culvert',
      acceptanceCriteria: 'No cracks, damage, debris, joints sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Walk-through or CCTV inspection'
    },
    {
      description: 'Complete as-built survey',
      acceptanceCriteria: 'Dimensions, levels, alignment recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For asset records'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All certificates, tests, survey, photos complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Full documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All criteria met',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW SUBSOIL DRAINAGE
// =============================================================================

const nswSubsoilDrainageTemplate = {
  name: 'Subsoil Drainage',
  description: 'TfNSW subsoil drainage installation including slotted/perforated pipe, geotextile, and aggregate drain',
  activityType: 'drainage',
  specificationReference: 'TfNSW R11 / R44',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK
    // =========================================================================
    {
      description: 'Submit subsoil drain details and materials',
      acceptanceCriteria: 'Pipe type, geotextile, aggregate approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Material certifications'
    },
    {
      description: 'Verify survey setout of drain alignment',
      acceptanceCriteria: 'Alignment and outlet locations correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check'
    },

    // =========================================================================
    // EXCAVATION
    // =========================================================================
    {
      description: 'Excavate trench to design depth and width',
      acceptanceCriteria: 'Dimensions per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 300-450mm wide'
    },
    {
      description: 'Verify trench grade',
      acceptanceCriteria: 'Minimum grade achieved (typically 0.5%)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Grade to outlet'
    },

    // =========================================================================
    // INSTALLATION
    // =========================================================================
    {
      description: 'Install geotextile liner (if specified)',
      acceptanceCriteria: 'Geotextile lines trench with adequate overlap',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent fines migration'
    },
    {
      description: 'Place bedding aggregate',
      acceptanceCriteria: 'Clean drainage aggregate, correct depth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 50-100mm bed'
    },
    {
      description: 'Install subsoil drain pipe',
      acceptanceCriteria: 'Pipe on grade, slots/perforations down or as specified',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check slot orientation'
    },
    {
      description: 'Place drainage aggregate surround',
      acceptanceCriteria: 'Aggregate surrounds pipe to specified level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No fines contamination'
    },
    {
      description: 'Wrap and seal geotextile',
      acceptanceCriteria: 'Geotextile wrapped over aggregate with overlap',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Seal to prevent fines entry'
    },

    // =========================================================================
    // OUTLET
    // =========================================================================
    {
      description: 'Connect to outlet (pit or daylighted)',
      acceptanceCriteria: 'Positive drainage to outlet',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No trapped sections'
    },

    // =========================================================================
    // BACKFILL
    // =========================================================================
    {
      description: 'Backfill trench',
      acceptanceCriteria: 'Compacted in layers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Material per location'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'Material certs, photos, as-built',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot records'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All criteria met',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: templateData.name,
      stateSpec: templateData.stateSpec,
      projectId: null
    }
  })

  if (existing) {
    console.log(`⚠️  Template "${templateData.name}" already exists (ID: ${existing.id}) - Skipping`)
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

  const holdPoints = template.checklistItems.filter(i => i.pointType === 'hold_point')
  const witnessPoints = template.checklistItems.filter(i => i.pointType === 'witness')

  console.log(`✅ Created: ${template.name}`)
  console.log(`   ID: ${template.id}`)
  console.log(`   Spec: ${template.specificationReference}`)
  console.log(`   Items: ${template.checklistItems.length} (H:${holdPoints.length} W:${witnessPoints.length})`)
  console.log('')

  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' NSW (TfNSW) Drainage ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswPipeInstallationTemplate)
    await seedTemplate(nswPitConstructionTemplate)
    await seedTemplate(nswBoxCulvertTemplate)
    await seedTemplate(nswSubsoilDrainageTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
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
