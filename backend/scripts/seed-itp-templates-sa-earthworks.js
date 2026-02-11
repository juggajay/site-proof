/**
 * Seed Script: SA (DIT) ITP Templates - Earthworks
 *
 * Creates global ITP templates for SA based on DIT specifications.
 * These templates have projectId = null and stateSpec = 'DIT' so they
 * appear for any project using DIT specification set.
 *
 * Based on: RD-EW-C1 Earthworks (formerly Part R10)
 * Verified against: DIT RD-EW-C1 specification clauses, RD-EW-D1, TP 320
 *
 * Run with: node scripts/seed-itp-templates-sa-earthworks.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// SA EARTHWORKS TEMPLATE (RD-EW-C1)
// Based on: DIT RD-EW-C1 Earthworks (formerly Part R10)
// =============================================================================

const saEarthworksTemplate = {
  name: 'Earthworks (DIT RD-EW-C1)',
  description: 'DIT Earthworks including site clearing, grubbing, excavation, fill placement, compaction, subgrade preparation, proof rolling, and geotextile placement per RD-EW-C1 (formerly Part R10). Covers material classification, TP 320 compaction testing, and lot acceptance.',
  activityType: 'earthworks',
  specificationReference: 'RD-EW-C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Earthworks Construction Procedures',
      acceptanceCriteria: 'Procedures accepted by Principal\'s Authorised Person prior to commencement of any earthworks',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Procedures must be accepted by Principal\'s Authorised Person before work commences.'
    },
    {
      description: 'Submit fill material source details and lab classification results',
      acceptanceCriteria: 'Fill material classified as Suitable Material with laboratory results provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1289.3.6.1',
      notes: 'RD-EW-C1 / RD-EW-D1 — Material classification as Suitable/Unsuitable required before use.'
    },
    {
      description: 'Submit proof rolling methodology and equipment details',
      acceptanceCriteria: 'Proof rolling methodology and equipment details accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Proof rolling equipment must comply: pneumatic roller >24t or loaded tandem truck/water cart ≥10kL with ≥450kPa tyre pressure.'
    },
    {
      description: 'Submit geotextile product details for soft subgrade areas (if applicable)',
      acceptanceCriteria: 'Geotextile product details approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Product must be approved before placement.'
    },
    {
      description: 'Submit chemical stabilisation design for subgrade treatment (if applicable)',
      acceptanceCriteria: 'Stabilisation mix design approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Cross-references RD-PV-C3 for in-situ stabilisation. Mix design approval required.'
    },

    // =========================================================================
    // CLEARING & GRUBBING
    // =========================================================================
    {
      description: 'Clear and grub work area as specified',
      acceptanceCriteria: 'All vegetation, stumps, and organic material removed from work area',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — All vegetation, stumps, and organic material removed.'
    },
    {
      description: 'Inspect grubbed holes prior to backfilling',
      acceptanceCriteria: 'Grubbed holes inspected and accepted by Principal\'s Authorised Person before backfilling',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Hold Point. Grubbed holes must be inspected and accepted before backfilling.'
    },
    {
      description: 'Strip and stockpile topsoil',
      acceptanceCriteria: 'Topsoil stripped to specified depth, stockpiled at approved locations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Topsoil stripped to specified depth, stockpiled at approved locations.'
    },
    {
      description: 'Verify topsoil stripping depth',
      acceptanceCriteria: 'Topsoil stripping depth confirmed as complete across work area',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Spot check depth to ensure full removal of topsoil from work area.'
    },

    // =========================================================================
    // MATERIAL TESTING & CLASSIFICATION
    // =========================================================================
    {
      description: 'Classify fill material — particle size distribution',
      acceptanceCriteria: 'Material grading within specified envelope for designated fill zone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1',
      notes: 'Material grading for fill classification. Test at source.'
    },
    {
      description: 'Determine Plasticity Index of fill material',
      acceptanceCriteria: 'PI within acceptable range for designated fill zone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.3.1',
      notes: 'Atterberg limits testing for clay content assessment.'
    },
    {
      description: 'Perform soaked CBR test on fill/subgrade material',
      acceptanceCriteria: 'Soaked CBR meets or exceeds design value',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.6.1.1',
      notes: 'At source — soaked CBR must meet design value.'
    },
    {
      description: 'Determine Maximum Dry Density for compaction control',
      acceptanceCriteria: 'MDD determined for each field density test location (one-for-one testing)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.1.1 / AS 1289.5.2.1',
      notes: 'Standard Compaction for general fill, Modified Compaction for structural/pavement fill. \'One-for-one\' MDD per field density test per TP 320.'
    },
    {
      description: 'Verify fill material does not exhibit characteristics of Unsuitable Material',
      acceptanceCriteria: 'Material does not show deformation, rutting, softness, yielding, distress or instability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EW-C1 — Material must not show deformation, rutting, softness, yielding, distress or instability.'
    },

    // =========================================================================
    // FOUNDATION / SUBGRADE INSPECTION
    // =========================================================================
    {
      description: 'Present foundation/subgrade surface for inspection before fill placement',
      acceptanceCriteria: 'Foundation inspected and accepted by Principal\'s Authorised Person before fill commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Hold Point. Foundation must be inspected and accepted before fill commences.'
    },
    {
      description: 'Inspect joint surfaces before fill placement',
      acceptanceCriteria: 'Joint inspection and survey completed and accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Hold Point per section 7.2(a). Joint inspection and survey required.'
    },
    {
      description: 'Inspect geotextile placement before covering with fill',
      acceptanceCriteria: 'Geotextile placement inspected and Hold Point released before fill placement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Hold Point. Fill must not be placed over geotextile until released.'
    },

    // =========================================================================
    // PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Verify layer thickness before compaction',
      acceptanceCriteria: 'Loose lift thickness within specified maximum for material type and compaction equipment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Loose lift thickness within specified maximum for material type and compaction equipment.'
    },
    {
      description: 'Verify moisture content during compaction',
      acceptanceCriteria: 'Moisture within specified range for material type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320',
      notes: 'RD-EW-C1 — Moisture within specified range for material type.'
    },
    {
      description: 'Perform field density testing — general fill',
      acceptanceCriteria: 'General fill (lower embankment): ≥95% Standard MDD; upper 500mm: ≥98% Standard MDD per TP 320',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320',
      notes: 'RD-EW-C1 Table RD-EW-C1 12-1. \'One-for-one\' MDD testing per TP 320. [VERIFY exact % from spec]'
    },
    {
      description: 'Perform field density testing — structural/select fill',
      acceptanceCriteria: 'Select fill / subgrade zone (top 300mm): ≥95% Modified MDD; structural fill: ≥95-100% Modified MDD per TP 320',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320',
      notes: 'RD-EW-C1 Table RD-EW-C1 12-1. [VERIFY exact % from spec]'
    },
    {
      description: 'Proof roll compacted fill layers',
      acceptanceCriteria: 'No deformation, rutting, softness, yielding, distress or instability under 3 passes at walking pace',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-EW-C1 — Proof rolling per spec requirements: pneumatic roller >24t or loaded truck ≥10kL/≥450kPa. Materials exhibiting distress = Unsuitable Material.'
    },
    {
      description: 'Witness density testing operations',
      acceptanceCriteria: 'Field density tests performed correctly; results comply with specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 320',
      notes: 'RD-EW-C1 — Principal\'s Authorised Person may audit density testing.'
    },
    {
      description: 'Fill placement and compaction approval for non-standard layer thickness',
      acceptanceCriteria: 'Non-standard layer thickness approved by Principal\'s Authorised Person before compaction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Hold Point where layer thicknesses exceed specified limits.'
    },

    // =========================================================================
    // SUBGRADE PREPARATION
    // =========================================================================
    {
      description: 'Verify subgrade compaction under proof roll',
      acceptanceCriteria: 'No visible vertical movement or soft spots under proof roll',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'RD-EW-C1 — Subgrade must demonstrate stability under proof rolling.'
    },
    {
      description: 'Treat or remove unsuitable subgrade material as directed',
      acceptanceCriteria: 'Unsuitable material treated or removed per Principal\'s Authorised Person direction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-EW-C1 — Rock subgrade must be blinded with subbase material. Soft/unstable areas treated or removed.'
    },
    {
      description: 'Survey finished subgrade levels',
      acceptanceCriteria: 'Subgrade level within design tolerances; testing at intervals ≤10m where no longitudinal frequency specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 / PC-SI1 — Level compliance per site survey requirements.'
    },
    {
      description: 'Check surface regularity with 3m straightedge',
      acceptanceCriteria: 'No abrupt surface irregularities',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Subgrade surface regularity check.'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Verify embankment width compliance',
      acceptanceCriteria: 'Width within specified tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification at specified intervals.'
    },
    {
      description: 'Verify batter slopes and alignment',
      acceptanceCriteria: 'Batter slopes within design tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification of batter slopes.'
    },
    {
      description: 'Verify crossfall and shape compliance',
      acceptanceCriteria: 'Crossfall within design tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EW-C1 — Formation crossfall check.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation pack',
      acceptanceCriteria: 'All test results (TP 320), survey data, photos, proof roll records complete for lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include all test results (TP 320), survey data, photos, proof roll records for lot.'
    },
    {
      description: 'Submit lot test results summary',
      acceptanceCriteria: 'Summary of all density, moisture, and proof roll results submitted for the lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Summary of all density, moisture, and proof roll results for the lot.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person. All acceptance criteria verified.'
    },
    {
      description: 'As-built survey documentation',
      acceptanceCriteria: 'As-built survey of completed earthworks submitted for record',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'As-built survey of completed earthworks submitted for record.'
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
    include: { checklistItems: true }
  })

  const holdPoints = template.checklistItems.filter(i => i.pointType === 'hold_point')
  const witnessPoints = template.checklistItems.filter(i => i.pointType === 'witness')
  const standardItems = template.checklistItems.filter(i => i.pointType === 'standard')

  console.log(`  ✅ Created: ${template.name}`)
  console.log(`     ID: ${template.id}`)
  console.log(`     Spec: ${template.specificationReference}`)
  console.log(`     Total Items: ${template.checklistItems.length}`)
  console.log(`     - Hold Points (H): ${holdPoints.length}`)
  console.log(`     - Witness Points (W): ${witnessPoints.length}`)
  console.log(`     - Standard Items: ${standardItems.length}`)
  console.log('')

  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SA (DIT) ITP Template Seeder - Earthworks')
  console.log(' Based on: RD-EW-C1 Earthworks (formerly Part R10)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saEarthworksTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('To use this template:')
    console.log('1. Create a project with specificationSet = "DIT (SA)" or "DIT"')
    console.log('2. When fetching templates with includeGlobal=true, this template will appear')
    console.log('3. Clone it to your project or assign directly to lots')
    console.log('')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
