/**
 * Seed Script: NSW (TfNSW) Asphalt ITP Templates
 *
 * Creates global ITP templates for NSW asphalt construction:
 * - Dense Graded Asphalt (DGA) - R116
 * - Prime & Primerseal
 *
 * Run with: node scripts/seed-itp-templates-nsw-asphalt.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// NSW DENSE GRADED ASPHALT (TfNSW R116)
// =============================================================================

const nswDenseGradedAsphaltTemplate = {
  name: 'Dense Graded Asphalt (DGA)',
  description: 'TfNSW heavy duty dense graded asphalt construction per R116 including material supply, placement, and acceptance testing',
  activityType: 'asphalt',
  specificationReference: 'TfNSW R116',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / MIX DESIGN APPROVAL
    // =========================================================================
    {
      description: 'Submit asphalt mix design and registration',
      acceptanceCriteria: 'Mix registered per TfNSW requirements, NATA endorsed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Mix must be registered before supply - volumetrics, Marshall/wheel tracking'
    },
    {
      description: 'Submit aggregate source approval',
      acceptanceCriteria: 'Aggregates meet specification (PSV, LAA, flakiness)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'T235 / T215',
      notes: 'Source properties - durability and skid resistance'
    },
    {
      description: 'Submit binder (bitumen) certification',
      acceptanceCriteria: 'Binder grade and properties certified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Class 170, C320, PMB as specified'
    },
    {
      description: 'Verify asphalt plant registration and calibration',
      acceptanceCriteria: 'Plant registered, calibration current',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required before production'
    },
    {
      description: 'Submit paving methodology including MTV use (if required)',
      acceptanceCriteria: 'Methodology addresses temperature management, joints, compaction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MTV (Material Transfer Vehicle) may be mandatory for highway works'
    },

    // =========================================================================
    // UNDERLYING SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Verify underlying pavement layer approved',
      acceptanceCriteria: 'Previous layer conformance issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Base course or lower asphalt layer signed off'
    },
    {
      description: 'Check surface condition - clean, dry, defects repaired',
      acceptanceCriteria: 'No loose material, potholes patched, cracks sealed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Surface prep critical for bond'
    },
    {
      description: 'Apply tack coat at specified rate',
      acceptanceCriteria: 'Uniform coverage, correct application rate (typically 0.2-0.4 L/m²)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Allow to break before paving'
    },
    {
      description: 'Verify tack coat has broken (cured)',
      acceptanceCriteria: 'Tack coat tacky but not liquid, not picking up on tyres',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Do not pave on wet tack'
    },

    // =========================================================================
    // WEATHER CONDITIONS
    // =========================================================================
    {
      description: 'Verify weather conditions suitable for paving',
      acceptanceCriteria: 'Air temp ≥10°C, surface temp ≥10°C, no rain forecast',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Record temperatures - do not pave in rain or on wet surface'
    },

    // =========================================================================
    // ASPHALT PRODUCTION & DELIVERY
    // =========================================================================
    {
      description: 'Verify production batch tickets (mix ID, time, temp)',
      acceptanceCriteria: 'Correct mix, temperature 150-170°C (varies by binder)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Each load - critical for temperature tracking'
    },
    {
      description: 'Check asphalt temperature on arrival at site',
      acceptanceCriteria: 'Within specified range (typically ≥140°C min)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Reject if below minimum - cannot achieve compaction'
    },
    {
      description: 'Visually inspect mix for segregation or contamination',
      acceptanceCriteria: 'Homogeneous appearance, no segregation, no foreign material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Reject segregated or contaminated loads'
    },

    // =========================================================================
    // PAVING OPERATIONS
    // =========================================================================
    {
      description: 'Commence paving operations',
      acceptanceCriteria: 'Paver set up correctly, screed heated',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of paving'
    },
    {
      description: 'Verify layer thickness (loose and compacted)',
      acceptanceCriteria: 'Design thickness achieved (typically 40-60mm wearing, varies)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Depth pins or paver sensor'
    },
    {
      description: 'Monitor paver speed and consistency',
      acceptanceCriteria: 'Constant speed, no stops, continuous supply',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Paver stops cause mat defects'
    },
    {
      description: 'Check mat surface behind paver (segregation, tearing)',
      acceptanceCriteria: 'No segregation, tearing, or dragging',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Adjust screed if defects observed'
    },

    // =========================================================================
    // JOINT CONSTRUCTION
    // =========================================================================
    {
      description: 'Construct longitudinal joints',
      acceptanceCriteria: 'Joint offset 150mm from lane line, cut back vertical, tacked',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - critical for waterproofing and ride'
    },
    {
      description: 'Construct transverse joints',
      acceptanceCriteria: 'Butt joint or tapered, properly compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'End-of-day joints, around structures'
    },

    // =========================================================================
    // COMPACTION
    // =========================================================================
    {
      description: 'Perform breakdown rolling (steel drum)',
      acceptanceCriteria: 'Initial compaction while mix workable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Minimum 3 passes typically'
    },
    {
      description: 'Perform intermediate rolling (pneumatic or steel)',
      acceptanceCriteria: 'Densification, kneading action',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Per approved rolling pattern'
    },
    {
      description: 'Perform finish rolling (static steel)',
      acceptanceCriteria: 'Surface sealed, roller marks removed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Final surface finish'
    },
    {
      description: 'Monitor compaction temperature window',
      acceptanceCriteria: 'Compaction complete before mix cools below minimum (typically 80°C)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'CRITICAL - cannot achieve density once cold'
    },

    // =========================================================================
    // ACCEPTANCE TESTING - FIELD
    // =========================================================================
    {
      description: 'Mark core locations for density testing',
      acceptanceCriteria: 'Random stratified sampling per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Typically 1 per 250-500m² or per lot'
    },
    {
      description: 'Extract cores for density and thickness',
      acceptanceCriteria: 'Cores extracted at marked locations',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - coring operation'
    },
    {
      description: 'Patch core holes',
      acceptanceCriteria: 'Holes patched with hot mix, properly compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Same day patching'
    },

    // =========================================================================
    // ACCEPTANCE TESTING - LABORATORY
    // =========================================================================
    {
      description: 'Submit core density results (air voids)',
      acceptanceCriteria: 'In-situ air voids 3-7% (typically target 5%)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2891.9.2',
      notes: 'Hold point - density acceptance. <3% = flushing risk, >7% = permeable'
    },
    {
      description: 'Verify layer thickness from cores',
      acceptanceCriteria: 'Minimum design thickness achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Core measurement'
    },
    {
      description: 'Submit plant production QC results (volumetrics, grading)',
      acceptanceCriteria: 'Production within JMF tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Plant QC during production'
    },

    // =========================================================================
    // GEOMETRIC / SURFACE VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance ±6mm (wearing course)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey grid'
    },
    {
      description: 'Verify crossfall compliance',
      acceptanceCriteria: 'Crossfall per design (typically 3%)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'For drainage'
    },
    {
      description: 'Perform ride quality assessment (IRI)',
      acceptanceCriteria: 'IRI ≤ 1.5 m/km (new construction)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Laser profilometer'
    },
    {
      description: 'Check surface texture depth',
      acceptanceCriteria: 'Texture depth per specification (sand patch or laser)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Skid resistance related'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All batch tickets, tests, survey, photos complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Full lot documentation pack'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, density compliant',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// NSW PRIME & PRIMERSEAL
// =============================================================================

const nswPrimersealTemplate = {
  name: 'Prime and Primerseal',
  description: 'TfNSW primer and primerseal application for pavement surface preparation',
  activityType: 'asphalt_prep',
  specificationReference: 'TfNSW Asphalt Specs',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK
    // =========================================================================
    {
      description: 'Submit primer/primerseal material details and application rates',
      acceptanceCriteria: 'Material approved, rates per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Cutback bitumen or emulsion type'
    },
    {
      description: 'Submit spray equipment calibration',
      acceptanceCriteria: 'Spray bar calibrated for uniform application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Nozzle spacing and pressure'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Verify base course approved and signed off',
      acceptanceCriteria: 'Base lot conformance issued',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Base must be approved before priming'
    },
    {
      description: 'Check base surface condition',
      acceptanceCriteria: 'Surface tight, dry, free of loose material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Sweep if required'
    },
    {
      description: 'Verify base moisture condition',
      acceptanceCriteria: 'Surface dry or slightly damp (not wet)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Primer will not penetrate wet surface'
    },

    // =========================================================================
    // WEATHER CONDITIONS
    // =========================================================================
    {
      description: 'Check weather conditions',
      acceptanceCriteria: 'Air temp ≥10°C, no rain forecast for 24 hours',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Rain washes off uncured prime'
    },

    // =========================================================================
    // PRIMER APPLICATION
    // =========================================================================
    {
      description: 'Commence primer application',
      acceptanceCriteria: 'Spray operation per methodology',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Witness point - start of spraying'
    },
    {
      description: 'Verify application rate',
      acceptanceCriteria: 'Application rate per specification (typically 0.5-1.0 L/m²)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Calculate from tank dips and area'
    },
    {
      description: 'Check for uniform coverage',
      acceptanceCriteria: 'No streaks, misses, or heavy spots',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Correct any deficiencies'
    },
    {
      description: 'Protect edges and structures from overspray',
      acceptanceCriteria: 'No bitumen on kerbs, structures, services',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Mask or protect as needed'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Allow primer to cure',
      acceptanceCriteria: 'Primer cured (not tacky to touch, penetrated into base)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Typically 24-48 hours depending on product and weather'
    },
    {
      description: 'Protect primed surface from traffic damage',
      acceptanceCriteria: 'No traffic until cured, or sand blinding applied',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Traffic will pick up uncured prime'
    },

    // =========================================================================
    // PRIMERSEAL (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Apply aggregate cover (primerseal)',
      acceptanceCriteria: 'Aggregate spread uniformly at correct rate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'If primerseal specified'
    },
    {
      description: 'Roll aggregate into binder',
      acceptanceCriteria: 'Aggregate embedded, excess swept',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Multi-tyre or steel roller'
    },

    // =========================================================================
    // VERIFICATION
    // =========================================================================
    {
      description: 'Inspect cured prime/primerseal surface',
      acceptanceCriteria: 'Uniform appearance, no bare patches, good adhesion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Before subsequent layer'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'Application records, photos, weather log complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Lot records'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'Prime/primerseal acceptable',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Release for subsequent layer'
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
  console.log(' NSW (TfNSW) Asphalt ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswDenseGradedAsphaltTemplate)
    await seedTemplate(nswPrimersealTemplate)

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
