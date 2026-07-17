/**
 * Seed Script: WA (Main Roads WA) ITP Templates - Drainage & Kerbing
 *
 * Creates the global ITP templates for Main Roads Western Australia (MRWA)
 * drainage and kerbing, part of the FIRST MRWA (WA) set. Derived from:
 *   - Specification 403 SUB-SOIL DRAINS (edition 04/10103, 16/11/2021)
 *   - Specification 404 CULVERTS       (edition 05/6181-003, 18/11/2025)
 *   - Specification 405 DRAINAGE STRUCTURES (edition 04/10105, 06/08/2021)
 *   - Specification 407 KERBING        (edition 05/2755, 23/02/2021)
 *
 * NOTE: WA has NO "Specification 401" - it is marked "NOT USED" in the MRWA
 * Standard Method of Measurement. WA's pipe/conduit drainage is split across
 * 402 (surface drains), 403 (sub-soil drains), 404 (culverts - pipes/boxes) and
 * 405 (drainage structures). Spec 404 is the closest WA equivalent to a generic
 * "drainage" spec, so the culverts template carries the culverts activity here.
 *
 * All checklist content is derived directly from the MRWA specs; clause
 * references cite the supporting clause. WA test methods (WA 210.1, WA 115.1/2,
 * WA 123.1, etc.) and terminology are used verbatim.
 *
 * Templates:
 *   1. Sub-Soil Drains (MRWA Spec 403)     - activityType subsoil_drainage
 *   2. Culverts (MRWA Spec 404)            - activityType culverts
 *   3. Drainage Structures (MRWA Spec 405) - activityType drainage_pits
 *   4. Kerbing (MRWA Spec 407)             - activityType kerb_channel
 *
 * Spec 407 kerbing has NO hold points - it is tolerance-gated. Its acceptance
 * gates are encoded as standard items carrying the tolerance values.
 *
 * Run with: npm run seed:itp -- --script=seed-itp-templates-wa-drainage.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: SUB-SOIL DRAINS (MRWA Spec 403)
// Geotextile-wrapped slotted-pipe subsoil drains. Hold points: 403.06.6
// geotextile, 403.07.2 filter aggregate, 403.27.6 trench, 403.31.3 pre-backfill.
// Witness: 403.32 flushing in presence of Superintendent.
// =============================================================================

const waSubsoilDrainTemplate = {
  name: 'Sub-Soil Drains (MRWA Spec 403)',
  description: 'Main Roads WA geotextile-wrapped slotted-pipe subsoil drains per Specification 403 (edition 04/10103, 16/11/2021). Slotted pipe is nominal 100 mm OD Class 400 Type 1 PVC (AS 2439.1 + AS/NZS 1254). Covers geotextile and filter-aggregate certification, trench excavation, drain lining, bedding and pipe laying, filter aggregate and geotextile wrap, backfill compaction (>= 96% MMDD as embankment per Spec 302) and flushing in the presence of the Superintendent.',
  activityType: 'subsoil_drainage',
  specificationReference: 'MRWA Spec 403',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD: geotextile certified (G >= 1350, EOS <= 250 um, Q100 >= 50 L/m2/s) on NATA-endorsed documents no more than 12 months old before use (MRWA Spec 403.06.6)',
      acceptanceCriteria: 'Prior to use of the geotextile for drainage lining, the Contractor submits product certificates of compliance on NATA-endorsed documents no more than twelve months old: strength rating G >= 1350 (Table 403.1, AS 3706.4/.5), EOS <= 250 um and Q100 >= 50 L/m2/s (Table 403.2, AS 3706.7/.9), UV resistance >= 50% retained after 672 h (AS 3706.11). This Hold Point is released before geotextile use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS 3706.4/.5 (G), AS 3706.7/.9 (EOS/flow), AS 3706.11 (UV)',
      notes: 'MRWA Spec 403.06.6 HOLD.'
    },
    {
      description: 'HOLD: filter aggregate certified to Table 403.3 (WA 210.1) on NATA-endorsed documents before use (MRWA Spec 403.07.2)',
      acceptanceCriteria: 'Prior to use of the aggregate material for filter aggregate, the Contractor certifies conformance to Table 403.3 (nominal 20 mm: 26.5 mm 100%, 19.0 mm 70-100%, 13.2 mm 0-30%, 9.5 mm 0-10%, 2.36 mm 0-5%, 0.075 mm 0-1% passing) via WA 210.1, on NATA-endorsed documents. Released before filter aggregate use.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'WA 210.1 (filter aggregate PSD)',
      notes: 'MRWA Spec 403.07.2 HOLD.'
    },
    {
      description: 'Trench excavated: vertical sides where <= 1.5 m deep, bottom <= 50 mm below pipe invert, minimum grade 0.5% (MRWA Spec 403.27)',
      acceptanceCriteria: 'The trench has vertical sides where <= 1.5 m deep (>1.5 m per OSH Regs 1996), a bottom no more than 50 mm below the specified pipe invert level, and a minimum drain grade of 0.5%; over-excavated sections are filled and lightly compacted and protruding/sharp objects removed.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.27.'
    },
    {
      description: 'HOLD: trench shape, grade and over-excavation filling certified before geotextile placement (MRWA Spec 403.27.6)',
      acceptanceCriteria: 'Prior to placement of the geotextile (403.28), the Contractor certifies the trench excavation conforms to shape, grade line, filling and light compaction of over-excavated sections, and removal of protruding/sharp objects. Released before lining the trench.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 403.27.6 HOLD.'
    },
    {
      description: 'Geotextile placed to trench shape, longitudinal overlap >= 500 mm, upstream over downstream (MRWA Spec 403.28)',
      acceptanceCriteria: 'Geotextile is placed to the trench shape with a minimum 500 mm longitudinal overlap, upstream over downstream; damaged geotextile is patched with the patch extending >= 1 m beyond the damage; geotextile is covered within 14 days (ideally 48 h), and if exposed > 14 days is removed and replaced.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.28.'
    },
    {
      description: 'No plant on bare geotextile; initial uncompacted cover >= 200 mm; no vibratory/heavy plant on initial layers (MRWA Spec 403.28.4, 403.28.5)',
      acceptanceCriteria: 'No plant travels on bare geotextile; the initial uncompacted cover over the geotextile is at least 200 mm; no vibratory or heavy plant is used on the initial layers.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.28.4/.5.'
    },
    {
      description: 'Filter aggregate bedding placed on geotextile and tamped level (default 50 mm) (MRWA Spec 403.29)',
      acceptanceCriteria: 'Filter aggregate bedding is placed on the geotextile and tamped level to the specified depth (default 50 mm).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.29.'
    },
    {
      description: 'Slotted 100 mm Class 400 PVC pipe laid central on the bedding; flush-out points built (MRWA Spec 403.30)',
      acceptanceCriteria: 'Nominal 100 mm OD Class 400 Type 1 PVC slotted pipe (AS 2439.1 + AS/NZS 1254) is installed centrally on the bedding; flush-out points are built as detailed.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.30. Flush-out concrete cover Class N32 per Spec 901.'
    },
    {
      description: 'Filter aggregate over the pipe compacted full-depth; geotextile wrapped over top with >= 300 mm overlap (MRWA Spec 403.31)',
      acceptanceCriteria: 'Filter aggregate is placed over the pipe and compacted full-depth, and the geotextile is wrapped over the top with a minimum 300 mm overlap.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.31, 403.28.6.'
    },
    {
      description: 'HOLD: compliance with all specified requirements certified before backfilling the drain (MRWA Spec 403.31.3)',
      acceptanceCriteria: 'Prior to backfilling, the Contractor certifies to the Superintendent that compliance has been achieved with all specified requirements; released before backfill.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 403.31.3 HOLD.'
    },
    {
      description: 'Backfill layer compacted to >= 96% MMDD as embankment per Spec 302; grading to Table 403.4, linear shrinkage <= 1.0% (MRWA Spec 403.34)',
      acceptanceCriteria: 'The backfill layer to subgrade is compacted as embankment (Spec 302) to at least 96% Modified Maximum Dry Density; backfill grading conforms to Table 403.4 (37.5 mm 90-100%, 2.36 mm 30-100%, 0.075 mm 1-10% passing, WA 115.1) with linear shrinkage <= 1.0% (WA 123.1) for imported material < 0.425 mm.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 115.1 (PSD), WA 123.1 (linear shrinkage), MMDD ratio (per Spec 302/201)',
      notes: 'MRWA Spec 403.34, Table 403.4.'
    },
    {
      description: 'WITNESS: drain flushed with clean water in the presence of the Superintendent until only clean water discharges (MRWA Spec 403.32)',
      acceptanceCriteria: 'Subsoil drains are flushed in the presence of the Superintendent with clean water until only clean water discharges.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 403.32 WITNESS (flushing).'
    },
    {
      description: 'Outlets connected to gully pits; marker posts erected at inlets/outlets (MRWA Spec 403.33, 403.35)',
      acceptanceCriteria: 'Drain outlets are connected to gully pits (403.33) and marker posts are erected: galvanised steel 80x40 mm, 1200 mm long (700 mm exposed), white powder-coat top with "SUBSOIL DRAIN" in black 60x30 mm letters (403.35).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRWA Spec 403.33, 403.35.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: CULVERTS (MRWA Spec 404)
// RC pipes/boxes, corrugated metal pipes, in-situ concrete. Hold points:
// 404.43 pegging, 404.37.01 pre-backfill, 404.10/404.37.02 cement-stabilised.
// (WA has no Spec 401 - 404 is the closest generic drainage-conduit spec.)
// =============================================================================

const waCulvertsTemplate = {
  name: 'Culverts (MRWA Spec 404)',
  description: 'Main Roads WA culverts per Specification 404 (edition 05/6181-003, 18/11/2025) - reinforced concrete pipes and boxes, corrugated metal pipes, in-situ concrete, cement stabilised backfill and select bedding. WA has no Spec 401 (marked "NOT USED"); Spec 404 is WA\'s closest equivalent to a generic drainage-conduit spec. Covers pegging/setout, trench and foundation, bedding, laying and jointing, pre-backfill certification, and backfill to Spec 302 embankment requirements tested per Spec 201.',
  activityType: 'culverts',
  specificationReference: 'MRWA Spec 404',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'HOLD: culvert pegged/set out and approved before construction (MRWA Spec 404.43)',
      acceptanceCriteria: 'Pegging and setout of the culvert (404.43) is subject to Hold Point approval; construction must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey (pegging/setout)',
      notes: 'MRWA Spec 404.43 HOLD.'
    },
    {
      description: 'Trench excavated to line and level; foundation surfaces protected (MRWA Spec 404.32, 404.34)',
      acceptanceCriteria: 'The trench is excavated to line and level (404.32; blasting per 404.33 where required) and foundation surfaces are protected from disturbance (404.34).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.32, 404.33, 404.34.'
    },
    {
      description: 'Select bedding material placed to grading (MRWA Spec 404.35, 404.11, WA 115.2)',
      acceptanceCriteria: 'Select bedding material is placed to the specified grading (404.35, 404.11), verified by WA 115.2.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 115.2 (bedding PSD)',
      notes: 'MRWA Spec 404.35, 404.11.'
    },
    {
      description: 'Pipe/box laid, jointed and sealed per drawings (MRWA Spec 404.40)',
      acceptanceCriteria: 'The RC pipe/box or corrugated metal pipe is laid, jointed and sealed (joint sealant per 404.12) per the drawings.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.40, 404.12.'
    },
    {
      description: 'HOLD: compliance with all specified requirements certified before backfilling (MRWA Spec 404.37.01)',
      acceptanceCriteria: 'Prior to backfilling, the Contractor certifies to the Superintendent that compliance has been achieved with all specified requirements; released before backfill.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 404.37.01 HOLD.'
    },
    {
      description: 'Temporary supports removed; corrugated metal pipes strapped against float during backfill vibration (MRWA Spec 404.37)',
      acceptanceCriteria: 'Temporary supports are removed and corrugated metal pipes are fitted with hold-down straps to prevent "float" during backfill vibration.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.37. Conditional - corrugated metal pipes.'
    },
    {
      description: 'Backfill placed as embankment material and compacted to Spec 302 Rc, tested per Spec 201 (MRWA Spec 404.37)',
      acceptanceCriteria: 'Backfill is embankment material compacted to Spec 302 "Embankment Construction" requirements (Rc >= 90%/88% Perth/Other per Annexure 302B) at 90-110% OMC (WA 133.1/133.2), tested per Spec 201.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Characteristic Dry Density Ratio Rc (Spec 302/201); WA 133.1/133.2 (moisture)',
      notes: 'MRWA Spec 404.37, Spec 302 Annexure 302B.'
    },
    {
      description: 'Backfill levels balanced within 150 mm each side of the conduit during placement (MRWA Spec 404.37)',
      acceptanceCriteria: 'Backfill levels each side of a conduit do not differ by more than 150 mm during placement.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.37.'
    },
    {
      description: 'Cover and compaction-equipment limits per AS/NZS 3725 / AS 1597 / AS 1762 (MRWA Spec 404)',
      acceptanceCriteria: 'Compaction equipment and minimum cover limits follow AS/NZS 3725 (RC pipes), AS 1597 (RC boxes) and AS 1762 (corrugated steel pipes).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404, AS/NZS 3725 / AS 1597 / AS 1762.'
    },
    {
      description: 'HOLD: cement stabilised backfill approved before placement; placed within 90 min of mixing and vibrated (MRWA Spec 404.10, 404.37.02)',
      acceptanceCriteria: 'Cement stabilised backfill is not placed until the cement mortar conforms/is approved; once approved it is placed within 90 minutes of mixing and vibrated with immersion vibrators (>= 10,000 cycles/min, Table 404.01) until all excess water/air is expelled.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 404.10, 404.37.02 HOLD. Conditional - cement stabilised backfill only.'
    },
    {
      description: 'No backfill placed behind in-situ wingwalls/headwalls within 7 days of concrete placement (MRWA Spec 404.37)',
      acceptanceCriteria: 'No backfill is placed behind in-situ wingwalls or headwalls within 7 days of concrete placement.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.37. Conditional - in-situ wingwalls/headwalls.'
    },
    {
      description: 'Pavement reinstated per Spec 501 with surfacing per Spec 503; excavation edges saw-cut and a waterproof seal at joins (MRWA Spec 404.38)',
      acceptanceCriteria: 'Excavation edges are saw-cut straight and parallel; the pavement is reinstated per Spec 501 and surfacing applied per Spec 503, with a waterproof seal between new and existing surfaces.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 404.38.'
    }
  ]
}

// =============================================================================
// TEMPLATE 3: DRAINAGE STRUCTURES (MRWA Spec 405)
// Manholes, gullies, catchpits (precast + in-situ). Hold points: 405.32.1
// pre-backfill, 405.41 cleaning before commissioning inspection.
// =============================================================================

const waDrainageStructuresTemplate = {
  name: 'Drainage Structures (MRWA Spec 405)',
  description: 'Main Roads WA drainage structures per Specification 405 (edition 04/10105, 06/08/2021) - manholes, gullies and catchpits, precast and in-situ. Concrete per Spec 820/901, reinforcement per Spec 822, select bedding per WA 115.2. Backfill is split at subgrade level (embankment material below to Spec 302, pavement material above to Spec 501), tested per Spec 201. Hold points cover pre-backfill certification and cleaning before commissioning inspection.',
  activityType: 'drainage_pits',
  specificationReference: 'MRWA Spec 405',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'Excavation to line and level; foundation surfaces protected (MRWA Spec 405.27, 405.29)',
      acceptanceCriteria: 'The structure excavation is to line and level (405.27; blasting per 405.28 where required) and foundation surfaces are protected from disturbance (405.29).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.27, 405.28, 405.29.'
    },
    {
      description: 'Select bedding placed to grading (MRWA Spec 405.30, 405.09, WA 115.2)',
      acceptanceCriteria: 'Select bedding material is placed to the specified grading (405.30, 405.09), verified by WA 115.2.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'WA 115.2 (bedding PSD)',
      notes: 'MRWA Spec 405.30, 405.09.'
    },
    {
      description: 'Precast units handled and set without damage, or in-situ structure built to drawings (MRWA Spec 405.31, 405.34)',
      acceptanceCriteria: 'Precast units are handled and set without damage (405.31) or the in-situ structure is built to the drawings (405.34).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.31, 405.34.'
    },
    {
      description: 'Concrete per Spec 820/901; reinforcement per Spec 822 (MRWA Spec 405.06, 405.07)',
      acceptanceCriteria: 'In-situ concrete conforms to Spec 820/901 (405.06) and reinforcement conforms to Spec 822 (405.07).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 405.06, 405.07.'
    },
    {
      description: 'Step irons installed where required (MRWA Spec 405.35)',
      acceptanceCriteria: 'Step irons are installed where required (405.35).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.35. Conditional - where step irons are specified.'
    },
    {
      description: 'HOLD: compliance with all specified requirements certified before backfilling (MRWA Spec 405.32.1)',
      acceptanceCriteria: 'Prior to backfilling, the Contractor certifies to the Superintendent that compliance has been achieved with all specified requirements; released before backfill.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRWA Spec 405.32.1 HOLD.'
    },
    {
      description: 'Backfill split at subgrade: embankment material below to Spec 302 Rc, pavement material above to Spec 501; tested per Spec 201 (MRWA Spec 405.32)',
      acceptanceCriteria: 'Backfill material is split at subgrade level - embankment material below compacted to Spec 302 Rc (Annexure 302B), pavement material above compacted to Spec 501 densities - and stormwater-drain backfill follows Spec 404; all tested per Spec 201.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Rc (Spec 302 below / Spec 501 above, per Spec 201)',
      notes: 'MRWA Spec 405.32.2/.3.'
    },
    {
      description: 'Connecting conduits undamaged; any damage repaired/replaced at no cost (MRWA Spec 405.32.4)',
      acceptanceCriteria: 'Connecting conduits are undamaged; any damaged connecting conduit is repaired or replaced at no cost to the Principal.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.32.4.'
    },
    {
      description: 'Pavement reinstated per Spec 501 with surfacing per Spec 503; excavation edges saw-cut with a waterproof seal at joins (MRWA Spec 405.33)',
      acceptanceCriteria: 'Excavation edges are saw-cut straight; the pavement is reinstated per Spec 501 with surfacing per Spec 503, with a waterproof seal between new and existing surfaces.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.33.'
    },
    {
      description: 'HOLD: structure cleaned before the Superintendent\'s inspection and commissioning (MRWA Spec 405.41)',
      acceptanceCriteria: 'Prior to the Superintendent\'s inspection and commissioning, all structures are cleaned; this Hold Point is released before inspection/commissioning.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 405.41 HOLD.'
    }
  ]
}

// =============================================================================
// TEMPLATE 4: KERBING (MRWA Spec 407)
// Extruded/in-situ concrete kerbing, medians, traffic islands.
// NO hold points - tolerance-gated. Acceptance gates (407.33) encoded as
// standard items carrying the tolerance values. Setout is a witness point.
// =============================================================================

const waKerbingTemplate = {
  name: 'Kerbing (MRWA Spec 407)',
  description: 'Main Roads WA kerbing per Specification 407 (edition 05/2755, 23/02/2021) - extruded and in-situ concrete kerbing, medians and traffic islands. Concrete strength/curing per Spec 820/901. Spec 407 has no hold points; conformance is by tolerance inspection (407.33) and curing/backfill timing gates - kerbing within 20 mm of true plan position, deviation from line <= 1 in 300, top surface free from depressions > 5 mm under a 3 m straightedge, backfill not before 72 hours after laying.',
  activityType: 'kerb_channel',
  specificationReference: 'MRWA Spec 407',
  stateSpec: 'MRWA',
  checklistItems: [
    {
      description: 'WITNESS: kerb line and level set out per the drawings before extrusion/placement (MRWA Spec 407.27)',
      acceptanceCriteria: 'The kerb line and level are set out per the drawings before extrusion or in-situ placement.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey (line and level)',
      notes: 'MRWA Spec 407.27. Spec 407 has no hold points; setout is a control/witness point.'
    },
    {
      description: 'Surface prepared (clean, correct level) before placing (MRWA Spec 407.28)',
      acceptanceCriteria: 'The surface is prepared - clean and at the correct level - before the kerb is placed.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 407.28.'
    },
    {
      description: 'Concrete conforms to the specified class (Spec 820/901); kerb extruded/placed to profile (MRWA Spec 407.29)',
      acceptanceCriteria: 'Concrete conforms to the specified class per Spec 820/901 (compressive strength AS 1012) and the kerb is extruded or placed to the specified profile.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test_result',
      testType: 'Concrete compressive strength (Spec 820/901, AS 1012)',
      notes: 'MRWA Spec 407.29, 407.06.'
    },
    {
      description: 'Kerb openings formed to the drawings (MRWA Spec 407.30)',
      acceptanceCriteria: 'Kerb openings are formed to the drawings.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 407.30.'
    },
    {
      description: 'Curing compound applied per 407.31 / 407.08 (MRWA Spec 407.31)',
      acceptanceCriteria: 'Curing compound is applied per 407.31 and 407.08 (curing membrane verified per WA 110.1/WA 110.2).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'WA 110.1 / WA 110.2 (curing membrane)',
      notes: 'MRWA Spec 407.31, 407.08.'
    },
    {
      description: 'Joints formed at the specified spacing (MRWA Spec 407.32)',
      acceptanceCriteria: 'Joints are formed at the specified spacing (joint fillers/sealants per 407.07).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 407.32, 407.07.'
    },
    {
      description: 'GATE: kerbing within 20 mm of true plan position; rate of deviation from true line <= 1 in 300 (MRWA Spec 407.33)',
      acceptanceCriteria: 'Kerbing is placed within 20 mm of the true plan position and the rate of deviation from the true line is no more than 1 in 300 (tolerance conformance 407.33).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey (plan position and line)',
      notes: 'MRWA Spec 407.33 tolerance gate (no hold point - tolerance-gated).'
    },
    {
      description: 'GATE: top surface parallel to ruling grade, free from depressions > 5 mm under a 3 m straightedge (MRWA Spec 407.33)',
      acceptanceCriteria: 'The top surface is parallel to the ruling grade and free from depressions greater than 5 mm measured under a 3 m straightedge (407.33).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Straightedge (3 m)',
      notes: 'MRWA Spec 407.33 tolerance gate (no hold point - tolerance-gated).'
    },
    {
      description: 'GATE: profile not less than the drawings; road face and back face parallel (MRWA Spec 407.33)',
      acceptanceCriteria: 'The finished kerb profile is not less than shown on the drawings and the road face and back face are parallel (407.33).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRWA Spec 407.33 tolerance gate (no hold point - tolerance-gated).'
    },
    {
      description: 'Backfill placed no sooner than 72 hours after laying, compacted per Spec 302 (MRWA Spec 407.35)',
      acceptanceCriteria: 'Backfill is not placed before 72 hours after laying and is compacted per Spec 302; backfill/select-fill linear shrinkage per WA 123 / WA 134.1 as specified.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'WA 123 / WA 134.1 (linear shrinkage)',
      notes: 'MRWA Spec 407.35.'
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
  console.log(' WA (Main Roads WA) ITP Template Seeder - Drainage & Kerbing')
  console.log(' (Specs 403 / 404 / 405 / 407)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(waSubsoilDrainTemplate)
    await seedTemplate(waCulvertsTemplate)
    await seedTemplate(waDrainageStructuresTemplate)
    await seedTemplate(waKerbingTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (4 drainage/kerbing templates)')
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
