/**
 * Seed Script: VIC (VicRoads) ITP Templates - Earthworks
 *
 * Creates global ITP templates for VIC based on VicRoads Standard Specifications
 * for Roadworks and Bridgeworks. These templates have projectId = null and
 * stateSpec = 'VicRoads' so they appear for any project using VicRoads specification set.
 *
 * Based on: VicRoads Section 204 (Earthworks), Section 173 (Clearing and Grubbing)
 * References: RC 500.05 (Acceptance of Field Compaction), RC 316.00, RC 316.10
 *
 * Run with: node scripts/seed-itp-templates-vic-earthworks.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// VIC EARTHWORKS TEMPLATE (Section 204)
// Based on: VicRoads Section 204 Earthworks (December 2015, Version 7)
//           VicRoads Section 173 Clearing and Grubbing
// =============================================================================

const vicEarthworksTemplate = {
  name: 'Earthworks (VicRoads Sec 201/204)',
  description: 'VicRoads Earthworks including site clearing, grubbing, foundation preparation, fill placement, compaction, subgrade treatment, excavation in cut, and post-construction documentation per Section 204 (Earthworks) and Section 201 (Site Clearing). Covers Type A/B/C fill classification, proof rolling, characteristic density ratio assessment per RC 500.05, and subgrade acceptance.',
  activityType: 'earthworks',
  specificationReference: 'Sec 201/204',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS (Items 1-5)
    // =========================================================================
    {
      description: 'Submit Earthworks Quality Plan including compaction procedures, equipment, testing regime, and material source details',
      acceptanceCriteria: 'Plan reviewed and accepted by Superintendent; compliant with Clause 204.02 requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.02. HP - Work shall not commence until Quality Plan is accepted.'
    },
    {
      description: 'Submit fill material source details including laboratory test results for classification as Type A, Type B, or Type C',
      acceptanceCriteria: 'Material classification confirmed; test results demonstrate compliance with Table 204.051 requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1289.3.1.1 (LL), AS 1289.3.3.1 (PL), AS 1289.3.6.1 (PI)',
      notes: 'Section 204.05. HP - Material source must be approved before use.'
    },
    {
      description: 'Submit compaction testing regime and lot layout plan',
      acceptanceCriteria: 'Lot sizes comply with Table 204.142; max 500 m2 under paved areas; testing scale and frequency defined per RC 500.05',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.14, RC 500.05. Lot size max 500 m2 under paved areas or per Table 204.142.'
    },
    {
      description: 'Submit proof rolling procedure including equipment details (roller type, mass, speed, number of passes)',
      acceptanceCriteria: 'Procedure compliant with Clause 204.12 and Section 173 requirements; nominated roller meets mass requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.12. HP - Proof rolling procedure must be approved before commencement.'
    },
    {
      description: 'Confirm survey control points and design levels are established',
      acceptanceCriteria: 'Survey control verified; bench marks and reference points established and documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.03.'
    },

    // =========================================================================
    // SITE CLEARING AND PREPARATION - Section 173 (Items 6-10)
    // =========================================================================
    {
      description: 'Complete clearing of vegetation, trees, stumps, and debris within the works area',
      acceptanceCriteria: 'All vegetation cleared to specified limits; no organic material remaining within formation area',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 173. W - Give Superintendent 24 hours notice.'
    },
    {
      description: 'Complete grubbing of root systems, stumps, and subsurface organic material',
      acceptanceCriteria: 'All roots and stumps removed to minimum 500 mm below finished surface level; voids backfilled and compacted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 173.'
    },
    {
      description: 'Strip and stockpile topsoil for reuse',
      acceptanceCriteria: 'Topsoil stripped to specified depth; stockpiled separately from fill material; stockpile locations approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 173. Topsoil to be preserved for landscaping reuse.'
    },
    {
      description: 'Remove unsuitable material from formation area',
      acceptanceCriteria: 'All unsuitable material (peat, organic soil, soft clay, rubbish) removed and disposed of; foundation exposed for inspection',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.06. W - Notify Superintendent before covering.'
    },
    {
      description: 'Inspect cleared and stripped foundation surface before fill placement',
      acceptanceCriteria: 'Foundation surface free of organic matter, soft spots, standing water; surface scarified and moisture conditioned',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.06. HP - Foundation must be released before fill placement commences.'
    },

    // =========================================================================
    // FOUNDATION PREPARATION (Items 11-14)
    // =========================================================================
    {
      description: 'Prepare natural ground foundation where embankment is to be placed',
      acceptanceCriteria: 'Foundation scarified to minimum 150 mm depth; benched into slopes steeper than 1V:4H; moisture conditioned',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.06. HP - Foundation acceptance required before fill placement.'
    },
    {
      description: 'Conduct foundation proof rolling on natural ground surface',
      acceptanceCriteria: 'No deflection greater than 2 mm vertically within 300 mm of test roller in isolated locations; Superintendent present',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.12. HP - Superintendent must witness proof rolling.'
    },
    {
      description: 'Test foundation density where specified',
      acceptanceCriteria: 'Characteristic density ratio meets minimum requirements per Table 204.131 for foundation zone',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 (Sand Replacement) or RC 316.00',
      notes: 'Section 204.13, RC 500.05.'
    },
    {
      description: 'Verify moisture content of foundation material',
      acceptanceCriteria: 'Moisture content not less than 70% of optimum moisture content prior to placement of pavement layers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Section 204.13. Material within 150 mm of subgrade shall be maintained at minimum 70% OMC.'
    },

    // =========================================================================
    // FILL PLACEMENT AND COMPACTION (Items 15-23)
    // =========================================================================
    {
      description: 'Verify fill material classification and compliance before placement',
      acceptanceCriteria: 'Material classified as Type A, B, or C per Table 204.051; laboratory test results current and compliant',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1 (PI), AS 1289.6.1.1 (CBR)',
      notes: 'Section 204.05, Table 204.051.'
    },
    {
      description: 'Place fill in layers not exceeding specified loose thickness',
      acceptanceCriteria: 'Loose layer thickness does not exceed 300 mm for material compacted by heavy rollers; 150 mm for hand-guided compactors',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.07. Layer thickness depends on compaction equipment.'
    },
    {
      description: 'Conduct moisture conditioning of fill material before compaction',
      acceptanceCriteria: 'Material moisture content within specified range; typically 85-115% of optimum moisture content per Table 204.131',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Section 204.08, Table 204.131.'
    },
    {
      description: 'Compact fill layers - Lower Zone (>500 mm below subgrade)',
      acceptanceCriteria: 'Characteristic density ratio >= 95.0% Standard Dry Density Ratio (SDDR) per RC 500.05 assessment; 6 tests per lot (Scale A) or 3 tests per lot (Scale C)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
      notes: 'Section 204.13, Table 204.131, RC 500.05. Characteristic value = mean - 0.92 x SD (6 tests).'
    },
    {
      description: 'Compact fill layers - Upper Zone (within 500 mm of subgrade)',
      acceptanceCriteria: 'Characteristic density ratio >= 98.0% SDDR per RC 500.05 assessment',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
      notes: 'Section 204.13, Table 204.131, RC 500.05. Higher compaction standard for upper zone.'
    },
    {
      description: 'Compact fill layers - Subgrade (top 150 mm of formation)',
      acceptanceCriteria: 'Characteristic density ratio >= 100.0% SDDR per RC 500.05 assessment',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
      notes: 'Section 204.13, Table 204.131, RC 500.05. W - Notify Superintendent before testing.'
    },
    {
      description: 'Verify no oversize material in fill layers',
      acceptanceCriteria: 'Maximum particle size not exceeding 2/3 of compacted layer thickness; no rocks >75 mm within 150 mm of subgrade level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.07.'
    },
    {
      description: 'Test each compaction lot for density compliance',
      acceptanceCriteria: 'Lot area not exceeding 500 m2 under paved areas (Table 204.142); minimum 6 test locations per lot for Scale A; 3 for Scale C',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1, RC 316.00, RC 316.10',
      notes: 'Section 204.14, Table 204.142, RC 500.05. RC 316.10 for test site selection.'
    },
    {
      description: 'Record and assess compaction lot results using characteristic value method',
      acceptanceCriteria: 'Characteristic value (mean - 0.92S for 6 tests) meets or exceeds specified minimum density ratio; no individual result more than 3% below specified minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RC 316.00',
      notes: 'Section 204.14, RC 500.05. Statistical acceptance per RC 500.05.'
    },

    // =========================================================================
    // SUBGRADE TREATMENT (Items 24-28)
    // =========================================================================
    {
      description: 'Trim subgrade to design levels and cross-fall',
      acceptanceCriteria: 'Surface level within +10 mm / -20 mm of design level; cross-fall within 0.5% of design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.09. Tolerances may vary per project.'
    },
    {
      description: 'Conduct subgrade proof rolling',
      acceptanceCriteria: 'Proof roller (minimum 12 tonne pneumatic tyred roller or as specified) applied; no visible deflection greater than 2 mm under roller; soft spots identified and treated',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.12. HP - Superintendent must be present during proof rolling.'
    },
    {
      description: 'Identify and treat soft spots revealed by proof rolling',
      acceptanceCriteria: 'Failed areas excavated to stable material, backfilled with approved material, and re-compacted to 100% SDDR; re-proof rolled after treatment',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1',
      notes: 'Section 204.12. HP - Re-inspection of treated areas required.'
    },
    {
      description: 'Test subgrade CBR where specified',
      acceptanceCriteria: 'Assigned CBR meets or exceeds design assumption per pavement design report; tested in accordance with RC 500.20',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.6.1.1 (Soaked CBR), RC 324.01, RC 500.20',
      notes: 'Section 204.13, RC 500.20.'
    },
    {
      description: 'Verify subgrade moisture content is within specification limits',
      acceptanceCriteria: 'Moisture content within specified range; moisture ratio not exceeding specified maximum per Table 204.131',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1',
      notes: 'Section 204.13, Table 204.131.'
    },

    // =========================================================================
    // EXCAVATION - CUTS (Items 29-31)
    // =========================================================================
    {
      description: 'Excavate to design levels in cut areas',
      acceptanceCriteria: 'Excavation to within specified tolerance of design levels; no over-excavation without approval; batter slopes as specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.04.'
    },
    {
      description: 'Inspect exposed formation in cut for suitability',
      acceptanceCriteria: 'Formation material meets minimum design CBR; no unsuitable material; drainage adequate; no seepage issues',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.06. HP - Formation in cut must be accepted before pavement construction.'
    },
    {
      description: 'Test formation density in cut areas',
      acceptanceCriteria: 'Characteristic density ratio meets specified minimum; in-situ material tested at natural density or after recompaction',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1, RC 316.00',
      notes: 'Section 204.13.'
    },

    // =========================================================================
    // POST-CONSTRUCTION AND DOCUMENTATION (Items 32-38)
    // =========================================================================
    {
      description: 'Complete final proof rolling of entire subgrade formation',
      acceptanceCriteria: 'Continuous proof rolling across full formation width; no defects; Superintendent present and signs off',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.12. HP - Final formation acceptance.'
    },
    {
      description: 'Conduct final survey of subgrade levels',
      acceptanceCriteria: 'All levels within specified tolerance of design; as-built survey recorded and submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.09.'
    },
    {
      description: 'Protect completed formation from damage and moisture ingress',
      acceptanceCriteria: 'Formation sealed or covered within 24 hours of acceptance where possible; no trafficking by unauthorized plant; drainage maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Section 204.15.'
    },
    {
      description: 'Compile and submit compaction test records for all lots',
      acceptanceCriteria: 'Complete set of density ratio test results for every lot; characteristic values calculated; all lots meeting specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.14, RC 500.05.'
    },
    {
      description: 'Submit as-built drawings showing final subgrade levels and any variations',
      acceptanceCriteria: 'As-built drawings showing actual levels vs design; any soft spot treatments documented; material sources recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.03.'
    },
    {
      description: 'Submit material source compliance records',
      acceptanceCriteria: 'All fill material sources documented with classification test results; traceability maintained throughout works',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.05.'
    },
    {
      description: 'Submit proof rolling records and formation release documentation',
      acceptanceCriteria: 'Signed proof rolling records for all areas; formation release certificates from Superintendent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Section 204.12. Hold point release records.'
    },

    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Superintendent',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Superintendent. All earthworks acceptance criteria verified per Section 204 and RC 500.05.'
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Earthworks')
  console.log(' Based on: VicRoads Section 204 Earthworks, Section 201 Site Clearing')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicEarthworksTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('To use this template:')
    console.log('1. Create a project with specificationSet = "VicRoads"')
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
