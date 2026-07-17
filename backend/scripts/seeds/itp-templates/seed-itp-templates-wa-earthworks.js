/**
 * Seed Script: WA (Main Roads WA) ITP Templates - Earthworks
 *
 * Creates the global ITP template for Main Roads Western Australia (MRWA)
 * earthworks, derived from Specification 302 EARTHWORKS (edition 04/10099-03,
 * issued 28/06/2024). This is part of the FIRST set of MRWA (WA) ITP templates.
 *
 * All checklist content is derived directly from MRWA Spec 302; clause
 * references in item text/notes cite the Spec 302 clause that supports the item.
 * WA test methods (WA 133.1, WA 115.1, WA 141.1, etc.) and WA terminology
 * (Characteristic Dry Density Ratio Rc, dryback, Perth Sands vs Other Materials)
 * are used verbatim - never substituted with AS/Austroads equivalents.
 *
 * Templates:
 *   1. Earthworks (MRWA Spec 302) - activityType earthworks_general
 *
 * Run with: npm run seed:itp -- --script=seed-itp-templates-wa-earthworks.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE: EARTHWORKS (MRWA Spec 302)
// Embankment foundation, embankment construction, subgrade preparation.
// Compaction assessed as Characteristic Dry Density Ratio (Rc) per Spec 201.
// Hold points: 302.22 seal cutting, 302.23 rock excavation measurement,
// blasting shot-firer notice, 302.41.5 foundation, 302.51 embankment start,
// 302.55.8 rock-fill geotextile. Witness: 302.65 subgrade shape, 302.64/66 level.
// =============================================================================

const waEarthworksTemplate = {
  name: 'Earthworks (MRWA Spec 302)',
  description: 'Main Roads WA earthworks per Specification 302 (edition 04/10099-03, 28/06/2024). Covers topsoil stripping and digital ground survey, excavation to subgrade, embankment foundation preparation, layered embankment construction, rock fill, and subgrade preparation and dryback. Compaction is assessed as the Characteristic Dry Density Ratio (Rc) per Spec 201, distinguishing Perth Sands from Other Materials for moisture windows and target densities.',
  activityType: 'earthworks_general',
  specificationReference: 'MRWA Spec 302',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD: existing seal marked out and Superintendent notified before any cutting of the existing seal (MRWA Spec 302.22)',
      acceptanceCriteria: 'Prior to any cutting of the existing seal, the Contractor marks out the area and notifies the Superintendent; cutting of the existing seal must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302.22 HOLD. Applies where an existing pavement/seal is cut for the works.'
    },
    {
      description: 'Topsoil stripped and stockpiled; digital ground survey completed before earthworks volume/area calculation (MRWA Spec 302.11, 302.16)',
      acceptanceCriteria: 'Topsoil removed per 302.11 and vegetation cleared (per Spec 301); a digital ground survey (302.16) is completed to establish the earthworks surface before excavation volumes and areas are calculated.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302.11 (topsoil), 302.16 (digital ground survey).'
    },
    {
      description: 'HOLD: rock excavation in table drains defined and measured with the Superintendent before over-break (MRWA Spec 302.23)',
      acceptanceCriteria: 'Rock excavation in drains is defined and measured before removal so that rock quantities in table drains are agreed; the measurement is a Hold Point held for the Superintendent.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 302.23 HOLD on measurement of rock in table drains. Conditional - applies where rock excavation occurs.'
    },
    {
      description: 'HOLD: replacement shot-firer notified at least three days prior to any blasting works (MRWA Spec 302 blasting)',
      acceptanceCriteria: 'A replacement shot-firer is notified at least three days prior to any blasting works; blasting must not proceed until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302 blasting HOLD, 3 days notice. Conditional - applies where blasting is used.'
    },
    {
      description: 'Imported fill certified dieback-free; PSD, CBR, linear shrinkage and organics conform to Tables 302B.01/302B.02 (MRWA Spec 302)',
      acceptanceCriteria: 'Imported material is certified free of dieback and conforms to Table 302B.01 grading (37.5 mm 80-100%, 2.36 mm 30-100%, 0.075 mm <10% passing) and Table 302B.02 limits (CBR min 12% via WA 141.1, swell max 1.5%, linear shrinkage max 1% via WA 123.1, organic matter max 1%). Particle size via WA 115.1/WA 115.2.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 115.1/115.2 (PSD), WA 141.1 (CBR), WA 123.1 (linear shrinkage)',
      notes: 'MRWA Spec 302, Tables 302B.01/302B.02. Applies to imported fill.'
    },
    {
      description: 'OMC/MDD relationship established via WA 133.1 (Perth Sand) or WA 133.2 (Other Materials) as the compaction basis (MRWA Spec 302)',
      acceptanceCriteria: 'The dry density / moisture (modified) relationship is established using WA 133.1 for Perth Sand or WA 133.2 for Other Materials, providing the OMC/MDD basis for compaction and dryback acceptance per Spec 201.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 133.1 (Perth Sand) / WA 133.2 (Other Materials)',
      notes: 'MRWA Spec 302, Spec 201 QA. WA methods only - do not substitute AS 1289 equivalents.'
    },
    {
      description: 'HOLD: embankment foundation levelled and compacted before any embankment material is placed over it (MRWA Spec 302.41.5)',
      acceptanceCriteria: 'No embankment materials are placed until the embankment foundation has been levelled as specified in the Embankment Foundation Section and compacted; this Hold Point must be released before overlying fill is placed.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302.41.5 HOLD.'
    },
    {
      description: 'Embankment foundation compacted to Rc >= 90% (Perth Sands) / 88% (Other), moisture 70-110% (Perth Sands) / 90-110% (Other) of OMC, over a 150 mm depth (MRWA Spec 302, Tables 302B.02/302B.03)',
      acceptanceCriteria: 'Embankment foundation and construction achieve a Characteristic Dry Density Ratio (Rc) of at least 90% for Perth Sands and 88% for Other Materials (Table 302B.03), with construction moisture 70-110% of OMC for Perth Sands and 90-110% for Other Materials; foundation compaction depth 150 mm (302B.2).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (per Spec 201)',
      notes: 'MRWA Spec 302, Table 302B.03. Rc per Spec 201 Annexure; Project Manager may vary to suit local conditions.'
    },
    {
      description: 'HOLD: Contractor certifies the embankment foundation conforms before embankment construction starts (MRWA Spec 302.51)',
      acceptanceCriteria: 'Prior to embankment construction, the Contractor certifies to the Superintendent that the embankment foundation conforms; embankment construction must not start until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302.51 HOLD.'
    },
    {
      description: 'Embankment placed in layers (cohesive 100-300 mm / sand 100-450 mm compacted), no abrupt material change (MRWA Spec 302.51)',
      acceptanceCriteria: 'Embankment is placed in layers of compacted thickness 100-300 mm for cohesive material and 100-450 mm for sand, without abrupt changes in material type between layers.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 302.51.'
    },
    {
      description: 'Each embankment layer compacted to the target Rc and conforming before the next layer is placed (MRWA Spec 302, Table 302B.03)',
      acceptanceCriteria: 'Each embankment construction layer achieves the target Characteristic Dry Density Ratio (Rc >= 90% Perth Sands / 88% Other) at 70-110% / 90-110% OMC and is confirmed conforming before the overlying layer is placed.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (per Spec 201)',
      notes: 'MRWA Spec 302, Table 302B.03.'
    },
    {
      description: 'HOLD: geotextile fabric (G robustness > 3000, non-woven) certified on NATA-endorsed documents before use in rock fill (MRWA Spec 302.55.8)',
      acceptanceCriteria: 'Where geotextile-fabric separation is used between fill and rock fill, product certificates (G robustness > 3000, non-woven) on NATA-endorsed documents are submitted before use; this Hold Point must be released before the geotextile is used.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 302.55.8 HOLD (added this revision). Conditional - applies where rock fill with geotextile separation is used. Rock fill: max dimension 1000 mm, layer <= 1000 mm, min 5 passes vibratory roller, >= 300 L water/m3, not within 2 m of subgrade surface.'
    },
    {
      description: 'Subgrade compacted to Rc >= 95% (Perth Sands) / 90% (Other) and dried/watered to spec moisture (MRWA Spec 302.61-302.66, Table 302B.03)',
      acceptanceCriteria: 'Subgrade preparation achieves a Characteristic Dry Density Ratio (Rc) of at least 95% for Perth Sands and 90% for Other Materials (higher tier 96%/92% where specified), dried back or watered to the specified moisture.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (per Spec 201)',
      notes: 'MRWA Spec 302.61-302.66, Table 302B.03.'
    },
    {
      description: 'WITNESS: subgrade surface shape max deviation <= 15 mm under a 3 m straightedge (MRWA Spec 302.65)',
      acceptanceCriteria: 'The finished subgrade surface deviates no more than 15 mm from a 3 m straightedge (302.65).',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Straightedge (3 m)',
      notes: 'MRWA Spec 302.65 surface shape tolerance.'
    },
    {
      description: 'WITNESS: subgrade surface level within -35 mm / +5 mm and width within +100 mm / -0 mm of design (MRWA Spec 302.64, 302.66)',
      acceptanceCriteria: 'Subgrade surface level is within -35 mm and +5 mm of design level (302.66); the outer top edge is no closer to the centreline and no more than 100 mm further out than the drawings (302.64); widening crossfall within 0.5% of the existing/design crossfall.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey (level and width)',
      notes: 'MRWA Spec 302.64 (width), 302.66 (level).'
    },
    {
      description: 'Batter slopes within 150 mm normal to the specified slope (MRWA Spec 302B.4)',
      acceptanceCriteria: 'Batter slopes are within 150 mm measured normal to the specified slope (Table 302B.4).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 302B.4 batter tolerance.'
    },
    {
      description: 'Subgrade maintained in conforming condition until pavement construction starts (MRWA Spec 302.61)',
      acceptanceCriteria: 'The completed subgrade is maintained in a conforming (shape, level and moisture) condition until pavement construction commences.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 302.61.'
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
      stateSpec: 'MRWA',
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
    include: {
      checklistItems: true
    }
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
  console.log(' WA (Main Roads WA) ITP Template Seeder - Earthworks (Spec 302)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(waEarthworksTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (1 earthworks template)')
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
