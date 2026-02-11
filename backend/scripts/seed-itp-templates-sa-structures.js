/**
 * Seed Script: SA (DIT) ITP Templates - Structures
 *
 * Creates global ITP templates for SA based on DIT specifications.
 * These templates have projectId = null and stateSpec = 'DIT' so they
 * appear for any project using DIT specification set.
 *
 * Templates (8):
 *   1. Structural Concrete (ST-SC-S7/C7/C6)
 *   2. Reinforcement Placement (ST-SC-S6)
 *   3. Piling (ST-PI-C1/C2/C3/C4)
 *   4. Structural Steelwork (ST-SS-S1/S2/C1)
 *   5. Bridge Bearings (ST-SD-D1 / AS 5100.4)
 *   6. Precast Concrete Elements (ST-SC-S3/C1)
 *   7. Post-Tensioning (ST-SC-C2)
 *   8. Bridge Deck Waterproofing (ST-SD-D1 / Project Specific)
 *
 * Run with: node scripts/seed-itp-templates-sa-structures.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: STRUCTURAL CONCRETE (ST-SC-S7/C7/C6)
// =============================================================================

const saStructuralConcreteTemplate = {
  name: 'Structural Concrete (DIT ST-SC-S7/C7/C6)',
  description: 'DIT Structural Concrete covering supply of concrete (ST-SC-S7), placement of concrete (ST-SC-C7), and formwork (ST-SC-C6). Includes mix design approval, temperature limits 5-35°C, curing, crack assessment, blowholes/honeycombing non-conformance criteria, and pre-pour hold points.',
  activityType: 'structures',
  specificationReference: 'ST-SC-S7/C7/C6',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit concrete mix design for approval',
      acceptanceCriteria: 'Mix design accepted by Principal\'s Authorised Person; cementitious component limited to GP or SR cement per AS 3972',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379',
      notes: 'ST-SC-S7 — Cement type GP or SR per AS 3972. Mineral additions not permitted without approval. Coarse aggregate sizes per Table ST-SC-S7 3-1.'
    },
    {
      description: 'Submit concrete placement procedures',
      acceptanceCriteria: 'Placement procedures accepted by Principal\'s Authorised Person including pour sequence, joint locations, and curing method',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 — Procedures must address temperature limits, pour sequence, joint treatment, and curing.'
    },
    {
      description: 'Submit formwork design and drawings',
      acceptanceCriteria: 'Formwork design accepted by Principal\'s Authorised Person; compliance with ST-SC-C6',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C6 — Formwork design must demonstrate adequate strength and stiffness.'
    },
    {
      description: 'Submit curing compound product details',
      acceptanceCriteria: 'Curing compound complies with AS 3799; product details submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3799',
      notes: 'ST-SC-C7 — All curing compounds must comply with AS 3799.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify concrete supply source and batch plant certification',
      acceptanceCriteria: 'Concrete supplier holds current certification; batch plant records available',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379',
      notes: 'ST-SC-S7 — Concrete supply per AS 1379.'
    },
    {
      description: 'Verify aggregate compliance — particle shape and size',
      acceptanceCriteria: 'Aggregate particle shape complies with ST-SC-S7 section 8; coarse aggregate size per Table ST-SC-S7 3-1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'ST-SC-S7 — For piles and closely reinforced sections, specific aggregate size requirements apply.'
    },
    {
      description: 'Obtain concrete delivery dockets and verify compliance',
      acceptanceCriteria: 'Delivery dockets confirm mix design, slump, water/cement ratio, and batching details',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S7 — Dockets must confirm compliance with approved mix design.'
    },

    // =========================================================================
    // FORMWORK
    // =========================================================================
    {
      description: 'Inspect formwork before concrete placement',
      acceptanceCriteria: 'Formwork aligned, dimensionally correct, clean, and adequately supported; release agent applied',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C6 — Hold Point. Formwork must be inspected and accepted before concrete placement.'
    },
    {
      description: 'Verify formwork tolerances',
      acceptanceCriteria: 'Formwork dimensions within specified tolerances for pile caps, footings, and structural elements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 — Specific tolerances for pile caps and footings defined in specification.'
    },

    // =========================================================================
    // PRE-POUR INSPECTION
    // =========================================================================
    {
      description: 'Pre-pour inspection — reinforcement, formwork, and embedments',
      acceptanceCriteria: 'Reinforcement placed to drawing, cover verified, formwork secure, embedments positioned correctly',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C7 — Hold Point. Pre-pour inspection constitutes a Hold Point; concrete must not be placed until released.'
    },
    {
      description: 'Verify construction joint preparation',
      acceptanceCriteria: 'All construction joints roughened to expose aggregate for bond between new and old concrete',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-SC-C7 — All construction joints (including those with keys or dowels) must be roughened.'
    },

    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Check air temperature before concrete placement',
      acceptanceCriteria: 'Air temperature ≥5°C and shade temperature ≤35°C at time of placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 — Concrete must not be placed if air temp <5°C or shade temp >35°C.'
    },
    {
      description: 'Verify concrete delivery temperature',
      acceptanceCriteria: 'Concrete temperature at acceptance point ≥5°C and ≤35°C',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 — Concrete when delivered must not be <5°C or >35°C.'
    },
    {
      description: 'Witness concrete placement and vibration',
      acceptanceCriteria: 'Concrete placed and vibrated per approved procedures; no segregation or cold joints',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C7 — Witness Point for concrete placement activities.'
    },
    {
      description: 'Take concrete test cylinders during placement',
      acceptanceCriteria: 'Test cylinders taken at specified frequency per AS 1379; correctly labelled and stored',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8',
      notes: 'ST-SC-S7 / AS 1379 — Sample and test per specified frequency.'
    },
    {
      description: 'Perform slump testing on delivered concrete',
      acceptanceCriteria: 'Slump within specified range for approved mix design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3',
      notes: 'ST-SC-S7 — Slump test per AS 1012.3.'
    },

    // =========================================================================
    // CURING
    // =========================================================================
    {
      description: 'Commence curing immediately after finishing',
      acceptanceCriteria: 'Curing compound applied or wet curing commenced immediately; method per approved procedure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-SC-C7 — Curing compounds must comply with AS 3799.'
    },
    {
      description: 'Monitor curing duration',
      acceptanceCriteria: 'Curing maintained for specified duration; temperature and moisture conditions documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 — Curing duration per specification requirements.'
    },

    // =========================================================================
    // POST-POUR INSPECTION
    // =========================================================================
    {
      description: 'Inspect concrete surface for blowholes',
      acceptanceCriteria: 'No blowholes deeper than 10% of specified cover; deeper blowholes treated as Non-Conformance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C7 — Blowholes >10% of specified cover = Non-Conformance per PC-QA1/PC-QA2.'
    },
    {
      description: 'Inspect for honeycombing',
      acceptanceCriteria: 'No instances of honeycombing; any honeycombing treated as Non-Conformance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C7 — Any honeycombing = Non-Conformance per PC-QA1/PC-QA2.'
    },
    {
      description: 'Assess cracks against specification limits',
      acceptanceCriteria: 'Crack widths within limits per Table ST-SC-C7 7-1 for applicable exposure classification',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C7 Table 7-1 — Acceptable crack widths by exposure classification.'
    },
    {
      description: 'Review compressive strength test results',
      acceptanceCriteria: 'Compressive strength results meet specified characteristic strength at required age',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'ST-SC-S7 — Compressive strength per AS 1012.9.'
    },
    {
      description: 'Strip formwork at approved time',
      acceptanceCriteria: 'Formwork stripped at approved time per specification; no damage to concrete surface',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-SC-C6 — Formwork stripping time per specification and strength requirements.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile lot conformance documentation',
      acceptanceCriteria: 'All delivery dockets, test results, inspection records, photos, and survey data compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include delivery dockets, strength results, slump tests, curing records, crack assessment.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: REINFORCEMENT PLACEMENT (ST-SC-S6)
// =============================================================================

const saReinforcementTemplate = {
  name: 'Reinforcement Placement (DIT ST-SC-S6)',
  description: 'DIT Steel Reinforcement per ST-SC-S6 (formerly Part CC05). Covers scheduling, cutting, bending, fixing, cover verification with ±5mm tolerance for bridge deck slabs, and pre-pour hold point for reinforcement acceptance.',
  activityType: 'structures',
  specificationReference: 'ST-SC-S6',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit reinforcement schedule and bending details',
      acceptanceCriteria: 'Schedule complies with design drawings; bending per AS 3600 / AS 5100 as applicable',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S6 — Scheduling, cutting, bending per AS 3600 and AS 5100.'
    },
    {
      description: 'Submit reinforcement material test certificates',
      acceptanceCriteria: 'Mill certificates demonstrate compliance with AS/NZS 4671 for all reinforcement grades',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 4671',
      notes: 'ST-SC-S6 — All steel reinforcing materials must comply with AS/NZS 4671.'
    },
    {
      description: 'Submit cover and tolerance verification procedure',
      acceptanceCriteria: 'Documented procedure for verifying reinforcement placement within specified cover and tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S6 — Quality system must provide documented evidence of reinforcement placement.'
    },

    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify reinforcement identification and tagging',
      acceptanceCriteria: 'All reinforcement clearly identified with grade, size, and batch traceability',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Verify bar tags match delivery documentation and mill certificates.'
    },
    {
      description: 'Inspect reinforcement condition — no rust, contamination, or damage',
      acceptanceCriteria: 'Reinforcement free from loose rust, oil, grease, and mechanical damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Bars must be clean and undamaged before fixing.'
    },

    // =========================================================================
    // FIXING AND PLACEMENT
    // =========================================================================
    {
      description: 'Verify bar sizes and spacing per drawings',
      acceptanceCriteria: 'Bar sizes and spacing match design drawings for each structural element',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Check against current revision of design drawings.'
    },
    {
      description: 'Verify lap splice lengths and locations',
      acceptanceCriteria: 'Lap splices at locations and lengths per drawings and AS 3600 / AS 5100',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 3600 / AS 5100 — Lap lengths per design specification.'
    },
    {
      description: 'Verify concrete cover using spacers/chairs',
      acceptanceCriteria: 'Cover verified within specified tolerances; bridge deck slabs: ±5mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-S6 — Clear cover = distance from face of any reinforcement, ties, or fixings to nearest concrete surface. Bridge deck tolerance: ±5mm.'
    },
    {
      description: 'Check tie wire and bar supports are secure',
      acceptanceCriteria: 'All reinforcement securely tied and supported; will not move during concrete placement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Reinforcement must remain in position during concrete placement and vibration.'
    },
    {
      description: 'Verify embedments, dowels, and cast-in items positioned correctly',
      acceptanceCriteria: 'All embedded items positioned per drawings; secured against displacement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Check all cast-in items, holding down bolts, conduits, etc.'
    },

    // =========================================================================
    // PRE-POUR HOLD POINT
    // =========================================================================
    {
      description: 'Pre-pour reinforcement verification — Hold Point',
      acceptanceCriteria: 'Evidence submitted verifying reinforcement placed within specified cover and tolerances; Hold Point released by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-S6 — Hold Point. Concrete must not be placed until this Hold Point has been released.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile reinforcement conformance documentation',
      acceptanceCriteria: 'Mill certificates, cover surveys, inspection records, and photos compiled for lot',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include mill certificates, cover verification records, inspection checklists, photos.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 3: PILING (ST-PI-C1/C2/C3/C4)
// =============================================================================

const saPilingTemplate = {
  name: 'Piling (DIT ST-PI-C1/C2/C3/C4)',
  description: 'DIT Piling covering driven piles (ST-PI-C1), cast-in-place/bored piles (ST-PI-C2), CFA piles (ST-PI-C3), and diaphragm walls (ST-PI-C4). Includes pile set-out hold point, integrity testing (PDA/PIT/CSL), load testing per AS 2159, and test results hold point.',
  activityType: 'structures',
  specificationReference: 'ST-PI-C1/C2/C3/C4',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit piling construction procedure and method statement',
      acceptanceCriteria: 'Procedure accepted by Principal\'s Authorised Person; includes equipment details, installation sequence, and quality records',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-PI-C1/C2/C3 — Method statement must include equipment, sequence, pile installation records, and specialist sub-contractor qualifications.'
    },
    {
      description: 'Submit integrity and load test methodology',
      acceptanceCriteria: 'Proposed test methods accepted; qualifications of testing specialist confirmed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 2159',
      notes: 'ST-PI-C2/C3 — Must include proposed integrity test and load test methods, specialist qualifications, and record sheet format.'
    },
    {
      description: 'Submit concrete mix design for piled elements',
      acceptanceCriteria: 'Mix design complies with ST-SC-S7; aggregate size suitable for reinforcement spacing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1379',
      notes: 'ST-SC-S7 — For piles and closely reinforced sections, specific aggregate size requirements apply.'
    },
    {
      description: 'Submit reinforcement cage details and fabrication drawings',
      acceptanceCriteria: 'Cage details comply with ST-SC-S6 and design drawings; splice details per AS 3600',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S6 — Reinforcement per ST-SC-S6 Steel Reinforcement specification.'
    },

    // =========================================================================
    // SET-OUT AND PRE-INSTALLATION
    // =========================================================================
    {
      description: 'Survey pile set-out locations',
      acceptanceCriteria: 'Pile positions set out within specified tolerances; survey data recorded',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey pile locations per design drawings. Check for services and obstructions.'
    },
    {
      description: 'Inspect pile set-out and reinforcement cages — Hold Point',
      acceptanceCriteria: 'Pile set-out verified and reinforcement cages inspected; Hold Point released by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-PI-C2 — Hold Point. Placing of concrete must not commence until this Hold Point is released.'
    },
    {
      description: 'Verify reinforcement cage fabrication — splices and cover',
      acceptanceCriteria: 'CFA pile cages supplied in full lengths with splices minimised; cover spacers attached',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-PI-C3 — CFA pile cages must be supplied in full lengths with splices minimised.'
    },

    // =========================================================================
    // DRIVEN PILES (ST-PI-C1)
    // =========================================================================
    {
      description: 'Verify driving equipment and hammer energy',
      acceptanceCriteria: 'Driving equipment matches approved method statement; hammer energy sufficient for pile type',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-PI-C1 — Equipment per approved method statement.'
    },
    {
      description: 'Record pile driving logs — blow counts, set, and penetration',
      acceptanceCriteria: 'Driving records complete for each pile; blow count, set, and final penetration documented',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-PI-C1 — Complete driving records for each pile.'
    },
    {
      description: 'Perform PDA dynamic load testing on driven piles',
      acceptanceCriteria: 'PDA testing completed per AS 2159; results demonstrate required capacity',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159 / ASTM D4945',
      notes: 'ST-PI-C1 — PDA (Pile Driving Analyzer) testing for dynamic load assessment.'
    },

    // =========================================================================
    // BORED PILES (ST-PI-C2)
    // =========================================================================
    {
      description: 'Inspect bore before cage placement — depth, diameter, base condition',
      acceptanceCriteria: 'Bore dimensions and base condition verified; free from slurry contamination or loose material',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-PI-C2 — Verify bore before reinforcement cage and concrete placement.'
    },
    {
      description: 'Place reinforcement cage and verify position',
      acceptanceCriteria: 'Cage lowered without damage; position and level verified; centralisers in place',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Cage must be centred with adequate cover maintained.'
    },
    {
      description: 'Witness concrete placement in bored piles',
      acceptanceCriteria: 'Concrete placed via tremie or pump per approved procedure; continuous pour maintained',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-PI-C2 — Concrete supply per ST-SC-S7.'
    },

    // =========================================================================
    // CFA PILES (ST-PI-C3)
    // =========================================================================
    {
      description: 'Verify CFA equipment — auger monitoring and concrete injection system',
      acceptanceCriteria: 'Equipment capable of monitoring torque, depth, concrete volume, and injection pressure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-PI-C3 — CFA piles constructed using hollow flight auger with concrete injected under pressure as auger withdrawn.'
    },
    {
      description: 'Record CFA pile installation parameters',
      acceptanceCriteria: 'Installation records include auger depth, concrete volume, injection pressure, and extraction rate',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-PI-C3 — Complete installation records for each CFA pile.'
    },
    {
      description: 'Place reinforcement cage into CFA pile',
      acceptanceCriteria: 'Cage placed into fresh concrete within specified timeframe; full depth achieved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-PI-C3 — Cage must achieve design depth in fresh concrete.'
    },

    // =========================================================================
    // INTEGRITY AND LOAD TESTING
    // =========================================================================
    {
      description: 'Perform integrity testing on all piles (unless otherwise specified)',
      acceptanceCriteria: 'Integrity testing completed per AS 2159; equipment capable of detecting cross-sectional irregularities, voids, and contaminants',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159',
      notes: 'ST-PI-C3 — Unless specified otherwise, integrity testing on all piles. Methods include PIT (Pulse Echo) and CSL (Crosshole Sonic Logging).'
    },
    {
      description: 'Perform CSL testing where required',
      acceptanceCriteria: 'Crosshole Sonic Logging completed between access tube pairs; results interpreted by qualified specialist',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159',
      notes: 'ST-PI-C2 — CSL evaluates sound wave travel times between pairs of access tubes. PIT can verify CSL anomalies.'
    },
    {
      description: 'Perform static or dynamic load testing where specified',
      acceptanceCriteria: 'Load testing completed per AS 2159; ultimate capacity meets or exceeds design requirements',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159',
      notes: 'ST-PI-C2/C3 — Load testing per AS 2159 requirements.'
    },
    {
      description: 'Submit pile test results — Hold Point',
      acceptanceCriteria: 'Results of integrity testing (6.3), load testing (6.4), and additional testing (6.5) submitted as Quality Management Records; Hold Point released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 2159',
      notes: 'ST-PI-C2/C3 — Hold Point. Breakback and pile cap/abutment construction must not occur until this Hold Point is released.'
    },

    // =========================================================================
    // POST-INSTALLATION
    // =========================================================================
    {
      description: 'Survey as-built pile positions and cut-off levels',
      acceptanceCriteria: 'As-built positions within specified tolerances; cut-off levels per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey as-built positions against design pile layout.'
    },
    {
      description: 'Breakback pile heads to design level',
      acceptanceCriteria: 'Pile heads broken back to specified level without damage to reinforcement projecting into pile cap',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Breakback only after test results Hold Point released.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile piling conformance documentation',
      acceptanceCriteria: 'All pile records, test results, as-built survey, and inspection records compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include driving/installation records, integrity test reports, load test results, as-built survey.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 4: STRUCTURAL STEELWORK (ST-SS-S1/S2/C1)
// =============================================================================

const saSteelworkTemplate = {
  name: 'Structural Steelwork (DIT ST-SS-S1/S2/C1)',
  description: 'DIT Structural Steelwork covering fabrication (ST-SS-S1), protective treatment (ST-SS-S2), and transportation/erection (ST-SS-C1). Includes mock set-up hold point, 2mm flange edge radius, NDE welding inspection, DFT measurement per TP 913, and 95% single point DFT compliance.',
  activityType: 'structures',
  specificationReference: 'ST-SS-S1/S2/C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit fabrication drawings and procedures',
      acceptanceCriteria: 'Fabrication drawings and procedures accepted by Principal\'s Authorised Person; compliance with AS/NZS 5131',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SS-S1 — References AS/NZS 5131 Structural steelwork — Fabrication and erection.'
    },
    {
      description: 'Submit welding procedures and welder qualifications',
      acceptanceCriteria: 'Welding procedures qualified per AS 1554 series; welders hold current qualifications',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 1554',
      notes: 'ST-SS-S1 — AS 1554 Structural steel welding series. Welder qualifications must be current.'
    },
    {
      description: 'Submit protective coating system details',
      acceptanceCriteria: 'Coating system accepted; product data sheets and DFT targets provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SS-S2 — Coating system per AS/NZS 2312. Paint must be mixed, used, and applied per manufacturer\'s instructions.'
    },
    {
      description: 'Submit erection procedure and lifting plan',
      acceptanceCriteria: 'Erection procedure and lifting plan accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SS-C1 — Covers transport and erection of bridge beams, precast members, and structural steel.'
    },

    // =========================================================================
    // FABRICATION (ST-SS-S1)
    // =========================================================================
    {
      description: 'Verify cut surfaces — finished true and smooth',
      acceptanceCriteria: 'All surfaces produced by cutting finished true and smooth to required dimensions; burrs and sharp edges removed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-S1 — All burrs and sharp edges on cut surfaces must be removed.'
    },
    {
      description: 'Verify flange plate edges ground to 2mm radius',
      acceptanceCriteria: 'All edges of flange plates ground to produce a 2mm radius',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-S1 — All edges of flange plates must be ground to produce a 2mm radius.'
    },
    {
      description: 'Perform NDE on welds per specification',
      acceptanceCriteria: 'NDE completed; welds meet acceptance criteria per AS 1554',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1554',
      notes: 'ST-SS-S1 — If defects found in individual splice weld, test frequency reverts to 50% of each weld splice until further approval to reduce.'
    },
    {
      description: 'Complete mock set-up — Hold Point',
      acceptanceCriteria: 'Mock set-up completed and accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-S1 — Hold Point. Completion of mock set-up constitutes a Hold Point.'
    },
    {
      description: 'Verify dimensional compliance of fabricated elements',
      acceptanceCriteria: 'All fabricated elements within specified dimensional tolerances per AS/NZS 5131',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS/NZS 5131 — Dimensional tolerances for fabricated steelwork.'
    },

    // =========================================================================
    // PROTECTIVE TREATMENT (ST-SS-S2)
    // =========================================================================
    {
      description: 'Verify surface preparation before coating application',
      acceptanceCriteria: 'Surface prepared to specified standard (abrasive blast cleaned); profile achieved',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-S2 — Surface preparation per AS/NZS 2312 requirements.'
    },
    {
      description: 'Apply protective coating per manufacturer instructions',
      acceptanceCriteria: 'Paint mixed, used, and applied per manufacturer\'s written instructions; environmental conditions within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SS-S2 — Paint must be mixed, used, and applied per manufacturer\'s written instructions.'
    },
    {
      description: 'Measure Dry Film Thickness per DIT TP 913',
      acceptanceCriteria: '95% of all single point readings within specified DFT range',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 913',
      notes: 'ST-SS-S2 — DFT measured per DIT TP 913. 95% of all single point readings must be within specified range.'
    },
    {
      description: 'Record and submit DFT test results',
      acceptanceCriteria: 'Complete DFT records for all coated surfaces; non-compliant areas recoated and retested',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'TP 913',
      notes: 'ST-SS-S2 — Non-conformances per PC-QA1/PC-QA2.'
    },

    // =========================================================================
    // TRANSPORT AND ERECTION (ST-SS-C1)
    // =========================================================================
    {
      description: 'Inspect steelwork before dispatch from fabrication shop',
      acceptanceCriteria: 'All fabrication, welding, and coating complete and compliant; protective wrapping applied for transport',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Pre-dispatch inspection of completed fabricated elements.'
    },
    {
      description: 'Inspect steelwork on arrival at site for transport damage',
      acceptanceCriteria: 'No transport damage to steelwork or protective coating; any damage recorded and repaired',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Check for coating damage, dents, or deformation during transport.'
    },
    {
      description: 'Erection of structural steelwork — Hold Point',
      acceptanceCriteria: 'Erection activities inspected and Hold Point released by Principal\'s Authorised Person before permanent connections',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-C1 — Hold Point for erection activities.'
    },
    {
      description: 'Verify alignment and geometry after erection',
      acceptanceCriteria: 'Erected steelwork within specified positional and alignment tolerances',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Survey verification of erected steelwork positions.'
    },
    {
      description: 'Complete site bolting and field welding connections',
      acceptanceCriteria: 'All site connections completed per design; bolt tensioning verified; field welds inspected',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Bolt tensioning records and field weld NDE results required.'
    },
    {
      description: 'Touch up protective coating at field connections',
      acceptanceCriteria: 'All damaged coating areas touched up per manufacturer\'s recommendations; DFT verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'TP 913',
      notes: 'ST-SS-S2 — Touch up coating at connections and any damaged areas.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile steelwork conformance documentation',
      acceptanceCriteria: 'All fabrication records, NDE results, DFT records, erection survey, and inspection records compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include fabrication QA records, weld NDE, DFT results, erection survey, bolt tensioning records.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 5: BRIDGE BEARINGS (ST-SD-D1 / AS 5100.4)
// =============================================================================

const saBridgeBearingsTemplate = {
  name: 'Bridge Bearings (DIT ST-SD-D1 / AS 5100.4)',
  description: 'DIT Bridge Bearings per ST-SD-D1 Design of Structures and AS 5100.4. Covers bearing supply, installation, accessibility for inspection/maintenance/replacement, jacking provisions, drainage protection, and deck joints. [VERIFY] SA does not publish standalone bearing construction spec — requirements from design spec and project-specific specifications.',
  activityType: 'structures',
  specificationReference: 'ST-SD-D1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit bearing product details and manufacturer data',
      acceptanceCriteria: 'Bearing product complies with AS 5100.4 Clause 7 General Design Requirements; data sheets submitted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 5100.4',
      notes: 'ST-SD-D1 / AS 5100.4 — Bearings designed per AS 5100.4 Clause 7. [VERIFY specific clause numbers from project spec]'
    },
    {
      description: 'Submit bearing installation procedure',
      acceptanceCriteria: 'Installation procedure accepted by Principal\'s Authorised Person; includes levelling, grouting, and load transfer sequence',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SD-D1 / ST-SS-C1 — Installation covered under erection procedures.'
    },
    {
      description: 'Submit deck joint product details (if applicable)',
      acceptanceCriteria: 'Deck joint details submitted; finger plate type preferred for bridges >100m; bonded steel/rubber joints not permitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SD-D1 — Joints minimised where practical. Bridges >100m: joints required. Free draining finger plate preferred. Bonded steel/rubber type must not be used.'
    },

    // =========================================================================
    // BEARING INSTALLATION
    // =========================================================================
    {
      description: 'Verify bearing seat preparation',
      acceptanceCriteria: 'Bearing seats level, clean, and dimensionally correct per design',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Bearing seats must provide uniform contact surface.'
    },
    {
      description: 'Inspect bearing installation — Hold Point',
      acceptanceCriteria: 'Bearings correctly positioned, oriented, and levelled; Hold Point released before load application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Hold Point. Bearings must be inspected before superstructure load is applied.'
    },
    {
      description: 'Verify jacking provisions per AS 5100.4',
      acceptanceCriteria: 'Provisions allow for jacking of components per AS 5100.4 for future bearing replacement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Must allow for jacking of components in accordance with AS 5100.4.'
    },
    {
      description: 'Verify bearing accessibility for inspection, maintenance, and replacement',
      acceptanceCriteria: 'Bearings readily accessible for inspection, maintenance, and replacement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Bearings must be readily accessible.'
    },
    {
      description: 'Complete bearing grouting and levelling',
      acceptanceCriteria: 'Grouting complete; bearing level and stable under design loads',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Grouting per approved procedure and material.'
    },

    // =========================================================================
    // DRAINAGE AND PROTECTION
    // =========================================================================
    {
      description: 'Verify drainage provisions prevent water damage to bearings',
      acceptanceCriteria: 'Adequate drainage measures prevent water from staining piers/abutments, damaging bearings, or causing corrosion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Adequate measures must prevent water from staining, damaging bearings, or causing corrosion.'
    },

    // =========================================================================
    // DECK JOINTS (IF APPLICABLE)
    // =========================================================================
    {
      description: 'Install deck joints per specification',
      acceptanceCriteria: 'Deck joints installed per approved details; accessible for inspection, maintenance, and replacement',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Joints must be readily accessible for inspection, maintenance, and replacement.'
    },
    {
      description: 'Verify deck joint drainage provisions',
      acceptanceCriteria: 'Drainage provisions prevent water passing through joints from causing damage below',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Where plate joints used, adequate drainage measures required.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile bearing conformance documentation',
      acceptanceCriteria: 'Product certificates, installation records, photos, survey data compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include product data, installation records, photos, level surveys.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 6: PRECAST CONCRETE ELEMENTS (ST-SC-S3/C1)
// =============================================================================

const saPrecastConcreteTemplate = {
  name: 'Precast Concrete Elements (DIT ST-SC-S3/C1)',
  description: 'DIT Precast Concrete covering precast units (ST-SC-S3) and pre-tensioned concrete (ST-SC-C1). Includes factory QA, storage, transport, erection via ST-SS-C1, tendon materials compliance hold point per AS 4672.1, and load-extension testing.',
  activityType: 'structures',
  specificationReference: 'ST-SC-S3/C1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit precast element fabrication procedures',
      acceptanceCriteria: 'Fabrication procedures accepted; covers factory QA, moulds, concrete supply per ST-SC-S7, reinforcement per ST-SC-S6',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S3 — Cross-references ST-SC-S7 for concrete supply, ST-SC-S6 for reinforcement.'
    },
    {
      description: 'Submit tendon materials compliance evidence — Hold Point',
      acceptanceCriteria: 'Evidence of compliance with materials requirements (sections 3.1a and 3.1b) submitted; Hold Point released before tendon installation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4672.1',
      notes: 'ST-SC-C1 — Hold Point. Installation of tendons must not commence until this Hold Point is released.'
    },
    {
      description: 'Submit tendon composition details and test results',
      acceptanceCriteria: 'Details of tendon composition provided; test results demonstrate compliance with AS 4672.1; load-extension graphs from 3 representative samples (1.4m long) per coil',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 4672.1',
      notes: 'ST-SC-C1 — Quality Management Records: tendon composition, AS 4672.1 compliance, load-extension graphs (3 samples × 1.4m per coil).'
    },
    {
      description: 'Submit transport and erection procedure',
      acceptanceCriteria: 'Transport and erection procedures accepted; covers lifting points, support during transport, and erection sequence',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SS-C1 — Transport and erection of precast elements covered under ST-SS-C1.'
    },

    // =========================================================================
    // FACTORY PRODUCTION
    // =========================================================================
    {
      description: 'Inspect moulds/formwork before casting',
      acceptanceCriteria: 'Moulds clean, dimensionally correct, and adequately oiled/released',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-S3 — Moulds must be dimensionally accurate and clean.'
    },
    {
      description: 'Verify reinforcement/tendon placement in moulds',
      acceptanceCriteria: 'Reinforcement and tendons correctly positioned per drawings; cover maintained',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Pre-pour hold point for precast element reinforcement and tendon placement.'
    },
    {
      description: 'Perform pre-tensioning stressing operations',
      acceptanceCriteria: 'Tensioning performed by experienced personnel; forces and elongations within specified tolerances',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C1 — Tensioning must be performed by experienced personnel only.'
    },
    {
      description: 'Monitor concrete placement and curing in factory',
      acceptanceCriteria: 'Concrete placed per ST-SC-S7; curing per approved procedure (steam curing per ST-SC-S4 or heat curing per ST-SC-S5 if applicable)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-S3 — Curing may reference ST-SC-S4 (steam) or ST-SC-S5 (heat accelerated).'
    },
    {
      description: 'Record and submit compressive strength results',
      acceptanceCriteria: 'Compressive strength meets specified characteristic strength before transfer/release',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'Strength at transfer/release must meet design requirements.'
    },
    {
      description: 'Inspect finished precast elements — dimensions, surface, and defects',
      acceptanceCriteria: 'Elements within dimensional tolerances; no unacceptable surface defects, cracks, or damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-S3 — Check dimensions, surface finish, and any defects.'
    },

    // =========================================================================
    // STORAGE AND TRANSPORT
    // =========================================================================
    {
      description: 'Verify storage conditions for precast elements',
      acceptanceCriteria: 'Elements stored on level supports at designated points; protected from damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-SC-S3 — Storage, handling, and transport requirements addressed.'
    },
    {
      description: 'Inspect elements before dispatch for transport damage',
      acceptanceCriteria: 'All elements inspected; no cracking, spalling, or damage visible',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Pre-dispatch inspection of precast elements.'
    },

    // =========================================================================
    // ERECTION AND GROUTING
    // =========================================================================
    {
      description: 'Inspect elements on arrival at site',
      acceptanceCriteria: 'No transport damage; elements match identification and quality records',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Check for transport damage on site arrival.'
    },
    {
      description: 'Erect precast elements — Hold Point',
      acceptanceCriteria: 'Elements erected per approved procedure; position and level verified; Hold Point released before grouting/connection',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SS-C1 — Hold Point for erection activities.'
    },
    {
      description: 'Complete grouting of joints and connections',
      acceptanceCriteria: 'Grouting completed per specification; joints fully filled and free from voids',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'ST-SC-S3 — Erection/grouting requirements addressed in specification.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile precast conformance documentation',
      acceptanceCriteria: 'Factory QA records, strength results, tendon records, transport/erection records, and photos compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include factory records, strength results, tendon stressing records, erection survey.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 7: POST-TENSIONING (ST-SC-C2)
// =============================================================================

const saPostTensioningTemplate = {
  name: 'Post-Tensioning (DIT ST-SC-C2)',
  description: 'DIT Post-Tensioned Concrete per ST-SC-C2. Covers duct installation (corrugated galvanized), tendon installation, stressing operations with 10% initial force, anchorage compliance per AS/NZS 1314, grouting, and multiple hold points for materials compliance and stressing release.',
  activityType: 'structures',
  specificationReference: 'ST-SC-C2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit post-tensioning system details and procedures',
      acceptanceCriteria: 'System details and procedures accepted by Principal\'s Authorised Person; includes duct, tendon, anchorage, and stressing details',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Post-tensioning procedures and system details required before commencement.'
    },
    {
      description: 'Submit tendon materials compliance evidence — Hold Point',
      acceptanceCriteria: 'Evidence of compliance with specified requirements submitted; Hold Point released before tendon installation commences',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 4672.1',
      notes: 'ST-SC-C2 — Hold Point. Installation of relevant tendons must not commence until this Hold Point is released.'
    },
    {
      description: 'Submit anchorage test certificates — Hold Point',
      acceptanceCriteria: 'Anchorage test certificates demonstrate compliance with AS/NZS 1314; Hold Point released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1314',
      notes: 'ST-SC-C2 — Hold Point. Anchorage test certificates per AS/NZS 1314 constitute a Hold Point.'
    },
    {
      description: 'Submit grouting procedure',
      acceptanceCriteria: 'Grouting procedure accepted; includes grout mix, injection sequence, and venting details',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Grouting requirements specified within specification.'
    },

    // =========================================================================
    // DUCT INSTALLATION
    // =========================================================================
    {
      description: 'Verify duct material — corrugated profile and galvanized',
      acceptanceCriteria: 'Steel duct has corrugated profile and is galvanized; product certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Steel duct must have a corrugated profile and be galvanized.'
    },
    {
      description: 'Install ducts per design alignment',
      acceptanceCriteria: 'Ducts positioned per design profile; no kinks or damage; securely fixed to reinforcement',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C2 — Ducts must not be damaged or kinked.'
    },
    {
      description: 'Check duct alignment and profile before concrete placement',
      acceptanceCriteria: 'Duct alignment matches design profile within tolerances; joints sealed against grout leakage',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Verify duct profile and connections before concrete placement.'
    },

    // =========================================================================
    // TENDON INSTALLATION
    // =========================================================================
    {
      description: 'Inspect tendons — free from pitting, kinks, and damage',
      acceptanceCriteria: 'Tendons free of surface pitting, kinks, and other damage',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C2 — Tendons must be free of surface pitting, kinks, and other damage.'
    },
    {
      description: 'Install tendons — no welding or heat application near tendons',
      acceptanceCriteria: 'Tendons installed per procedure; no welding on or near tendons; no heat applied',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C2 — Welding is not permitted on or near tendons. No heat may be applied to tendons.'
    },
    {
      description: 'Protect anchorage steel components from corrosion',
      acceptanceCriteria: 'Anchorage steel components protected by greased wrappings or plugs',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C2 — Anchorage steel must be protected from corrosion by greased wrappings or plugs.'
    },

    // =========================================================================
    // STRESSING OPERATIONS
    // =========================================================================
    {
      description: 'Pre-stressing release — Hold Point',
      acceptanceCriteria: 'Post-tensioning of relevant tendons must not commence until specified Hold Points have been released',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Hold Point. Post-tensioning must not commence until Hold Points released.'
    },
    {
      description: 'Apply initial force — 10% of final force to take up slack',
      acceptanceCriteria: 'Initial force equal to 10% of final force applied to each tendon to take up slack',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Initial force of 10% of final force applied to take up slack of tendon.'
    },
    {
      description: 'Complete tendon stressing without interruption',
      acceptanceCriteria: 'Stressing operation completed without interruption; no tendon left in partially stressed condition',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Once commenced, stressing must be completed without interruption. No tendon can be left partially stressed.'
    },
    {
      description: 'Record elongation measurements from jack',
      acceptanceCriteria: 'Elongations recorded from jack; within specified tolerance of theoretical values',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Elongations must be recorded from the jack.'
    },
    {
      description: 'Post-stressing verification — Hold Point',
      acceptanceCriteria: 'Stressing results verified; elongations within tolerance; Hold Point released before grouting',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SC-C2 — Hold Point for post-stressing / elongation verification before grouting commences.'
    },

    // =========================================================================
    // GROUTING
    // =========================================================================
    {
      description: 'Grout ducts per approved procedure',
      acceptanceCriteria: 'Ducts fully grouted per approved mix and procedure; venting confirms full encapsulation',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SC-C2 — Grouting per specification requirements.'
    },
    {
      description: 'Record grouting volumes and pressures',
      acceptanceCriteria: 'Grout volumes and injection pressures recorded; consistent with theoretical duct volumes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Complete grouting records for each tendon/duct.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile post-tensioning conformance documentation',
      acceptanceCriteria: 'All material certificates, stressing records, elongation data, and grouting records compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include tendon certs, anchorage certs, stressing records, elongation data, grouting records.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
    }
  ]
}

// =============================================================================
// TEMPLATE 8: BRIDGE DECK WATERPROOFING (ST-SD-D1 / PROJECT SPECIFIC)
// =============================================================================

const saWaterproofingTemplate = {
  name: 'Bridge Deck Waterproofing (DIT ST-SD-D1 / Project Specific)',
  description: 'DIT Bridge Deck Waterproofing per ST-SD-D1 Design of Structures and project-specific specifications. [VERIFY] SA does not publish standalone waterproofing membrane spec — requirements from design specification and project-specific documents. Covers surface preparation, membrane application, drainage provisions, and protection.',
  activityType: 'structures',
  specificationReference: 'ST-SD-D1',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS
    // =========================================================================
    {
      description: 'Submit waterproofing membrane system details',
      acceptanceCriteria: 'Membrane system product details and manufacturer data submitted and accepted by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'ST-SD-D1 / Project Spec — [VERIFY] Requirements from project-specific specification. SA does not have standalone waterproofing master spec.'
    },
    {
      description: 'Submit waterproofing application procedure',
      acceptanceCriteria: 'Application procedure accepted; includes surface prep, primer, membrane application, and protection requirements',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Procedure per manufacturer\'s recommendations and project specification.'
    },

    // =========================================================================
    // SURFACE PREPARATION
    // =========================================================================
    {
      description: 'Prepare concrete deck surface for waterproofing',
      acceptanceCriteria: 'Surface clean, dry, free from contaminants; surface profile suitable for membrane adhesion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Surface preparation per manufacturer and project specification requirements.'
    },
    {
      description: 'Inspect prepared surface before membrane application — Hold Point',
      acceptanceCriteria: 'Surface inspected and accepted by Principal\'s Authorised Person; Hold Point released before application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Hold Point. Surface must be accepted before membrane application commences.'
    },
    {
      description: 'Check environmental conditions before application',
      acceptanceCriteria: 'Temperature, humidity, and surface moisture within manufacturer\'s limits for application',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Check manufacturer\'s environmental limits for application.'
    },

    // =========================================================================
    // MEMBRANE APPLICATION
    // =========================================================================
    {
      description: 'Apply primer coat (if required)',
      acceptanceCriteria: 'Primer applied uniformly at specified coverage rate; curing time observed',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Primer per manufacturer\'s requirements if specified.'
    },
    {
      description: 'Apply waterproofing membrane',
      acceptanceCriteria: 'Membrane applied per manufacturer\'s instructions; uniform thickness/coverage achieved; laps and edges sealed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Application per manufacturer\'s written instructions and project specification.'
    },
    {
      description: 'Inspect membrane for defects — pinholes, tears, or debonding',
      acceptanceCriteria: 'No pinholes, tears, wrinkles, or areas of debonding; defects repaired before protection layer',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'Full surface inspection after membrane curing.'
    },
    {
      description: 'Verify membrane thickness/coverage',
      acceptanceCriteria: 'Membrane thickness or coverage rate meets manufacturer\'s minimum requirements',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: null,
      notes: 'Thickness or coverage verification per project specification.'
    },

    // =========================================================================
    // DRAINAGE AND PROTECTION
    // =========================================================================
    {
      description: 'Verify drainage provisions at membrane level',
      acceptanceCriteria: 'Drainage measures prevent water from staining piers/abutments, damaging bearings, or causing corrosion',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'ST-SD-D1 — Adequate measures must prevent water from causing damage.'
    },
    {
      description: 'Apply protection layer over membrane before trafficking',
      acceptanceCriteria: 'Protection layer applied per specification before any traffic or construction loads placed on membrane',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'Membrane must be protected before any loads are applied.'
    },

    // =========================================================================
    // LOT CLOSE-OUT
    // =========================================================================
    {
      description: 'Compile waterproofing conformance documentation',
      acceptanceCriteria: 'Product certificates, application records, thickness verification, inspection records, and photos compiled',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'Include product data, application records, thickness records, inspection reports, photos.'
    },
    {
      description: 'Lot conformance review and sign-off',
      acceptanceCriteria: 'All acceptance criteria met, NCRs closed or dispositioned, lot approved by Principal\'s Authorised Person',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'Final lot approval by Principal\'s Authorised Person.'
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
  console.log(' SA (DIT) ITP Template Seeder - Structures')
  console.log(' Based on: ST-SC, ST-PI, ST-SS, ST-SD series specifications')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const templates = [
    saStructuralConcreteTemplate,
    saReinforcementTemplate,
    saPilingTemplate,
    saSteelworkTemplate,
    saBridgeBearingsTemplate,
    saPrecastConcreteTemplate,
    saPostTensioningTemplate,
    saWaterproofingTemplate,
  ]

  let totalItems = 0
  let totalHold = 0
  let totalWitness = 0
  let totalStandard = 0

  try {
    for (const tmpl of templates) {
      const result = await seedTemplate(tmpl)
      if (result?.checklistItems) {
        totalItems += result.checklistItems.length
        totalHold += result.checklistItems.filter(i => i.pointType === 'hold_point').length
        totalWitness += result.checklistItems.filter(i => i.pointType === 'witness').length
        totalStandard += result.checklistItems.filter(i => i.pointType === 'standard').length
      }
    }

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete!')
    console.log(`   Templates: ${templates.length}`)
    console.log(`   Total Items: ${totalItems}`)
    console.log(`   - Hold Points (H): ${totalHold}`)
    console.log(`   - Witness Points (W): ${totalWitness}`)
    console.log(`   - Standard Items: ${totalStandard}`)
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('To use these templates:')
    console.log('1. Create a project with specificationSet = "DIT (SA)" or "DIT"')
    console.log('2. When fetching templates with includeGlobal=true, these templates will appear')
    console.log('3. Clone them to your project or assign directly to lots')
    console.log('')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
