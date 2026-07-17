/**
 * Seed Script: VIC (VicRoads) ITP Templates - Conduits
 *
 * Creates global ITP templates for VIC conduit and pit activities.
 * Templates: Conduits and Pits for Underground Wiring (Sec 733)
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-vic-conduits.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// VIC CONDUITS AND PITS FOR UNDERGROUND WIRING (VicRoads Sec 733)
// VicRoads Section 733 - current DTP edition June 2025.
// The current edition ADDED 4 hold points vs the withdrawn 2008 edition
// (boring proposal, grout inspection, bedding inspection, pit-collar inspection).
// =============================================================================

const vicConduitsAndPitsTemplate = {
  name: 'Conduits and Pits for Underground Wiring (VIC Sec 733)',
  description: 'VIC VicRoads/DTP supply and installation of conduits and pits for underground electrical wiring and communications cabling per Section 733 (current DTP edition June 2025). The current edition introduces four inspection hold points (boring proposal, bore-grout inspection, bedding inspection, pit-collar inspection) absent from the withdrawn 2008 edition, and adds HDPE continuous conduit, recycled crushed glass sand bedding (ATS 3050 Type A), and the TCN 010 shallow-cover exemption. Electrical work must be by or under a pre-qualified registered electrical contractor. Read with DTP TC-series Standard Drawings.',
  activityType: 'conduit_trenching',
  specificationReference: 'Sec 733',
  stateSpec: 'VicRoads',
  checklistItems: [
    // =========================================================================
    // PRE-QUALIFICATION
    // =========================================================================
    {
      description: 'Confirm contractor pre-qualification for electrical / communications work',
      acceptanceCriteria: 'Electrical work performed by or under direct supervision of a pre-qualified and registered electrical contractor; pre-qualification category correct per Table 733.021 (STS1 for signals, STCE for on-road, SCTV + ACMA for carrier communications)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 733.02. Pre-qualification (STS1 / STCE / SCTV) verified before works commence.'
    },

    // =========================================================================
    // BORING UNDER CARRIAGEWAY
    // =========================================================================
    {
      description: 'Submit boring-under-carriageway proposal at least two weeks prior',
      acceptanceCriteria: 'Detailed proposals for boring under carriageways submitted to the Superintendent for review two weeks prior to programmed commencement; under-carriageway conduits installed by boring only (no water jetting)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HP - Clause 733.05. Boring proposal submitted 2 weeks prior; no water jetting permitted.'
    },
    {
      description: 'Inspect bore annulus pressure grouting before backfilling access excavation',
      acceptanceCriteria: 'Before backfilling the bore access excavation, the pressure grouting is inspected by the Superintendent or representative; grout ends sealed watertight',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP - Clause 733.05. Bore grouting inspected before backfill of access excavation.'
    },
    {
      description: 'Verify bore annulus grout properties',
      acceptanceCriteria: 'Grout flow cone time <= 30 s; 28-day compressive strength 0.5-2.0 MPa; thermal resistivity < 1.2 K.m/W (dry); heat of hydration <= 35 deg C; minimum 1 sample per 50 m3 per day at discharge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1478.2 (flow cone + compressive strength)',
      notes: 'Clause 733.05. Grout sampled at >= 1 per 50 m3/day at discharge.'
    },

    // =========================================================================
    // CONDUIT INSTALLATION
    // =========================================================================
    {
      description: 'Verify conduit type, colour, and size',
      acceptanceCriteria: 'Conduit type and colour correct (orange heavy-duty UPVC for electrical, white for communications, HDPE continuous conduit for bores); sizes per Table 733.041; one size and type per run',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 733.04. Orange = electrical, white = communications, HDPE for bores. One size/type per run.'
    },
    {
      description: 'Verify conduit depth of cover',
      acceptanceCriteria: 'Depth of cover meets Table 733.051 (freeway/arterial 1200 mm; local road 600 mm; comms/ELV footpath 300 mm; rail crossing 2000 mm); any reduction only with written TCN 010 approval plus shallow-conduit warning sign TC-1217',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 733.05. Cover per Table 733.051; reduced cover only per TCN 010 + TC-1217 sign.'
    },
    {
      description: 'Install marker tape at 50% depth over conduits',
      acceptanceCriteria: 'Marker tape installed at 50% of trench depth above conduits; trace wire installed on managed motorways',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 733.08. Marker tape at 50% depth; trace wire on managed motorways.'
    },
    {
      description: 'Install draw cords and verify bend radii',
      acceptanceCriteria: 'Draw cord (>= 3 mm, >= 1.6 kN) installed in every conduit; minimum bend radius HD UPVC electrical 600 mm, communications 500 mm; elbows and tees prohibited; direction changes only at pits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 733.06/733.08. Draw cord in every conduit; no elbows/tees; direction change only at pits.'
    },

    // =========================================================================
    // BEDDING & BACKFILL
    // =========================================================================
    {
      description: 'Inspect bedding and conduits before proceeding',
      acceptanceCriteria: 'Once the bedding material has been laid and the conduits put in place, works do not proceed prior to inspection by the Superintendent or representative',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP - Clause 733.08(b). Bedding and conduits inspected before proceeding.'
    },
    {
      description: 'Verify bedding dimensions and bedding/backfill grading',
      acceptanceCriteria: 'Bedding >= 80 mm (earth) or 200 mm (rock) with +150 mm cover over conduit; bedding/backfill grading per Table 733.081 (bedding PI <= 10, selected backfill PI <= 20); recycled crushed glass sand bedding permitted only if compliant with ATS 3050 Type A',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grading + PI (Table 733.081)',
      notes: 'Clause 733.08. Bedding >= 80 mm earth / 200 mm rock + 150 mm cover; glass sand per ATS 3050 Type A.'
    },
    {
      description: 'Compact and test backfill',
      acceptanceCriteria: 'Bedding/backfill (< 37.5 mm) density ratio >= 95% (standard compaction), moisture 85-115% OMC; pavement material where specified >= 98% (modified compaction, 3 tests per lot per Section 173)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Standard / modified compaction (Section 173)',
      notes: 'Clause 733.08. Bedding/backfill >= 95%; pavement material >= 98% modified.'
    },

    // =========================================================================
    // PITS
    // =========================================================================
    {
      description: 'Verify cable pit type, location, and capacity',
      acceptanceCriteria: 'Pits Type-Approved; not located in trafficable area of freeway or managed motorway; maximum pit spacing 100 m; number of conduits per pit not exceeding Table 733.095',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Clause 733.09. Type-Approved pits; max spacing 100 m; conduit count <= Table 733.095.'
    },
    {
      description: 'Inspect pit lid surround / pre-formed collar before concreting',
      acceptanceCriteria: 'Before the pit lid surround or pre-formed collar is concreted into position, an inspection by the Superintendent or representative is carried out',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HP - Clause 733.09(c). Pit lid surround / collar inspected before concreting.'
    },
    {
      description: 'Install detector pits and reinstate site',
      acceptanceCriteria: 'Detector pits installed per TC-1310 / TC-1320; site cleaned on completion; disturbed surfaces reinstated equal to or better than original',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 733.10. Detector pits per TC-1310/1320; surfaces reinstated equal-or-better.'
    },

    // =========================================================================
    // DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit as-built records and electrical safety certificates',
      acceptanceCriteria: 'As-built drawings provided (Microstation/PDF, showing depths, dated); electrical safety certificates provided for completed installation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 733.11. As-built drawings (depths, dated) + electrical safety certificates.'
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
  console.log(' VIC (VicRoads) ITP Template Seeder - Conduits')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(vicConduitsAndPitsTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (1 conduits template)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

withItpTemplateSeedLock(prisma, main)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
