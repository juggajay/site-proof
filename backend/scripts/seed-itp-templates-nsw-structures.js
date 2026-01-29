/**
 * Seed Script: NSW (TfNSW) Structures ITP Templates
 *
 * Creates global ITP templates for NSW structural construction:
 * - Piling (Bored, Driven, CFA)
 * - Structural Concrete
 * - Reinforcement
 *
 * Run with: node scripts/seed-itp-templates-nsw-structures.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// NSW PILING (TfNSW B51)
// =============================================================================

const nswPilingTemplate = {
  name: 'Piling (Bored/CFA/Driven)',
  description: 'TfNSW piling construction including bored piles, CFA piles, and driven piles per B51 and related specifications',
  activityType: 'structures',
  specificationReference: 'TfNSW B51',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / DESIGN
    // =========================================================================
    {
      description: 'Submit piling contractor qualifications and experience',
      acceptanceCriteria: 'Contractor qualified for pile type',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Pre-qualification required'
    },
    {
      description: 'Submit pile design and working drawings',
      acceptanceCriteria: 'Design certified, drawings approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Geotechnical design parameters'
    },
    {
      description: 'Submit piling methodology and equipment details',
      acceptanceCriteria: 'Method addresses all pile types and ground conditions',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include contingency for difficult ground'
    },
    {
      description: 'Submit concrete mix design for piles',
      acceptanceCriteria: 'Mix meets strength and workability requirements (typically S40-S50)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'High slump for tremie placement (typically 180-220mm)'
    },
    {
      description: 'Submit reinforcement cage details and fabrication drawings',
      acceptanceCriteria: 'Cage design matches structural drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include spacers, centralisers, splice details'
    },

    // =========================================================================
    // SITE PREPARATION
    // =========================================================================
    {
      description: 'Verify survey setout of pile locations',
      acceptanceCriteria: 'Pile positions within tolerance (typically ±75mm)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check before piling commences'
    },
    {
      description: 'Establish pile working platform',
      acceptanceCriteria: 'Platform stable, level, adequate for rig',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Bearing capacity for piling rig'
    },
    {
      description: 'Locate and protect existing services',
      acceptanceCriteria: 'Services identified and protected',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'DBYD, potholing as required'
    },

    // =========================================================================
    // TRIAL PILE (IF REQUIRED)
    // =========================================================================
    {
      description: 'Construct trial/test pile',
      acceptanceCriteria: 'Trial pile installed per methodology',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - validate methodology'
    },
    {
      description: 'Perform pile load test (if specified)',
      acceptanceCriteria: 'Load test confirms design capacity',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Static or dynamic load test'
    },

    // =========================================================================
    // BORED PILE CONSTRUCTION
    // =========================================================================
    {
      description: 'Set up piling rig at pile location',
      acceptanceCriteria: 'Rig positioned, vertical/raked as required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check verticality/rake'
    },
    {
      description: 'Install temporary casing (if required)',
      acceptanceCriteria: 'Casing through unstable ground',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'For bore stability'
    },
    {
      description: 'Bore to design depth',
      acceptanceCriteria: 'Design toe level reached, founding material confirmed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Witness point - confirm founding stratum'
    },
    {
      description: 'Verify founding conditions (rock socket if applicable)',
      acceptanceCriteria: 'Founding material matches geotechnical report',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Hold point - geotechnical verification may be required'
    },
    {
      description: 'Clean base of pile bore',
      acceptanceCriteria: 'Base clean, no debris or loose material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Airlift or cleanout bucket'
    },

    // =========================================================================
    // REINFORCEMENT INSTALLATION
    // =========================================================================
    {
      description: 'Inspect reinforcement cage before installation',
      acceptanceCriteria: 'Cage dimensions, steel, spacers correct',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - cage inspection'
    },
    {
      description: 'Install reinforcement cage',
      acceptanceCriteria: 'Cage lowered without damage, centralisers in place',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - cage installation'
    },
    {
      description: 'Check cage position and cover',
      acceptanceCriteria: 'Cage centred, correct cover all around',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Minimum cover per durability requirements'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Install tremie pipe',
      acceptanceCriteria: 'Tremie to base of pile, sealed joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'For wet pour - tremie method'
    },
    {
      description: 'Verify concrete supply (dockets, slump)',
      acceptanceCriteria: 'Correct mix, slump 180-220mm for tremie',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1',
      notes: 'Each load'
    },
    {
      description: 'Commence concrete pour',
      acceptanceCriteria: 'Tremie submerged, continuous pour',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of pour'
    },
    {
      description: 'Monitor concrete level and tremie embedment',
      acceptanceCriteria: 'Tremie always submerged (min 2-3m)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record levels throughout pour'
    },
    {
      description: 'Concrete to cut-off level',
      acceptanceCriteria: 'Concrete to design cut-off plus contingency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Allow for trimming contaminated concrete'
    },
    {
      description: 'Collect concrete test specimens',
      acceptanceCriteria: 'Cylinders cast per frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 1 set per pile or per 50m³'
    },

    // =========================================================================
    // POST-CONSTRUCTION
    // =========================================================================
    {
      description: 'Remove temporary casing (if used)',
      acceptanceCriteria: 'Casing withdrawn during/after pour',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Monitor concrete level during withdrawal'
    },
    {
      description: 'Record as-built pile details',
      acceptanceCriteria: 'Position, depth, concrete volume recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Pile log/record'
    },
    {
      description: 'Trim pile to cut-off level',
      acceptanceCriteria: 'Sound concrete at cut-off, steel exposed for connection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Remove contaminated/weak concrete'
    },

    // =========================================================================
    // PILE INTEGRITY TESTING
    // =========================================================================
    {
      description: 'Perform pile integrity test (PIT/sonic)',
      acceptanceCriteria: 'No major defects detected',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Hold point - PIT testing if specified'
    },
    {
      description: 'Cross-hole sonic logging (CSL) if specified',
      acceptanceCriteria: 'Results indicate sound concrete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'For critical piles or larger diameter'
    },

    // =========================================================================
    // STRENGTH VERIFICATION
    // =========================================================================
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
      acceptanceCriteria: 'Compressive strength ≥ specified (typically S40-S50)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Hold point - final strength'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile pile conformance documentation',
      acceptanceCriteria: 'Pile logs, tests, PIT results, as-built complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Full pile documentation'
    },
    {
      description: 'Lot/pile conformance review and sign-off',
      acceptanceCriteria: 'All criteria met, integrity confirmed',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final pile approval'
    }
  ]
}

// =============================================================================
// NSW STRUCTURAL CONCRETE (TfNSW B80)
// =============================================================================

const nswStructuralConcreteTemplate = {
  name: 'Structural Concrete',
  description: 'TfNSW structural concrete construction for bridges, retaining walls, and other structures per B80',
  activityType: 'structures',
  specificationReference: 'TfNSW B80',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN
    // =========================================================================
    {
      description: 'Submit concrete mix design',
      acceptanceCriteria: 'Mix achieves strength, durability, and workability requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA endorsed - strength class, exposure class, VPV'
    },
    {
      description: 'Submit concrete supplier approval',
      acceptanceCriteria: 'Supplier registered/approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Quality system certification'
    },
    {
      description: 'Submit pour methodology and sequence',
      acceptanceCriteria: 'Method addresses pour sequence, joints, curing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include thermal control for mass pours'
    },
    {
      description: 'Submit formwork design and drawings',
      acceptanceCriteria: 'Formwork design certified for loads',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Propping, striking times'
    },

    // =========================================================================
    // FORMWORK
    // =========================================================================
    {
      description: 'Inspect formwork before reinforcement',
      acceptanceCriteria: 'Forms clean, correct dimensions, release agent applied',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check alignment, joints sealed'
    },
    {
      description: 'Verify formwork alignment and dimensions',
      acceptanceCriteria: 'Dimensions within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey check'
    },
    {
      description: 'Check formwork support and bracing',
      acceptanceCriteria: 'Propping and bracing per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No movement during pour'
    },

    // =========================================================================
    // REINFORCEMENT
    // =========================================================================
    {
      description: 'Inspect reinforcement before pour',
      acceptanceCriteria: 'Bar size, spacing, laps, cover per drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'CRITICAL hold point - reinforcement inspection'
    },
    {
      description: 'Check reinforcement cover',
      acceptanceCriteria: 'Cover meets durability requirements (typically 40-50mm)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cover meter or spacer check'
    },
    {
      description: 'Verify lap lengths and splice locations',
      acceptanceCriteria: 'Laps per drawings, staggered as required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check against schedule'
    },
    {
      description: 'Check reinforcement cleanliness',
      acceptanceCriteria: 'Steel clean, no loose rust, oil, or contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clean before pour'
    },

    // =========================================================================
    // EMBEDMENTS & CAST-INS
    // =========================================================================
    {
      description: 'Check cast-in items (bolts, plates, ferrules)',
      acceptanceCriteria: 'Cast-ins correctly positioned and secured',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Holding down bolts, bearing plates'
    },
    {
      description: 'Install blockouts, sleeves, penetrations',
      acceptanceCriteria: 'Penetrations in correct locations, secured',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'For services, drainage'
    },

    // =========================================================================
    // PRE-POUR INSPECTION
    // =========================================================================
    {
      description: 'Final pre-pour inspection',
      acceptanceCriteria: 'All items checked, ready to pour',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Hold point - pre-pour sign-off'
    },

    // =========================================================================
    // CONCRETE SUPPLY
    // =========================================================================
    {
      description: 'Verify delivery dockets (mix ID, batch time)',
      acceptanceCriteria: 'Correct mix, delivery within time limit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each load'
    },
    {
      description: 'Perform slump test',
      acceptanceCriteria: 'Slump within specified range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1',
      notes: 'Each load initially, then per frequency'
    },
    {
      description: 'Check concrete temperature',
      acceptanceCriteria: 'Temperature within limits (typically 10-32°C)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Reject if outside limits'
    },
    {
      description: 'Cast strength test specimens',
      acceptanceCriteria: 'Cylinders cast per frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 1 set per 50m³'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Commence concrete pour',
      acceptanceCriteria: 'Placement per approved method',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of pour'
    },
    {
      description: 'Monitor pour - drop height, layer thickness',
      acceptanceCriteria: 'Drop height ≤1.5m, layers ≤500mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent segregation'
    },
    {
      description: 'Verify vibration - no honeycombing or segregation',
      acceptanceCriteria: 'Full consolidation, vibrator in contact with previous layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Systematic vibration pattern'
    },
    {
      description: 'Monitor cold joints',
      acceptanceCriteria: 'No cold joints - continuous pour or planned construction joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Time between layers'
    },

    // =========================================================================
    // FINISHING
    // =========================================================================
    {
      description: 'Finish exposed surfaces',
      acceptanceCriteria: 'Surface finish as specified (formed/trowel/broom)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Class of finish per drawings'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing immediately after finishing',
      acceptanceCriteria: 'Curing compound, wet curing, or membrane',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - curing application'
    },
    {
      description: 'Maintain curing for specified period',
      acceptanceCriteria: 'Minimum 7 days continuous curing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record curing method and duration'
    },

    // =========================================================================
    // THERMAL CONTROL (MASS CONCRETE)
    // =========================================================================
    {
      description: 'Monitor concrete temperature (mass pours)',
      acceptanceCriteria: 'Temperature differential ≤20-25°C (core to surface)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For pours >1m thick - prevent thermal cracking'
    },

    // =========================================================================
    // FORMWORK STRIPPING
    // =========================================================================
    {
      description: 'Strip formwork after minimum curing/strength',
      acceptanceCriteria: 'Minimum strength achieved before stripping',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Hold point - verify strength before stripping'
    },
    {
      description: 'Inspect concrete after stripping',
      acceptanceCriteria: 'No defects, honeycombing, cracks',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - inspect stripped surface'
    },

    // =========================================================================
    // DEFECT RECTIFICATION
    // =========================================================================
    {
      description: 'Identify and mark any defects',
      acceptanceCriteria: 'Defects documented and categorised',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Minor repairs vs structural defects'
    },
    {
      description: 'Submit repair methodology (if required)',
      acceptanceCriteria: 'Repair method approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For defects requiring repair'
    },

    // =========================================================================
    // STRENGTH VERIFICATION
    // =========================================================================
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
      acceptanceCriteria: 'Compressive strength ≥ specified (typically 32-50 MPa)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Hold point - final strength verification'
    },

    // =========================================================================
    // DURABILITY TESTING
    // =========================================================================
    {
      description: 'Submit VPV (Volume of Permeable Voids) results',
      acceptanceCriteria: 'VPV ≤13% (or per exposure class)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.21',
      notes: 'Hold point for durability-critical elements'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All pour records, tests, photos complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Full documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All criteria met, strength and durability verified',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW REINFORCEMENT PLACEMENT
// =============================================================================

const nswReinforcementTemplate = {
  name: 'Reinforcement Placement',
  description: 'TfNSW reinforcement steel placement for structural concrete including supply, fabrication, and installation',
  activityType: 'structures',
  specificationReference: 'TfNSW B80 / AS 3600',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit reinforcement supplier certification',
      acceptanceCriteria: 'Steel certified to AS/NZS 4671',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mill certificates required'
    },
    {
      description: 'Submit bar bending schedules',
      acceptanceCriteria: 'Schedules match structural drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cross-check with drawings'
    },
    {
      description: 'Submit fabrication drawings (if shop fabricated)',
      acceptanceCriteria: 'Fabrication details correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For prefabricated cages'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify steel delivery against schedule',
      acceptanceCriteria: 'Bar marks, sizes, quantities match schedule',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check delivery dockets'
    },
    {
      description: 'Inspect steel condition',
      acceptanceCriteria: 'No damage, excessive rust, contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject corroded or damaged bars'
    },
    {
      description: 'Verify steel storage',
      acceptanceCriteria: 'Steel stored off ground, protected, separated by mark',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent contamination and mix-up'
    },

    // =========================================================================
    // PLACEMENT - BOTTOM STEEL
    // =========================================================================
    {
      description: 'Install bottom steel spacers/chairs',
      acceptanceCriteria: 'Spacers at correct spacing, adequate capacity',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Concrete or plastic chairs'
    },
    {
      description: 'Place bottom reinforcement layer',
      acceptanceCriteria: 'Correct bars, spacing, orientation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check against drawings'
    },
    {
      description: 'Verify bottom cover',
      acceptanceCriteria: 'Cover meets specification (typically 40-75mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cover meter or spacer check'
    },

    // =========================================================================
    // PLACEMENT - VERTICAL/WALL STEEL
    // =========================================================================
    {
      description: 'Install vertical/starter bars',
      acceptanceCriteria: 'Correct size, spacing, embedment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Starter bars for walls/columns'
    },
    {
      description: 'Install wall/column ties and ligatures',
      acceptanceCriteria: 'Correct size, spacing, hooks',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check fitment spacing'
    },
    {
      description: 'Check side cover to formwork',
      acceptanceCriteria: 'Cover maintained with spacer wheels/blocks',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Ensure cover not compromised'
    },

    // =========================================================================
    // PLACEMENT - TOP STEEL
    // =========================================================================
    {
      description: 'Install top steel supports (bar chairs)',
      acceptanceCriteria: 'Chairs at correct spacing to support top mat',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Continuous chairs or individual'
    },
    {
      description: 'Place top reinforcement layer',
      acceptanceCriteria: 'Correct bars, spacing, lapped as required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check against drawings'
    },
    {
      description: 'Verify top cover',
      acceptanceCriteria: 'Cover meets specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical for durability'
    },

    // =========================================================================
    // LAPS AND SPLICES
    // =========================================================================
    {
      description: 'Check lap lengths',
      acceptanceCriteria: 'Laps per drawings and AS 3600 (typically 40-50 x bar dia)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Measure representative laps'
    },
    {
      description: 'Verify stagger of laps',
      acceptanceCriteria: 'Laps staggered as required (not all at same location)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per structural requirements'
    },
    {
      description: 'Check mechanical splices (if used)',
      acceptanceCriteria: 'Splices correctly installed per manufacturer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point for mechanical couplers'
    },

    // =========================================================================
    // SPECIAL REINFORCEMENT
    // =========================================================================
    {
      description: 'Install shear reinforcement (links, stirrups)',
      acceptanceCriteria: 'Correct size, spacing, hooks',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical for shear capacity'
    },
    {
      description: 'Install bursting/splitting reinforcement',
      acceptanceCriteria: 'As detailed at anchorage zones',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Post-tensioned elements'
    },

    // =========================================================================
    // TIE WIRE
    // =========================================================================
    {
      description: 'Tie all bar intersections',
      acceptanceCriteria: 'All intersections tied, steel secure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No movement during pour'
    },

    // =========================================================================
    // FINAL INSPECTION
    // =========================================================================
    {
      description: 'Clean reinforcement before pour',
      acceptanceCriteria: 'Steel clean - no loose rust, mud, oil, debris',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'High pressure wash if required'
    },
    {
      description: 'Final reinforcement inspection',
      acceptanceCriteria: 'All steel per drawings, cover correct, securely tied',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'CRITICAL hold point - final steel inspection'
    },
    {
      description: 'Sign off reinforcement for pour',
      acceptanceCriteria: 'Ready for concrete',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Release reinforcement for pour'
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
  console.log(' NSW (TfNSW) Structures ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswPilingTemplate)
    await seedTemplate(nswStructuralConcreteTemplate)
    await seedTemplate(nswReinforcementTemplate)

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
