/**
 * Seed Script: NSW (TfNSW) Road Furniture ITP Templates
 *
 * Creates global ITP templates for NSW road furniture:
 * - Wire Rope Safety Barrier (TfNSW R132)
 * - W-Beam Guard Fence (TfNSW R132)
 * - Concrete Road Safety Barrier (TfNSW R132)
 * - Pavement Marking (TfNSW R145, with R142 RRPM items)
 * - Noise Barriers (TfNSW R271)
 * - Fencing (TfNSW R201)
 *
 * R132 (Safety Barrier Systems = TS 03291) covers all three barrier types; the
 * three barrier templates share R132's common hold points (Accepted Products
 * gate, setting-out Cl 4.1.2, end-treatment Cl 1.4) plus the ±20 mm tolerance
 * item, and each adds its type-specific checks. Fencing and Noise Barriers
 * share activityType 'fencing_noise_walls' by design (Tier-B shortlist).
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-nsw-road-furniture.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';

const prisma = new PrismaClient()

// =============================================================================
// R132 SAFETY BARRIER SYSTEMS — shared items (TfNSW R132 = TS 03291)
// 3 hold points in Annexure R132/C: Cl 1.4 (end treatments), Cl 4.1.2
// (setting out), Cl 4.4 (WRSB curvature — type-specific). Product acceptance
// gate = TfNSW Accepted Safety Barrier Products list. Tolerances: height/line
// ±20 mm, verticality ±15 mm at top, post spacing ±25 mm, face steps ≤5 mm.
// =============================================================================

// Leading items shared by all three barrier types.
const r132LeadingItems = [
  {
    description: 'Confirm barrier and end-treatment products are on the TfNSW Accepted Safety Barrier Products list',
    acceptanceCriteria: 'All barrier system components and end/terminal treatments are accepted products',
    pointType: 'hold_point',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
    testType: null,
    notes: 'R132 - Accepted Safety Barrier Products gate before incorporation'
  },
  {
    description: 'Verify component material certificates and galvanizing conformity',
    acceptanceCriteria: 'Posts, rails/cables and fittings certified; galvanizing conforms',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
    testType: null,
    notes: 'R132 - material certification'
  },
  {
    description: 'Setting out of barrier line',
    acceptanceCriteria: 'Hold Point released; ≥2 working days notice before installing posts',
    pointType: 'hold_point',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
    testType: null,
    notes: 'R132 Cl 4.1.2 - Hold Point (setting out)'
  }
]

// Closing items shared by all three barrier types.
const r132ClosingItems = [
  {
    description: 'Verify installed geometry within R132 tolerances',
    acceptanceCriteria: 'Height ±20 mm; line ±20 mm; verticality ±15 mm at top; post spacing ±25 mm; face steps ≤5 mm',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
    testType: null,
    notes: 'R132 - installation tolerances'
  },
  {
    description: 'Repair galvanizing damage within 24 hours',
    acceptanceCriteria: 'Damaged galvanizing repaired within 24 h of occurrence',
    pointType: 'standard',
    responsibleParty: 'contractor',
    evidenceRequired: 'photo',
    testType: null,
    notes: 'R132 - galvanizing repair'
  },
  {
    description: 'Exposing traffic to the barrier without operational end treatments',
    acceptanceCriteria: 'Hold Point released; risk assessment completed, 3 working days notice given',
    pointType: 'hold_point',
    responsibleParty: 'contractor',
    evidenceRequired: 'document',
    testType: null,
    notes: 'R132 Cl 1.4 - Hold Point (end treatments)'
  },
  {
    description: 'Lot conformance review and sign-off',
    acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned',
    pointType: 'hold_point',
    responsibleParty: 'superintendent',
    evidenceRequired: 'signature',
    testType: null,
    notes: 'Final lot approval'
  }
]

// =============================================================================
// NSW WIRE ROPE SAFETY BARRIER (TfNSW R132)
// =============================================================================

const nswWireRopeBarrierTemplate = {
  name: 'Wire Rope Safety Barrier (TfNSW R132)',
  description: 'TfNSW wire rope safety barrier (WRSB) install per R132 Safety Barrier Systems (= TS 03291) — posts, cables, tensioning and curvature certification',
  activityType: 'wire_rope_barrier',
  specificationReference: 'TfNSW R132 (TS 03291)',
  stateSpec: 'TfNSW',
  checklistItems: [
    ...r132LeadingItems,
    {
      description: 'Install posts to line in foundation sockets/sleeves per drawings',
      acceptanceCriteria: 'Posts installed to setting-out line and foundation detail',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R132 - WRSB post installation'
    },
    {
      description: 'Certify WRSB curvature/radius before construction',
      acceptanceCriteria: 'Curvature certified; WRSB prohibited where radius <200 m or sag K <30',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R132 Cl 4.4 - Hold Point (WRSB construction / curvature)'
    },
    {
      description: 'Tension cables and end-treatment anchor cables to specification',
      acceptanceCriteria: 'Cable tension per spec; end-treatment cables tensioned to 50 Nm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R132 - wire rope tensioning'
    },
    ...r132ClosingItems
  ]
}

// =============================================================================
// NSW W-BEAM GUARD FENCE (TfNSW R132)
// =============================================================================

const nswWBeamGuardFenceTemplate = {
  name: 'W-Beam Guard Fence (TfNSW R132)',
  description: 'TfNSW W-beam steel guard fence install per R132 Safety Barrier Systems (= TS 03291) — posts, rail, MELT terminal and post-rail load test',
  activityType: 'w_beam_guardrail',
  specificationReference: 'TfNSW R132 (TS 03291)',
  stateSpec: 'TfNSW',
  checklistItems: [
    ...r132LeadingItems,
    {
      description: 'Install posts and verify post-rail assembly load test',
      acceptanceCriteria: 'Apply 1 kN at the top 200 mm of post → movement ≤3 mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: '1 kN post load test',
      notes: 'R132 - post-rail 1 kN / ≤3 mm movement'
    },
    {
      description: 'Compact MELT terminal soil-plate backfill',
      acceptanceCriteria: '≥95% relative compaction; no cement in MELT post backfill',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'T166',
      notes: 'R132 - MELT soil-plate backfill compaction'
    },
    {
      description: 'Install W-beam rail, blockouts and fittings',
      acceptanceCriteria: 'Rail lapped in the direction of traffic; bolts/blockouts per drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R132 - W-beam rail installation'
    },
    ...r132ClosingItems
  ]
}

// =============================================================================
// NSW CONCRETE ROAD SAFETY BARRIER (TfNSW R132)
// =============================================================================

const nswConcreteBarrierTemplate = {
  name: 'Concrete Road Safety Barrier (TfNSW R132)',
  description: 'TfNSW concrete road safety barrier (cast in-situ or precast) per R132 Safety Barrier Systems (= TS 03291) — profile, joints and surface finish',
  activityType: 'concrete_barrier',
  specificationReference: 'TfNSW R132 (TS 03291)',
  stateSpec: 'TfNSW',
  checklistItems: [
    ...r132LeadingItems,
    {
      description: 'Construct barrier to profile and alignment per approved drawings',
      acceptanceCriteria: 'Barrier profile and alignment match approved drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R132 - concrete barrier profile'
    },
    {
      description: 'Cut contraction joints',
      acceptanceCriteria: 'Joints 50 mm deep at ≤4.5 m spacing, sawn within 12 h of placing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R132 - joints ≤4.5 m, saw within 12 h'
    },
    {
      description: 'Verify exposed concrete surface finish',
      acceptanceCriteria: 'Surface finish meets AS 3610 Class 3',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R132 - AS 3610 Class 3 finish'
    },
    ...r132ClosingItems
  ]
}

// =============================================================================
// NSW PAVEMENT MARKING (TfNSW R145, performance-based) + R142 RRPM items
// R145: Ed 4 / Rev 0 (Feb 2016), vendor mirror of the RMS-era edition.
// R142 (RRPM) items are sourced from TfNSW R142 Ed 4 Rev 7 (Jun 2020,
// IC-QA-R142), the current published QA spec, with clause references.
// =============================================================================

const nswPavementMarkingTemplate = {
  name: 'Pavement Marking (TfNSW R145)',
  description: 'TfNSW performance-based pavement marking per R145 (Ed 4 Rev 0; vendor mirror) with raised pavement marker (RRPM) items per TfNSW R142 Ed 4 Rev 7 (Jun 2020, IC-QA-R142).',
  activityType: 'pavement_marking',
  specificationReference: 'TfNSW R145 Ed 4 Rev 0 (+ R142 Ed 4 Rev 7 RRPMs)',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Evidence Contractor accreditation to the Painting Contractors Certification Program',
      acceptanceCriteria: 'Contractor accredited per Cl 2.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R145 Cl 2.1, Annexure R145/D - accreditation gate'
    },
    {
      description: 'Submit proposed materials list with limitations',
      acceptanceCriteria: 'Materials list + seasonal/compatibility limitations submitted (Contractor-selected to meet performance)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R145 Cl 3.6, Annexure R145/D'
    },
    {
      description: 'Prepare surface; mask/remove redundant markings',
      acceptanceCriteria: 'Surface prepared, redundant markings removed/masked',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R145 - surface preparation'
    },
    {
      description: 'Set out pavement markings',
      acceptanceCriteria: 'Hold Point released before application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R145 Cl 3.4 - Hold Point (set out)'
    },
    {
      description: 'Apply markings within positional and dimensional tolerances',
      acceptanceCriteria: 'Marking positions/dimensions per Table R145.2 (and profile dims Table R145.1)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R145 Table R145.2 / R145.1'
    },
    {
      description: 'Verify dry retroreflectivity within first 20 days after opening',
      acceptanceCriteria: 'Dry RL ≥ 250 mcd/lux/m²',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Field retroreflectivity (RL)',
      notes: 'R145 Cl 4.1(i)'
    },
    {
      description: 'Verify dry retroreflectivity at 310-340 days after opening',
      acceptanceCriteria: 'Dry RL ≥ 200 mcd/lux/m² (intervention level 150 mcd/lux/m²)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Field retroreflectivity (RL)',
      notes: 'R145 Cl 4.1(ii)/(iii)'
    },
    {
      description: 'Verify wet retroreflectivity',
      acceptanceCriteria: 'Wet RL ≥ 80 mcd/lux/m²',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Field retroreflectivity (RL)',
      notes: 'R145 Cl 4.1'
    },
    {
      description: 'Verify skid resistance',
      acceptanceCriteria: 'Skid resistance ≥ 40 BPN',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'British Pendulum (BPN)',
      notes: 'R145 Cl 4.2'
    },
    {
      description: 'Verify colour and luminance factor conform',
      acceptanceCriteria: 'Colour within specified colour box (Cl 4.3); luminance factor met (Cl 4.4)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'R145 Cl 4.3, 4.4'
    },
    {
      description: 'Record dry retroreflectivity test results',
      acceptanceCriteria: 'Test results recorded (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R145 Cl 5'
    },
    // --- RRPM items (TfNSW R142 Ed 4 Rev 7, Jun 2020, IC-QA-R142) ---
    {
      description: 'Set out RRPMs then hold for Principal before fixing',
      acceptanceCriteria: 'RRPMs set out to drawings and tolerances; notify Principal that set-out is complete; markers not fixed until the Hold Point is released (Principal may inspect the set out first)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R142 §3.1, Annexure R142/C1 — R142\'s only Hold Point. TfNSW R142 Ed 4 Rev 7 (Jun 2020, IC-QA-R142).'
    },
    {
      description: 'Use only prequalified AS/NZS 1906.3 markers with TfNSW 3354 adhesive; installer PCCP Class 25 accredited',
      acceptanceCriteria: 'Markers Principal-prequalified (ATD 2015/01), comply with AS/NZS 1906.3 and identifiable ≥12 months; adhesive to TfNSW 3354; installer PCCP Class 25 accreditation evidence provided; signed materials statement with NATA test results (≤36 months old) submitted ≥7 days before use',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1906.3',
      notes: 'R142 §1.4, §2.1–2.3. TfNSW R142 Ed 4 Rev 7 (Jun 2020, IC-QA-R142).'
    },
    {
      description: 'Fix RRPMs to position/rotation tolerance and verify retroreflective performance',
      acceptanceCriteria: 'Longitudinal ≤100 mm, transverse ≤25 mm (and ≤25 mm from any RRPM in the same line within 1.5 m), rotation ±4° along centreline; bonded per manufacturer recommendations; CIL ≥ White 10 / Yellow 5 / Red 5 mcd/lx; ≥80% effective for 12 months with ≤3 consecutive ineffective (new install), or 100% effective within 30 days (partial replacement)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'CIL (RPM retroreflectometer, AS/NZS 1906.3)',
      notes: 'R142 §3.2, §3.3, §4.1–4.2. TfNSW R142 Ed 4 Rev 7 (Jun 2020, IC-QA-R142).'
    }
  ]
}

// =============================================================================
// NSW NOISE BARRIERS (TfNSW R271 — Design and Construction of Noise Walls)
// Ed 2 / Rev 5 (Jun 2020) — current TfNSW edition.
// =============================================================================

const nswNoiseBarriersTemplate = {
  name: 'Noise Barriers (TfNSW R271)',
  description: 'TfNSW design and construction of noise walls/barriers per R271 (Ed 2 Rev 5) — acoustic performance, panel manufacture, foundations and (where the wall is a traffic barrier) collision safety',
  activityType: 'fencing_noise_walls',
  specificationReference: 'TfNSW R271 Ed 2 Rev 5',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Accept load / structural test results',
      acceptanceCriteria: 'Design Engineer certifies load test results satisfactory',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'R271 Cl 4.1.3 - Hold Point'
    },
    {
      description: 'Confirm structural design to AS/NZS 1170 series',
      acceptanceCriteria: 'Dead/live/wind loads per AS/NZS 1170.0/.1/.2; serviceability R = 20 yr unless specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 3'
    },
    {
      description: 'Certify panel materials',
      acceptanceCriteria: 'Panel materials certified; material test records kept',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 6.5 - Hold Point'
    },
    {
      description: 'Verify acoustic Sound Reduction Index (Rw)',
      acceptanceCriteria: 'Rw ≥ 26.0 (normal use) or ≥ 31.0 where noise reduction > 10 dB(A)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS ISO 717.1',
      notes: 'R271 Cl 3.3 - acoustic gate'
    },
    {
      description: 'Prepare and accept concrete pigment samples',
      acceptanceCriteria: 'Pigment samples accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R271 Cl 7.6.1 - Hold Point'
    },
    {
      description: 'Demonstrate reparability',
      acceptanceCriteria: 'Reparability demonstrated and accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 7.6.2 - Hold Point'
    },
    {
      description: 'Prepare and accept panel specimen',
      acceptanceCriteria: 'Panel specimen accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R271 Cl 7.6.3 - Hold Point'
    },
    {
      description: 'Set out survey marks',
      acceptanceCriteria: 'Survey marks set out',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 8.1 - Hold Point'
    },
    {
      description: 'Geotechnical verification of Site/foundation',
      acceptanceCriteria: 'Geotechnical Engineer verifies Site/foundation meets design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 8.5'
    },
    {
      description: 'Inspect foundations',
      acceptanceCriteria: 'Foundations inspected and accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R271 Cl 8.5.4 - Hold Point'
    },
    {
      description: 'Erect panels/posts to acoustic design height',
      acceptanceCriteria: 'Wall height meets acoustic design; no gaps/obstructions increasing transmission or reducing capacity',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R271 Cl 8 / 635 / 642 - height gate'
    },
    {
      description: 'Manage damaged / repaired panels and post-installation repairs',
      acceptanceCriteria: 'Damaged panels, repaired panels and repairs after installation managed and accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 8.7 - Hold Point (covers three distinct held events)'
    },
    {
      description: 'Complete falling-debris / stone-impact / collision-safety tests where required',
      acceptanceCriteria: 'Tests per Annexures R271/E (falling debris), R271/F (stone impact), R271/G (collision safety where wall is a traffic barrier)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'R271 Annexures E/F/G - where required'
    },
    {
      description: 'Issue Completion Certificate and certify conformity',
      acceptanceCriteria: 'Completion Certificate issued; conformity certified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R271 Cl 8.10 - Hold Point'
    }
  ]
}

// =============================================================================
// NSW FENCING (TfNSW R201)
// Ed 4 / Rev 3 (Jul 2011) — ACT-hosted mirror of the RMS edition.
// =============================================================================

const nswFencingTemplate = {
  name: 'Fencing (TfNSW R201)',
  description: 'TfNSW/RMS supply and erection of fencing, gates, flood gates and stock grids (incl. connection to existing fencing and fence-line clearing) per R201 (Ed 4 Rev 3; ACT-hosted mirror of the RMS edition)',
  activityType: 'fencing_noise_walls',
  specificationReference: 'TfNSW/RMS R201 Ed 4 Rev 3',
  stateSpec: 'TfNSW',
  checklistItems: [
    {
      description: 'Supply fencing materials/components with Certificate of Compliance',
      acceptanceCriteria: 'Materials/components carry a Certificate of Compliance (Identified Record)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 Cl 2.17 - certification'
    },
    {
      description: 'Verify galvanizing/steel/fastener conformity to referenced AS standards',
      acceptanceCriteria: 'Conforms to AS 1074/1163 (steel), AS 1214/1397 (galvanizing), AS/NZS 1111.1/1112.3/1237.1/1390 (fasteners), AS/NZS 1554.1 (welding)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 - referenced AS standards'
    },
    {
      description: 'Set out fence line',
      acceptanceCriteria: 'Fence line set out per drawings',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 - setting out'
    },
    {
      description: 'Removal of trees with trunk diameter exceeding 100 mm',
      acceptanceCriteria: 'Hold Point released before removing trees with trunk Ø > 100 mm',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 Cl 4.3.2 - Hold Point (ties to G36 environmental controls)'
    },
    {
      description: 'Erect posts to line and level; compact footings where specified',
      acceptanceCriteria: 'Posts to line/level; footings compacted (RMS T166 where specified)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R201 - post erection'
    },
    {
      description: 'Install wire/mesh, gates, flood gates and stock grids',
      acceptanceCriteria: 'Installed to drawings / Annexure R201/A (e.g. welded-mesh infill for rabbit-proof gates)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R201 - installation'
    },
    {
      description: 'Incorporation of fencing/gates/flood gates/stock grids into the Works',
      acceptanceCriteria: 'Hold Point released for incorporation into the Works',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 Cl 2.17 - Hold Point'
    },
    {
      description: 'Connection of new fencing to existing fencing',
      acceptanceCriteria: 'Hold Point released; connection arrangement recorded (Identified Record)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'R201 Cl 4.1 - Hold Point'
    },
    {
      description: 'Verify wire tension / mesh / grid dimensions against drawings',
      acceptanceCriteria: 'Wire tension, mesh and grid dimensions per drawings/Annexure R201/A',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'R201 - final verification'
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
  console.log(' NSW (TfNSW) Road Furniture ITP Template Seeder')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(nswWireRopeBarrierTemplate)
    await seedTemplate(nswWBeamGuardFenceTemplate)
    await seedTemplate(nswConcreteBarrierTemplate)
    await seedTemplate(nswPavementMarkingTemplate)
    await seedTemplate(nswNoiseBarriersTemplate)
    await seedTemplate(nswFencingTemplate)

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
