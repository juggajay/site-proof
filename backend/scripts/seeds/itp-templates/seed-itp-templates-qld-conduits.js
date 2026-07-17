/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Conduits
 *
 * Creates global ITP templates for QLD conduit and pit activities.
 * Templates: Conduits and Pits (MRTS91)
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-qld-conduits.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// 1. QLD CONDUITS AND PITS (TMR MRTS91)
// =============================================================================

const qldConduitsAndPitsTemplate = {
  name: 'Conduits and Pits (QLD MRTS91)',
  description: 'TMR supply, installation and testing of pits, conduits and draw ropes for traffic signals, road lighting, ITS and communications per MRTS91 (March 2025). Sequential trench -> conduit -> pit hold structure. Per Cl 5.1 every hold/witness release additionally requires current electrical contractor training/audit evidence.',
  activityType: 'conduit_trenching',
  specificationReference: 'MRTS91',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // SUBMISSIONS & MATERIAL COMPLIANCE
    // =========================================================================
    {
      description: 'Milestone: Submit construction procedures for installation of conduits and pits, with electrical contractor training/audit evidence, 14 days prior to commencement',
      acceptanceCriteria: 'Construction procedures and Cl 5.1 electrical contractor training/audit evidence submitted at least 14 days before installation commences',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Milestone - Clause 5.3 MRTS91. Construction procedures due 14 days prior; include Cl 5.1 training/audit evidence.'
    },
    {
      description: 'Obtain release of Construction Procedures before installation',
      acceptanceCriteria: 'Construction Procedures released after expiry of the 14-day period once Administrator considers the evidence and procedure submitted. Note: under Cl 5.1, every hold/witness point release additionally requires current electrical contractor training/audit evidence',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP1 - Clause 5.3 MRTS91. Construction Procedures held. Cl 5.1 supplementary release condition (electrical contractor training/audit evidence) applies to this and every hold/witness release.'
    },
    {
      description: 'Assess asbestos presence before disturbing ACM ducting',
      acceptanceCriteria: 'Asbestos presence assessed; Principal decides and instructs on work to be carried out. Flagged where excavation would leave less than 300 mm residual cover to ACM ducting',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP2 - Clause 6.1 MRTS91. Asbestos presence assessment held; Principal instructs on ACM ducting work.'
    },
    {
      description: 'Obtain acceptance of Material Compliance / Batch Certificate of Compliance before materials incorporated',
      acceptanceCriteria: 'Material Compliance Certificate and Batch Certificate of Compliance for pit products and conduits accepted before incorporation; access covers assessed to MRTS91/MRTS78 (TN63)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Batch Certificate of Compliance / TN63 assessment',
      notes: 'HP3 - Clause 7.1 MRTS91. Material Compliance Certificate held before materials incorporated.'
    },

    // =========================================================================
    // EXCAVATION & TRENCH
    // =========================================================================
    {
      description: 'Milestone: Notify set out of underground conduits and pits at least 48 hours prior',
      acceptanceCriteria: 'Set out of underground conduits and pits notified at least 48 hours before excavation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Milestone - Clause 8.1 MRTS91. Set out notified at least 48 hours prior.'
    },
    {
      description: 'Obtain inspection/release of excavation set out before excavating for conduits and pits',
      acceptanceCriteria: 'Representative of the Principal inspects the set out (48 hr notice) and releases excavation for underground conduits and pits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP4 - Clause 8.1 MRTS91. Excavation for underground conduits and pits held pending set out inspection (48 hr notice).'
    },
    {
      description: 'Administrator to inspect bottom of trench',
      acceptanceCriteria: 'Bottom of trench inspected and satisfactory before bedding',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP1 - Clause 8 MRTS91. Bottom of trench witnessed.'
    },
    {
      description: 'Verify trench depth',
      acceptanceCriteria: 'Trench depth verified sufficient to maintain minimum cover to conduits per SD1149',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP2 - Clause 8 MRTS91. Trench depth witnessed.'
    },

    // =========================================================================
    // CONDUIT INSTALLATION
    // =========================================================================
    {
      description: 'Demonstrate boring and/or jacking method and casing acceptable to Administrator',
      acceptanceCriteria: 'Proposed boring/jacking method and casing demonstrated acceptable before boring or jacking of conduits',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP5 - Clause 8.4 / 8.7 MRTS91. Boring and/or jacking of conduits held until method/casing accepted.'
    },
    {
      description: 'Administrator to inspect conduits within structure or barrier',
      acceptanceCriteria: 'Conduits within structure or barrier inspected; barrier-void 150 mm conduit conforms to Table 4.1 column PN 12; conduit min 10 mm above FSL of barrier void',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP3 - Clause 8 MRTS91. Conduits within structure or barrier witnessed; barrier-void conduit PN 12 minimum.'
    },
    {
      description: 'Maintain minimum cover to conduits per Standard Drawing SD1149',
      acceptanceCriteria: 'Minimum cover to conduits per SD1149 maintained at all times, including reduced-cover cases',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 8 MRTS91. Minimum cover to conduits per SD1149.'
    },
    {
      description: 'Obtain inspection and audit of conduit installation',
      acceptanceCriteria: 'Principal carries out inspection and auditing of installed conduit; installation released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP6 - Clause 8.9 / 9.1 MRTS91. Installation of conduits held pending inspection and audit.'
    },
    {
      description: 'Install draw rope in each conduit run',
      acceptanceCriteria: 'Draw rope installed in each conduit run, extending minimum 500 mm above finished level; any rope joint does not appreciably increase rope diameter',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Draw rope pull-through / proving',
      notes: 'WP4 - Clause 8 MRTS91. Draw rope installation witnessed; minimum 500 mm tail above finished level.'
    },

    // =========================================================================
    // PITS
    // =========================================================================
    {
      description: 'Administrator to inspect bedding of pits',
      acceptanceCriteria: 'Bedding of pits inspected; conduit entry to pits no lower than 1200 mm depth, preferably at minimum depth of cover',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP5 - Clause 8 MRTS91. Bedding of pits witnessed; conduit entry no lower than 1200 mm depth.'
    },
    {
      description: 'Install marker tape of the correct colour',
      acceptanceCriteria: 'Marker tape correct colour installed: orange = low-voltage electrical wiring, white = communications systems',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 10 MRTS91. Marker tape colours: orange LV electrical / white communications.'
    },
    {
      description: 'Vermin proof conduits before any cabling',
      acceptanceCriteria: 'Vermin proofing of conduits carried out as specified before any cabling (unless an approved sealing system is used)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP7 - Clause 9.13 / 10.4 MRTS91. Vermin proofing of conduits held; done before cabling.'
    },
    {
      description: 'Verify pit drainage',
      acceptanceCriteria: 'Pit drainage verified functional; barrier voids free draining',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP6 - Clause 9 MRTS91. Pit drainage witnessed.'
    },
    {
      description: 'Verify access cover / grate load class and slip resistance',
      acceptanceCriteria: 'Access covers and grates load class per AS 3996 (class per drawing, e.g. SD1149); pedestrian cover slip resistance classification per AS 4586',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 3996 (load class), AS 4586 (slip resistance)',
      notes: 'Clause 7 MRTS91. Access cover / grate load class AS 3996; pedestrian cover slip resistance AS 4586.'
    },

    // =========================================================================
    // BACKFILL & COMPLETION
    // =========================================================================
    {
      description: 'Compact and test backfill per MRTS04',
      acceptanceCriteria: 'Backfill compacted and tested to the compaction standard of MRTS04 General Earthworks (relevant Q-method), per lot/layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Per MRTS04 General Earthworks (relevant Q-method)',
      notes: 'Clause 10 MRTS91. Backfill compaction per MRTS04.'
    },
    {
      description: 'Obtain inspection/release of trench backfilling',
      acceptanceCriteria: 'Backfilling inspected and all requirements met before release',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP8 - Clause 10.9 / 10.11 / 13.1 MRTS91. Backfilling of trenches held pending inspection.'
    },
    {
      description: 'Clear all pits of debris before Practical Completion',
      acceptanceCriteria: 'All pits cleared of debris before Practical Completion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13 MRTS91. All pits cleared of debris before Practical Completion.'
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Conduits')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldConduitsAndPitsTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (1 conduits template)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

withItpTemplateSeedLock(prisma, main)
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
