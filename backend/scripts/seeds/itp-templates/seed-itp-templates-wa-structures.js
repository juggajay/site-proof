/**
 * Seed Script: WA (Main Roads WA) ITP Templates - Structures
 *
 * Creates the global ITP templates for Main Roads Western Australia (MRWA)
 * bridge/structural concrete and reinforcement, part of the FIRST MRWA set.
 * Derived from:
 *   - Specification 820 CONCRETE FOR STRUCTURES (edition 04/10134, 29/08/2025)
 *   - Specification 822 STEEL REINFORCEMENT     (edition 04/10136, 21/06/2023)
 *
 * All checklist content is derived directly from the MRWA specs; clause
 * references cite the supporting clause. WA strength-conformance rules, delivery
 * temperature limits and reinforcement standards are used verbatim.
 *
 * Templates:
 *   1. Concrete for Structures (MRWA Spec 820) - activityType structural_concrete
 *   2. Steel Reinforcement (MRWA Spec 822)     - activityType reinforcement
 *
 * Run with: npm run seed:itp -- --script=seed-itp-templates-wa-structures.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: CONCRETE FOR STRUCTURES (MRWA Spec 820)
// Structural concrete for bridges/major structures. Hold points: 820.06
// batching plant, 820.11 AAR cement, 820.29 trial mixes, 820.52 pre-pour.
// Witness: 820.34 delivery temperature, 820.35 slump.
// =============================================================================

const waStructuralConcreteTemplate = {
  name: 'Concrete for Structures (MRWA Spec 820)',
  description: 'Main Roads WA structural concrete for bridges and major structures per Specification 820 (edition 04/10134, 29/08/2025). Falsework per Spec 819, formwork per Spec 821, reinforcement per Spec 822. Covers mix design and trial mixes, alkali-aggregate-reaction cement control, batching, delivery temperature (mix <= 32 C) and slump gates, the pre-pour reinforcement/formwork hold, placing and compaction, curing and the 28-day strength conformance rule (every sample > 95% of nominated strength and the average of any 4 consecutive samples >= nominated).',
  activityType: 'structural_concrete',
  specificationReference: 'MRWA Spec 820',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD: on-site batching plant approved before use (MRWA Spec 820.06)',
      acceptanceCriteria: 'Where an on-site batching plant is used, its use is subject to the Spec 820.06 general requirements and Hold Point release before batching.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 820.06 HOLD. Conditional - on-site batching plant.'
    },
    {
      description: 'HOLD: cement type approved for alkali-aggregate-reaction control (blended, e.g. 65% GGBFS) (MRWA Spec 820.11)',
      acceptanceCriteria: 'For AAR control, the cement is a blended cement (e.g. 65% GGBFS) or otherwise approved; the cement type is released before use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 820.11 HOLD (AAR control).'
    },
    {
      description: 'HOLD: mix designs and trial mixes tested and approved before production of any class of concrete (MRWA Spec 820.29)',
      acceptanceCriteria: 'Mix designs and trial mixes are tested and approved before use of any class of concrete, including volume of permeable voids per the durability class (820.30, AS 1012.21).',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1012.21 (VPV durability)',
      notes: 'MRWA Spec 820.29 HOLD.'
    },
    {
      description: 'Batched and mixed per the approved mix; no water added after concrete leaves the batching plant (MRWA Spec 820.32, 820.36)',
      acceptanceCriteria: 'Concrete is batched and mixed per the approved mix (820.32) and transported per 820.33; no water is added after the concrete leaves the batching plant (820.36).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 820.32, 820.33, 820.36.'
    },
    {
      description: 'WITNESS: concrete temperature at delivery <= 32 C; ambient/shade conditions met before each pour (MRWA Spec 820.34)',
      acceptanceCriteria: 'The concrete mix temperature at the point of delivery is <= 32 C with measures (chilled water, night pours, shielding) required when ambient exceeds 32 C; ambient shade rules per 820.34 are met.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Concrete temperature at delivery',
      notes: 'MRWA Spec 820.34.'
    },
    {
      description: 'WITNESS: slump test on-site before placement (each truck for mobile plant) within AS 1379 tolerance (MRWA Spec 820.35)',
      acceptanceCriteria: 'A slump/consistency test (AS 1012.3.1) is performed on-site prior to placement - one per truck for rural/mobile plant - and is within the AS 1379 slump tolerance.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (slump); AS 1379 tolerance',
      notes: 'MRWA Spec 820.35.'
    },
    {
      description: 'HOLD: reinforcement and formwork inspected before the pour (MRWA Spec 820.52)',
      acceptanceCriteria: 'Reinforcement and formwork are inspected and the Hold Point released before concrete is placed.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 820.52 HOLD (pre-pour). Links to Spec 822.30 reinforcement fixing.'
    },
    {
      description: 'Concrete placed near its final position, compacted; construction joints per drawings (MRWA Spec 820.52-820.54)',
      acceptanceCriteria: 'Concrete is deposited as near as possible in its final position (820.52), compacted (820.54) and construction joints formed per the drawings (820.53).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 820.52-820.54.'
    },
    {
      description: 'At least 3 strength specimens cast per sample (AS 1012.1); moist-cured within 36 hours (MRWA Spec 820.37, 820.39)',
      acceptanceCriteria: 'At least 3 compressive-strength specimens are cast per sample per pour (AS 1012.1) and standard moist-cured within 36 hours (AS 1012), continuously to the test age.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.1 (sampling); AS 1012 (moist-cure)',
      notes: 'MRWA Spec 820.37, 820.39.'
    },
    {
      description: 'Unformed surfaces finished; concrete cured per 820.56 and protected (MRWA Spec 820.55-820.57)',
      acceptanceCriteria: 'Unformed surfaces are finished (820.55), the concrete is cured per 820.56 and protected (820.57); steam curing (820.71) / maturity testing (820.72) apply where used.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 820.55-820.57.'
    },
    {
      description: '28-day strength conforms: every sample > 95% of nominated AND average of any 4 consecutive samples >= nominated (MRWA Spec 820.38)',
      acceptanceCriteria: 'Concrete conforms if (a) every sample\'s 28-day strength (AS 1012.9) exceeds 95% of the nominated strength and (b) the average of any group of 4 consecutive samples is >= the nominated strength. A failing group means the concrete represented by the lowest-strength sample is rejected.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.9 (28-day compressive strength)',
      notes: 'MRWA Spec 820.38 conformance rule.'
    },
    {
      description: 'Non-conforming concrete rejected or remediated per 820.59 (MRWA Spec 820.58, 820.59)',
      acceptanceCriteria: 'QA during construction is maintained (820.58) and non-conforming concrete is rejected or remediated per 820.59.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 820.58, 820.59.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: STEEL REINFORCEMENT (MRWA Spec 822)
// Supply, bending, fixing of reinforcement. Hold points: 822.06.2 bar chairs,
// 822.29.6 supports submission (>= 14 days), 822.27 welding qualifications.
// Witness: 822.03/822.30 cover/fabrication, pre-pour fixing inspection.
// =============================================================================

const waReinforcementTemplate = {
  name: 'Steel Reinforcement (MRWA Spec 822)',
  description: 'Main Roads WA steel reinforcement for structures per Specification 822 (edition 04/10136, 21/06/2023). Grade 500N deformed bars, reinforcing wire and Grade 500L welded mesh to AS/NZS 4671; bar chairs/spacers to AS/NZS 2425; manufacturers/processors hold a valid ACRS certificate. Covers procurement, bending to AS 5100.5, fixing to tolerance, bar-chair compliance, lap and welded splices, and the pre-pour fixing inspection that links to the Spec 820.52 pour hold.',
  activityType: 'reinforcement',
  specificationReference: 'MRWA Spec 822',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'Reinforcement is ACRS-certified to AS/NZS 4671 (Grade 500N bars / Grade 500L mesh) (MRWA Spec 822.06)',
      acceptanceCriteria: 'Reinforcement (Grade 500N deformed bars, reinforcing wire, Grade 500L welded mesh) complies with AS/NZS 4671 and is supplied by a manufacturer/processor holding a valid ACRS certificate.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4671 + ACRS certification',
      notes: 'MRWA Spec 822.06.'
    },
    {
      description: 'HOLD: bar chairs and spacers comply with AS/NZS 2425 (concrete chairs >= 60 MPa, RCPT <= 1000 coulombs; no metal/site-cast) (MRWA Spec 822.06.2)',
      acceptanceCriteria: 'Bar chairs and spacers used in the Works comply with AS/NZS 2425: concrete chairs >= 60 MPa with RCPT <= 1000 coulombs; metal, plastic-coated-metal and site-cast chairs are not permitted.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 2425 (bar chairs/spacers)',
      notes: 'MRWA Spec 822.06.2 HOLD.'
    },
    {
      description: 'HOLD: signed test reports demonstrating AS/NZS 2425 compliance submitted >= 14 days before use of steel supports/spacers (MRWA Spec 822.29.6)',
      acceptanceCriteria: 'At least 14 days prior to use of steel supports/spacers, the Contractor submits for approval a signed document with test reports demonstrating AS/NZS 2425 compliance; released before use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 822.29.6 HOLD, 14 days notice.'
    },
    {
      description: 'Bending schedules prepared from the drawings; bars cut and bent to AS 5100.5 pin diameters (MRWA Spec 822.07)',
      acceptanceCriteria: 'Bending schedules are prepared from the drawings and bars are cut and bent to AS 5100.5 pin diameters; no field bending of embedded bars unless allowed.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 5100.5 (bending)',
      notes: 'MRWA Spec 822.07.'
    },
    {
      description: 'Reinforcement stored clear of the ground and cleaned before fixing (MRWA Spec 822.08, 822.09)',
      acceptanceCriteria: 'Reinforcement is stored clear of the ground (822.08) and cleaned before fixing (822.09).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 822.08, 822.09.'
    },
    {
      description: 'Bars fixed to Table 822.3 tolerances and tied with 1.6 mm annealed soft-iron wire (MRWA Spec 822.26)',
      acceptanceCriteria: 'Bars are fixed to the Table 822.3 position tolerances forming an effective cage and tied with 1.6 mm annealed soft-iron tie wire.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 822.26, Table 822.3.'
    },
    {
      description: 'Reinforcement supported on compliant concrete/plastic bar chairs - no metal or site-cast (MRWA Spec 822.29)',
      acceptanceCriteria: 'Reinforcement is supported on AS/NZS 2425-compliant concrete or plastic bar chairs; metal, plastic-coated-metal and site-cast chairs are not permitted.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 822.29.'
    },
    {
      description: 'HOLD: welders qualified and procedures verified to AS/NZS 1554.3 before any welding; none within 75 mm of a bend (MRWA Spec 822.27)',
      acceptanceCriteria: 'Prior to welding any reinforcement, the Contractor supplies documentation showing welders are suitably qualified and welding procedures are verified by testing to AS/NZS 1554.3; welding is not permitted within 75 mm of a bend (Grade 500) and welds shall not be broken out. Released before any welding.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1554.3 (welding qualification)',
      notes: 'MRWA Spec 822.27 HOLD. Conditional - where welding of reinforcement is shown.'
    },
    {
      description: 'Lap splices only at drawing locations with the minimum lap per drawings (MRWA Spec 822.28)',
      acceptanceCriteria: 'Lap splices occur only at the drawing locations with the minimum lap per the drawings; mechanical splices per 822.10 where used.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 822.28, 822.10.'
    },
    {
      description: 'WITNESS: clear cover to drawings; fabrication within Table 822.2 tolerances (MRWA Spec 822.03, 822.30)',
      acceptanceCriteria: 'Clear cover is the minimum shown on the drawings (822.03) and fabrication is within Table 822.2 tolerances (cover-controlled overall dimensions +0/-20 mm for bar <= 20 mm/L <= 600, grading to +0/-40 / +0/-50 mm for larger bars/dimensions).',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Table 822.2 (fabrication) / cover',
      notes: 'MRWA Spec 822.03, 822.30, Table 822.2.'
    },
    {
      description: 'WITNESS: fixed reinforcement inspected before concrete pour (MRWA Spec 822.30)',
      acceptanceCriteria: 'Fixed reinforcement is inspected against the Table 822.3 fixing tolerances before the concrete pour; this interacts with the Spec 820.52 pour hold point.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Table 822.3 (fixing tolerances)',
      notes: 'MRWA Spec 822.30, links to Spec 820.52.'
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
  console.log(' WA (Main Roads WA) ITP Template Seeder - Structures (Specs 820/822)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(waStructuralConcreteTemplate)
    await seedTemplate(waReinforcementTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (2 structures templates)')
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
