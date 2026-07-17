/**
 * Seed Script: NSW (TfNSW) Environmental ITP Templates
 *
 * Creates global ITP templates for NSW environmental / landscaping works:
 * - Erosion and Sediment Control (TfNSW G38 site measures + G36 management gates)
 * - Vegetation (TfNSW R178)
 * - Landscape Planting (TfNSW R179)
 * - Geotextiles — Separation and Filtration (TfNSW R63)
 *
 * All checklist content is derived from the TfNSW/RMS specifications named per
 * template. Two landscaping templates (R178 + R179) share activityType
 * 'landscaping' by design — the matcher surfaces both as a Tier-B shortlist.
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-nsw-environmental.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// NSW EROSION & SEDIMENT CONTROL (TfNSW G38 Soil & Water Management +
// G36 Environmental Protection management gates)
// G38: Ed 2 / Rev 4 (Jun 2020, current) — site ESC detail
// G36: Ed 4 / Rev 10 (Aug 2022, current) — CEMP / approvals gates
// =============================================================================

const nswErosionSedimentTemplate = {
  name: 'Erosion and Sediment Control (TfNSW G38/G36)',
  description: 'TfNSW erosion and sediment control — site soil & water measures per G38 (Ed 2 Rev 4) with the leading environmental-management gates (CEMP/CEMS, approvals) from G36 (Ed 4 Rev 10)',
  activityType: 'erosion_sediment_control',
  specificationReference: 'TfNSW G38 Ed 2 Rev 4 / G36 Ed 4 Rev 10',
  stateSpec: 'TfNSW',
  checklistItems: [
    // =========================================================================
    // ENVIRONMENTAL MANAGEMENT GATES (G36)
    // =========================================================================
    {
      description: 'Submit CEMP and selected CEMS documents for acceptance',
      acceptanceCriteria: 'CEMP/CEMS accepted by Superintendent; CEMS complies with NSW Government Environmental Management System Guidelines',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G36 Cl 3.1 - Hold Point before relevant environmental work'
    },
    {
      description: 'Obtain and evidence all approvals, licences and permits',
      acceptanceCriteria: 'All statutory approvals/licences/permits evidenced before relevant work',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G36 Cl 3.2.2 - Approval gate (Hold Point)'
    },

    // =========================================================================
    // SOIL & WATER PLANNING (G38)
    // =========================================================================
    {
      description: 'Prepare Soil & Water Management Plan (SWMP) with design calculations and drawings',
      acceptanceCriteria: 'SWMP prepared per Annexure G38/D planning requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 2.1, 2.4'
    },
    {
      description: 'Submit ESCP(s) and WQMP (where required) for the work section',
      acceptanceCriteria: 'ESCP/WQMP submitted and accepted before disturbing the section',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.1 - Hold Point; no ground disturbance until released'
    },
    {
      description: 'Size control measures to the Annexure G38/E design ARI for their design life',
      acceptanceCriteria: 'Controls sized to applicable ARI (e.g. sediment basin outlet 10 yr <12 mo / 20-100 yr >12 mo; sediment trap 5 / 10 yr)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 2.4, Annexure G38/E'
    },

    // =========================================================================
    // INSTALLATION & VERIFICATION (G38)
    // =========================================================================
    {
      description: 'Install erosion and sediment controls per accepted ESCP',
      acceptanceCriteria: 'Controls installed to the accepted ESCP layout',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'G38 - install before disturbing the section'
    },
    {
      description: 'Submit written notice that ESCP measures are installed',
      acceptanceCriteria: 'Written notice submitted; measures verified installed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.1 - Witness Point'
    },
    {
      description: 'Test sediment basin/trap embankment compaction',
      acceptanceCriteria: 'Relative compaction per design (value set in Annexure/project docs)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T166',
      notes: 'G38 Annexure G38/L - 1 test per 500 m³, minimum 2 per basin/trap'
    },

    // =========================================================================
    // ONGOING RECORDS (G38)
    // =========================================================================
    {
      description: 'Maintain inspection & maintenance register for controls',
      acceptanceCriteria: 'Register kept current (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.1.2'
    },
    {
      description: 'Keep dewatering records',
      acceptanceCriteria: 'Dewatering records maintained (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.4'
    },
    {
      description: 'Record approvals to stockpile on private land',
      acceptanceCriteria: 'Stockpile-on-private-land approvals recorded (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.5'
    },
    {
      description: 'Record water-extraction approvals/licences',
      acceptanceCriteria: 'Water-extraction approvals/licences recorded (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G38 Cl 3.8'
    },

    // =========================================================================
    // CLOSE-OUT (G36)
    // =========================================================================
    {
      description: 'Rectify and verify close-out of environmental nonconformities',
      acceptanceCriteria: 'Environmental nonconformities rectified and verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'G36 Cl 3.10 - Hold Point'
    }
  ]
}

// =============================================================================
// NSW VEGETATION (TfNSW R178)
// Ed 5 / Rev 4 (Aug 2008) — ACT-hosted mirror of the RMS-era edition
// =============================================================================

const nswVegetationTemplate = {
  name: 'Vegetation (TfNSW R178)',
  description: 'TfNSW/RMS vegetating of disturbed soil to stabilise it and minimise erosion — topsoiling, seeding, hydromulching, turfing and fertilising per R178 (Ed 5 Rev 4; ACT-hosted mirror of the RMS edition)',
  activityType: 'landscaping',
  specificationReference: 'TfNSW/RMS R178 Ed 5 Rev 4',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Verify topsoil compliance for source/import',
      acceptanceCriteria: 'Imported topsoil meets topsoil requirements (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R178 Cl 2.1'
    },
    {
      description: 'Delivery of imported topsoil',
      acceptanceCriteria: 'Hold Point released before topsoil is incorporated',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R178 Cl 2.1.3 - Hold Point on delivery of imported topsoil'
    },
    {
      description: 'Prepare and inspect subgrade/seedbed',
      acceptanceCriteria: 'Subgrade preparation inspected before proceeding',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 - subgrade preparation inspection stage'
    },
    {
      description: 'Application of fertiliser',
      acceptanceCriteria: 'Fertiliser applied at specified rate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 Cl 2.4 - Witness Point'
    },
    {
      description: 'Record/approve seed supplier(s)',
      acceptanceCriteria: 'Name of proposed seed supplier(s) recorded (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R178 Cl 2.3'
    },
    {
      description: 'Use of off-site pre-treated seed',
      acceptanceCriteria: 'Hold Point released before off-site pre-treated seed is used',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R178 Cl 3.3 - Hold Point'
    },
    {
      description: 'Sowing',
      acceptanceCriteria: 'Sowing carried out per specification',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 Cl 3.4.1 - Witness Point'
    },
    {
      description: 'Apply mulch/hydromulch at specified rate and depth',
      acceptanceCriteria: 'Minimum dry depth achieved within 48 h (e.g. sugar-cane 3,500 kg/ha → ≥5 mm; wood fibre 2,500 kg/ha → ≥2 mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 Table R178.1 / Annexure R178/D'
    },
    {
      description: 'Place turfing where specified',
      acceptanceCriteria: 'Turf placed per specification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 - where turfing specified'
    },
    {
      description: 'Verify vegetation establishment/maintenance',
      acceptanceCriteria: 'Vegetation established per maintenance period',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R178 - establishment/maintenance'
    }
  ]
}

// =============================================================================
// NSW LANDSCAPE PLANTING (TfNSW R179)
// Ed 1 / Rev 1 (Aug 2009) — ACT-hosted mirror of the RMS edition
// =============================================================================

const nswLandscapePlantingTemplate = {
  name: 'Landscape Planting (TfNSW R179)',
  description: 'TfNSW/RMS site preparation, supply and planting of containerised plants (mulching, fertilising, staking) and turfing per R179 (Ed 1 Rev 1; ACT-hosted mirror of the RMS edition)',
  activityType: 'landscaping',
  specificationReference: 'TfNSW/RMS R179 Ed 1 Rev 1',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Complete site preparation — weed control, cultivation, soil ameliorants',
      acceptanceCriteria: 'Site prepared per specification; Noxious Weeds Act 1993 compliance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 Cl 2/3'
    },
    {
      description: 'Confirm soil suitability',
      acceptanceCriteria: 'Soil meets AS 4419; pH per RMS T123 / AS 1289 D1.1 where specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'RMS T123 / AS 1289 D1.1',
      notes: 'R179 Annexure R179/M - AS 4419 soil for landscaping'
    },
    {
      description: 'Setting out of all planting positions complete',
      acceptanceCriteria: 'Hold Point released on advice that set-out is complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R179 Cl 3.4 - Hold Point'
    },
    {
      description: 'Planting holes excavated and ready for inspection',
      acceptanceCriteria: 'Hold Point released on inspection of planting holes',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 Cl 3.6.2 - Hold Point'
    },
    {
      description: 'Supply plants to specified species/stock and condition',
      acceptanceCriteria: 'Plants match specified species, stock size and condition',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 - plant supply'
    },
    {
      description: 'Plant, backfill and fertilise to specification',
      acceptanceCriteria: 'Planting, backfilling and fertilising per spec',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 - planting'
    },
    {
      description: 'Install staking, tying and tree guards',
      acceptanceCriteria: 'Staking/tying/guards installed per spec/drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 - staking and protection'
    },
    {
      description: 'Apply mulch to specified depth',
      acceptanceCriteria: 'Mulch applied to specified depth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 - mulching'
    },
    {
      description: 'Complete watering-in',
      acceptanceCriteria: 'Plants watered in after planting',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R179 - watering-in'
    },
    {
      description: 'Record Maintenance Inspection Reports through establishment period',
      acceptanceCriteria: 'Plants established per maintenance period (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R179 Cl 4.2 - Maintenance Inspection Reports'
    }
  ]
}

// =============================================================================
// NSW GEOTEXTILES — SEPARATION AND FILTRATION (TfNSW R63)
// Ed 4 / Rev 2 (Jun 2020) — vendor mirror of the current TfNSW edition
// =============================================================================

const nswGeotextilesTemplate = {
  name: 'Geotextiles — Separation and Filtration (TfNSW R63)',
  description: 'TfNSW separation/filtration geotextiles — material requirements, product certification, site sampling/testing and placement per R63 (Ed 4 Rev 2; vendor mirror of the current TfNSW edition)',
  activityType: 'geosynthetics',
  specificationReference: 'TfNSW R63 Ed 4 Rev 2',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Identify required Strength Class and Filtration Class for the application',
      acceptanceCriteria: 'Strength Class (A-E by D90) + Filtration Class selected per Table R63/E.1 / Annexure R63/A',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R63 Table R63/E.1'
    },
    {
      description: 'Receive and verify supplier Certificate of Compliance',
      acceptanceCriteria: 'Geotextile carries a supplier Certificate of Compliance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R63 Cl 2.5 - Certification gate (Identified Record)'
    },
    {
      description: 'Store and handle geotextile to protect from UV and damage',
      acceptanceCriteria: 'Storage/packaging/identification/delivery controls per spec',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R63 Cl 3'
    },
    {
      description: 'Site sampling of delivered geotextile',
      acceptanceCriteria: 'Site sampling witnessed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R63 Cl 2.4.2 - Witness Point'
    },
    {
      description: 'Sample each Lot per Table R63.1 frequency',
      acceptanceCriteria: 'Sample 1 roll per first 10,000 m² (or part), then 1 roll per subsequent 20,000 m² (max)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R63 Table R63.1 - sampling frequency'
    },
    {
      description: 'Verify grab and tearing strength meet Strength Class',
      acceptanceCriteria: 'Lot characteristic strength in weaker direction ≥ Strength Class (Table R63/E.1)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3706.2 / AS 3706.3',
      notes: 'R63 Cl 2.4 - grab (10 long + 10 transverse) & tear'
    },
    {
      description: 'Verify CBR burst and drop-cone puncture meet Strength Class',
      acceptanceCriteria: 'CBR burst & drop-cone puncture ≥ Strength Class requirement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3706.4 / AS 3706.5',
      notes: 'R63 Cl 2.4 - min 10 specimens each'
    },
    {
      description: 'Verify EOS, permittivity and flow rate meet Filtration Class',
      acceptanceCriteria: 'EOS (O95) and flow-rate/permittivity within Filtration Class limits (e.g. EOS ≤ 300 µm for D15 ≤ 75 µm; Q100 ≥ 5 L/s/m² Class 5)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3706.1 / AS 3706.7 / AS 3706.9',
      notes: 'R63 Table R63/E.1 - filtration verification'
    },
    {
      description: 'Prepare subgrade/receiving surface',
      acceptanceCriteria: 'Receiving surface prepared before placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R63 - surface preparation'
    },
    {
      description: 'Placement of geotextile',
      acceptanceCriteria: 'Hold Point released before geotextile is covered',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R63 Cl 4.1 - Hold Point'
    },
    {
      description: 'Place cover/backfill without damaging geotextile',
      acceptanceCriteria: 'Cover/backfill placed per construction-method controls; no damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R63 Cl 4.6.2'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  const existing = await prisma.iTPTemplate.findFirst({
    where: {
      name: templateData.name,
      stateSpec: templateData.stateSpec,
      projectId: null
    }
  })

  if (existing) {
    console.log(`⚠️  Template "${templateData.name}" already exists (ID: ${existing.id}) - Skipping`)
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

  const holdPoints = template.checklistItems.filter(i => i.pointType === 'hold_point')
  const witnessPoints = template.checklistItems.filter(i => i.pointType === 'witness')

  console.log(`✅ Created: ${template.name}`)
  console.log(`   ID: ${template.id}`)
  console.log(`   Spec: ${template.specificationReference}`)
  console.log(`   Items: ${template.checklistItems.length} (H:${holdPoints.length} W:${witnessPoints.length})`)
  console.log('')

  return template
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' NSW (TfNSW) Environmental ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswErosionSedimentTemplate)
    await seedTemplate(nswVegetationTemplate)
    await seedTemplate(nswLandscapePlantingTemplate)
    await seedTemplate(nswGeotextilesTemplate)

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
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
