/**
 * Seed Script: NSW (TfNSW) Pavement ITP Templates
 *
 * Creates global ITP templates for NSW pavement construction:
 * - Unbound Granular Pavement (R71 + 3051)
 * - Cement Treated Base / Heavily Bound (R73)
 * - Lean Mix Concrete Subbase (R82)
 * - Concrete Pavement Base (R83)
 *
 * Run with: node scripts/seed-itp-templates-nsw-pavements.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// NSW UNBOUND GRANULAR PAVEMENT (TfNSW R71 + 3051)
// =============================================================================

const nswUnboundPavementTemplate = {
  name: 'Unbound Granular Pavement',
  description: 'TfNSW unbound granular pavement base and subbase construction per R71 and material specification 3051',
  activityType: 'pavement_unbound',
  specificationReference: 'TfNSW R71 / 3051',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MATERIAL APPROVAL
    // =========================================================================
    {
      description: 'Submit material source details and quarry certification',
      acceptanceCriteria: 'Source approved, NATA certification valid',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required before any material delivery - 3051 compliance'
    },
    {
      description: 'Submit material compliance test results (grading, PI, LL, durability)',
      acceptanceCriteria: 'Grading within envelope, PI ≤6 (base) or ≤12 (subbase), LA ≤35',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T106 / T108 / T215',
      notes: '3051 material properties - verify against spec class'
    },
    {
      description: 'Submit pavement construction methodology and rolling pattern',
      acceptanceCriteria: 'Methodology approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include equipment, layer thickness, compaction sequence'
    },

    // =========================================================================
    // UNDERLYING LAYER VERIFICATION
    // =========================================================================
    {
      description: 'Verify underlying layer (subgrade/subbase) approved and signed off',
      acceptanceCriteria: 'Previous lot conformance certificate issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cannot place pavement until underlying layer approved'
    },
    {
      description: 'Check underlying surface for damage, contamination, moisture',
      acceptanceCriteria: 'Surface clean, no ruts/damage, moisture acceptable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Visual inspection before placement'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section (minimum 100m)',
      acceptanceCriteria: 'Trial demonstrates methodology achieves specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - validate rolling pattern and compaction'
    },
    {
      description: 'Submit trial section results and approved rolling pattern',
      acceptanceCriteria: 'Density, levels, and surface finish compliant',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 / T162',
      notes: 'Hold point release for main works'
    },

    // =========================================================================
    // MATERIAL DELIVERY & STOCKPILING
    // =========================================================================
    {
      description: 'Check delivery dockets match approved source',
      acceptanceCriteria: 'Source ID matches approved quarry',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each delivery - retain dockets for lot records'
    },
    {
      description: 'Verify stockpile segregation controls',
      acceptanceCriteria: 'Material classes separated, protected from contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent mixing of different material classes'
    },

    // =========================================================================
    // LAYER PLACEMENT
    // =========================================================================
    {
      description: 'Verify layer thickness (loose lift)',
      acceptanceCriteria: 'Loose thickness ≤200mm (or per approved method)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check before compaction - adjust if required'
    },
    {
      description: 'Check material for segregation during spreading',
      acceptanceCriteria: 'No visible segregation, homogeneous appearance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject segregated areas - remix or replace'
    },
    {
      description: 'Verify moisture conditioning before compaction',
      acceptanceCriteria: 'Moisture within OMC ±2%',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T120 / T180',
      notes: 'Add water or allow drying as needed'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Perform compaction per approved rolling pattern',
      acceptanceCriteria: 'Minimum passes achieved, uniform coverage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Record roller type, passes, and any variations'
    },
    {
      description: 'Perform field density testing',
      acceptanceCriteria: '≥100% Modified MDD (base) or ≥98% (subbase)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 (Nuclear) / T166',
      notes: 'Frequency: 1 per 500m² or 1 per lot minimum'
    },
    {
      description: 'Verify compaction uniformity across lot',
      acceptanceCriteria: 'No soft spots, consistent density results',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173',
      notes: 'Additional tests at suspect areas'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance ±10mm from design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey at 10-20m grid'
    },
    {
      description: 'Check layer thickness (cores or survey)',
      acceptanceCriteria: 'Minimum design thickness achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Core or level difference method'
    },
    {
      description: 'Verify crossfall and grade compliance',
      acceptanceCriteria: 'Per design requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification'
    },

    // =========================================================================
    // SURFACE FINISH (BASE COURSE)
    // =========================================================================
    {
      description: 'Check surface texture and tightness',
      acceptanceCriteria: 'Tight, dense surface - no loose material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Final pass with steel drum or pneumatic roller'
    },
    {
      description: 'Perform straightedge/profilometer check',
      acceptanceCriteria: 'Surface regularity within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check for bumps, depressions'
    },
    {
      description: 'Verify edge alignment and trimming',
      acceptanceCriteria: 'Clean edges, no overbreak',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Trim edges to line'
    },

    // =========================================================================
    // PROOF ROLLING
    // =========================================================================
    {
      description: 'Perform proof rolling of finished surface',
      acceptanceCriteria: 'No visible deflection or pumping',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'T198',
      notes: 'Witness point - loaded roller or water cart'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All test results, survey, photos, dockets complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval before subsequent layer'
    }
  ]
}

// =============================================================================
// NSW CEMENT TREATED BASE / HEAVILY BOUND (TfNSW R73)
// =============================================================================

const nswCementTreatedBaseTemplate = {
  name: 'Cement Treated Base (CTB)',
  description: 'TfNSW plant mixed heavily bound (cement treated) pavement construction per R73',
  activityType: 'pavement_bound',
  specificationReference: 'TfNSW R73',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN
    // =========================================================================
    {
      description: 'Submit mix design and laboratory trial results',
      acceptanceCriteria: 'Mix achieves target UCS (typically 2-4 MPa at 28 days)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA endorsed results - cement content, grading, strength'
    },
    {
      description: 'Submit material source approvals (aggregate, cement)',
      acceptanceCriteria: 'Sources approved, certifications valid',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Aggregate properties + cement type compliance'
    },
    {
      description: 'Submit construction methodology including working time management',
      acceptanceCriteria: 'Methodology addresses working time constraints',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 2-4 hours working time from mixing'
    },
    {
      description: 'Verify mixing plant calibration and cement batching',
      acceptanceCriteria: 'Plant calibrated, batch records accurate',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Plant inspection before production'
    },

    // =========================================================================
    // UNDERLYING LAYER VERIFICATION
    // =========================================================================
    {
      description: 'Verify underlying layer approved and signed off',
      acceptanceCriteria: 'Previous lot conformance certificate issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cannot place CTB until underlying layer approved'
    },
    {
      description: 'Check underlying surface condition',
      acceptanceCriteria: 'Clean, damp (not wet), no damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Lightly dampen if dry, remove standing water'
    },

    // =========================================================================
    // TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section',
      acceptanceCriteria: 'Trial demonstrates mix and method achieve specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - validate production and placement'
    },
    {
      description: 'Submit trial section results (density, thickness, strength specimens)',
      acceptanceCriteria: 'All parameters compliant',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Hold point release for main production'
    },

    // =========================================================================
    // PRODUCTION & DELIVERY
    // =========================================================================
    {
      description: 'Verify batch tickets (cement content, batch time)',
      acceptanceCriteria: 'Cement content per approved mix, time recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each load - critical for working time tracking'
    },
    {
      description: 'Check material temperature on delivery',
      acceptanceCriteria: 'Within acceptable range (not overheated)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'High temperature accelerates set'
    },
    {
      description: 'Monitor and record working time',
      acceptanceCriteria: 'Placement complete within working time (2-4 hrs)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'CRITICAL - reject material exceeding working time'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Verify spreading equipment and layer thickness',
      acceptanceCriteria: 'Paver/grader achieving uniform thickness',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 150-200mm compacted thickness per layer'
    },
    {
      description: 'Check for segregation during placement',
      acceptanceCriteria: 'No visible segregation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject segregated areas'
    },
    {
      description: 'Verify joint treatment (longitudinal and transverse)',
      acceptanceCriteria: 'Joints cut back, vertical face, properly bonded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical for structural integrity'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Perform compaction within working time',
      acceptanceCriteria: 'Compaction complete before initial set',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'CRITICAL - no compaction after set commences'
    },
    {
      description: 'Perform field density testing',
      acceptanceCriteria: '≥98% Modified MDD or per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 / T166',
      notes: 'Test before curing membrane applied'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound/membrane immediately after compaction',
      acceptanceCriteria: 'Uniform coverage at specified rate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - critical for strength development'
    },
    {
      description: 'Protect curing surface from traffic and damage',
      acceptanceCriteria: 'No traffic until curing period complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 7 days minimum curing'
    },

    // =========================================================================
    // STRENGTH VERIFICATION
    // =========================================================================
    {
      description: 'Collect strength test specimens (cylinders/cores)',
      acceptanceCriteria: 'Specimens collected per frequency requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Field-cured and lab-cured specimens'
    },
    {
      description: 'Submit 7-day strength results',
      acceptanceCriteria: 'Trending toward specification requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'UCS',
      notes: 'Early indication of compliance'
    },
    {
      description: 'Submit 28-day strength results',
      acceptanceCriteria: 'UCS ≥ specified value (typically 2-4 MPa)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'UCS',
      notes: 'Hold point - final strength verification'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance ±10mm from design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey grid'
    },
    {
      description: 'Verify layer thickness (cores)',
      acceptanceCriteria: 'Minimum design thickness achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Core measurement'
    },

    // =========================================================================
    // SHRINKAGE CRACK ASSESSMENT
    // =========================================================================
    {
      description: 'Inspect for shrinkage cracking after curing',
      acceptanceCriteria: 'Cracking within acceptable limits',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Document crack pattern and severity'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All test results, batch records, survey complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met including 28-day strength',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW LEAN MIX CONCRETE SUBBASE (TfNSW R82)
// =============================================================================

const nswLeanMixConcreteTemplate = {
  name: 'Lean Mix Concrete Subbase',
  description: 'TfNSW lean mix concrete subbase construction per R82',
  activityType: 'pavement_bound',
  specificationReference: 'TfNSW R82',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN
    // =========================================================================
    {
      description: 'Submit mix design and trial mix results',
      acceptanceCriteria: 'Mix achieves target strength (typically 5-15 MPa)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA endorsed - cement content, aggregate, w/c ratio'
    },
    {
      description: 'Submit concrete supplier registration/approval',
      acceptanceCriteria: 'Supplier approved for lean mix supply',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Pre-qualification required'
    },
    {
      description: 'Submit construction methodology',
      acceptanceCriteria: 'Method addresses placement, compaction, curing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include joint details and curing plan'
    },

    // =========================================================================
    // UNDERLYING LAYER
    // =========================================================================
    {
      description: 'Verify underlying layer approved',
      acceptanceCriteria: 'Previous lot conformance issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Foundation must be approved'
    },
    {
      description: 'Check subgrade/subbase surface condition',
      acceptanceCriteria: 'Clean, stable, at correct level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'No loose material, correct moisture'
    },

    // =========================================================================
    // FORMWORK / EDGE RESTRAINT
    // =========================================================================
    {
      description: 'Verify formwork alignment and level',
      acceptanceCriteria: 'Forms at correct line, level, and grade',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Survey check before pour'
    },
    {
      description: 'Check formwork rigidity and bracing',
      acceptanceCriteria: 'Forms stable, will not move during pour',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Prevent blowouts'
    },

    // =========================================================================
    // CONCRETE SUPPLY & TESTING
    // =========================================================================
    {
      description: 'Verify delivery dockets (mix ID, batch time, volume)',
      acceptanceCriteria: 'Correct mix, within delivery time limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each load'
    },
    {
      description: 'Perform slump test',
      acceptanceCriteria: 'Slump within specified range (typically 40-80mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1',
      notes: 'Each load or per frequency'
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
      description: 'Collect strength test specimens',
      acceptanceCriteria: 'Cylinders cast per frequency requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 1 set per 50m³ or per lot'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Commence concrete placement',
      acceptanceCriteria: 'Placement method per approved methodology',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of pour'
    },
    {
      description: 'Verify layer thickness during placement',
      acceptanceCriteria: 'Design thickness achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check with pins or depth gauge'
    },
    {
      description: 'Verify compaction/vibration',
      acceptanceCriteria: 'Full consolidation, no honeycombing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Vibrating screed or internal vibrators'
    },

    // =========================================================================
    // FINISHING
    // =========================================================================
    {
      description: 'Finish surface to required texture',
      acceptanceCriteria: 'Surface texture as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Float finish or broom as required'
    },
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance ±10mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey immediately after finishing'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound immediately after finishing',
      acceptanceCriteria: 'Uniform coverage at specified rate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before surface dries'
    },
    {
      description: 'Protect from traffic during curing',
      acceptanceCriteria: 'No traffic for minimum 7 days (or per spec)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Barrier and signage'
    },

    // =========================================================================
    // JOINTS
    // =========================================================================
    {
      description: 'Sawcut contraction joints within time window',
      acceptanceCriteria: 'Joints cut before uncontrolled cracking',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 4-12 hours after pour depending on conditions'
    },
    {
      description: 'Verify joint spacing and depth',
      acceptanceCriteria: 'Spacing and depth per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically D/3 to D/4 depth'
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
      acceptanceCriteria: 'Compressive strength ≥ specified (typically 5-15 MPa)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Hold point - final strength verification'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All records complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Dockets, tests, survey, photos'
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
// NSW CONCRETE PAVEMENT BASE (TfNSW R83)
// =============================================================================

const nswConcretePavementTemplate = {
  name: 'Concrete Pavement Base',
  description: 'TfNSW concrete pavement base construction (plain, reinforced, CRCP) per R83',
  activityType: 'pavement_concrete',
  specificationReference: 'TfNSW R83',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN
    // =========================================================================
    {
      description: 'Submit concrete mix design and trial mix results',
      acceptanceCriteria: 'Mix achieves target strength (typically ≥32-40 MPa) and durability',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'NATA endorsed - flexural or compressive strength'
    },
    {
      description: 'Submit concrete supplier approval',
      acceptanceCriteria: 'Supplier registered/approved for pavement concrete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Quality system certification'
    },
    {
      description: 'Submit construction methodology (slipform or fixed form)',
      acceptanceCriteria: 'Method addresses all construction stages',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include paver setup, joint plan, curing'
    },
    {
      description: 'Submit joint layout plan',
      acceptanceCriteria: 'Joint spacing and details per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Contraction, construction, expansion joints'
    },

    // =========================================================================
    // SUBBASE PREPARATION
    // =========================================================================
    {
      description: 'Verify subbase layer approved and signed off',
      acceptanceCriteria: 'Subbase lot conformance issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cannot commence until subbase approved'
    },
    {
      description: 'Check subbase surface - clean, damp, debonding agent applied',
      acceptanceCriteria: 'Surface prepared per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - pre-pour preparation'
    },

    // =========================================================================
    // REINFORCEMENT / DOWELS (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Check reinforcement installation (bar size, spacing, cover, laps)',
      acceptanceCriteria: 'Per drawings and specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Hold point - steel fixing inspection'
    },
    {
      description: 'Verify dowel basket alignment and anchoring',
      acceptanceCriteria: 'Baskets parallel to centreline, securely anchored',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Survey check for alignment'
    },
    {
      description: 'Check tie bar installation at longitudinal joints',
      acceptanceCriteria: 'Correct size, spacing, length, deformed bars',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per joint detail drawings'
    },

    // =========================================================================
    // FORMS / STRINGLINE (SLIPFORM)
    // =========================================================================
    {
      description: 'Verify forms/stringline alignment and level',
      acceptanceCriteria: 'Alignment tolerances ±5mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification'
    },

    // =========================================================================
    // CONCRETE SUPPLY & TESTING
    // =========================================================================
    {
      description: 'Verify delivery dockets (mix ID, batch time)',
      acceptanceCriteria: 'Correct mix, delivery within 90 minutes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each load - reject if over time'
    },
    {
      description: 'Perform slump test',
      acceptanceCriteria: 'Slump within range - 40mm±15mm (slipform) or 80mm±20mm (fixed)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1',
      notes: 'Each load initially, then per frequency'
    },
    {
      description: 'Perform air content test (if specified)',
      acceptanceCriteria: 'Air content 4.0-6.0% (if freeze/thaw requirement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.4',
      notes: 'For durability in freeze/thaw environments'
    },
    {
      description: 'Check concrete temperature',
      acceptanceCriteria: 'Temperature 10-32°C (or per spec)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Reject outside limits'
    },
    {
      description: 'Cast strength test specimens (beams or cylinders)',
      acceptanceCriteria: 'Specimens cast per frequency',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically flexural beams for pavement'
    },

    // =========================================================================
    // PLACEMENT
    // =========================================================================
    {
      description: 'Commence concrete placement',
      acceptanceCriteria: 'Placement per approved method',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of pour'
    },
    {
      description: 'Verify vibration - no segregation, full consolidation',
      acceptanceCriteria: 'Poker vibrators functional, no over-vibration',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Visual check during pour'
    },
    {
      description: 'Check slab thickness',
      acceptanceCriteria: 'Design thickness achieved (typically 200-300mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Probe or depth gauge check'
    },

    // =========================================================================
    // FINISHING
    // =========================================================================
    {
      description: 'Float/screed surface to level',
      acceptanceCriteria: 'Surface level and uniform',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Straightedge check'
    },
    {
      description: 'Apply surface texture (tining/broom)',
      acceptanceCriteria: 'Texture depth per specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - texture application'
    },
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance ±5mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Immediate survey'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Apply curing compound at specified rate',
      acceptanceCriteria: 'Uniform coverage (typically 0.2-0.35 L/m²)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - before surface dries'
    },
    {
      description: 'Protect pavement during curing period',
      acceptanceCriteria: 'No traffic for minimum 7 days',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Barriers and protection'
    },

    // =========================================================================
    // JOINTS
    // =========================================================================
    {
      description: 'Sawcut contraction joints within time window',
      acceptanceCriteria: 'Joints cut before uncontrolled cracking (4-12 hours)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Critical timing - weather dependent'
    },
    {
      description: 'Verify joint depth and width',
      acceptanceCriteria: 'Depth D/4 to D/3, width per sealant requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Measure and record'
    },
    {
      description: 'Install joint sealant (after curing)',
      acceptanceCriteria: 'Joint clean, dry, sealant properly installed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per sealant manufacturer requirements'
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
      testType: 'AS 1012.9 / AS 1012.11',
      notes: 'Compressive or flexural'
    },
    {
      description: 'Submit 28-day strength results',
      acceptanceCriteria: 'Compressive ≥32-40 MPa or Flexural ≥4.5 MPa',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 / AS 1012.11',
      notes: 'Hold point - final strength'
    },

    // =========================================================================
    // RIDE QUALITY
    // =========================================================================
    {
      description: 'Perform ride quality survey (IRI or straightedge)',
      acceptanceCriteria: 'IRI ≤ 1.5-2.0 m/km or straightedge tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Profilometer or 3m straightedge'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All records complete',
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
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  // Check if template already exists
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

  // Create the template
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
  console.log(' NSW (TfNSW) Pavement ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswUnboundPavementTemplate)
    await seedTemplate(nswCementTreatedBaseTemplate)
    await seedTemplate(nswLeanMixConcreteTemplate)
    await seedTemplate(nswConcretePavementTemplate)

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
