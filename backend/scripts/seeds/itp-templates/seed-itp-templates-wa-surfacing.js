/**
 * Seed Script: WA (Main Roads WA) ITP Templates - Bituminous Surfacing
 *
 * Creates the global ITP templates for Main Roads Western Australia (MRWA)
 * sprayed bituminous surfacing, derived from Specification 503 BITUMINOUS
 * SURFACING (edition 04/10111, issued 05/02/2018). Part of the FIRST MRWA set.
 *
 * The one Spec 503 governs primes, primerseals, conventional seals and reseals.
 * Following the SA seals pattern (seed-itp-templates-sa-seals.js), it is split
 * by scope into two templates:
 *   1. Sprayed Bituminous Surfacing (MRWA Spec 503) - activityType sprayed_seal
 *      (conventional seals and reseals - binder over an existing/prepared surface)
 *   2. Prime and Primerseal (MRWA Spec 503)          - activityType prime_primerseal
 *      (primes and primerseals - the initial surfacing treatment on new basecourse)
 *
 * All checklist content is derived directly from MRWA Spec 503; clause
 * references cite the Spec 503 clause that supports the item. WA terminology is
 * used verbatim: BAR (Binder Application Rate at 15 C), OAR (Ordered Application
 * Rate), Class 170 bitumen, cutting oil, precoating fluid, Annexure 503C.
 * Conformance of binder is BAR within OAR +/- 0.10 L/m2. Aggregate acceptance is
 * via Spec 511 (referenced).
 *
 * Run with: npm run seed:itp -- --script=seed-itp-templates-wa-surfacing.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: SPRAYED BITUMINOUS SURFACING (MRWA Spec 503)
// Conventional seals and reseals (incl. rubberised and geotextile-reinforced).
// Hold points: 503.16.5 aggregate, 503.33 sprayer/precoater, 503.36.02(3)
// reseal surface, 503.36.03(3) cold-planed surface, 503.41 binder prep,
// 503.39 traffic control. Witness: BAR +/- 0.10, traffic ban.
// =============================================================================

const waSprayedSealTemplate = {
  name: 'Sprayed Bituminous Surfacing (MRWA Spec 503)',
  description: 'Main Roads WA sprayed bituminous surfacing per Specification 503 (edition 04/10111, 05/02/2018) - conventional seals and reseals, including rubberised seals/reseals and geotextile-reinforced seals. Binder is Class 170 bitumen (AS 2008), bitumen emulsion or rubber binder mixed with cutting oil, adhesion agent and precoating fluid per Annexure 503C. Binder conformance is the actual Binder Application Rate (BAR) within the Ordered Application Rate (OAR) +/- 0.10 L/m2 at 15 C. Cover aggregate is accepted via Spec 511.',
  activityType: 'sprayed_seal',
  specificationReference: 'MRWA Spec 503',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD: aggregate certified conforming (Spec 511) before on-site delivery of crushed aggregate (MRWA Spec 503.16.5)',
      acceptanceCriteria: 'Prior to the on-site delivery of crushed aggregate, the Contractor provides certification to the Superintendent that the aggregate conforms to the specified requirements (Spec 511); delivery must not occur until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Spec 511 aggregate conformance',
      notes: 'MRWA Spec 503.16.5 HOLD.'
    },
    {
      description: 'Aggregate stockpiled in identifiable lots (<= 2000 m3 / one day\'s production); aggregate dump sites nominated (MRWA Spec 503.16, 503.27, 503.37)',
      acceptanceCriteria: 'Aggregate is sourced, tested (Spec 511) and stockpiled in identifiable lots of one day\'s production or approximately 2000 m3; aggregate stockpile/dump sites are nominated to the Superintendent.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.16 (lots), 503.27/503.37 (dump sites).'
    },
    {
      description: 'HOLD: bitumen sprayer and precoater calibrated/demonstrated before use on the Works (MRWA Spec 503.33)',
      acceptanceCriteria: 'Prior to use of the sprayer and precoater on the Works, the Contractor calibrates and demonstrates them to the Superintendent; use must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.33 HOLD (sprayer and precoater).'
    },
    {
      description: 'Seal design (binder + aggregate application rates) fixed per Annexure 503C (MRWA Spec 503.20-503.23)',
      acceptanceCriteria: 'The seal design - binder and aggregate application rates - is fixed per Annexure 503C, either "Designed by the Principal" (default) or "Designed by the Contractor" per Table 503C1, using the aggregate Average Least Dimension (ALD) as the design basis.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.20-503.23, Annexure 503C.'
    },
    {
      description: 'Surface swept clean of loose and adherent matter; raised pavement markers removed (MRWA Spec 503.36)',
      acceptanceCriteria: 'The surface is swept clean of loose and adherent matter and raised pavement markers are removed before sealing.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 503.36.'
    },
    {
      description: 'HOLD: reseal surface (bituminous or cold-planed) certified suitable and Hold released >= 1 hour prior to binder application (MRWA Spec 503.36.02(3), 503.36.03(3))',
      acceptanceCriteria: 'For a reseal on a bituminous surface, at least 1 hour prior to binder application the Contractor certifies that sweeping and repairs are complete and the surface is suitable to receive the seal (503.36.02(3)); for a cold-planed surface, the surface is certified per Spec 508 and release requested at least 1 hour prior to binder (503.36.03(3)). Binder must not be applied until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.36.02(3) (bituminous surface), 503.36.03(3) (cold-planed surface) HOLD, >= 1 hour notice.'
    },
    {
      description: 'HOLD: binder (Class 170 + cutting oil + adhesion agent per 503C) prepared before application (MRWA Spec 503.41)',
      acceptanceCriteria: 'Binder is not applied until the Contractor has sufficient material and plant ready; the binder (Class 170 bitumen with cutting oil and adhesion agent per Annexure 503C) is prepared and this Hold Point released before application (503.41.1).',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.41.1 HOLD.'
    },
    {
      description: 'HOLD: traffic control measures approved before implementation (MRWA Spec 503.39)',
      acceptanceCriteria: 'Prior to implementing the proposed traffic control measures, the Contractor obtains release of this Hold Point.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.39 HOLD.'
    },
    {
      description: 'WITNESS: binder application rate (BAR) within OAR +/- 0.10 L/m2 at 15 C (MRWA Spec 503, Tables 503.4/503.5)',
      acceptanceCriteria: 'The measured Binder Application Rate (BAR) per spray run conforms if within the Ordered Application Rate (OAR) +/- 0.10 L/m2 at 15 C (Tables 503.4/503.5); rates beyond attract the pay-factor bands, and <= (OAR - 0.16) or >= (OAR + 0.21) for seals/reseals is a Non-Conformance.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'BAR vs OAR at 15 C (Tables 503.4/503.5)',
      notes: 'MRWA Spec 503, Table 503.5 (Seals & Reseals).'
    },
    {
      description: 'No binder sprayed outside the 50 mm margin (MRWA Spec 503.42.04, 503.53.4)',
      acceptanceCriteria: 'Binder sprayed outside the 50 mm margin (Clause 503.42.04) is not paid (503.53.4); spraying is controlled to hold the line within tolerance.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 503.42.04, 503.53.4.'
    },
    {
      description: 'Geotextile fabric applied where specified (MRWA Spec 503.43)',
      acceptanceCriteria: 'Where a geotextile-reinforced seal is specified, the geotextile fabric is applied per 503.43 before the cover aggregate.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 503.43. Conditional - geotextile-reinforced seals only.'
    },
    {
      description: 'Cover aggregate applied and rolled with the specified multi-tyred rollers (MRWA Spec 503.44, Annexure 503C)',
      acceptanceCriteria: 'Cover aggregate is applied and rolled with the multi-tyred rollers specified in Annexure 503C; the time lapse between rolling completion and final surfacing does not exceed one week (503.44).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 503.44, Annexure 503C.'
    },
    {
      description: 'WITNESS: traffic ban observed; final surfacing within one week of rolling completion (MRWA Spec 503.44, Annexure 503C)',
      acceptanceCriteria: 'The specified traffic ban and binder application rates (Annexure 503C) are observed on opening to traffic; final surfacing follows within one week of rolling completion.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 503.44 (time lapse), Annexure 503C (traffic ban).'
    },
    {
      description: 'Daily Works Record (Annexure 503D form) submitted to the Superintendent (MRWA Spec 503.81)',
      acceptanceCriteria: 'The daily Works Record on the Annexure 503D form is submitted to the Superintendent.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.81, Annexure 503D.'
    },
    {
      description: 'Non-conforming binder defects rectified within 60 days of completion at no cost to the Principal (MRWA Spec 503.52)',
      acceptanceCriteria: 'Non-conforming binder (per AS 2008 / sampling per Spec 201) is repaired or replaced within 60 days of completion at no cost to the Principal.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.52.'
    },
    {
      description: 'Aggregate application rate uniform; spotting/line-marking interval per Annexure 503C (MRWA Spec 503.44, Annexure 503C)',
      acceptanceCriteria: 'Cover aggregate is applied at a uniform rate and spotting/line-marking intervals follow Annexure 503C, with markers placed as needed to hold tolerance.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 503.44, Annexure 503C.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: PRIME AND PRIMERSEAL (MRWA Spec 503)
// Primes and primerseals - the initial surfacing treatment on new basecourse.
// Hold points: 503.16.5 aggregate (primerseal), 503.33 sprayer/precoater,
// 503.36.01(5) basecourse+dryback before initial binder, 503.36.01(6) surface
// finish after sweeping, 503.41 binder prep. Witness: BAR +/- 0.10, traffic ban.
// =============================================================================

const waPrimePrimersealTemplate = {
  name: 'Prime and Primerseal (MRWA Spec 503)',
  description: 'Main Roads WA primes and primerseals per Specification 503 (edition 04/10111, 05/02/2018) - the initial sprayed surfacing treatment over new basecourse. A prime penetrates and bonds the pavement surface; a primerseal (aggregate or sand/crusher-dust) waterproofs and holds cover aggregate. Binder is Class 170 bitumen with cutting oil, adhesion agent and precoating fluid per Annexure 503C; conformance is the actual Binder Application Rate (BAR) within the Ordered Application Rate (OAR) +/- 0.10 L/m2 at 15 C (Table 503.4). Requires the basecourse dryback and surface finish (Spec 501) to be certified before the initial binder.',
  activityType: 'prime_primerseal',
  specificationReference: 'MRWA Spec 503',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD (primerseal): cover aggregate certified conforming (Spec 511) before on-site delivery (MRWA Spec 503.16.5)',
      acceptanceCriteria: 'For primerseals (which carry cover aggregate): prior to on-site delivery of crushed aggregate, the Contractor certifies to the Superintendent that the aggregate conforms (Spec 511); delivery must not occur until this Hold Point is released. A prime alone carries no aggregate.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Spec 511 aggregate conformance',
      notes: 'MRWA Spec 503.16.5 HOLD. Conditional - primerseal cover aggregate; a prime carries no aggregate.'
    },
    {
      description: 'Aggregate (primerseal) stockpiled in identifiable lots (<= 2000 m3 / one day\'s production); dump sites nominated (MRWA Spec 503.16, 503.27, 503.37)',
      acceptanceCriteria: 'Primerseal cover aggregate is stockpiled in identifiable lots of one day\'s production or approximately 2000 m3; stockpile/dump sites are nominated to the Superintendent.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.16, 503.27/503.37. Primerseals only.'
    },
    {
      description: 'HOLD: bitumen sprayer and precoater calibrated/demonstrated before use on the Works (MRWA Spec 503.33)',
      acceptanceCriteria: 'Prior to use of the sprayer and precoater on the Works, the Contractor calibrates and demonstrates them to the Superintendent; use must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.33 HOLD (sprayer and precoater).'
    },
    {
      description: 'Prime/primerseal design (binder + aggregate rates) fixed per Annexure 503C (MRWA Spec 503.20-503.23)',
      acceptanceCriteria: 'The prime/primerseal design - binder and (for primerseals) aggregate application rates - is fixed per Annexure 503C, "Designed by the Principal" (default) or "Designed by the Contractor" per Table 503C1.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.20-503.23, Annexure 503C.'
    },
    {
      description: 'Surface swept clean; light water spray applied consistently across the width before prime/primerseal (MRWA Spec 503.36)',
      acceptanceCriteria: 'The basecourse surface is swept clean of loose and adherent matter and a light water spray is applied consistently across the width before the prime/primerseal (503.36.01(4)).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 503.36, 503.36.01(4).'
    },
    {
      description: 'HOLD: basecourse compliance and dryback certified before applying binder as an initial surfacing treatment (MRWA Spec 503.36.01(5))',
      acceptanceCriteria: 'Prior to applying bituminous binder as an initial surfacing treatment, the Contractor certifies that the basecourse complies (including surface finish per Spec 501) and that dryback complies at the time of application; binder must not be applied until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Basecourse dryback (Spec 501)',
      notes: 'MRWA Spec 503.36.01(5) HOLD.'
    },
    {
      description: 'HOLD: at completion of basecourse sweeping, surface finish (Spec 501) certified; Hold released >= 1 hour prior to binder (MRWA Spec 503.36.01(6))',
      acceptanceCriteria: 'At completion of basecourse sweeping and prior to binder, the Contractor certifies the surface finish per Spec 501 and suitability, requesting release of this Hold Point in writing after sweeping and at least 1 hour prior to binder application.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.36.01(6) HOLD, >= 1 hour notice.'
    },
    {
      description: 'HOLD: binder (Class 170 + cutting oil + adhesion agent per 503C) prepared before application (MRWA Spec 503.41)',
      acceptanceCriteria: 'Binder is not applied until the Contractor has sufficient material and plant ready; the binder (Class 170 bitumen with cutting oil and adhesion agent per Annexure 503C) is prepared and this Hold Point released before application (503.41.1).',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.41.1 HOLD.'
    },
    {
      description: 'WITNESS: binder application rate (BAR) within OAR +/- 0.10 L/m2 at 15 C (MRWA Spec 503, Table 503.4)',
      acceptanceCriteria: 'The measured Binder Application Rate (BAR) conforms if within the Ordered Application Rate (OAR) +/- 0.10 L/m2 at 15 C (Table 503.4, Class 170 Primes & Primerseals); rates beyond attract the pay-factor bands, and <= (OAR - 0.16) or >= (OAR + 0.26) is a Non-Conformance.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'BAR vs OAR at 15 C (Table 503.4)',
      notes: 'MRWA Spec 503, Table 503.4 (Primes & Primerseals).'
    },
    {
      description: 'No binder sprayed outside the 50 mm margin (MRWA Spec 503.42.04, 503.53.4)',
      acceptanceCriteria: 'Binder sprayed outside the 50 mm margin (Clause 503.42.04) is not paid (503.53.4); spraying is controlled to hold the line within tolerance.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 503.42.04, 503.53.4.'
    },
    {
      description: 'Cover aggregate (primerseal) applied and rolled with the specified multi-tyred rollers (MRWA Spec 503.44, Annexure 503C)',
      acceptanceCriteria: 'For primerseals, cover aggregate is applied and rolled with the multi-tyred rollers specified in Annexure 503C. A prime alone carries no aggregate.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 503.44, Annexure 503C. Primerseals only.'
    },
    {
      description: 'WITNESS: traffic ban observed; final surfacing within one week of rolling completion (MRWA Spec 503.44, 503.39, Annexure 503C)',
      acceptanceCriteria: 'The specified traffic ban and traffic control measures (503.39, Annexure 503C) are observed on opening to traffic; where a primerseal is followed by a final seal, final surfacing follows within one week of rolling completion.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 503.44, 503.39, Annexure 503C.'
    },
    {
      description: 'Daily Works Record (Annexure 503D form) submitted to the Superintendent (MRWA Spec 503.81)',
      acceptanceCriteria: 'The daily Works Record on the Annexure 503D form is submitted to the Superintendent.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.81, Annexure 503D.'
    },
    {
      description: 'Non-conforming binder defects rectified within 60 days of completion at no cost to the Principal (MRWA Spec 503.52)',
      acceptanceCriteria: 'Non-conforming binder (per AS 2008 / sampling per Spec 201) is repaired or replaced within 60 days of completion at no cost to the Principal.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 503.52.'
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
  console.log(' WA (Main Roads WA) ITP Template Seeder - Bituminous Surfacing (Spec 503)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(waSprayedSealTemplate)
    await seedTemplate(waPrimePrimersealTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (2 bituminous-surfacing templates)')
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
