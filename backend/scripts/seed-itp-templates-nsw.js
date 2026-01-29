/**
 * Seed Script: NSW (TfNSW) ITP Templates
 *
 * Creates global ITP templates for NSW based on TfNSW specifications.
 * These templates have projectId = null and stateSpec = 'TfNSW' so they
 * appear for any project using TfNSW/RMS specification set.
 *
 * Run with: node scripts/seed-itp-templates-nsw.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// NSW EARTHWORKS TEMPLATE (TfNSW R44)
// Based on: TfNSW QA Specification R44 – Earthworks (Ed 6 / Rev 0)
// =============================================================================

const nswEarthworksTemplate = {
  name: 'Earthworks',
  description: 'TfNSW Earthworks construction including clearing, excavation, embankment construction, and compaction verification per R44 Ed 6 Rev 0',
  activityType: 'earthworks',
  specificationReference: 'TfNSW R44 Ed 6 Rev 0',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Survey Report and present set out for verification',
      acceptanceCriteria: 'Survey control validated, setout approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 2.5.3, G71 - Joint survey notification required'
    },
    {
      description: 'Submit Earthworks Management Plan including borrow pit locations and mass haul diagram',
      acceptanceCriteria: 'Plan approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required before commencement of earthworks'
    },
    {
      description: 'Submit Vibration & Airblast Management Sub-Plan and Building Condition Inspection Reports',
      acceptanceCriteria: 'Plan approved, baseline inspections complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 4.6.1, G36 - Required if blasting or vibration-generating work'
    },

    // =========================================================================
    // CLEARING & GRUBBING
    // =========================================================================
    {
      description: 'Clear and grub work area per G40',
      acceptanceCriteria: 'Complete removal of vegetation, stumps, roots to specified depth',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Each section - Visual inspection per G40'
    },
    {
      description: 'Strip and stockpile topsoil',
      acceptanceCriteria: 'Topsoil depth as specified, stockpiled for reuse',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Stockpile locations approved, protected from contamination'
    },

    // =========================================================================
    // UNSUITABLE MATERIAL REMOVAL
    // =========================================================================
    {
      description: 'Present unsuitable material removal area before backfilling',
      acceptanceCriteria: 'All unsuitable material removed to approved depth/extent',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 2.6.1 - Mucking out verification'
    },
    {
      description: 'Verify unsuitable material disposal location',
      acceptanceCriteria: 'Disposed at approved location',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Disposal dockets required'
    },

    // =========================================================================
    // CUTTING OPERATIONS
    // =========================================================================
    {
      description: 'Present floor of cutting for each Lot',
      acceptanceCriteria: 'CBR and PI results compliant per Annex R44/A2',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T117 (CBR) / T108 (PI)',
      notes: 'Clause 3.2 - Submit CBR/PI results if required'
    },
    {
      description: 'Present cleaned cutting batter/bench/floor for geotechnical inspection',
      acceptanceCriteria: 'Approved by geotechnical engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 4.2 - Geotechnical verification'
    },

    // =========================================================================
    // BLASTING (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Submit blasting details for each blast',
      acceptanceCriteria: 'Blast design approved, exclusion zones established',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 4.6.2 - Required for each blast event'
    },

    // =========================================================================
    // EMBANKMENT FOUNDATION
    // =========================================================================
    {
      description: 'Present embankment foundation after topsoil removal for each Lot',
      acceptanceCriteria: 'CBR and PI results compliant if required',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T117 (CBR) / T108 (PI)',
      notes: 'Clause 3.3 - Foundation verification before fill placement'
    },
    {
      description: 'Proof roll embankment foundation',
      acceptanceCriteria: 'No visible deflection or pumping under loaded roller',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'T198',
      notes: 'Visual assessment of foundation stability'
    },

    // =========================================================================
    // FILL MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Submit details of Upper Zone materials including Selected Material sources',
      acceptanceCriteria: 'Material sources approved, site sources verified exhausted/allocated if importing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6.1.1 - Material source approval'
    },
    {
      description: 'Submit verification of conformity of stockpiled Selected Material',
      acceptanceCriteria: 'Grading, PI, CBR compliant per specification',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T106 / T108 / T117',
      notes: 'Clause 6.1.2 - Stockpile verification'
    },
    {
      description: 'Submit details of verge material to be delivered',
      acceptanceCriteria: 'Material approved, site sources verified if importing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 6.2 - Verge material approval'
    },
    {
      description: 'Verify verge material CBR and PI for each Lot (site won)',
      acceptanceCriteria: 'Per Annex R44/A2.2',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T117 / T108',
      notes: 'Clause 2.8.6.1'
    },
    {
      description: 'Verify verge material grading for each Lot',
      acceptanceCriteria: 'Per Clause 2.8.6.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T106',
      notes: 'Grading envelope compliance'
    },

    // =========================================================================
    // ROCK FILL TRIAL SECTION
    // =========================================================================
    {
      description: 'Construct trial section of rock fill',
      acceptanceCriteria: 'Trial demonstrates compaction procedure achieves specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7.4.2 - Witness Point'
    },
    {
      description: 'Submit verification of trial sections of rock fill and compaction procedure',
      acceptanceCriteria: 'Compaction procedure approved for remaining sections',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7.4.2 - Hold Point release for rock fill'
    },

    // =========================================================================
    // EMBANKMENT CONSTRUCTION - LAYER PLACEMENT
    // =========================================================================
    {
      description: 'Verify layer thickness before compaction',
      acceptanceCriteria: 'Loose lift thickness per Clause 5.2.2 (typically ≤200mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 5.2.2 - Measure each Lot'
    },
    {
      description: 'Verify Lot homogeneity (no segregation, consistent material)',
      acceptanceCriteria: 'Per Clause 7.2.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7.2.1 - Visual inspection each Lot'
    },
    {
      description: 'Verify moisture content during compaction',
      acceptanceCriteria: 'Within specified range of OMC (typically ±2%)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T120 / T121 / T180',
      notes: 'Clause 7.1 - Q (characteristic) frequency per Annex R44/A5'
    },
    {
      description: 'Perform relative compaction testing',
      acceptanceCriteria: 'Per Table R44.7 (typically ≥95% Std or ≥100% Mod)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 (Nuclear) / T166 / T162',
      notes: 'Clause 7.2 - Q (characteristic) frequency'
    },

    // =========================================================================
    // SELECTED MATERIAL ZONE VERIFICATION
    // =========================================================================
    {
      description: 'Submit verification of conformity for each Lot of Selected Material Zone placed',
      acceptanceCriteria: 'Test results and survey reports compliant',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T173 / T106 / T108',
      notes: 'Clause 6.1.2 - Lot conformance'
    },

    // =========================================================================
    // DEFLECTION TESTING
    // =========================================================================
    {
      description: 'Proof roll surface of Selected Material Zone',
      acceptanceCriteria: 'No visible deformation under loaded vehicle',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'T198',
      notes: 'Clause 7.6.1 - Proof rolling within 1.5m of underside'
    },
    {
      description: 'Perform Benkelman Beam testing at underside of Selected Material Zone',
      acceptanceCriteria: 'Deflection per Clause 7.6.2 and Annex R44/A4',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T199',
      notes: 'Clause 7.6.2 - Hold Point'
    },
    {
      description: 'Perform Benkelman Beam testing at top of Selected Material Zone',
      acceptanceCriteria: 'Deflection per Clause 7.6.2 and Annex R44/A4',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T199',
      notes: 'Clause 7.6.3 - Witness Point'
    },
    {
      description: 'Submit deflection test results, Survey Report and verification of conformity',
      acceptanceCriteria: 'All results compliant, lot closure approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 7.6.5 - Final lot verification'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished surface levels',
      acceptanceCriteria: 'Level tolerance +0mm / -30mm (subgrade)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey at 20m grid minimum'
    },
    {
      description: 'Verify batter slopes and alignment',
      acceptanceCriteria: 'Per design tolerances (typically ±100mm at structures)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification'
    },
    {
      description: 'Verify crossfall/grade compliance',
      acceptanceCriteria: 'Per design requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation pack',
      acceptanceCriteria: 'All test results, survey data, photos, and inspection records complete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required for lot sign-off'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval'
    }
  ]
}

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function seedNSWTemplates() {
  console.log('🌱 Seeding NSW (TfNSW) ITP Templates...\n')

  // Check if template already exists
  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: nswEarthworksTemplate.name,
      stateSpec: 'TfNSW',
      projectId: null
    }
  })

  if (existing) {
    console.log(`⚠️  Template "${nswEarthworksTemplate.name}" already exists (ID: ${existing.id})`)
    console.log('   Skipping to avoid duplicates. Delete existing template first if you want to re-seed.')
    return existing
  }

  // Create the template with checklist items
  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: null, // Global template
      name: nswEarthworksTemplate.name,
      description: nswEarthworksTemplate.description,
      activityType: nswEarthworksTemplate.activityType,
      specificationReference: nswEarthworksTemplate.specificationReference,
      stateSpec: nswEarthworksTemplate.stateSpec,
      isActive: true,
      checklistItems: {
        create: nswEarthworksTemplate.checklistItems.map((item, index) => ({
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

  // Summary
  const holdPoints = template.checklistItems.filter(i => i.pointType === 'hold_point')
  const witnessPoints = template.checklistItems.filter(i => i.pointType === 'witness')
  const standardItems = template.checklistItems.filter(i => i.pointType === 'standard')

  console.log(`✅ Created: ${template.name}`)
  console.log(`   ID: ${template.id}`)
  console.log(`   Spec: ${template.specificationReference}`)
  console.log(`   State: ${template.stateSpec}`)
  console.log(`   Total Items: ${template.checklistItems.length}`)
  console.log(`   - Hold Points (H): ${holdPoints.length}`)
  console.log(`   - Witness Points (W): ${witnessPoints.length}`)
  console.log(`   - Standard Items: ${standardItems.length}`)
  console.log('')

  return template
}

// =============================================================================
// RUN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' NSW (TfNSW) ITP Template Seeder')
  console.log(' Based on TfNSW QA Specification R44 – Earthworks (Ed 6 / Rev 0)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    const template = await seedNSWTemplates()

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('To use this template:')
    console.log('1. Create a project with specificationSet = "RMS (NSW)" or "TfNSW"')
    console.log('2. When fetching templates with includeGlobal=true, this template will appear')
    console.log('3. Clone it to your project or assign directly to lots')
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
