/**
 * Seed Script: NATIONAL ITP Templates - Utilities (Water & Sewer Reticulation)
 *
 * Creates the platform's first NATIONAL utilities templates. Served by the
 * matcher (src/lib/itpMatcher.ts, NATIONAL_BASELINE_SPECS) as gap-fill for every
 * project and as PRIMARY for projects whose spec set is WSA.
 *
 * Templates:
 *   1. Water Supply Reticulation (WSA 03)   - activityType water_reticulation
 *   2. Gravity Sewer Reticulation (WSA 02)  - activityType sewer_reticulation
 *
 * HONESTY MODEL (critical): WSA 02/03 code bodies are paywalled and NOT
 * reproduced. The STAGES and HOLD/WITNESS STRUCTURE are national (they recur
 * across agency supplements). The ACCEPTANCE NUMBERS are agency-localised and
 * are NEVER hard-coded — deferred values read "per WSA 03/02 and agency
 * supplement"; verified agency figures appear only as attributed examples
 * ("e.g. 1200 kPa (Unitywater) / 1400 kPa (Icon Water) — agency-set"). Hold-point
 * OWNERSHIP (Consulting Engineer vs Council/authority) also varies by agency and
 * is stated in item text. Each project MUST apply its own water agency's
 * supplement to resolve the placeholders.
 *
 * Sources (public agency documents that quote/apply the WSA codes):
 *   - Icon Water (ACT) STD-SPE-G-012 (WSA 03 supplement) / STD-SPE-G-011 v5
 *     08/10/2025 (WSA 02 supplement)
 *   - Unitywater (SEQ) Pr9087 Rev 11 (water pressure test) / Pr9085 Rev 13
 *     (sewer pressure test)
 *   - FNQROC (Qld regional councils) CP1 Appendices Issue 9 05/23, Appendix C
 *     (water ITP) / Appendix B (sewer ITP) — the national stage+hold skeleton.
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-national-utilities.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// 1. WATER SUPPLY RETICULATION (WSA 03)
// =============================================================================

const nationalWaterTemplate = {
  name: 'Water Supply Reticulation (WSA 03)',
  description:
    'National water supply reticulation ITP (WSA 03 Water Supply Code of Australia). The construction stages and hold/witness structure are national; the WSA 03 code body is agency-AMENDED and PAYWALLED and is NOT reproduced here. ACCEPTANCE VALUES ARE AGENCY-SET, NOT NATIONAL: hydrostatic test pressure, allowable leakage rate, disinfection chlorine residual/contact time, sampling window, swabbing trigger, compaction density, cover/bedding dimensions and hold-point ownership all vary by water agency and appear below as "per WSA 03 and agency supplement" or as attributed examples only (e.g. 1200 kPa Unitywater / 1400 kPa Icon Water — agency-set). THE PROJECT MUST APPLY ITS OWN WATER AGENCY SUPPLEMENT (e.g. Icon Water STD-SPE-G-012, Unitywater, FNQROC CP1) to resolve every deferred value. Never import US/AWWA figures — units are metric/WSAA.',
  activityType: 'water_reticulation',
  specificationReference: 'WSA 03',
  stateSpec: 'WSA',
  checklistItems: [
    {
      description: 'Pre-start / site establishment',
      acceptanceCriteria:
        'Current approved plan on site; DBYD services located and marked; accredited main-layer on site; traffic and environmental management plans implemented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HOLD - FNQROC App C. Held by BOTH Consulting Engineer and Council/authority; hold-point ownership is agency-defined and may be reassigned by another agency.'
    },
    {
      description: 'Approved materials on site',
      acceptanceCriteria:
        'Pipe type/size/class to current plan; PE sleeving, marking tape, fittings and bedding all approved-product',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Surveillance - FNQROC App C.'
    },
    {
      description: 'Trench excavation',
      acceptanceCriteria:
        'Width and depth to design; shoring in place; existing services exposed and cleared. Cover and bedding dimensions per WSA 03 and agency supplement (WSA 03 drawings)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App C: Council hold prior to backfill (Consulting Engineer hold on excavation). Ownership agency-defined. Cover/bedding dims DEFERRED to agency.'
    },
    {
      description: 'Pipe laying and jointing',
      acceptanceCriteria:
        'Laid to line and grade; PE sleeving overlapped and sealed; jointing to standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App C.'
    },
    {
      description: 'Anchor / thrust blocks',
      acceptanceCriteria:
        'Visual and dimensional check before backfill; blocks sized for the agency system test pressure (e.g. Icon Water sizes for 1000 kPa base x 1.4 for a 1400 kPa test — agency-set). Design test pressure per WSA 03 and agency supplement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App C + App A: held by Consulting Engineer AND Council before backfill; ownership agency-defined. Design pressure DEFERRED to agency.'
    },
    {
      description: 'Embedment and trench fill',
      acceptanceCriteria:
        'Bedding/overlay material and compaction to standard. Compaction density and lift depth per WSA 03 and agency supplement; compaction testing by NATA-accredited laboratory (national requirement)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Compaction (NATA-accredited lab; method/density per agency)',
      notes: 'HOLD - FNQROC App C: Consulting Engineer Hold / Council Witness; ownership agency-defined. Density % and lift depth DEFERRED to agency; NATA-lab requirement is national.'
    },
    {
      description: 'Surface fittings',
      acceptanceCriteria:
        'Valve and hydrant boxes to finished level; spindle depths correct; indicator plates fitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App C.'
    },
    {
      description: 'Swabbing (where specified)',
      acceptanceCriteria:
        'Where the agency specifies swabbing (e.g. Icon Water requires it for DN >= 100 to remove deleterious material — agency-optional), swab per WSA 03 and agency supplement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App C / WSA 03 s18. Swabbing trigger DN and whether required are agency-set (Icon Water DN >= 100 when specified).'
    },
    {
      description: 'Pre-disinfection flush and clarity check',
      acceptanceCriteria:
        'Main flushed (e.g. flush velocity > 1 m/s per Icon Water — agency-set); water clarity/turbidity acceptance is a released Hold Point held by the authority. Clarity acceptance criteria per WSA 03 and agency supplement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - Icon Water G-012 makes clarity/turbidity a released Hold Point (held by the authority); ownership agency-defined. Flush velocity example is agency-set.'
    },
    {
      description: 'Disinfection / chlorination',
      acceptanceCriteria:
        'Main disinfected; initial free chlorine residual, contact time and residual per WSA 03 s20 and agency supplement (e.g. Icon Water initial free chlorine 20 mg/L — agency-set)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Free chlorine residual (value per agency)',
      notes: 'WITNESS - FNQROC App C: Consulting Engineer Hold / Council Witness on disinfection. Chlorine residual and contact time DEFERRED to WSA 03 s20 / agency; 20 mg/L is an Icon Water example.'
    },
    {
      description: 'Post-disinfection sampling',
      acceptanceCriteria:
        'Samples taken after disinfection (e.g. within 72 h per Icon Water — agency-set); bacteriological/water-quality pass criteria per agency and health regulator',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Bacteriological / water-quality clearance (criteria per agency/health regulator)',
      notes: 'FNQROC App C / WSA 03 s20. Sampling window (72 h Icon Water example) and pass criteria DEFERRED to agency/health regulator.'
    },
    {
      description: 'Hydrostatic pressure test',
      acceptanceCriteria:
        'NATA-accredited test with a certified/marked gauge (e.g. gauge calibration <= 12 months per Icon Water — agency-set); submit test procedure to the authority in advance (e.g. >= 5 working days per Icon Water — agency-set). Test pressure, allowable leakage rate and test duration per WSA 03 s19.4 and agency supplement (e.g. 1200 kPa default Unitywater / 1400 kPa Icon Water — agency-set). Thrust/anchor blocks adequately cured before pressurising',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Hydrostatic pressure test (WSA 03 s19.4; pressure/leakage/duration per agency)',
      notes: 'HOLD - FNQROC App C + App A: Consulting Engineer Hold / Council Witness; ownership agency-defined. Test pressure, leakage rate and duration DEFERRED to WSA 03 s19.4 / agency. 1200/1400 kPa are attributed examples only. NATA + certified gauge are national.'
    },
    {
      description: 'Hydrostatic Test Certificate',
      acceptanceCriteria:
        'Hydrostatic Test Certificate produced and submitted to the authority for approval',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'FNQROC / Unitywater / Icon Water. Test Certificate is the national closeout artifact.'
    },
    {
      description: 'Compaction test results collated',
      acceptanceCriteria:
        'Compaction test results collated from a NATA-accredited laboratory (density/lift per agency supplement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Compaction (NATA-accredited lab)',
      notes: 'FNQROC App C. NATA-lab requirement national; density % DEFERRED to agency.'
    },
    {
      description: 'Pre-connection inspection',
      acceptanceCriteria:
        'Isolation per job-specific letter; all prior records (test, compaction, disinfection, sampling) compiled and reviewed before connection',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HOLD - FNQROC App C: held by BOTH Consulting Engineer and Council/authority; ownership agency-defined.'
    },
    {
      description: 'Dual water flow test (property service)',
      acceptanceCriteria:
        'Drinking and recycled property-service flow test performed; meter ball valve locked and tagged. Procedure per WSA 03 and agency supplement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App C: held by all parties (Contractor, Consulting Engineer, Council); ownership agency-defined. Procedural — no numeric threshold.'
    },
    {
      description: 'Restoration',
      acceptanceCriteria:
        'Surface restored; visual check against pre-construction photos; clearance letter from Council/owner obtained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'FNQROC App C. Record.'
    },
    {
      description: 'Work-as-executed / asset handover',
      acceptanceCriteria:
        'Work-as-executed records and gauge/test certificate PDFs submitted. Submission package per agency asset-creation process (e.g. Icon Water STD-SPE-G-019) and agency supplement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'FNQROC / Icon Water. WAE + certificate handover package national; submission format DEFERRED to agency.'
    }
  ]
}

// =============================================================================
// 2. GRAVITY SEWER RETICULATION (WSA 02)
// =============================================================================

const nationalSewerTemplate = {
  name: 'Gravity Sewer Reticulation (WSA 02)',
  description:
    'National gravity sewer reticulation ITP (WSA 02 Gravity Sewerage Code of Australia), covering gravity mains and maintenance shafts. The construction stages and hold/witness structure are national; the WSA 02 code body is agency-AMENDED and PAYWALLED and is NOT reproduced here. ACCEPTANCE VALUES ARE AGENCY-SET, NOT NATIONAL: the gravity-main test METHOD is agency-selectable (low-pressure air / vacuum / hydrostatic — vacuum is Unitywater default), and allowable air-drop / vacuum-drop, rising-main test pressure, infiltration trigger, max deflection/ovality, min grade per DN, compaction density, cover/bedding dimensions and hold-point ownership all vary by agency. These appear below as "per WSA 02 and agency supplement" or as attributed examples only (e.g. 900 kPa rising-main default Unitywater — agency-set). THE PROJECT MUST APPLY ITS OWN WATER AGENCY SUPPLEMENT (e.g. Icon Water STD-SPE-G-011, Unitywater, FNQROC CP1) to resolve every deferred value. Never import US/AWWA figures — units are metric/WSAA.',
  activityType: 'sewer_reticulation',
  specificationReference: 'WSA 02',
  stateSpec: 'WSA',
  checklistItems: [
    {
      description: 'Pre-start / site establishment',
      acceptanceCriteria:
        'Current approved plan on site; receiving sewer located; DBYD services located and marked; accredited main-layer; environmental, safe-work and traffic plans implemented',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HOLD - FNQROC App B. Held by BOTH Consulting Engineer and Council/authority; ownership agency-defined.'
    },
    {
      description: 'Approved materials on site',
      acceptanceCriteria:
        'Pipe type/size/class to current plan; bedding, fittings, precast chambers and mortar all approved-product',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Surveillance - FNQROC App B.'
    },
    {
      description: 'Trench excavation',
      acceptanceCriteria:
        'Width and depth to design level; shoring; trench drainage; services exposed and cleared. Cover and bedding dimensions per WSA 02 and agency supplement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App B + App A: Consulting Engineer inspection after excavation prior to bedding; ownership agency-defined. Cover/bedding dims DEFERRED to agency.'
    },
    {
      description: 'Pipe laying, jointing and grade',
      acceptanceCriteria:
        'Laid to grade; jointing to standard; trench stops/bulkheads; property connection sewers; ID tape. Minimum grade per pipe DN per WSA 02 and agency design standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App B. Min grade per DN DEFERRED to agency design standard.'
    },
    {
      description: 'Maintenance shafts',
      acceptanceCriteria:
        'Base/channels/benching formed; precast shaft assembled in order; step-iron spacing to standard; minimum one make-up ring; cover and frame set',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App B: Consulting Engineer Hold; ownership agency-defined.'
    },
    {
      description: 'Anchor / thrust blocks',
      acceptanceCriteria:
        'Visual and dimensional check to standard before backfill',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'HOLD - FNQROC App B: held by BOTH Consulting Engineer and Council; ownership agency-defined.'
    },
    {
      description: 'Embedment and trench fill',
      acceptanceCriteria:
        'Bedding/surround material and compaction. Compaction density and lift depth per WSA 02 and agency supplement; compaction testing by NATA-accredited laboratory (national requirement)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Compaction (NATA-accredited lab; method/density per agency)',
      notes: 'HOLD - FNQROC App B: Consulting Engineer Hold / Council Witness; ownership agency-defined. Density % and lift depth DEFERRED to agency; NATA-lab requirement is national.'
    },
    {
      description: 'Surface fittings',
      acceptanceCriteria:
        'Surface boxes and surrounds set to finished level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App B.'
    },
    {
      description: 'Visual inspection (above ground)',
      acceptanceCriteria:
        'Above-ground visual inspection — the first step of the WSA 02 s21 acceptance-test order (visual -> compaction -> pressure -> infiltration -> deflection -> grade -> CCTV)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'FNQROC App B / Icon Water G-011 s21 sequencing (national test order).'
    },
    {
      description: 'Pressure / vacuum test',
      acceptanceCriteria:
        'Test method agency-selectable: low-pressure air, vacuum (e.g. Unitywater default) or hydrostatic; for rising mains a hydrostatic test applies (e.g. 900 kPa default Unitywater — agency-set). Submit test procedure to the authority in advance (e.g. >= 5 working days per Icon Water — agency-set); gauge certified/marked (e.g. <= 12-month calibration per Icon Water — agency-set). Test method, allowable air/vacuum drop, pressure and duration per WSA 02 s21.4 and agency supplement',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Pressure/vacuum test (WSA 02 s21.4; method + drop + duration per agency)',
      notes: 'HOLD - FNQROC App B + App A: Consulting Engineer Hold / Council Witness; ownership agency-defined. Method agency-selectable (vacuum default Unitywater). Allowable drop and duration DEFERRED to WSA 02 s21.4 / agency; 900 kPa rising-main is an attributed example. NATA + certified gauge national.'
    },
    {
      description: 'Infiltration test (conditional)',
      acceptanceCriteria:
        'Performed only where triggered (e.g. Icon Water: free water table >= 150 mm above a DN >= 150 sewer, or on authority request — agency-set); allowable infiltration rate per WSA 02 and agency supplement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Infiltration test (rate per agency)',
      notes: 'FNQROC App B / WSA 02 s21. Trigger (150 mm / DN 150 Icon Water example) and allowable rate DEFERRED to agency.'
    },
    {
      description: 'Deflection / ovality test (flexible sewers)',
      acceptanceCriteria:
        'Flexible-pipe deflection/ovality measured (laser profiling preferred, e.g. per Icon Water — agency-set); maximum allowable deflection % and through-maintenance-shaft deflection per WSA 02 s16.2 and agency supplement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Deflection / ovality (laser profiling; max % per agency)',
      notes: 'WITNESS - FNQROC App B (testing witnessed). Method preference (laser profiling) is Icon Water example; max deflection % DEFERRED to WSA 02 s16.2 / agency.'
    },
    {
      description: 'Grade measurement',
      acceptanceCriteria:
        'As-laid grade measured; minimum grade per pipe DN per WSA 02 and agency design standard',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Grade measurement (min grade per DN per agency)',
      notes: 'FNQROC App B / WSA 02 s21. Min grade per DN DEFERRED to agency design standard.'
    },
    {
      description: 'CCTV inspection',
      acceptanceCriteria:
        '100% of main length inspected by CCTV per WSA 05-2020 Conduit Inspection Reporting Code, just prior to final handover (coverage national); defect-grading thresholds per WSA 05-2020',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'CCTV per WSA 05-2020 (defect grades per WSA 05)',
      notes: 'WITNESS - Icon Water G-011: mandatory 100% CCTV review before final handover. 100% coverage national; defect grades per WSA 05-2020.'
    },
    {
      description: 'Pressure / vacuum Test Certificate',
      acceptanceCriteria:
        'Pressure/vacuum Test Certificate produced and submitted to the authority for approval',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'FNQROC / Unitywater. Test Certificate is the national closeout artifact.'
    },
    {
      description: 'Compaction test results collated',
      acceptanceCriteria:
        'Compaction test results collated from a NATA-accredited laboratory (density/lift per agency supplement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Compaction (NATA-accredited lab)',
      notes: 'FNQROC App B. NATA-lab requirement national; density % DEFERRED to agency.'
    },
    {
      description: 'Pre-connection inspection',
      acceptanceCriteria:
        'Work-as-constructed compiled; vacuum/air + deflection + CCTV results reviewed; flow-management per job-specific letter before connection',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'HOLD - FNQROC App B: held by BOTH Consulting Engineer and Council/authority; ownership agency-defined.'
    },
    {
      description: 'Restoration',
      acceptanceCriteria:
        'Surface restored; visual check against pre-construction photos; clearance letter from Council/owner obtained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'FNQROC App B. Record.'
    },
    {
      description: 'Work-as-executed / asset handover',
      acceptanceCriteria:
        'Work-as-executed records and test/gauge certificate PDFs submitted. Submission package per agency asset-creation process (e.g. Icon Water STD-SPE-G-019) and agency supplement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'FNQROC / Icon Water. WAE + certificate handover package national; submission format DEFERRED to agency.'
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
  console.log(' NATIONAL ITP Template Seeder - Utilities (Water & Sewer)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nationalWaterTemplate)
    await seedTemplate(nationalSewerTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (2 national utilities templates)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

withItpTemplateSeedLock(prisma, main)
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
