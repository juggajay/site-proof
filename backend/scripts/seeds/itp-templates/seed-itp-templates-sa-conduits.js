/**
 * Seed Script: SA (DIT) ITP Templates - Conduits
 *
 * Creates global ITP templates for SA electrical/communications conduit and
 * pit activities based on the Department for Infrastructure and Transport
 * (DIT) Roads Master Specification.
 *
 * Templates (1):
 *   1. Conduits and Pits (DIT RD-EL-C3)
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-sa-conduits.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// 1. SA CONDUITS AND PITS (DIT RD-EL-C3)
// =============================================================================
//
// Point-type accounting per RD-EL-C3 Document Version 2 (30/09/2024):
//   - 0 Hold Points defined in this Part. The one inline Hold Point reference
//     (§7.3b) is the generic Non-Conformance Hold Point defined in PC-QA1/PC-QA2,
//     not a Hold Point of RD-EL-C3 — so it is not encoded as a hold_point item.
//   - 1 Witness Point: §11b) prior to backfill (24 hours notification), Table 12-1.
//
// =============================================================================

const saConduitsAndPitsTemplate = {
  name: 'Conduits and Pits (DIT RD-EL-C3)',
  description: 'DIT supply and installation of electrical and communications conduits and pits per RD-EL-C3. Sequential design -> trench/bore -> bedding -> conduit -> cover -> pit -> pre-backfill inspection -> witness -> backfill -> post-construction internal inspection. Genuinely 0 Hold Points / 1 Witness Point in this Part. Derived from Document Version 2 (30/09/2024); DIT lists a later v4 (30/04/2026) which was unobtainable — verify currency before relying.',
  activityType: 'conduit_trenching',
  specificationReference: 'RD-EL-C3',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // DESIGN & MATERIAL COMPLIANCE
    // =========================================================================
    {
      description: 'Submit conduit/pit design and provide licensing evidence and electrical certificate of compliance',
      acceptanceCriteria: 'Conduit/pit system design per RD-EL-D3 submitted as Design Documentation (where not provided by Principal); electrical certificate of compliance signed by a licensed electrical worker certifying compliance with the Electricity Act 1996 (SA) lodged in QM Records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EL-C3 §3, §5. Design per RD-EL-D3; electrical certificate of compliance per §3c)ii).'
    },
    {
      description: 'Inspect all pits and conduits for defects/damage before installation',
      acceptanceCriteria: 'All pits and conduits inspected and free of defects or damage prior to installation; result recorded in the ITP; pits and covers support >= 2670 kg wheel loading with no visible damage (incl. underside of cover)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §4.1b), §4.1a)iii). Pre-installation defect/damage inspection; wheel-loading strength requirement.'
    },

    // =========================================================================
    // TRENCHING & BEDDING
    // =========================================================================
    {
      description: 'Excavate trench/bore and complete conduit and pit works before any pavement/verge/footpath finish above them',
      acceptanceCriteria: 'Trenching per RD-EW-C2, boring per RD-EW-C3, pavement reinstatement per RD-PV-C6; all conduit and pit works completed before any road pavement, verge or footpath finish is built above them',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §6. Trench/bore per RD-EW-C2 / RD-EW-C3; sequence before overlying finishes.'
    },
    {
      description: 'Place 100 mm Sa C type C sand bedding before laying conduit',
      acceptanceCriteria: '100 mm of Sa C type C sand placed on the trench floor before any conduit is laid',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §7.1b). Trench bedding: 100 mm Sa C type C sand.'
    },

    // =========================================================================
    // CONDUIT INSTALLATION
    // =========================================================================
    {
      description: 'Lay conduit — straight lines, correct bends/curvature, cemented joints, draw cords and bell mouths',
      acceptanceCriteria: 'Conduit laid in straight lines; cumulative bends between pits <= 90 degrees; direction-change curvature radius >= 130 x conduit diameter; joints cemented; draw cords installed (>= 3 m tails, >= 4 mm dia polyethylene mono rope, 5 kN breaking load); bell mouths fitted in P4+ pits; marking tape at correct height',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §7.1. Conduit lay: <=90 deg cumulative bends (§7.1h)i)), curvature >=130x dia (§7.1h)iii)), draw cord (§7.1k)).'
    },
    {
      description: 'Achieve cover — electrical 500–800 mm, communications >= 450 mm, rail cover per Table 7-1',
      acceptanceCriteria: 'Electrical conduit cover 500–800 mm below finished level (uniform depth); communications conduit cover >= 450 mm in road reserve; cover within rail boundaries per Table RD-EL-C3 7-1 (main lines 1.2 m, secondary 1.0 m, other 0.6 m for min 3 m each side of rail); any shortfall protected per AS/NZS 3000 and recorded in QM Records (comms shortfall raises a Non-Conformance and the PC-QA1/PC-QA2 Hold Point applies)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §7.2–7.4, Table 7-1. Electrical 500–800 mm (§7.2), comms >=450 mm (§7.3a); comms shortfall = Non-Conformance + PC-QA1/PC-QA2 Hold Point (§7.3b).'
    },
    {
      description: 'Terminate conduits into pits, Stobie poles and signal footings with sealed, correctly angled entries',
      acceptanceCriteria: 'Conduit entry holes neatly drilled <= 10 mm larger than conduit OD and sealed with flexible sealant; electrical terminating pit entries at 45 degrees protruding 25–50 mm; traffic signal footing terminations <= 25 mm inside the footing recess',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §8. Entry hole <=10 mm over OD (§8.1a)i)); 45 deg / 25–50 mm protrusion at electrical terminating pit (§8.1a)iii)); signal footing <=25 mm recess (§8.1b)).'
    },

    // =========================================================================
    // PITS
    // =========================================================================
    {
      description: 'Bed pits on 10 mm aggregate and compacted Sa-C sand; brace against bowing',
      acceptanceCriteria: 'Pits bedded on a 10 mm aggregate levelled base plus compacted Sa-C type C sand per S-4055 sh.68; pit sides temporarily braced as needed; no inward bowing of pit sides checked before and after compaction',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §9.1d). Pit bedding + bowing check before/after compaction.'
    },
    {
      description: 'Pour reinforced concrete apron (min 200 mm) and check lid fit before and after pour',
      acceptanceCriteria: 'Reinforced concrete apron min 200 mm thickness and width from each pit side (min grade N20 where concrete used for conduit protection); apron template >= 25 mm and slightly larger than the pit lid; multiple-pit shared aprons >= 100 mm spacing + 100 mm concrete + reinforcing between pits; lid fit checked before and after the concrete apron pour',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §9.1e)–f), §4.5a). Apron min 200 mm; template >=25 mm; shared apron spacing; concrete grade >= N20.'
    },
    {
      description: 'Set pits flush and draining, gasket lids, and visually check parallel/flush/grade <= 1:14 before backfill',
      acceptanceCriteria: 'Pits set flush with surrounds with gasketed lids; built-up grade max 1:14 to conform to footpath fall (else flush); water must not pond within 1 m of the pit; isolation pits >= 5 m from signal controllers (not in painted islands/medians); lids fitted and visually checked parallel, flush and correctly graded before backfill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §9.1c)ii)B), §9.1g), §9.4. Grade <=1:14; no ponding within 1 m; isolation pit >=5 m from controller.'
    },
    {
      description: 'Install trench caution/marking tape and cable position marker posts at correct depths and spacing',
      acceptanceCriteria: 'Electrical caution tape 300 mm above electrical conduit (>1 tape where trench > 500 mm wide); communications marking tape >= 100 mm above comms conduit (AS/NZS 2648.1 non-detectable marking tape); cable position marker posts at direction changes and <= 200 m apart with ID plate + alignment direction; buried-cable warning posts installed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §10. Electrical caution tape 300 mm above (§10a)); comms marking tape >=100 mm above (§10b)); marker posts <=200 m (§10c)).'
    },

    // =========================================================================
    // PRE-BACKFILL INSPECTION & WITNESS
    // =========================================================================
    {
      description: 'Perform pre-backfill external and internal inspection of all conduits and pits',
      acceptanceCriteria: 'All conduits and pits inspected (external + internal) prior to backfill and confirmed free of defects/rough edges/damaging material, at correct depths, with sand support, correct pit entry, glued joints and clean square-cut ends per §11a checklist',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §11a). Pre-backfill external + internal inspection checklist (precedes the §11b Witness Point).'
    },
    {
      description: 'Invite Principal to witness condition of conduit and pit system prior to backfill',
      acceptanceCriteria: 'Principal invited to witness the condition of the conduit and pit system prior to backfill (24 hours notification); backfilling must not commence until the Contractor has progressed past this Witness Point',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'WP - RD-EL-C3 §11b), Table 12-1. Construction quality Witness Point, 24 hours notification. Do NOT backfill until past this Witness Point.'
    },

    // =========================================================================
    // BACKFILL & COMPLETION
    // =========================================================================
    {
      description: 'Backfill, compact and install pit surrounds',
      acceptanceCriteria: 'Trench backfilled and compacted and pit surrounds installed after the pre-backfill Witness Point has been passed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'RD-EL-C3 §11c) context. Backfill/compact/pit surrounds after Witness Point release.'
    },
    {
      description: 'Post-construction internal conduit inspection confirming no defects/compression/distortion',
      acceptanceCriteria: 'After all construction (incl. backfill, compaction, pit surrounds), internal conduit inspection by borescope or two-stage pig (external inspection permitted for qualifying tunnels) confirms conduits free of defects/rough edges/damaging material and not compressed or distorted; pits not distorted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Internal conduit inspection (borescope / two-stage pig per §11d–e)',
      notes: 'RD-EL-C3 §11c)–f). Post-construction internal inspection; borescope or two-stage pig.'
    },
    {
      description: 'Provide documentary and video evidence per Site Acceptance Testing and lodge as-constructed records in QM Records',
      acceptanceCriteria: 'Documentary and video evidence of the post-construction inspection provided to the Principal per Site Acceptance Testing (PC-CN1); as-constructed drawings, GPS pit map and electrical certificate of compliance lodged in the Quality Management Records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-EL-C3 §11g)–h), §2.2. Site Acceptance Testing per PC-CN1; as-constructed + GPS pit map + electrical certificate in QM Records.'
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
  console.log(' SA (DIT) ITP Template Seeder - Conduits')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saConduitsAndPitsTemplate)

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
