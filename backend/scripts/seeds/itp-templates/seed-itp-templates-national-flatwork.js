/**
 * Seed Script: NATIONAL ITP Templates - Concrete Flatwork
 *
 * Creates the platform's first NATIONAL concrete-flatwork template. Served by
 * the matcher (src/lib/itpMatcher.ts, NATIONAL_BASELINE_SPECS) as gap-fill for
 * every project and as PRIMARY for projects whose spec set is AUS-SPEC.
 *
 * Template: Concrete Flatwork - Footpaths and Cycleways (AUS-SPEC 0282)
 *
 * Sources (primary/public-agency documents, derived not invented):
 *   S1 = AUS-SPEC 0282 "Pathways and cycleways (Construction)" (NATSPEC base
 *        Oct 2020; MidCoast Council NSW adoption Rev 0, 14/12/2020) - the
 *        specification backbone (stages, hold/witness, tests, tolerances, curing).
 *   S2 = IPWEAQ Standard Drawing PCD-101 "Concrete Pathways - Construction
 *        Details" Rev A, 07/2023 - the dimensional defaults (thickness, mesh
 *        grade, joint spacing, dowels, slump, finish) that S1 defers to.
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-national-flatwork.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// NATIONAL CONCRETE FLATWORK - FOOTPATHS AND CYCLEWAYS (AUS-SPEC 0282)
// =============================================================================

const nationalFlatworkTemplate = {
  name: 'Concrete Flatwork — Footpaths and Cycleways (AUS-SPEC 0282)',
  description:
    'National concrete flatwork ITP for footpaths, shared/cycle paths, kerb ramps, driveways and minor concrete (NOT kerb & channel, NOT structural concrete). Backbone from AUS-SPEC 0282 "Pathways and cycleways (Construction)" (NATSPEC base Oct 2020, MidCoast Council NSW adoption Rev 0 14/12/2020); dimensional defaults from IPWEAQ Standard Drawing PCD-101 Rev A 07/2023. GOVERNING STANDARD: AS 3727.1. GRADE DEFAULT IS A PRAGMATIC MIDDLE: the concrete-grade default (N25) is NOT quoted verbatim from either source — the sources bracket it (AUS-SPEC 0282 specifies N20/20 MPa for footpaths & minor concrete; IPWEAQ PCD-101 Note 2 specifies N32). N25 is the most common council footpath spec and sits between them. Set concrete grade, thickness, mesh, joint spacings, curing days and test frequencies to the adopted council/project specification — all parameter defaults below are project-editable.',
  activityType: 'footpaths_flatwork',
  specificationReference: 'AUS-SPEC 0282',
  stateSpec: 'AUS-SPEC',
  checklistItems: [
    // =========================================================================
    // SUBGRADE & SUBBASE
    // =========================================================================
    {
      description: 'Subgrade prepared — topsoil/organics stripped; soft material removed and replaced',
      acceptanceCriteria:
        'Topsoil and organics stripped; soft/organic material in top 300 mm removed and replaced with approved fill; prepared extent minimum 300 mm beyond path edge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AUS-SPEC 0282 cl 3.1. Remove soft/organic material in top 300 mm and replace with good fill.'
    },
    {
      description: 'Subgrade compaction verified — proof roll and density test',
      acceptanceCriteria:
        'Subgrade proof rolled to AS 3798 cl 5.5; compaction density to documented target tested AS 1289.5.4.1 (max lot 1000 lin.m / 1000 m2, min 1 per 200 lin.m / 200 m2). Notice given 1 day before base',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (compaction), AS 3798 cl 5.5 (proof roll)',
      notes: 'WP - AUS-SPEC 0282 cl 1.7 / Annexure. Witness point; 0282 requires Superintendent + Principal Certifier authorisation. Density target is project-editable.'
    },
    {
      description: 'Subbase / base placed, trimmed and compacted',
      acceptanceCriteria:
        'Subbase/base placed in layers not exceeding 150 mm, trimmed to crossfall (default 2.5% max per PCD-101, editable); compaction tested AS 1289.5.4.1 (max lot 1 day placement, min 1 per 100 lin.m / 100 m2)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1289.5.4.1 (compaction)',
      notes: 'AUS-SPEC 0282 cl 3.2. Layers <= 150 mm. Crossfall default 2.5% max (PCD-101), editable.'
    },
    {
      description: 'Subbase / base compaction and geometry verified',
      acceptanceCriteria:
        'Subbase/base geometry checked with 3 m straightedge (1 per 25 lin.m); rigid-pavement subbase tolerance +0 / -10 mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: '3 m straightedge',
      notes: 'WP - AUS-SPEC 0282 Annexure 4.3. Witness point; Superintendent + Principal Certifier.'
    },
    {
      description: 'No-subbase case — underlay membrane / sand blinding laid',
      acceptanceCriteria:
        'Where no subbase: 200 micron polyethylene sheeting laid with 200 mm taped laps and/or 20 mm sand blinding; nominal 50 mm bedding sand where directed (PCD-101, editable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AUS-SPEC 0282 cl 2.4 / 3.2. Bedding sand nominal 50 mm (PCD-101), editable.'
    },

    // =========================================================================
    // FORMWORK, REINFORCEMENT & JOINTS (PRE-POUR)
    // =========================================================================
    {
      description: 'Formwork and reinforcement set — mesh placed central on chairs',
      acceptanceCriteria:
        'Formwork set to slab edge thickness (default 100 mm path / 150 mm at vehicle crossings, editable per council); SL72 mesh placed central with minimum 50 mm bottom cover, laps 400 mm, on bar chairs (PCD-101; AUS/NZS 4671). Fibre reinforcement (Class 2 macro synthetic per AS 3600) where council approves',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'PCD-101 sections; AUS-SPEC 0282 cl 3.3 defers dimensions "as documented". Thickness 100/150 mm and SL72 mesh are PCD-101 defaults, project-editable.'
    },
    {
      description: 'Joints set out — contraction and dowelled expansion joints',
      acceptanceCriteria:
        'Contraction (control) joints set to match path width (or as directed); dowelled expansion joints at maximum 12 000 mm spacing with 10 mm compressible filler full depth; dowels diameter 12 mm (N12) greased one end with expansion cap at 600 mm centres (PCD-101, all editable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'PCD-101. CJ spacing = path width; DEJ <= 12 m; N12 dowels @ 600 crs greased + capped one end. All defaults project-editable.'
    },
    {
      description: 'PRE-POUR HOLD — reinforcement, cover, dowels, embedded items and joint formers inspected and released before concrete placed',
      acceptanceCriteria:
        'Reinforcement position/cover, dowels, cores/fixings/embedded items and joint formers inspected and released BEFORE any concrete is placed; notice given 2 days prior. Release requires dual authorisation by both the Superintendent and the Principal Certifier (Council)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD (pre-pour). PROVENANCE: AUS-SPEC 0282 Annexure formally classifies the pre-pour reinforcement check as a DUAL-AUTHORISATION WITNESS point (Superintendent + Principal Certifier), not a Hold. It is set here as a Hold Point to match universal Australian civil ITP convention and because 0282 requires dual sign-off before release, functioning as a release gate. In 0282 the only two formal Hold points are asphalt completion and segmental completion (see completion item).'
    },

    // =========================================================================
    // CONCRETE SUPPLY, PLACEMENT & FINISH
    // =========================================================================
    {
      description: 'Concrete supplied to specification — grade, delivery time and no on-site water',
      acceptanceCriteria:
        'Concrete supplied to AS 1379; characteristic strength per project specification (default N25 — a national middle, see template note; AUS-SPEC 0282 = N20 for footpaths/minor concrete, IPWEAQ PCD-101 = N32; editable N20/N25/N32/N40); no water added on site; elapsed delivery time within the specification temperature table (placing window default 10-30 C, editable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379 (concrete supply)',
      notes: 'AUS-SPEC 0282 cl 3.3. GRADE DEFAULT N25 IS A PRAGMATIC MIDDLE, not quoted verbatim: 0282 = N20 (min cement 270 GP/330 GB, 20 mm agg, 28 d 20 MPa), PCD-101 = N32. Set to adopted council spec.'
    },
    {
      description: 'Slump tested each load',
      acceptanceCriteria:
        'Slump tested each load to AS 1012.3.1: 50-60 mm fixed form with manual vibration, or 30-50 mm slip form no side forms (or 80 mm for N32 per PCD-101 Note 2 — project spec governs). Max lot 15 m3, min 1 per load',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.3.1 (slump)',
      notes: 'WP - AUS-SPEC 0282 cl 3.3 / Annexure 4.3. Slump acceptance is grade/method dependent; project spec governs.'
    },
    {
      description: 'Compression test cylinders taken',
      acceptanceCriteria:
        'Compression cylinders sampled to AS 1012.1 / .8.1 / .9, 2 pairs per 15 m3, tested for 28-day compressive strength against the specified characteristic strength',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'AS 1012.1 / AS 1012.8.1 / AS 1012.9 (compressive strength, 28 d)',
      notes: 'AUS-SPEC 0282 Annexure 4.3. 2 pairs per 15 m3.'
    },
    {
      description: 'Concrete placed and compacted; placing log kept',
      acceptanceCriteria:
        'Concrete placed and compacted (no immersion vibrator in slabs <= 100 mm); concrete placing log kept recording date, grade, slump and volume',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AUS-SPEC 0282 cl 3.3. No immersion vibrator in slabs <= 100 mm.'
    },
    {
      description: 'Surface finished to documented type',
      acceptanceCriteria:
        'Surface finished to documented type — default broom finish perpendicular to path length (PCD-101 Note 6; 0282 permits wood-float or broom); slip resistance to AS/NZS 4586',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'AS/NZS 4586 (slip resistance)',
      notes: 'PCD-101 Note 6; AUS-SPEC 0282 cl 3.3. Broom perpendicular to length is the default finish, editable.'
    },
    {
      description: 'Curing started immediately and continued',
      acceptanceCriteria:
        'Curing started immediately after finishing and continued for the specified period (default >= 3 days, editable) by cover-sheet, moisture or curing compound (AS 3799); coloured concrete not covered with plastic/sand/hessian',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AUS-SPEC 0282 cl 3.3. Curing period default >= 3 days (editable). 0282 sets no hard day-count for traffic protection; industry 4-7 days before use.'
    },

    // =========================================================================
    // JOINTS, LEVELS, TGSIs & COMPLETION
    // =========================================================================
    {
      description: 'Joints sealed / saw-cut',
      acceptanceCriteria:
        'Expansion joints sealed with low-modulus self-priming colour-matched sealant; saw-cut contraction joints cut 1/3 slab depth x 6 mm wide, 4-12 hours after laying (or tooled)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'PCD-101 Notes 10-11; AUS-SPEC 0282 cl 3.3. Saw-cut 1/3 depth x 6 mm, 4-12 h after laying.'
    },
    {
      description: 'Finished levels and geometry verified',
      acceptanceCriteria:
        'Finished levels/geometry surveyed with 3 m straightedge, 1 cross-section per 15 m. Tolerances: concrete surface absolute +10 / -0 mm, relative (3 m straightedge) 5 mm; outer concrete edge horizontal position within 30 mm of documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Survey + 3 m straightedge',
      notes: 'AUS-SPEC 0282 cl 1.5 / Annexure 4.3. Surface tol +10/-0 mm; relative 5 mm; edge 30 mm.'
    },
    {
      description: 'Tactile ground surface indicators installed where documented',
      acceptanceCriteria:
        'Tactile ground surface indicators (kerb ramps) installed to AS/NZS 1428.4.1 where documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AUS-SPEC 0282 cl 2.9. TGSIs to AS/NZS 1428.4.1 where documented.'
    },
    {
      description: 'COMPLETION HOLD — finish and reinstatement released before opening to public/traffic',
      acceptanceCriteria:
        'Finish and reinstatement of adjacent surfaces evaluated and released BEFORE opening to public/traffic; notice given 2 days prior',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - AUS-SPEC 0282 Annexure 4.2. This is a FORMAL Hold point in 0282 (gates opening to the public), authorised by Superintendent + Principal Certifier. Applies to completion of asphalt wearing surface and segmental pavement where present.'
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
      stateSpec: templateData.stateSpec,
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
  console.log(' NATIONAL ITP Template Seeder - Concrete Flatwork')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nationalFlatworkTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (1 national flatwork template)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

withItpTemplateSeedLock(prisma, main)
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
