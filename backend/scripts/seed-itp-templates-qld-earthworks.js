/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Earthworks
 *
 * Creates global ITP templates for QLD based on TMR MRTS specifications.
 * These templates have projectId = null and stateSpec = 'MRTS' so they
 * appear for any project using TMR/MRTS specification set.
 *
 * Based on: MRTS04 General Earthworks (March 2025)
 * Verified against: TMR MRTS04 specification clauses, TN216 (Nov 2025)
 *
 * Run with: node scripts/seed-itp-templates-qld-earthworks.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// QLD EARTHWORKS TEMPLATE (MRTS04)
// Based on: TMR MRTS04 General Earthworks (March 2025)
// =============================================================================

const qldEarthworksTemplate = {
  name: 'Earthworks',
  description: 'TMR General Earthworks including clearing, excavation, fill placement, compaction, subgrade preparation, and backfill to structures per MRTS04 (March 2025). Covers embankment construction, cut operations, acid sulfate soil management, amelioration of dispersive soils, and pavement subgrade works.',
  activityType: 'earthworks',
  specificationReference: 'MRTS04',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK / SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit Earthworks Construction Procedures for acceptance',
      acceptanceCriteria: 'Procedures accepted by Administrator prior to commencement of any earthworks',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 5.2 - No earthworks to commence until Contractor procedures are submitted and accepted. Includes plant, methods, layer thickness, moisture control, and compaction approach.'
    },

    // =========================================================================
    // CLEARING & GRUBBING
    // =========================================================================
    {
      description: 'Mark and protect trees and shrubs to remain undisturbed',
      acceptanceCriteria: 'All trees/shrubs designated to remain are clearly marked and protection measures in place',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7.2.2 - Trees and shrubs to remain must be identified, marked, and protected before any clearing commences.'
    },
    {
      description: 'Obtain Administrator marking of trees required for removal before felling',
      acceptanceCriteria: 'Administrator has marked all trees approved for removal; only marked trees to be felled',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7.2.3 - Felling only to proceed after Administrator marks the required trees for removal.'
    },
    {
      description: 'Strip and stockpile topsoil from work area',
      acceptanceCriteria: 'Topsoil stripped to specified depth, stockpiled at approved locations and protected from contamination',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 7 - Spot check depth every 100m or at change of material to ensure full removal of topsoil.'
    },

    // =========================================================================
    // UNSUITABLE MATERIAL & SOIL TREATMENT
    // =========================================================================
    {
      description: 'Identify and treat or remove unsuitable material as directed',
      acceptanceCriteria: 'All unsuitable material (overly wet, weak, organic) treated or removed per Administrator direction',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 9.4 - Stop work until unsuitable material is treated or removed as directed by the Administrator.'
    },
    {
      description: 'Complete acid sulfate soil field testing in high-risk areas',
      acceptanceCriteria: 'Field tests confirm no acid sulfate soil issues, or appropriate treatment plan approved by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Clause 10.1.4 - Do not proceed in high-risk soils until field tests confirm no ASS issues or treatment plans are approved.'
    },

    // =========================================================================
    // CUT OPERATIONS
    // =========================================================================
    {
      description: 'Obtain approval for cut surface treatment on excavated cut faces',
      acceptanceCriteria: 'Proposed surface treatment (sealing, amelioration, or other) approved by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 10.2.3 - Hold on excavated cut faces until proposed surface treatment is approved.'
    },

    // =========================================================================
    // FILL AMELIORATION
    // =========================================================================
    {
      description: 'Submit soil amelioration plan for dispersive or acid soils and obtain approval',
      acceptanceCriteria: 'Amelioration plan (lime/gypsum treatment for dispersive or acid soils) approved by Administrator before incorporation of site-won fill',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 10.2.4.1 - Do not incorporate site-won fill until soil amelioration plan is approved.'
    },
    {
      description: 'Verify application rate of ameliorants on cut/fill surfaces',
      acceptanceCriteria: 'Spreading rates confirmed correct via field spread rate test; uniform application achieved',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q719',
      notes: 'Clause 10.2.4.3 - Contractor to verify spreading rates of ameliorants via field spread rate test Q719. Notify Administrator prior to spreading (daily).'
    },
    {
      description: 'Inspect batter slope amelioration (lime application on cut/fill batters)',
      acceptanceCriteria: 'Ameliorant applied uniformly on cut/fill batters for erosion control per specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 16.1 - Administrator may inspect application of ameliorant (e.g. lime) on batters. Notify prior to covering.'
    },

    // =========================================================================
    // MATERIAL TESTING & CLASSIFICATION
    // =========================================================================
    {
      description: 'Classify fill material - particle size distribution',
      acceptanceCriteria: 'Material grading within specified envelope for designated fill zone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.3.6.1',
      notes: 'Particle size distribution for fill classification. Test at source per frequency requirements.'
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
      description: 'Determine Weighted Plasticity Index of fill material',
      acceptanceCriteria: 'WPI within acceptable limits per Annexure MRTS04.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q252',
      notes: 'Combined PI and fines calculation for fill quality assessment.'
    },
    {
      description: 'Perform dispersion test on fill material (Emerson Class)',
      acceptanceCriteria: 'Emerson Class rating acceptable; dispersive soils identified and amelioration plan initiated if required',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q168',
      notes: 'Dispersion testing for fill material - identify dispersive soils requiring treatment.'
    },
    {
      description: 'Perform soaked CBR test on fill/subgrade material',
      acceptanceCriteria: 'Soaked CBR meets or exceeds design value; swell does not exceed 2% (4-day soak)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.6.1.1',
      notes: 'At source - at least 1 soaked CBR per material type prior to placement. Lot with CBR < 0.8x design or high swell is rejected.'
    },

    // =========================================================================
    // FOUNDATION INSPECTION (STRUCTURES)
    // =========================================================================
    {
      description: 'Present culvert or structure foundation for inspection and acceptance',
      acceptanceCriteria: 'Excavation inspected by Administrator; foundation adequacy accepted. 3 days notice required.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13.3.4.1 - No culvert or structure foundation to be covered until Administrator inspects and accepts foundation adequacy. Provide 3 business days notice.'
    },
    {
      description: 'Witness prepared foundation surface before placing structural fill',
      acceptanceCriteria: 'Foundation surface is suitable for structural fill placement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 13.3.4.1 - Administrator to witness prepared foundation surface. Coordinated with Hold Point for foundation inspection. 3 days notice.'
    },

    // =========================================================================
    // PLACEMENT & COMPACTION
    // =========================================================================
    {
      description: 'Verify layer thickness before compaction',
      acceptanceCriteria: 'Loose lift thickness within specified maximum for material type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Check each lot. Layer thickness must be appropriate for compaction equipment and material type.'
    },
    {
      description: 'Verify moisture content of fill material during compaction',
      acceptanceCriteria: 'Moisture within specified range: OMC +0% to +3% for clay fills per Annexure MRTS04.1; no compaction if material above plastic limit',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.2.1.1 / AS 1289.5.8.1',
      notes: '1 test per 500m2 of layer. Oven drying or nuclear gauge method. For coarse material (20-40% >37.5mm), use moisture ratio test TMR Q250.'
    },
    {
      description: 'Perform field density testing on compacted fill layers',
      acceptanceCriteria: 'General fill: minimum 95% Standard Proctor MDD. Subgrade zone (top 300mm): minimum 97% Standard MDD. Cohesionless material: minimum 70% relative density (Density Index).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1',
      notes: 'At least 1 test per 500m2 per layer (min 1 per Lot). Small areas: min 2 locations. Increased frequency (1/250m2) for structural areas (bridge approach).'
    },
    {
      description: 'Perform density index testing on cohesionless (sandy) fill material',
      acceptanceCriteria: 'Minimum 70% relative density (Density Index)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.6.1',
      notes: 'Used in lieu of MDD for cohesionless (sandy) materials. Same frequency as standard density testing.'
    },
    {
      description: 'Proof roll compacted fill layers',
      acceptanceCriteria: 'No visible deformation, rutting, or pumping under loaded 8t axle during proof rolling',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q723',
      notes: 'Clause 15.3 - Proof roll each fill layer (e.g. 50m test section). Administrator witnesses to check for deflection or instability. Any yielding areas must be reworked. Continuous 100% observation during initial subgrade proof rolling.'
    },
    {
      description: 'Witness density testing of compacted layers',
      acceptanceCriteria: 'Field density tests (nuclear gauge) performed correctly; results comply with specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1289.5.4.1',
      notes: 'Clause 15.3 - Administrator may audit density testing. Concurrent with testing operations.'
    },
    {
      description: 'Witness mechanical interlock rolling for cohesionless material',
      acceptanceCriteria: 'Heavy rock interlock rolling technique achieves adequate compaction of cohesionless material',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Clause 15.4 - If using heavy rock interlock methods for cohesionless material, notify Administrator to witness rolling technique prior to operation.'
    },

    // =========================================================================
    // SUBGRADE PREPARATION
    // =========================================================================
    {
      description: 'Submit or nominate stabilised subgrade mix design for approval (if subgrade is to be stabilised)',
      acceptanceCriteria: 'Mix design approved by Administrator prior to placement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Clause 18.2.5.4 - If subgrade is to be stabilised, Contractor must submit mix design for approval prior to placement.'
    },
    {
      description: 'Verify subgrade compaction - no visible movement under proof roll',
      acceptanceCriteria: 'No visible vertical movement or soft spots detected under proof roll',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TMR Q723',
      notes: 'Clause 18.3.2 - After compaction of subgrade, Contractor to demonstrate no visible vertical movement under proof roll. Administrator to witness. Soft spots must be reworked.'
    },

    // =========================================================================
    // BACKFILL TO STRUCTURES
    // =========================================================================
    {
      description: 'Inspect backfill material and compaction compliance around structures/culverts',
      acceptanceCriteria: 'Backfill material meets specification; compaction compliant before continuation to next stage',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Clause 19.3.1 - For backfill around structures/culverts, notify Administrator to inspect material and compaction compliance before continuation. Notify before next stage.'
    },

    // =========================================================================
    // EXISTING SUBGRADE INVESTIGATION
    // =========================================================================
    {
      description: 'Sample existing in-situ subgrade for laboratory testing as directed',
      acceptanceCriteria: 'Subgrade sampled at directed locations; samples sent to NATA-accredited laboratory',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Appendix B.4 - Contractor to sample in-situ subgrade as directed for lab testing. Administrator may witness sampling process. As directed (on request).'
    },

    // =========================================================================
    // GEOMETRIC VERIFICATION
    // =========================================================================
    {
      description: 'Survey finished subgrade levels',
      acceptanceCriteria: 'Subgrade level within +/-25mm of design elevation for any point, +/-10mm on average',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: '100% check of subgrade design levels by survey. Typically 10m grid for mainline, tighter for crossfalls and transitions. Elevation records for each Lot.'
    },
    {
      description: 'Verify embankment width compliance',
      acceptanceCriteria: 'Width tolerance: -0mm to +250mm (no under-run permitted)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification of embankment width at specified intervals.'
    },
    {
      description: 'Check surface regularity with 3m straightedge',
      acceptanceCriteria: 'Gap under 3m straightedge must not exceed 25mm; no abrupt surface irregularities',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Subgrade surface must have no abrupt irregularities.'
    },
    {
      description: 'Verify batter slopes and alignment',
      acceptanceCriteria: 'Batter slopes within design tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification of batter slopes and alignment compliance.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation pack',
      acceptanceCriteria: 'All test results, survey data, photos, density records, proof roll records, and inspection records complete for lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Required for lot sign-off. Include field density results, moisture content, CBR, survey levels, proof roll records, and amelioration records where applicable.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Administrator/Superintendent. All earthworks acceptance criteria verified.'
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Earthworks')
  console.log(' Based on: MRTS04 General Earthworks (March 2025)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(qldEarthworksTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('To use this template:')
    console.log('1. Create a project with specificationSet = "TMR (QLD)" or "MRTS"')
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
