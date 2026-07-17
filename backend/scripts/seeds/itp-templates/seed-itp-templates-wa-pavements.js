/**
 * Seed Script: WA (Main Roads WA) ITP Templates - Pavements
 *
 * Creates the global ITP template for Main Roads Western Australia (MRWA)
 * crushed rock base pavement, derived from Specification 501 PAVEMENTS
 * (edition 04/10110-05, issued 10/05/2023). Part of the FIRST MRWA (WA) set.
 *
 * All checklist content is derived directly from MRWA Spec 501; clause
 * references cite the Spec 501 clause that supports the item. WA terminology
 * is used verbatim: CRB (Crushed Rock Base), Characteristic Dry Density Ratio
 * (Rc), and dryback (Dryback Characteristic Moisture Content DMc as a proportion
 * of OMC). WA test methods (WA 115.1, WA 120.2, WA 123.1, WA 133.1/133.2,
 * WA 313.2, etc.) are used exactly - never substituted with AS/Austroads.
 *
 * Templates:
 *   1. Crushed Rock Base Pavement (MRWA Spec 501) - activityType pavement_unbound
 *
 * The six Spec 501 hold points are encoded; several are conditional (CRC and
 * HCTCRB are alternative pavement materials to CRB and their holds apply only
 * when those materials/processes are used).
 *
 * Run with: npm run seed:itp -- --script=seed-itp-templates-wa-pavements.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE: CRUSHED ROCK BASE PAVEMENT (MRWA Spec 501)
// CRB is WA's dominant unbound basecourse. Acceptance = Rc + dryback (DMc).
// Six hold points: 501.41.3 material before each layer, 501.11 modification
// plant, 501.14 CRC delivery, 501.14 CRC placement (+ asbestos stop-work),
// 501.15 HCTCRB trial mixes, 501.41.5 LS/PSD before surfacing.
// =============================================================================

const waPavementTemplate = {
  name: 'Crushed Rock Base Pavement (MRWA Spec 501)',
  description: 'Main Roads WA unbound pavement per Specification 501 (edition 04/10110-05, 10/05/2023), centred on Crushed Rock Base (CRB) - WA\'s dominant basecourse - with subbase and basecourse construction. Acceptance is by Characteristic Dry Density Ratio (Rc) and dryback (Dryback Characteristic Moisture Content DMc as a proportion of OMC): CRB subbase Rc 96% dried back to 85% OMC, CRB basecourse Rc 99% dried back to 60% OMC. Conditional hold points cover the alternative materials Crushed Recycled Concrete (CRC) and Hydrated Cement Treated Crushed Rock Base (HCTCRB).',
  activityType: 'pavement_unbound',
  specificationReference: 'MRWA Spec 501',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'Subgrade accepted per Spec 302 and the layer 150 mm below subgrade dried back to <= 85% OMC before pavement (MRWA Spec 501.27)',
      acceptanceCriteria: 'The subgrade is accepted per Spec 302 and the layer 150 mm below the subgrade surface (except Perth sand) is dried back to a Dryback Characteristic Moisture Content <= 85% of OMC before pavement construction (501.27, Table 501A2).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Dryback Characteristic Moisture DMc (WA 133.1/133.2, per Spec 201)',
      notes: 'MRWA Spec 501.27, Table 501A2.'
    },
    {
      description: 'HOLD: Contractor certifies pavement material complies in all respects before construction of each pavement layer (MRWA Spec 501.41.3)',
      acceptanceCriteria: 'Prior to constructing any pavement layer, the Contractor certifies to the Superintendent that the pavement material supplied complies in all respects with the specified requirements (PSD via WA 115.1, LL via WA 120.2, LS via WA 123.1, flakiness WA 216.1, LAA WA 220.1, CBR WA 141.1); this Hold Point is released before each layer.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'WA 115.1 / WA 120.2 / WA 123.1 / WA 216.1 / WA 220.1 / WA 141.1',
      notes: 'MRWA Spec 501.41.3 HOLD. Applies before each pavement layer.'
    },
    {
      description: 'HOLD: plant proposed for basecourse modification notified to and approved by the Superintendent before use (MRWA Spec 501.11)',
      acceptanceCriteria: 'Prior to the use of plant proposed for modification of the basecourse material, the Contractor notifies the Superintendent; the modification plant and timing must be released before use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 501.11 HOLD. Conditional - applies where basecourse material is modified by plant.'
    },
    {
      description: 'HOLD (CRC): Crushed Recycled Concrete certified conforming before delivery to site (MRWA Spec 501.14)',
      acceptanceCriteria: 'Where Crushed Recycled Concrete (CRC) is used, the Contractor certifies conformance before delivery to site; delivery must not occur until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 501.14 HOLD. Conditional - CRC only (an alternative material to CRB).'
    },
    {
      description: 'HOLD (CRC): Crushed Recycled Concrete certified before placement; work stops if asbestos or hazardous metals exceed limits (MRWA Spec 501.14)',
      acceptanceCriteria: 'Where CRC is used, conformance is certified before placement; if asbestos or hazardous metals are identified exceeding the specified limits, work stops. Placement must not proceed until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 501.14 HOLD (placement + asbestos/hazardous-metals stop-work). Conditional - CRC only.'
    },
    {
      description: 'HOLD (HCTCRB): trial mixes demonstrating HCTCRB and constituents conform before use (MRWA Spec 501.15)',
      acceptanceCriteria: 'Where Hydrated Cement Treated Crushed Rock Base (HCTCRB) is used, trial mixes demonstrating that the HCTCRB and its constituents conform are approved before use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 501.15 HOLD. Conditional - HCTCRB only (a cement-treated CRB variant with a separate acceptance regime).'
    },
    {
      description: 'Subbase spread in 100-250 mm layers, full width, parallel to the finished surface (MRWA Spec 501.28)',
      acceptanceCriteria: 'Subbase is spread in layers of 100-250 mm compacted thickness, full width, parallel to the finished pavement surface.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 501.28.'
    },
    {
      description: 'Subbase compacted to Rc >= 96% (CRB subbase) at 90-110% OMC (MRWA Spec 501.29, 501.42, Table 501A1)',
      acceptanceCriteria: 'Subbase achieves a Characteristic Dry Density Ratio (Rc) of at least the Table 501A1 value (CRB subbase 96%; CRC subbase 96%; other subbase 94-96%) at a construction moisture of 90-110% of OMC.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (per Spec 201)',
      notes: 'MRWA Spec 501.29, 501.42, Table 501A1.'
    },
    {
      description: 'Subbase dried back to <= 85% OMC (CRB subbase) before basecourse placement (MRWA Spec 501.43, Table 501A2)',
      acceptanceCriteria: 'CRB subbase is dried back to a Dryback Characteristic Moisture Content <= 85% of OMC before the basecourse is placed (Table 501A2).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Dryback Characteristic Moisture DMc (per Spec 201 201A 1.3)',
      notes: 'MRWA Spec 501.43, Table 501A2.'
    },
    {
      description: 'WITNESS: subbase surface shape <= 10 mm (WA 313.2); level within +5 mm / -25 mm of design (MRWA Spec 501.45, 501.46)',
      acceptanceCriteria: 'Granular subbase surface shape deviates no more than 10 mm from a 3 m straightedge measured per WA 313.2 (<= 15 mm under Full Depth Asphalt); surface level is within +5 mm and -25 mm of design.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'WA 313.2 (surface shape); survey (level)',
      notes: 'MRWA Spec 501.45 (shape), 501.46 (level).'
    },
    {
      description: 'CRB basecourse grading within Table 501.09, dust ratio 0.35-0.60, linear shrinkage 0.4-2.0%, LL <= 25% (MRWA Spec 501)',
      acceptanceCriteria: 'CRB basecourse conforms to the Table 501.09 grading envelope (e.g. 19.0 mm 95-100%, 4.75 mm 40-60%, 0.075 mm 5-11% passing), dust ratio (0.075/0.425) 0.35-0.60, linear shrinkage 0.4% min to 2.0% max (WA 123.1), liquid limit <= 25.0% (WA 120.2); source properties flakiness <= 30% (WA 216.1), LAA <= 35% (WA 220.1), max dry compressive strength >= 1.7 MPa (WA 140.1), soaked CBR >= 100% (WA 141.1).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 115.1 / WA 120.2 / WA 123.1 / WA 216.1 / WA 220.1 / WA 140.1 / WA 141.1',
      notes: 'MRWA Spec 501, Table 501.09 (General CRB grading).'
    },
    {
      description: 'Basecourse spread 100-250 mm (HCTCRB >= 150 mm) and compacted to Rc >= 99% (CRB) at 90-110% OMC (MRWA Spec 501.29, Table 501A1)',
      acceptanceCriteria: 'Basecourse is spread in 100-250 mm layers (HCTCRB >= 150 mm; rehabilitation up to 300 mm with approval) and compacted to a Characteristic Dry Density Ratio (Rc) of at least 99% for CRB basecourse (HCTCRB 99%, CRC 99%, Ferricrete/BSL 98%) at 90-110% of OMC.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (per Spec 201)',
      notes: 'MRWA Spec 501.29, Table 501A1.'
    },
    {
      description: 'Basecourse dried back to <= 60% OMC (CRB) before bituminous binder (MRWA Spec 501.43, Table 501A3)',
      acceptanceCriteria: 'CRB basecourse is dried back to a Dryback Characteristic Moisture Content <= 60% of OMC before binder (Table 501A3), whether the final surface is sprayed seal or asphalt.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Dryback Characteristic Moisture DMc (per Spec 201 201A 1.3)',
      notes: 'MRWA Spec 501.43, Table 501A3. CRB dryback (60%) is stricter than most other basecourse materials (70-85%).'
    },
    {
      description: 'WITNESS: basecourse surface shape <= 6 mm (WA 313.2); level -5 mm / +10 mm (asphalt) or -5 mm / +20 mm of design (MRWA Spec 501.45, 501.46)',
      acceptanceCriteria: 'Basecourse surface shape deviates no more than 6 mm from a 3 m straightedge measured per WA 313.2; surface level is within -5 mm and +10 mm of design where the final surface is asphalt, otherwise within -5 mm and +20 mm.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'WA 313.2 (surface shape); survey (level)',
      notes: 'MRWA Spec 501.45 (shape), 501.46 (level).'
    },
    {
      description: 'Basecourse surface finish is a tightly bonded stone mosaic with no slurrying of fines (MRWA Spec 501.47)',
      acceptanceCriteria: 'The finished basecourse surface presents a tightly bonded stone mosaic, free of a slurried film of fines, and is uniformly dry before surfacing (501.47.4).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 501.47.'
    },
    {
      description: 'Layer widths within +100 mm / -0 mm of the drawings (MRWA Spec 501.44)',
      acceptanceCriteria: 'The outer top edge of each pavement layer is no closer to the centreline and no more than 100 mm further out than the drawings.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey (width)',
      notes: 'MRWA Spec 501.44.'
    },
    {
      description: 'Widening crossfall within 0.5% of the adjacent lane; basecourse widening within -0 / +5 mm of the existing seal top-cut-edge level (MRWA Spec 501.45)',
      acceptanceCriteria: 'For widening, the crossfall is within 0.5% of the adjacent lane and the basecourse is within -0 mm and +5 mm of the existing seal top-cut-edge level.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey (crossfall/level)',
      notes: 'MRWA Spec 501.45.'
    },
    {
      description: 'HOLD: Contractor certifies linear shrinkage and PSD after compaction before bituminous surfacing (MRWA Spec 501.41.5)',
      acceptanceCriteria: 'Prior to the application of bituminous surfacing, the Contractor certifies that the pavement material complies with the specified linear shrinkage (WA 123.1) and particle size distribution (WA 115.1) after compaction into the pavement; this Hold Point is released before surfacing.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'WA 123.1 (linear shrinkage) / WA 115.1 (PSD) after compaction',
      notes: 'MRWA Spec 501.41.5 HOLD.'
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
  console.log(' WA (Main Roads WA) ITP Template Seeder - Pavements (Spec 501)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(waPavementTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (1 pavement template)')
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
