/**
 * Seed Script: QLD (TMR/MRTS) ITP Templates - Structures
 *
 * Creates global ITP templates for QLD structural activities.
 * Templates: Concrete (MRTS70), Piling (MRTS63-66), Reinforcement (MRTS71),
 *            Steelwork (MRTS78), Bearings (MRTS81), Precast (MRTS72), PT (MRTS89)
 *
 * Run with: node scripts/seed-itp-templates-qld-structures.js
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// =============================================================================
// 1. STRUCTURAL CONCRETE (MRTS70)
// =============================================================================

const qldStructuralConcreteTemplate = {
  name: 'QLD Structural Concrete (MRTS70)',
  description: 'TMR structural concrete for bridges, culverts, and retaining structures per MRTS70 (July 2022). Covers mix design approval, formwork, placement, curing, and strength acceptance.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS70 Concrete (July 2022)',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Concrete Quality Plan including placement procedures, curing method, formwork design, and QA program for Administrator acceptance',
      acceptanceCriteria: 'Quality Plan addresses all MRTS70 requirements; submitted minimum 28 days prior to concreting; accepted by Administrator in writing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 5.2 & 17.1 — Hold Point 2. No concreting to commence until Quality Plan accepted.'
    },
    {
      description: 'Submit concrete mix design for each strength grade for Administrator approval',
      acceptanceCriteria: 'Mix design includes cement type, admixtures, w/c ratio, and 28-day f\'c; trial mix results demonstrate compliance; approved by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 15.1 (Special Class) / 17.6.1 (Normal Class) — Hold Point 1. No concrete to be placed until mix design approved for each strength grade.'
    },
    {
      description: 'Submit predicted long-term properties (shrinkage, creep) for mass concrete or specific durability design elements',
      acceptanceCriteria: 'Shrinkage and creep predictions provided and vetted; values within design assumptions; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 17.6.1 — Hold Point. Required for mass concrete or where long-term properties affect design.'
    },
    {
      description: 'Submit concreting procedure for special-class concrete (mass pours >100 m3 or underwater placement)',
      acceptanceCriteria: 'Detailed procedure covers placement rate, equipment, contingency plans; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 15.6 (Special Class) — Hold Point 3. Required for mass pours or underwater placement.'
    },
    {
      description: 'Conduct concrete trial mix and submit results for specialized or high-performance concrete',
      acceptanceCriteria: 'Trial batch strength, workability, and durability results meet specification; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength) / AS 1012.3.1 (Slump)',
      notes: 'MRTS70 Clause 16.1.1 — Hold Point 6. For specialized concrete (precast, high-performance, large pours).'
    },
    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify site batch plant calibration (if site-batched concrete)',
      acceptanceCriteria: 'Scale calibration current; trial batch yield and admixture dosing correct; calibration witnessed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 17.5 / 17.6 — Witness Point. Prior to first batch from site plant.'
    },
    {
      description: 'Witness laboratory trial mix batching and testing for new concrete mix designs',
      acceptanceCriteria: 'Trial mix batching observed; slump, strength, and admixture effects assessed; results acceptable',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (Slump) / AS 1012.9 (Strength)',
      notes: 'MRTS70 Clause 15.2.3 — Witness Point. 3 days notice required.'
    },
    // =========================================================================
    // FORMWORK & REINFORCEMENT PRE-POUR
    // =========================================================================
    {
      description: 'Verify steel reinforcement fixing — bar sizes, spacing, laps, cover, and chairing',
      acceptanceCriteria: 'Reinforcement matches approved drawings; cover correct per exposure class; laps and splices correct; chairs adequate',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 Clause 5.5 & 6.2 — Witness Point. During fixing, advisory role before formal pre-pour inspection.'
    },
    {
      description: 'Pre-pour inspection of formwork, reinforcement, and embedded items',
      acceptanceCriteria: 'Formwork dimensions correct per AS 3610; reinforcement matches drawings; cover maintained; all debris removed; embedded items positioned; construction joints prepared; inspection checklist completed and signed',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 Clause 11.3 / 17.2 — Hold Point 12. NO CONCRETE SHALL BE PLACED until formwork and reinforcement are inspected and accepted by the Administrator.'
    },
    {
      description: 'Approve tremie/wet placement method for concrete in wet conditions',
      acceptanceCriteria: 'Tremie system approved; continuous concreting plan confirmed; method compliant with CIA Z17 Recommended Practice',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 11.5 / 13.1 — Hold Point 5. Required if concrete placed under water or in wet excavation.'
    },
    // =========================================================================
    // CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Conduct slump test and temperature check on concrete prior to placement',
      acceptanceCriteria: 'Slump within +/-15mm of nominated value (or +/-25%); concrete temperature 10-32 deg C; time since batching <= 90 minutes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (Slump) / AS 1012.8.4 (Temperature)',
      notes: 'MRTS70 — Test every truck initially. Record batch ticket details for each load. Reject loads not meeting specification.'
    },
    {
      description: 'Cast concrete test cylinders during placement',
      acceptanceCriteria: 'Minimum 1 set of 3 cylinders per 50 m3 or per pour (whichever more frequent); minimum 1 set per day per grade; specimens per AS 1012.8.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8.1 (Making) / AS 1012.9 (Compressive Strength)',
      notes: 'MRTS70 — Cylinders for 7-day and 28-day strength testing. Cured at 23 +/- 2 deg C per AS 1012.8.'
    },
    {
      description: 'Monitor air content of fresh concrete (if air-entrained specified)',
      acceptanceCriteria: 'Air content within specified range; tested on first 3 loads then every 50 m3 or change in material',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.4.2 (Air Content)',
      notes: 'MRTS70 — Required where air-entrained concrete specified for exposure class.'
    },
    {
      description: 'Witness concrete placing operations for major pours',
      acceptanceCriteria: 'Placement sequence, vibration, and continuous supply per approved procedure; no segregation; forms fully filled',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 17.7 / 17.8 — Witness Point. Contractor must give 24 hours notice of pour start.'
    },
    {
      description: 'Witness underwater concrete placement (tremie operation)',
      acceptanceCriteria: 'Tremie not lifted off concrete surface; continuous pour; no interruptions; tremie embedded minimum 1.5-3m in fresh concrete',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 15.7 / 17.11 — Witness Point. Notice included in HP for tremie approval.'
    },
    {
      description: 'Verify construction joint location and preparation',
      acceptanceCriteria: 'Joint locations per drawings or engineer-approved; surface roughened to 5mm amplitude; laitance removed; clean and prepared for bonding',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 Clause 15.13 / 16.9 — Witness Point. Before next pour at unplanned joints.'
    },
    // =========================================================================
    // POST-PLACEMENT & CURING
    // =========================================================================
    {
      description: 'Verify curing method and duration',
      acceptanceCriteria: 'Minimum 7 days moist curing or equivalent; curing applied promptly; no surface drying or powdering',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 — Effective curing for specified period. Curing lapse is a non-conformance.'
    },
    {
      description: 'Assess early formwork removal proposal (if proposed)',
      acceptanceCriteria: 'Concrete strength verified by cylinders or rebound hammer; surface condition acceptable before early stripping',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 / Rebound hammer',
      notes: 'MRTS70 Clause 17.9 — Witness Point. Administrator inspects concrete surface and gauges strength.'
    },
    {
      description: 'Verify concrete achieves minimum strength before formwork stripping or load application',
      acceptanceCriteria: 'Concrete strength >= 40% f\'c (or specific MPa value) for load-bearing formwork; side forms per approved early-strip procedure',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength)',
      notes: 'MRTS70 Clause 13.3 / 17.18 — Hold Point 13. Load-bearing formwork (soffits, props) removal held until approved strength reached.'
    },
    // =========================================================================
    // CONCRETE REPAIRS
    // =========================================================================
    {
      description: 'Witness concrete repair method for defects (honeycomb, tie-bolt holes, surface imperfections)',
      acceptanceCriteria: 'Repair method approved; surface preparation and repair execution witnessed; repairs not covered without inspection opportunity',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 Clause 17.12 / 17.13 — Witness Point. 24 hours notice. Repairs must not be concealed.'
    },
    // =========================================================================
    // POST-TENSIONING (WHERE APPLICABLE)
    // =========================================================================
    {
      description: 'Verify concrete achieves transfer strength before post-tensioning operations',
      acceptanceCriteria: 'Concrete strength >= 0.85 f\'c (or specified transfer strength) confirmed by cylinder tests before stressing; duct grouting or tendon stressing held until verified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength)',
      notes: 'MRTS70 Clause 17.14 / 17.15 — Hold Point. Do not grout ducts or stress tendons until transfer strength achieved.'
    },
    {
      description: 'Witness tendon stressing operation and verify elongation',
      acceptanceCriteria: 'Jack calibration current; jacking force within +/-5% of design; elongation within +/-7% of theoretical; 24 hours notice given',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Elongation measurement / Calibrated jack',
      notes: 'MRTS70 Clause 17.15 — Witness Point. 24 hours notice of stressing operations.'
    },
    // =========================================================================
    // STRENGTH ACCEPTANCE & DIMENSIONAL
    // =========================================================================
    {
      description: 'Verify 28-day compressive strength results meet acceptance criteria',
      acceptanceCriteria: 'No individual cylinder < 0.9 f\'c; batch mean minus 0.5 x standard deviation >= f\'c. Example: For 40 MPa concrete, no cylinder below 36 MPa.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength)',
      notes: 'MRTS70 Appendix A — TMR uses 0.9 f\'c rejection threshold (stricter than AS 1379 general 0.85 f\'c). Non-conforming lots require investigation.'
    },
    {
      description: 'Conduct post-pour cover survey using covermeter on exposed surfaces',
      acceptanceCriteria: 'Cover depth at minimum 5 points per member (or every 3m for long members); cover within specified tolerances; deficient cover reported',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Electromagnetic cover meter survey',
      notes: 'MRTS70 — 10% of members as audit, or more if issues found. Non-compliant cover may require protective coating.'
    },
    {
      description: 'Verify dimensional tolerances of formed concrete elements',
      acceptanceCriteria: 'Dimensions within AS 3610 tolerance: +/-10mm linear, +/-3mm slab thickness; plumb deviation <= H/1000 or 25mm; Class 2 finish: no offsets >3mm, undulations within 5mm under 3m straightedge',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey / Straightedge',
      notes: 'MRTS70 — Position of cast-in items (bolts, ducts) within +/-5mm.'
    },
    {
      description: 'Inspect concrete surfaces for cracking after curing',
      acceptanceCriteria: 'No pattern cracking or full-depth cracks; crack > 0.1mm wide in XD/XS exposure class requires epoxy injection; narrow plastic shrinkage cracks (<0.2mm) tolerable if infrequent',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 — Any crack > 0.1mm in XD/XS exposure requires rectification. Pattern cracking or full-depth cracks not accepted without engineer evaluation.'
    },
    // =========================================================================
    // LOT SIGN-OFF
    // =========================================================================
    {
      description: 'Final lot acceptance — all hold points released, strength verified, documentation complete',
      acceptanceCriteria: 'All test results compliant (strength, cover, dimensions); no outstanding NCRs; curing verified; quality records compiled; conformance report submitted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS70 / MRTS50 — Final acceptance by Administrator. All quality records included in handover documentation.'
    }
  ]
}

// =============================================================================
// 2. PILING (MRTS63-66)
// =============================================================================

const qldPilingTemplate = {
  name: 'QLD Piling - Bored, CFA & Driven (MRTS63-66)',
  description: 'TMR piling for bridge/structure foundations covering bored piles (MRTS63), driven tubular steel (MRTS64), precast prestressed (MRTS65), driven steel H-piles (MRTS66), and dynamic testing (MRTS68).',
  activityType: 'structural',
  specificationReference: 'TMR MRTS63/64/65/66/68 / AS 2159',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & APPROVALS
    // =========================================================================
    {
      description: 'Submit Piling Construction Procedure including pile type, equipment, installation sequence, concrete mix, and contingency plans',
      acceptanceCriteria: 'Procedure addresses all specification requirements; submitted minimum 28 days prior; accepted by Administrator in writing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63 Clause 5.2 / MRTS64 Clause 5.2 — Hold Point 1. Must include details of plant, liner/casing material, excavation method, concreting method (dry/tremie), and integrity testing program.'
    },
    {
      description: 'Submit concrete mix design for pile shaft concrete',
      acceptanceCriteria: 'Mix design meets MRTS70 requirements for specified class (typically S40 or S50); w/c ratio within limits; trial mix results provided; for tremie: 180-220mm slump or SCC designed per CIA Z17',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 Clause 15.1 — Hold Point 1 (Concrete). No concrete to be placed until mix design approved.'
    },
    {
      description: 'Submit Weld Procedure Specification (WPS) for liner/casing fabrication and field splice welding',
      acceptanceCriteria: 'WPS compliant with AS/NZS 1554.1; qualified by testing; all welders hold current qualifications',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63 / MRTS64 — Hold Point 2. Full penetration butt welds for spiral, longitudinal, transverse, and field splice welds.'
    },
    {
      description: 'Submit Geotechnical Investigation Report and confirm design founding levels',
      acceptanceCriteria: 'Borehole data at or adjacent to each pile location; founding level confirmed in competent material; report endorsed by qualified geotechnical engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'AS 2159 Clause 4 — Design assumptions confirmed by site investigation. Geotechnical Assessor must review ground conditions.'
    },
    {
      description: 'Submit Pile Integrity Testing program (PIT/PDA) including testing contractor qualifications',
      acceptanceCriteria: '100% low-strain PIT for cast-in-place piles; 100% PDA at end of drive for driven piles; nominated percentage for static load testing; MRTS68 compliant',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS68 Clause 5.2 — Program must detail PDA (high-strain) and PIT (low-strain) methodology, equipment calibration, and reporting format.'
    },
    {
      description: 'Submit reinforcing steel supplier acceptance documentation',
      acceptanceCriteria: 'Supplier TMR-registered; certified by ACRS or equivalent; mill certificates provided for all bar sizes',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 Clause 6.1 — Hold Point 1 (Reinforcing Steel). Steel only from TMR-registered supplier.'
    },
    // =========================================================================
    // MATERIAL VERIFICATION
    // =========================================================================
    {
      description: 'Verify survey set-out of pile locations against design drawings',
      acceptanceCriteria: 'Pile positions within +/-25mm of design coordinates; reference markers established for each pile',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS56 Construction Surveying. Set-out checked by independent surveyor prior to commencing piling.'
    },
    {
      description: 'Verify piling plant and equipment compliance with submitted construction procedure',
      acceptanceCriteria: 'Piling rig, crane, hammer match approved procedure; equipment in serviceable condition; operator qualifications current',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS63/64 — Equipment must be capable of achieving design founding level and pile capacity.'
    },
    {
      description: 'Verify steel liner/casing material certificates and dimensions (driven tubular piles)',
      acceptanceCriteria: 'Steel grade per AS/NZS 3678 or AS/NZS 1163; wall thickness >= design minimum (>20mm for MRTS64); mill certificates provided',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS64 Clause 6 — Each liner individually identified. Verify wall thickness, grade, and freedom from defects.'
    },
    {
      description: 'Verify precast concrete pile material certificates and quality (if precast prestressed piles)',
      acceptanceCriteria: 'Piles from TMR-registered precaster; concrete strength >= specified f\'c; prestressing force verified; no visible defects',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS65 — Each pile uniquely identified. Check for transport damage. Manufacturing QA records required.'
    },
    {
      description: 'Verify reinforcement cage fabrication against bar schedule and drawings',
      acceptanceCriteria: 'Bar sizes, spacing, lap lengths, cage dimensions correct; centralisers at max 3m spacing; minimum 75mm cover to liner/ground',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 Clause 10 / MRTS63 — Cage must maintain concentricity during concrete placement.'
    },
    {
      description: 'Verify concrete supply arrangements and batching plant approval',
      acceptanceCriteria: 'Batching plant TMR-approved or NATA-accredited; delivery time <= 90 minutes (or per TN125); contingency supply arranged for continuous pours',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS70 / TN125 — Pile concrete must be placed continuously without interruption.'
    },
    // =========================================================================
    // BORED PILE INSTALLATION (MRTS63)
    // =========================================================================
    {
      description: 'Verify bore/liner verticality and position at commencement of each pile',
      acceptanceCriteria: 'Position within 75mm in plan; verticality within 1:100 (bored) or 1:75 (driven); bore collar/guide correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 2159 Clause 7.2 — Record actual position of each pile.'
    },
    {
      description: 'Monitor boring operations and record ground conditions',
      acceptanceCriteria: 'Continuous log maintained for each pile; material changes with depth; groundwater levels; bore stability maintained',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63 — Compare with design assumptions. Notify Geotechnical Assessor of unexpected conditions.'
    },
    {
      description: 'Conduct test drilling at pile base to verify founding conditions',
      acceptanceCriteria: 'Test hole >= 2.4m or 2 pile diameters below base (whichever greater); material competence confirmed; supervised by Geotechnical Assessor',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Rotary or percussion test drilling',
      notes: 'MRTS63 — Hold Point 3. At least one test hole at each abutment and pier location. Written record signed by Geotechnical Assessor.'
    },
    {
      description: 'Dewater pile excavation and clean pile base of all debris',
      acceptanceCriteria: 'Pile base dewatered if practicable; bearing surface cleaned; no debris, loose rock, or sediment; base dressed to level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS63 — Dewatering and cleaning must occur prior to geotechnical certification.'
    },
    {
      description: 'Down-the-hole inspection of bored pile before concrete placement',
      acceptanceCriteria: 'Base cleanliness confirmed (no debris >50mm); socket dimensions verified; inspection by camera or personnel (if diameter >750mm and dry)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Visual inspection / DTI camera',
      notes: 'MRTS63 — For every bored pile. Part of Hold Point 3/4 (geotechnical certification).'
    },
    {
      description: 'Geotechnical certification of pile base and founding level',
      acceptanceCriteria: 'Geotechnical Assessor certifies ground conditions match design; factored strength >= design loads per AS 5100.3; actual vs design depth recorded',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: 'Visual inspection / geotechnical assessment',
      notes: 'MRTS63 — Hold Point 3/4. Critical quality gate. No concrete placement until Hold Point released. Signed by Geotechnical Assessor.'
    },
    {
      description: 'Geotechnical re-certification after delay or reclean of pile base',
      acceptanceCriteria: 'If delay >4 hours between certification and concrete placement, Geotechnical Assessor re-inspects and re-certifies; no deterioration of conditions',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: 'Visual inspection / geotechnical assessment',
      notes: 'MRTS63 — Hold Point 4. Risk of groundwater seepage or contamination during delay.'
    },
    // =========================================================================
    // DRIVEN PILE INSTALLATION (MRTS64/65/66)
    // =========================================================================
    {
      description: 'Verify pile driving hammer selection and energy rating',
      acceptanceCriteria: 'Hammer type, weight, energy rating match approved procedure; adequate for pile type and ground; cushion serviceable',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS64/65/66 — Hammer energy must be adequate to achieve design founding level and set criteria.'
    },
    {
      description: 'Monitor pile driving with PDA at end of drive',
      acceptanceCriteria: '100% of driven piles monitored; PDA data recorded for final set; force and velocity traces recorded; CAPWAP on nominated test piles (min 5%)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'PDA / High-Strain Dynamic Testing per MRTS68 / ASTM D4945',
      notes: 'MRTS68 — 100% monitoring at end of drive. CAPWAP signal matching required for nominated test piles.'
    },
    {
      description: 'Verify pile driving set criteria achieved at founding level',
      acceptanceCriteria: 'Pile driven to predetermined Founding Level; set within specified criteria (typically 2-10mm/blow at refusal); no damage indicators in PDA traces',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'PDA monitoring / Set measurement',
      notes: 'MRTS64/65/66 — Set criteria vary by pile type and ground conditions — refer to project specification.'
    },
    {
      description: 'Check driven pile head condition for damage after driving',
      acceptanceCriteria: 'No crushing, splitting, spalling of pile head; steel pile: no buckling/tearing; concrete pile: no cracking >0.3mm width',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Visual inspection',
      notes: 'MRTS64/65/66 — Driving damage can compromise pile integrity. Damaged piles may require replacement.'
    },
    {
      description: 'Survey pile position and verticality after installation (as-driven)',
      acceptanceCriteria: 'Final position within 75mm in plan at cutoff; verticality within 1:75 (driven) or as specified; rake within 1:25 of specified (battered piles)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Survey',
      notes: 'AS 2159 Clause 7.2 — Out-of-position piles must be assessed by designer.'
    },
    // =========================================================================
    // REINFORCEMENT & CONCRETE PLACEMENT (ALL PILE TYPES)
    // =========================================================================
    {
      description: 'Inspect reinforcement cage prior to installation in bore/liner',
      acceptanceCriteria: 'All bars, stirrups, ligatures per drawings; cage dimensions correct; centralisers/spacers fitted; cage clean and free from contamination',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 Clause 10 — Hold Point 3. Concrete must not be placed until reinforcement inspected and accepted.'
    },
    {
      description: 'Install reinforcement cage and verify final position',
      acceptanceCriteria: 'Cage installed without damage; centrally located; top at correct level; minimum 75mm cover maintained; cage suspended, not resting on base',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'MRTS63/64 — Cage installation must be supervised. Displacement or damage must be rectified.'
    },
    {
      description: 'Pre-pour inspection: formwork, reinforcement, cleanliness, readiness for concrete',
      acceptanceCriteria: 'Reinforcement accepted; bore/liner clean and free of debris/water (or tremie approved); embedded items positioned; concrete supply confirmed',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 Clause 11.3 / MRTS63 — Hold Point. Critical quality gate immediately before concreting. Administrator must release.'
    },
    {
      description: 'Conduct concrete slump/flow test and temperature check for pile concrete',
      acceptanceCriteria: 'Slump within +/-15mm of nominated (or flow spread 500-600mm for SCC); temperature 10-32 deg C; time since batching <= 90 minutes',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (Slump) / AS 1012.8.4 (Temperature)',
      notes: 'MRTS70 — Test every truck. Reject loads not meeting specification. Record batch ticket details.'
    },
    {
      description: 'Monitor concrete placement operations — continuous pour, vibration, concrete level',
      acceptanceCriteria: 'Continuous operation; concrete level rises uniformly; no segregation or contamination; tremie embedded to minimum depth; final level at or above cutoff + 600mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63/64 — 24 hours notice. Cast to minimum 600mm above cutoff for laitance removal. Record start/finish times, truck numbers, volumes.'
    },
    {
      description: 'Record pile concreting log with volumes, times, truck details',
      acceptanceCriteria: 'Complete log for each pile; actual volume within +/-10% of theoretical (flag if >+20% indicating over-break); no interruptions exceeding approved limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63/64 — Over-consumption may indicate voids or ground loss. Under-consumption may indicate obstruction. Both require investigation.'
    },
    // =========================================================================
    // PILE CUTOFF & HEAD TREATMENT
    // =========================================================================
    {
      description: 'Verify concrete strength before pile cutoff operations',
      acceptanceCriteria: 'Concrete compressive strength >= 10 MPa (or as specified) confirmed by cylinder test before breaking down pile head',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'MRTS63/64 — Premature cutoff can damage pile shaft. Cutoff by hydraulic breaking, not drop weight.'
    },
    {
      description: 'Cut off pile head to design level and prepare for pile cap connection',
      acceptanceCriteria: 'Cutoff level within +/-25mm of design; surface perpendicular to pile axis; reinforcement protruding correct length; no damage below cutoff',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Survey',
      notes: 'MRTS63/64 — Protruding reinforcement must have correct embedment for pile cap connection.'
    },
    // =========================================================================
    // PILE INTEGRITY TESTING
    // =========================================================================
    {
      description: 'Conduct Low-Strain Pile Integrity Testing (PIT) on cast-in-place piles',
      acceptanceCriteria: 'PIT on 100% of cast-in-place piles; testing when concrete >= 70% f\'c (7-14 days); Pile Integrity Factor >= 0.7; no significant shaft defects',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Low-Strain PIT per ASTM D5882 / AS 2159',
      notes: 'MRTS63/68 — Anomalous results trigger further investigation (cross-hole sonic logging or coring).'
    },
    {
      description: 'Submit Pile Integrity Test reports and obtain acceptance',
      acceptanceCriteria: 'All PIT/PDA reports submitted within 14 days; analysis and interpretation complete; all piles satisfactory; anomalous piles addressed',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63/68 — Hold Point. Administrator must accept reports before pile cap/headstock work proceeds.'
    },
    {
      description: 'Conduct static load testing on nominated piles (if specified)',
      acceptanceCriteria: 'Test per AS 2159; pile sustains 1.5x-2.0x design working load; settlement within criteria (typically <25mm at working load, <50mm at 1.5x)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Static Load Test per AS 2159',
      notes: 'MRTS63/64 — Definitive pile capacity verification. Required on preliminary/test piles and percentage of working piles.'
    },
    // =========================================================================
    // POST-INSTALLATION VERIFICATION & DOCUMENTATION
    // =========================================================================
    {
      description: 'Verify 28-day concrete compressive strength results for pile shaft concrete',
      acceptanceCriteria: 'No sample < 0.9 f\'c; batch mean - 0.5 x standard deviation >= f\'c; non-conforming results investigated',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'MRTS70 Appendix A — TMR 0.9 f\'c rejection threshold. For 40 MPa, no cylinder below 36 MPa.'
    },
    {
      description: 'Prepare and submit complete Pile Schedule (as-built record for each pile)',
      acceptanceCriteria: 'Record per pile: number, date, position, founding level, verticality, concrete mix, volume, strength, integrity results, deviations',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS63/64 — Primary as-built record. Complete before pile cap work commences.'
    },
    {
      description: 'Verify pile cap construction joint preparation',
      acceptanceCriteria: 'Pile heads prepared for connection; exposed reinforcement clean; concrete surface roughened to 5mm amplitude; no laitance; positions within tolerance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 — Interface between pile and pile cap is critical structural joint.'
    },
    {
      description: 'Submit conformance report for completed piling works',
      acceptanceCriteria: 'All piles installed per specification; all hold points released; all tests compliant; non-conformances addressed; report accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 Quality System Requirements — Final acceptance by Administrator.'
    }
  ]
}

// =============================================================================
// 3. REINFORCEMENT PLACEMENT (MRTS71)
// =============================================================================

const qldReinforcementTemplate = {
  name: 'QLD Reinforcement Placement (MRTS71)',
  description: 'TMR reinforcement supply, fabrication, and placement for all structural concrete per MRTS71 (June 2020, updated July 2025). Covers material acceptance, bending, fixing, cover, couplers, welding, and pre-pour inspection.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS71 Reinforcing Steel / AS 3600 / AS/NZS 4671',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-WORK SUBMISSIONS & MATERIAL ACCEPTANCE
    // =========================================================================
    {
      description: 'Submit proposed steel reinforcement supplier for Administrator acceptance',
      acceptanceCriteria: 'Supplier TMR-registered; certified by ACRS or equivalent; supplier registration documentation submitted minimum 3 days prior to supply',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 Clause 6.1 — Hold Point 1 (Acceptance of Supplier). 3 day notification. Steel only from TMR-registered supplier.'
    },
    {
      description: 'Verify reinforcement material compliance certificates (mill certificates) for each delivery',
      acceptanceCriteria: 'Mill certificates confirm AS/NZS 4671 compliance (grade 500N, 500L, or 500E); chemical/mechanical properties within limits; traceable to heat/cast numbers',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 Clause 6.1.1 — Mill certificates must accompany every delivery. Bar identification marks must match.'
    },
    {
      description: 'Conduct random tensile testing of reinforcement samples',
      acceptanceCriteria: 'Yield strength, UTS, elongation, and UTS/yield ratio comply with AS/NZS 4671; minimum 1 sample per 30 tonnes per bar size',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 4671 / AS 1391 (Tensile testing)',
      notes: 'MRTS71 Clause 6 — Random verification testing. Frequency may be reduced if supplier has established TMR quality record.'
    },
    {
      description: 'Submit bar schedule and check against structural drawings',
      acceptanceCriteria: 'Bar schedule matches current drawings including amendments; bar marks, sizes, shapes, lengths, quantities correct; per TMR Volume 3 Chapter 4',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'TMR Volume 3, Chapter 4 — Bar schedules checked by independent person before fabrication.'
    },
    {
      description: 'Submit mechanical coupler product registration and test certificates',
      acceptanceCriteria: 'Couplers TMR-registered for bar sizes and types; product certification current (re-tested every 3 years); coupler type appropriate for application',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 — Hold Point 4 (Mechanical reinforcing bar splices). Couplers must be TMR-registered product. Types: mechanically gripped, threaded, friction-welded.'
    },
    {
      description: 'Submit Weld Procedure Specification (WPS) and welder qualifications for site welding of reinforcement',
      acceptanceCriteria: 'WPS compliant with AS/NZS 1554.3; all welders hold current qualifications for weld type; pre-heat requirements specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 — Not all bar grades weldable — check AS/NZS 4671 weldability. Flash butt, arc, and friction welding each have different requirements.'
    },
    {
      description: 'Submit hot bending procedure for Administrator acceptance (if required)',
      acceptanceCriteria: 'Temperature range 600-800 deg C, never >850 deg C; heating method specified; quenching prohibited; accepted by Administrator',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS71 Clause 8.2 — Hold Point 2 (Hot Bending). Cold bending preferred. Hot bending can alter steel properties.'
    },
    // =========================================================================
    // STORAGE AND HANDLING
    // =========================================================================
    {
      description: 'Verify reinforcement storage conditions on site',
      acceptanceCriteria: 'Stored off ground on bearers; protected from contamination; separated by size/mark; no excessive rust beyond normal surface oxidation',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 — Light surface rust acceptable; heavy flaking rust, pitting, or section loss is not.'
    },
    {
      description: 'Verify reinforcement is free from deleterious materials before fixing',
      acceptanceCriteria: 'Bars free from loose rust, mill scale, oil, grease, paint, mud, concrete splatter per AS 3600 Clause 13.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 3600 Clause 13.1 — Surface condition directly affects bond. Light surface rust improves bond.'
    },
    // =========================================================================
    // FABRICATION AND BENDING
    // =========================================================================
    {
      description: 'Verify bar bending dimensions and shapes against bar schedule',
      acceptanceCriteria: 'Length +/-25mm (bars up to 12m), +/-50mm (longer); bend angle +/-2.5 deg; minimum bend diameters per AS 3600 Table 13.2.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 3600 Clause 13.2 — Min pin diameter: 5db for db<=20mm, 8db for db>20mm (D500N). Bars must not be re-bent without approval.'
    },
    // =========================================================================
    // FIXING AND PLACEMENT
    // =========================================================================
    {
      description: 'Verify formwork dimensions and cleanliness before reinforcement fixing',
      acceptanceCriteria: 'Formwork per AS 3610 tolerances; clean, release agent applied; kickers/starters clean and correct; construction joint surfaces roughened to 5mm amplitude',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 / AS 3610 — Formwork checked before reinforcement fixing as it determines cover and position.'
    },
    {
      description: 'Verify reinforcement bar sizes, spacings, and arrangement against structural drawings',
      acceptanceCriteria: 'Bar sizes match drawings; spacing within +/-10mm; layer arrangement correct (top/bottom, inner/outer); bar orientation correct',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 Clause 10 / AS 3600 — Wrong bar arrangement difficult to rectify after concrete placement.'
    },
    {
      description: 'Verify concrete cover to all reinforcement using spacer inspection and measurement',
      acceptanceCriteria: 'Cover per exposure class: girders/beams/slabs -5mm/+10mm; slabs on ground -10mm/+20mm; footings cast in ground >=500mm -10mm/+40mm; bar chairs at max spacing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Cover meter survey (post-pour verification)',
      notes: 'MRTS71 — Cover critical for durability. Typical minimums: 40mm (sheltered), 50mm (exterior), 65mm (marine), 75mm (piles cast in ground).'
    },
    {
      description: 'Verify lap splice lengths, positions, and stagger pattern',
      acceptanceCriteria: 'Laps >= design requirement per AS 3600 Clause 13.1.2 (typically 40-60db); staggered per drawings (max 50% at same section); not in maximum moment regions',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 3600 Clause 13.1.2 — Verify against drawing details, not just generic formula.'
    },
    {
      description: 'Verify mechanical coupler installation and torque',
      acceptanceCriteria: 'Installed per manufacturer instructions; bar fully inserted to marked depth; threaded couplers torqued to specified value; engagement indicator checked',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Torque wrench / visual per manufacturer',
      notes: 'MRTS71 — Hold Point 4 (Mechanical splices). Each coupler individually verified. Record type, bar sizes, location.'
    },
    {
      description: 'Verify welded splice quality (if site welding)',
      acceptanceCriteria: '100% visual inspection (no cracks, porosity, undercut); NDE per WPS; weld dimensions meet design; welder qualification current',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Visual + NDE per AS/NZS 1554.3',
      notes: 'MRTS71 — All welds visually inspected. NDE (magnetic particle, ultrasonic) as specified in qualified WPS.'
    },
    {
      description: 'Verify tie wire and fixing system rigidity',
      acceptanceCriteria: 'Rigid cage maintains tolerances under all loads during concrete placement; tie wire at every second intersection minimum; wire tails bent away from forms',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 — System of fixing must form rigid cage without need for adjustment during placement.'
    },
    {
      description: 'Verify bar chair types, spacing, and positioning for cover',
      acceptanceCriteria: 'Chairs appropriate for exposure class (no plastic in aggressive zones); height correct for cover; max spacing 800-1000mm bottom, 600-800mm top bars',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71/MRTS70 — Top mat support critical in slabs. Concrete or stainless steel chairs in marine/severe exposure.'
    },
    {
      description: 'Verify reinforcement around embedded items, penetrations, and build-outs',
      acceptanceCriteria: 'Displaced bars replaced with equivalent area; trimmer bars at all openings per drawings; adequate clearance for embedded items; no cutting without engineer approval',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'AS 3600 — Cutting or displacement of reinforcement requires engineer approval.'
    },
    // =========================================================================
    // PRE-POUR INSPECTION
    // =========================================================================
    {
      description: 'Conduct formal pre-pour inspection of all reinforcement, formwork, and embedded items',
      acceptanceCriteria: 'All reinforcement matches drawings; cover correct; laps correct and staggered; couplers verified; formwork correct; embedded items positioned; no debris; joints prepared; comprehensive checklist signed',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS71 Clause 10 — Hold Point 3 / MRTS70 Clause 11.3 — Hold Point 12. NO CONCRETE SHALL BE PLACED until inspected and accepted by Administrator.'
    },
    // =========================================================================
    // DURING AND AFTER CONCRETE PLACEMENT
    // =========================================================================
    {
      description: 'Monitor reinforcement position during concrete placement for displacement',
      acceptanceCriteria: 'No visible displacement during placement or vibration; top mat at correct level; cover not compromised; pour stopped if displacement identified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 — Workers must not stand on or bend reinforcement. Continuous monitoring during pour.'
    },
    {
      description: 'Conduct post-pour cover survey using covermeter after formwork removal',
      acceptanceCriteria: 'Minimum 5 points per member (or every 3m); cover within tolerances; deficient cover reported with remedial measures',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Electromagnetic cover meter survey',
      notes: 'MRTS70 — 10% of members as audit. Non-compliant cover may require protective coating or additional cover.'
    },
    {
      description: 'Inspect exposed reinforcement at construction joints before resuming pour',
      acceptanceCriteria: 'Protruding reinforcement clean, undamaged, correctly positioned; no contamination; laitance removed; starters at correct spacing and projection',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS70 / AS 3600 — Reinforcement continuity across joints critical. Adequate development length on each side.'
    },
    // =========================================================================
    // DOCUMENTATION & RECORDS
    // =========================================================================
    {
      description: 'Compile and submit reinforcement conformance records for each structural element',
      acceptanceCriteria: 'Material certificates, bar schedule verification, pre-pour checklists (signed), coupler records, weld records, cover survey results, NCR reports; complete set per pour/element',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS50 / MRTS71 — Records for handover and defects liability period.'
    },
    {
      description: 'Final lot acceptance for reinforcement — all items verified and documented',
      acceptanceCriteria: 'All hold points released; material certificates complete; pre-pour inspections signed; cover surveys acceptable; no outstanding NCRs',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'signature',
      testType: null,
      notes: 'MRTS50 / MRTS71 — Final acceptance by Administrator.'
    }
  ]
}

// =============================================================================
// 4. STRUCTURAL STEELWORK (MRTS78)
// =============================================================================

const qldSteelworkTemplate = {
  name: 'QLD Structural Steelwork (MRTS78)',
  description: 'TMR structural steelwork fabrication, coating, and erection for bridges and sign gantries per MRTS78 (November 2020). Covers fabricator qualification, welding, NDE, coatings, and site erection.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS78 Fabrication of Structural Steelwork / AS/NZS 5131 / AS 4100',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // PRE-FABRICATION
    // =========================================================================
    {
      description: 'Submit Fabricator registration certificate (AS/NZS 5131 CC2 or CC3) for Administrator acceptance',
      acceptanceCriteria: 'Valid registration for required Construction Category; provided minimum 10 business days before fabrication',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS78 Clause 5 — CC2 = minor infrastructure; CC3 = major infrastructure (bridges). All AS/NZS 5131 "should" clauses replaced with "shall".'
    },
    {
      description: 'Submit fabrication Quality Plan including WPS, NDE plan, surface treatment plan, and ITP',
      acceptanceCriteria: 'Quality Plan addresses all AS/NZS 5131 and MRTS78 requirements; accepted by Administrator prior to fabrication',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS78 Clause 5.2 — Quality Plan shall include welder qualifications, NDE procedures, coating system details.'
    },
    {
      description: 'Provide material test certificates for all steel, minimum 5 business days prior to fabrication',
      acceptanceCriteria: 'Mill certificates for each heat/grade; minimum 2% each size/grade tested (min 1 sample); compliance with AS/NZS 3678 (plate) or AS/NZS 3679 (sections)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 3678 / AS/NZS 3679 material testing',
      notes: 'MRTS78 Clause 6 & TN60 — Check Charpy impact values if specified for fracture-critical members.'
    },
    {
      description: 'Verify WPS are qualified and welders hold current qualifications',
      acceptanceCriteria: 'WPS per AS/NZS 1554.1 (or 1554.5 for fatigue-loaded); all welders currently qualified for applicable process and position',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AS/NZS 1554.1 / AS/NZS 1554.5 welder qualification',
      notes: 'MRTS78 Clause 7 — FP (fatigue purpose) welding per AS/NZS 1554.5. Welder records must be current.'
    },
    // =========================================================================
    // CUTTING, PREPARATION & WELDING
    // =========================================================================
    {
      description: 'Verify material cutting per AS/NZS 5131 Clause 6.5.1',
      acceptanceCriteria: 'Cut surfaces free from notches, tears, heat-affected defects; thermal cut edges ground smooth',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 Clause 6 — Butt weld preparation by machining, grinding, or thermal cutting followed by grinding.'
    },
    {
      description: 'Inspect weld joint preparation (bevel angles, root gaps, cleanliness)',
      acceptanceCriteria: 'Preparation matches WPS; surfaces clean, dry, free of mill scale/rust/oil within 50mm of weld zone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual inspection per AS/NZS 5131',
      notes: 'MRTS78 Clause 7 — Preparation required for all butt weld preparation.'
    },
    {
      description: 'Verify bolt holes drilled (not punched) for CC3, or punched and reamed for CC2',
      acceptanceCriteria: 'Hole diameter within tolerance per AS 4100; no ovality >1mm; burrs removed; match-marking verified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 / AS/NZS 5131 Clause 6.6 — Bolt hole requirements per construction category.'
    },
    {
      description: 'Perform pre-heat verification before welding (where required)',
      acceptanceCriteria: 'Preheat temperature meets WPS minimum; measured by contact thermometer at specified distance from weld zone',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature measurement per WPS',
      notes: 'MRTS78 Clause 7 — Critical for sections >25mm thick or high-strength steels.'
    },
    {
      description: 'Perform in-process welding inspection (100% visual) during fabrication',
      acceptanceCriteria: 'No visible cracks, undercut >1mm, porosity, slag inclusions, or excessive spatter',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual inspection per AS/NZS 1554.1',
      notes: 'MRTS78 Clause 7 — 100% visual scanning baseline for all construction categories.'
    },
    {
      description: 'Perform Non-Destructive Examination (NDE) of completed welds per approved plan',
      acceptanceCriteria: 'NDE type/extent per AS/NZS 5131 CC level; CC3: 100% visual + MT/PT fillet welds + UT/RT butt welds; all results meet AS/NZS 1554.1 Category SP',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'UT per AS 2207 / RT per AS 2177 / MT',
      notes: 'MRTS78 Clause 7 — NDE levels in ADDITION to 100% visual. CC3 bridges: 100% UT/RT butt welds, 20-50% MT critical fillets.'
    },
    {
      description: 'Submit all weld NDE results and obtain acceptance before surface treatment',
      acceptanceCriteria: 'All welds pass acceptance criteria; non-conforming welds repaired and re-tested; NDE report accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'NDE results compilation',
      notes: 'MRTS78 — No surface treatment until all welding complete and accepted. Repairs use approved procedure.'
    },
    // =========================================================================
    // FABRICATION DIMENSIONAL CHECK
    // =========================================================================
    {
      description: 'Perform dimensional survey of fabricated steelwork',
      acceptanceCriteria: 'Dimensions per drawings and AS 4100 (+/-3mm lengths, +/-2mm bolt holes, camber within +/-L/1000 or as specified)',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Dimensional survey',
      notes: 'MRTS78 — Check match-marking for site assembly.'
    },
    {
      description: 'Verify trial assembly (shop fit-up) of major connections (where specified)',
      acceptanceCriteria: 'Components align correctly; bolt holes match; bearing surfaces achieve contact; no forced fit required',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 / AS/NZS 5131 — Trial assembly may be required for CC3 bridge components.'
    },
    // =========================================================================
    // SURFACE PREPARATION & COATINGS
    // =========================================================================
    {
      description: 'Perform surface preparation (abrasive blast cleaning) to required standard',
      acceptanceCriteria: 'Treatment Grade P3 per AS/NZS 5131; blast to AS 1627.4 Class Sa 2.5 (near-white metal); profile 50-75 microns; applied within 4 hours',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1627.4 (blast cleaning), surface profile measurement',
      notes: 'MRTS78 Clause 8 — Coating must be applied within 4 hours of blasting (before flash rust).'
    },
    {
      description: 'Verify coating system matches specification (paint or galvanizing)',
      acceptanceCriteria: 'Coating system per Engineering Drawings (e.g., IZS primer + epoxy + PU topcoat, or HDG per AS/NZS 4680); product data sheets and batch certificates provided',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS78 Clause 8 — Coating system per project specification.'
    },
    {
      description: 'Verify primer and coating DFT at each stage',
      acceptanceCriteria: 'Each coat DFT within range (primer typically 75-100 microns IZS); min 5 readings per member per coat; no readings below 80% of specified DFT; total system meets minimum',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'DFT measurement per AS/NZS 2312 / AS 3894.3',
      notes: 'MRTS78 / AS/NZS 2312 — Inter-coat adhesion verified by cross-cut test (AS 3894.9) if required.'
    },
    {
      description: 'Perform adhesion testing of completed coating system',
      acceptanceCriteria: 'Pull-off adhesion >= 2.5 MPa (or specified); cross-hatch rating 0-2 per AS 3894.9; no delamination between coats',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 3894.6 (pull-off adhesion), AS 3894.9 (cross-cut)',
      notes: 'MRTS78 / AS/NZS 2312 — At frequency specified in coating plan.'
    },
    {
      description: 'For galvanized steelwork: verify coating thickness and quality',
      acceptanceCriteria: 'Minimum thickness per AS/NZS 4680 (e.g., 85 microns for steel >=6mm); no bare spots, blisters, or dross inclusions; zinc uniform and adherent',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 4680 / AS 2331 (coating thickness)',
      notes: 'MRTS78 — Galvanizing certificate required. Touch-up per AS/NZS 4680 Appendix.'
    },
    {
      description: 'Final inspection of all coated/galvanized steelwork before dispatch',
      acceptanceCriteria: 'All defects repaired; DFT records complete; colour matches approved sample; packaging/protection plan approved for transport',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 — Administrator release required before dispatch from fabrication workshop.'
    },
    // =========================================================================
    // TRANSPORT, STORAGE & ERECTION
    // =========================================================================
    {
      description: 'Inspect steelwork on delivery for transport damage',
      acceptanceCriteria: 'No damage to members, coatings, or connections; any damage documented and repair method approved',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 — All damage repaired to original specification standard.'
    },
    {
      description: 'Submit erection methodology and sequence for Administrator acceptance',
      acceptanceCriteria: 'Erection plan includes crane lifts, temporary bracing, bolt-up sequence, safety provisions; accepted by Administrator and structural engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS78 — Must address stability at all stages. Temporary works designed by RPEQ.'
    },
    {
      description: 'Verify bearing and seating surfaces at abutments/piers before placement',
      acceptanceCriteria: 'Bearing surfaces level within +/-2mm; bearing pads positioned; grouted seats cured to specified strength; dimensions match shop drawings',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Level survey',
      notes: 'MRTS78 — Bearing surfaces prepared and accepted before placing steelwork.'
    },
    {
      description: 'Check temporary bracing and stability during erection sequence',
      acceptanceCriteria: 'Bracing per erection engineer design; stability verified at each stage; no unbraced members left overnight',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS78 — Temporary works must be designed by RPEQ.'
    },
    {
      description: 'Perform alignment survey of erected steelwork',
      acceptanceCriteria: 'Plumb +/-H/1000; horizontal alignment +/-3mm at connections; overall geometry within +/-10mm',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Dimensional survey',
      notes: 'MRTS78 / AS 4100 — Survey before permanent bolting to allow adjustment.'
    },
    {
      description: 'Install and tension permanent bolts (HSFG or bearing type)',
      acceptanceCriteria: 'Grade/size per drawings; HSFG tensioned to AS 4100 Table 15.2.5.1 minimum; snug-tight for bearing bolts; verified by turn-of-nut, DTI, or calibrated wrench',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 4100 bolt tensioning verification',
      notes: 'MRTS78 — HSFG faying surfaces must meet specified slip factor (Class C minimum for galvanized).'
    },
    {
      description: 'Perform site welding with NDE verification (if required)',
      acceptanceCriteria: 'Per approved WPS; NDE as per factory requirements (same CC level); environmental conditions suitable; all welds pass NDE',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'NDE per AS/NZS 1554.1',
      notes: 'MRTS78 — Site welding requires same quality as shop welding. Weather protection may be required.'
    },
    {
      description: 'Repair all coating damage from transport and erection',
      acceptanceCriteria: 'Damaged areas prepared to original standard; touch-up compatible with original system; repaired DFT meets spec; overlap 50mm onto existing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'DFT measurement',
      notes: 'MRTS78 — All repairs use approved touch-up system.'
    },
    {
      description: 'Final dimensional survey and completion certificate for steelwork',
      acceptanceCriteria: 'All hold points released; NDE records complete; coating records complete; as-built survey accepted; no outstanding NCRs; quality records compiled',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS78 — Final acceptance by Administrator. All quality records for handover.'
    }
  ]
}

// =============================================================================
// 5. BRIDGE BEARINGS (MRTS81)
// =============================================================================

const qldBearingsTemplate = {
  name: 'QLD Bridge Bearings (MRTS81)',
  description: 'TMR bridge bearing supply, testing, and installation per MRTS81 (November 2020). Covers elastomeric and sliding bearings — design submission, manufacture, testing, installation, and commissioning.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS81 Bridge Bearings / AS 5100.4 / AS 1523',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // BEARING SUPPLY AND DOCUMENTATION
    // =========================================================================
    {
      description: 'Submit bearing design calculations, shop drawings, and material specifications for Administrator acceptance',
      acceptanceCriteria: 'Design demonstrates capacity for specified loads/movements; shop drawings show dimensions, layup, tolerances; materials comply with MRTS81',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS81 Clause 5 — All documentation accepted before manufacture commences. Bearings from TMR-approved product list.'
    },
    {
      description: 'Verify bearing manufacturer is on TMR Approved Products list with current quality certification',
      acceptanceCriteria: 'Manufacturer on TMR Product Index for Bridges; current ISO 9001 (or equivalent); manufacturing facility approved',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS81 — Bearings sourced only from approved manufacturers per TMR Product Index.'
    },
    {
      description: 'Verify elastomer material properties (hardness, tensile, elongation, compression set, ozone resistance)',
      acceptanceCriteria: 'Hardness +/-5 IRHD of nominal; tensile >= 17 MPa; elongation >= 300%; compression set <= 30% at 70 deg C; ozone pass; 100-year service life formulation',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1523 / AS ISO 48 (hardness) / AS ISO 37 (tensile)',
      notes: 'MRTS81 Clause 6 — All components formulated for minimum 100-year service life. Material certificates per batch.'
    },
    // =========================================================================
    // BEARING MANUFACTURE AND TESTING
    // =========================================================================
    {
      description: 'Factory inspection of bearing manufacture (laminate bonding, dimensions, internal reinforcement)',
      acceptanceCriteria: 'Steel shim plates correctly positioned; bond complete (no voids >2mm); dimensions within +/-1mm thickness, +/-2mm plan',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual and dimensional inspection',
      notes: 'MRTS81 Clause 7 — Factory inspection during and after manufacture.'
    },
    {
      description: 'Perform type testing on representative bearings (min 1 per 10 identical from same batch)',
      acceptanceCriteria: 'Shear modulus within +/-15% of design; compressive stiffness within +/-15%; friction coefficient <= 0.04 for sliding surfaces',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1523 bearing testing (shear, compression)',
      notes: 'MRTS81 Clause 8 — Test costs borne by Contractor.'
    },
    {
      description: 'Verify bearing permanent identification markings',
      acceptanceCriteria: 'Unique ID number, manufacturer name, batch/lot number, and orientation arrows; markings permanent, legible, and do not damage function',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 Clause 9 — Each bearing uniquely identifiable and traceable to test records.'
    },
    {
      description: 'Submit bearing test certificates and compliance documentation before delivery',
      acceptanceCriteria: 'Test certificates demonstrate compliance; material certificates provided; manufacturing records complete; Administrator accepts',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS81 — Bearings not to be delivered until test documentation accepted.'
    },
    // =========================================================================
    // DELIVERY AND STORAGE
    // =========================================================================
    {
      description: 'Inspect bearings on delivery for transport damage',
      acceptanceCriteria: 'No visible damage to body, laminations, or sliding surfaces; quantities and IDs match delivery schedule; packaging intact',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 — Damaged bearings rejected and replaced.'
    },
    {
      description: 'Verify site storage conditions for bearings',
      acceptanceCriteria: 'Stored flat on clean surface; protected from UV, chemicals, oil, sharp objects; temperature 5-40 deg C; no deforming stacking; PTFE surfaces protected',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 — Elastomeric bearings degrade under UV and chemical contact.'
    },
    // =========================================================================
    // BEARING SEAT PREPARATION & INSTALLATION
    // =========================================================================
    {
      description: 'Inspect bearing seat surfaces for level, flatness, and finish',
      acceptanceCriteria: 'Level within +/-2mm of design; flatness <= 1mm under 300mm straightedge; smooth finish (no protrusions >1mm); concrete strength >= specified',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Level survey, straightedge check',
      notes: 'MRTS81 Clause 10 — Bearing seats prepared and accepted before installation. Surface clean, free of laitance.'
    },
    {
      description: 'Install bearings at correct location, orientation, and preset',
      acceptanceCriteria: 'Position within +/-5mm of design; orientation correct (direction arrows); thermal preset applied if specified; fully seated',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Level survey, temperature measurement',
      notes: 'MRTS81 — Orientation critical. Preset accounts for installation temperature vs mean bridge temperature. Min 15mm gap between headstock top and deck soffit per MRTS74.'
    },
    {
      description: 'Verify bearing restraint system (hold-down bolts, keeper plates, guide bars)',
      acceptanceCriteria: 'Restraint type per design; bolts torqued to specification; keeper plates allow design movements; guide bars aligned +/-1mm',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 — Restraint must allow specified movements while preventing bearing walk-out.'
    },
    // =========================================================================
    // GROUTING & LOAD TRANSFER
    // =========================================================================
    {
      description: 'Place grout around bearings and verify complete fill',
      acceptanceCriteria: 'Non-shrink cementitious grout (>= 50 MPa at 28 days); no voids under or around bearing; flush finish; grout samples taken',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Grout compressive strength test',
      notes: 'MRTS81 — Grouting in suitable weather (5-35 deg C). Grout achieves design strength before loading.'
    },
    {
      description: 'Verify superstructure load transfer to bearings after placement',
      acceptanceCriteria: 'Superstructure correctly seated on all bearings; uniform contact (no gaps >0.5mm at edges); measured loads within tolerance (if load cells used)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Visual inspection, load measurement if specified',
      notes: 'MRTS81 — Uneven loading may indicate bearing seat irregularity.'
    },
    {
      description: 'Remove temporary works and verify bearing free to move as designed',
      acceptanceCriteria: 'All temporary restraints removed; movement freedom verified in design directions; no mechanical interference; no damage during removal',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 — Bearings must accommodate thermal, creep, and shrinkage movements.'
    },
    // =========================================================================
    // DOCUMENTATION AND ACCEPTANCE
    // =========================================================================
    {
      description: 'Record as-installed bearing positions, orientations, and presets',
      acceptanceCriteria: 'As-built survey of all locations; orientation documented; preset values recorded with installation temperature',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'As-built survey',
      notes: 'MRTS81 — Essential for future bearing inspection and replacement.'
    },
    {
      description: 'Verify bearing access provisions for future maintenance inspection',
      acceptanceCriteria: 'Access to all bearings for visual inspection and potential replacement; minimum clearances per design; access hatches/platforms if specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS81 — Long-term maintenance access is a durability requirement for 100-year service life.'
    },
    {
      description: 'Compile and submit complete bearing quality records package',
      acceptanceCriteria: 'Material certificates, test certificates, factory inspection, delivery inspection, installation survey, grouting records, load transfer verification, as-built; all accepted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS81 — Complete quality records for final acceptance. Records retained for design life.'
    }
  ]
}

// =============================================================================
// 6. PRECAST CONCRETE ELEMENTS (MRTS72)
// =============================================================================

const qldPrecastTemplate = {
  name: 'QLD Precast Concrete Elements (MRTS72)',
  description: 'TMR precast concrete manufacture, transport, and erection per MRTS72 (July 2019), MRTS70 Section 16, and MRTS74 (November 2023). Covers beams, panels, deck units, and segments.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS72 / MRTS70 Section 16 / MRTS74',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // FACTORY QUALIFICATION
    // =========================================================================
    {
      description: 'Verify precast manufacturer is on TMR Registered Precast Concrete Suppliers list',
      acceptanceCriteria: 'Manufacturer on current TMR list; registration valid; scope covers required element types',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS72 Clause 5 — Manufacturer must be registered with TMR.'
    },
    {
      description: 'Submit precast quality plan covering manufacture, curing, storage, transport, and erection',
      acceptanceCriteria: 'Plan addresses all MRTS72 requirements: mix design, formwork, reinforcement/prestressing, curing, dimensional control, handling, transport, erection; accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS72 Clause 5.2 — Accepted before manufacture commences.'
    },
    {
      description: 'Submit concrete mix design(s) for precast elements',
      acceptanceCriteria: 'Meets specified strength (typically >=50 MPa prestressed, >=40 MPa reinforced); durability class per exposure; trial mix results confirm compliance',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012 concrete testing',
      notes: 'MRTS72 / MRTS70 Clause 15.1 — Mix design approved before production. Trial mix per MRTS70 Section 16.1.1.'
    },
    // =========================================================================
    // FACTORY PRODUCTION
    // =========================================================================
    {
      description: 'Inspect formwork/moulds for dimensions, condition, and surface finish',
      acceptanceCriteria: 'Mould dimensions within +/-2mm; surfaces clean, smooth, undamaged; release agent applied; joints sealed; alignment jigs correct',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Dimensional check',
      notes: 'MRTS72 Clause 7 — Formwork per AS 3610. Check for wear in reusable moulds.'
    },
    {
      description: 'Inspect reinforcement/prestressing strand placement before concrete pour',
      acceptanceCriteria: 'Bar sizes, spacing, laps per design; cover >= specified minimum (typically >=40mm); strand profile correct; anchorages positioned',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS72 / MRTS70 Clause 11.3 — Hold Point. No concrete until reinforcement inspected and accepted. 3 days notice.'
    },
    {
      description: 'Accept quality benchmark sample for production run (first element)',
      acceptanceCriteria: 'Benchmark meets all dimensional, surface finish, and strength requirements; accepted as reference; preserved until production completion',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS72 Clause 8 — Hold Point 3. Accepted sample preserved as quality benchmark.'
    },
    // =========================================================================
    // CONCRETE PLACEMENT AND CURING
    // =========================================================================
    {
      description: 'Monitor concrete placement in moulds (slump, temperature, vibration, time)',
      acceptanceCriteria: 'Slump within +/-15mm; temperature 10-32 deg C; placed within 90 min of batching; full compaction without segregation; no cold joints',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.3.1 (slump) / AS 1012.8.4 (temperature)',
      notes: 'MRTS70 Clause 12 — Standard placement requirements apply to precast.'
    },
    {
      description: 'Cast concrete test specimens for strength verification',
      acceptanceCriteria: 'Min 1 set of 3 cylinders per 50 m3 or per pour (whichever more frequent); min 1 set per day per grade; per AS 1012.8.1',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.8.1 (Making) / AS 1012.9 (Strength)',
      notes: 'MRTS70 — Test frequency per normal or reduced rate.'
    },
    {
      description: 'Verify curing method and duration',
      acceptanceCriteria: 'Per approved quality plan (steam, water, or membrane); min 7 days equivalent moist cure; steam curing <= 70 deg C; rate of temp change <= 20 deg C/hour',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Temperature monitoring',
      notes: 'MRTS72 Clause 9 — Curing records maintained. Steam curing requires temperature monitoring.'
    },
    // =========================================================================
    // DEMOULDING AND PRESTRESS TRANSFER
    // =========================================================================
    {
      description: 'Verify concrete strength before formwork removal or lifting',
      acceptanceCriteria: 'Strength >= 60% of f\'c before removal/lifting; early strip to min 40% (not less than 16 MPa) only with Administrator permission',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (early age or maturity method)',
      notes: 'MRTS72 Clause 10 — Curing continues no later than 1 hour after formwork removal.'
    },
    {
      description: 'Verify concrete strength at prestress transfer (for prestressed elements)',
      acceptanceCriteria: 'Strength >= specified transfer strength (typically >= 0.75 f\'c or per drawings); no cracking or damage during transfer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength)',
      notes: 'MRTS72 / MRTS70 Clause 17.14 — Confirmed by cylinder tests. Record actual transfer strength and age.'
    },
    {
      description: 'Inspect element after demoulding for defects (surface, dimensions, cracking)',
      acceptanceCriteria: 'Surface finish meets class; no structural cracks; honeycombing: none >25mm depth or 150mm extent; dimensions per AS 3610 (+/-5mm length, +/-3mm width/depth); no reinforcement visible',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Dimensional check',
      notes: 'MRTS72 Clause 11 — Witness Point 1. Defective elements reported and disposition agreed.'
    },
    // =========================================================================
    // QUALITY TESTING & STORAGE
    // =========================================================================
    {
      description: 'Verify 28-day compressive strength results',
      acceptanceCriteria: 'No individual cylinder < 0.9 f\'c (TMR criteria); batch mean per MRTS70 statistical acceptance',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'MRTS70 Appendix A — TMR uses 0.9 f\'c rejection threshold.'
    },
    {
      description: 'Perform dimensional survey of completed elements',
      acceptanceCriteria: 'All dimensions within design tolerances; prestressed beam camber within range (+/-5mm or specified); bearing surfaces flat and level',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Dimensional survey',
      notes: 'MRTS72 — Dimensional records form part of quality documentation.'
    },
    {
      description: 'Perform cover meter survey on completed elements',
      acceptanceCriteria: 'Cover >= specified minimum at all measured points (min 5 per element); no areas with cover less than (specified - 5mm)',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Electromagnetic cover meter',
      notes: 'MRTS70 Clause 5.5 — 10% of elements as audit, more if issues detected.'
    },
    {
      description: 'Verify minimum strength/age before transport/erection',
      acceptanceCriteria: '28-day strength confirmed OR min 14 days age AND transfer strength met; all test results available and compliant',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9',
      notes: 'MRTS72 — Elements must achieve specified strength before transport loads applied.'
    },
    // =========================================================================
    // TRANSPORT & ERECTION
    // =========================================================================
    {
      description: 'Submit transport plan and verify transport method',
      acceptanceCriteria: 'Plan addresses orientation, support/tie-down locations, route assessment, protection of bearing surfaces/connections; accepted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS72 / MRTS74 — Transport stresses must not exceed element capacity.'
    },
    {
      description: 'Inspect elements on delivery for transport damage',
      acceptanceCriteria: 'No cracking, chipping, spalling; bearing surfaces undamaged; connection details intact; strand exposure within limits',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS72 — Damaged elements reported; repair per MRTS70.'
    },
    {
      description: 'Submit erection methodology and sequence for Administrator acceptance',
      acceptanceCriteria: 'Plan includes crane lifts, rigging, temporary bracing, placement sequence, joint grouting, safety; accepted by Administrator and engineer',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS74 Clause 7 — Must address stability at all stages. Temporary works by RPEQ.'
    },
    {
      description: 'Verify bearing surfaces/seats prepared and accepted before element placement',
      acceptanceCriteria: 'Surfaces level within +/-2mm; mortar pads/bearing strips positioned; headstock dimensions verified; min 15mm gap per MRTS74',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Level survey',
      notes: 'MRTS74 — 15mm minimum gap between headstock top and deck soffit per November 2023 amendment.'
    },
    {
      description: 'Place precast elements and verify alignment',
      acceptanceCriteria: 'Elements at correct location (+/-5mm horizontal, +/-3mm vertical); correct orientation; bearing contact verified; gaps within tolerance',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Alignment survey',
      notes: 'MRTS74 — Administrator to witness placement of major bridge elements.'
    },
    // =========================================================================
    // CONNECTIONS, GROUTING & STRESSING
    // =========================================================================
    {
      description: 'Inspect joint preparation between precast elements before grouting',
      acceptanceCriteria: 'Joint surfaces clean; shear keys properly formed; reinforcement across joints positioned; formwork/seals preventing grout loss installed',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS74 — Joint preparation critical for structural continuity.'
    },
    {
      description: 'Place grout in joints between precast elements',
      acceptanceCriteria: 'Proprietary cementitious grout per MRTS74; completely fills joint; no voids; strength >= specified; samples taken',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grout compressive strength test',
      notes: 'MRTS74 — Per November 2023 amendment. Grout achieves design strength before loading.'
    },
    {
      description: 'Perform transverse stressing and verify elongation (if specified)',
      acceptanceCriteria: 'Jacking force within +/-5% of design; elongation within +/-7% of theoretical; no strand slip; stressing records submitted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Elongation measurement',
      notes: 'MRTS74 / MRTS89 — Critical Activity. All elongation records submitted for acceptance.'
    },
    // =========================================================================
    // DOCUMENTATION AND ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile and submit complete precast quality records package',
      acceptanceCriteria: 'Factory registration, mix design, strength results, curing records, dimensional surveys, cover surveys, delivery inspections, erection records, grouting records, stressing records, as-built survey; all accepted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS72 — Complete quality records for final acceptance.'
    }
  ]
}

// =============================================================================
// 7. POST-TENSIONING (MRTS89)
// =============================================================================

const qldPostTensioningTemplate = {
  name: 'QLD Post-Tensioning (MRTS89)',
  description: 'TMR post-tensioning for bridges and slabs per MRTS89 (July 2017). Covers PT system approval, duct installation, stressing, grouting, and anchorage protection.',
  activityType: 'structural',
  specificationReference: 'TMR MRTS89 Post-Tensioned Concrete / AS/NZS 4672',
  stateSpec: 'MRTS',
  checklistItems: [
    // =========================================================================
    // SYSTEM APPROVAL AND MATERIALS
    // =========================================================================
    {
      description: 'Submit post-tensioning system details (anchorage, duct, strand, grout) for Administrator acceptance',
      acceptanceCriteria: 'PT system from TMR Approved Products list per TN25; anchorage system approved per TN25 Post Tensioning Anchorage Approval; documentation complete',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 Clause 5 — All PT systems approved per TMR Product Index and TN25.'
    },
    {
      description: 'Submit PT construction procedures including stressing sequence, elongation calculations, grouting procedure, and quality plan',
      acceptanceCriteria: 'Procedures cover installation, stressing sequence/forces, theoretical elongations, grouting methodology, quality hold/witness points; accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 Clause 5.2 — Detailed procedures accepted before any PT work commences.'
    },
    {
      description: 'Verify prestressing strand material compliance — mill certificates and check testing',
      acceptanceCriteria: 'Strand per AS/NZS 4672; mill certificates per coil; modulus of elasticity at stressing load confirmed; samples stored for potential check testing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS/NZS 4672 (prestressing steel testing)',
      notes: 'MRTS89 Clause 6 — Hold Point 2. Samples from each coil stored before use for potential check testing.'
    },
    {
      description: 'Verify anchorage components comply with approved system and are undamaged',
      acceptanceCriteria: 'Plates, wedges, grips, trumpets match approved system; undamaged; correct quantities; positioned within +/-6mm across/vertically, +/-15mm along tendon; face square within 0.5 deg',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 Clause 6 — Anchorages outside tolerance are non-conforming.'
    },
    {
      description: 'Verify grout material compliance and submit certificate of uniformity testing',
      acceptanceCriteria: 'Grout per approved specification; manufacturer QMS accredited; uniformity testing certificate for each batch; properties meet MRTS89',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'Grout testing per MRTS89',
      notes: 'MRTS89 Clause 11 — Each batch verified by uniformity testing certificate.'
    },
    // =========================================================================
    // DUCT INSTALLATION
    // =========================================================================
    {
      description: 'Inspect duct installation for profile, support spacing, and joint integrity before concrete placement',
      acceptanceCriteria: 'Duct profile within +/-5mm vertically and +/-10mm horizontally; support chairs at max 1m centres; joints sealed; vent/drain locations correct',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 Clause 7 — Duct profile critical for tendon force calculations. Part of pre-pour check per MRTS70.'
    },
    {
      description: 'Verify duct is free from damage, blockage, and contamination',
      acceptanceCriteria: 'No kinks, punctures, contamination; mandrel or ball passed through to confirm clear bore; inlet/outlet connections secure',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Mandrel/ball test',
      notes: 'MRTS89 — Blocked ducts prevent strand installation and grouting. Test all ducts before pour.'
    },
    {
      description: 'Verify anchorage positions are correct before concrete placement',
      acceptanceCriteria: 'Positioned within +/-6mm across/vertically, +/-15mm along tendon; face square within 0.5 deg; any outside tolerance is non-conforming',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: 'Dimensional check',
      notes: 'MRTS89 — Correction may require formwork/reinforcement adjustment.'
    },
    // =========================================================================
    // CONCRETE & STRAND INSTALLATION
    // =========================================================================
    {
      description: 'Verify concrete achieves specified transfer strength before stressing',
      acceptanceCriteria: 'Strength >= 0.85 f\'c (or specified transfer strength) confirmed by cylinder tests at location of stressing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AS 1012.9 (Compressive Strength)',
      notes: 'MRTS89 / MRTS70 Clause 17.14 — No stressing until transfer strength confirmed. Critical PT Activity.'
    },
    {
      description: 'Thread strands through ducts and verify number/configuration at each anchorage',
      acceptanceCriteria: 'Correct number per tendon per design; strands identified by coil for traceability; no damage during installation; not in duct >5 weeks before stressing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 Clause 8 — Unstressed tendons shall not lie in duct longer than 5 weeks. Prevents corrosion and relaxation.'
    },
    {
      description: 'Verify jack calibration certificate is current and system compatible',
      acceptanceCriteria: 'Jack calibrated within 6 months by NATA lab; certificate provided; capacity suitable for specified force; gauge readable to +/-1%',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 Clause 9 — Prerequisite for stressing. Recalibrate if damaged or repaired.'
    },
    // =========================================================================
    // STRESSING
    // =========================================================================
    {
      description: 'Perform stressing in approved sequence with Administrator notification',
      acceptanceCriteria: 'Sequence per approved procedure; Administrator notified 24 hours prior; records maintained in real time',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Elongation and force measurement',
      notes: 'MRTS89 Clause 9 — Critical PT Activity. Administrator must witness.'
    },
    {
      description: 'Verify jacking force for each tendon',
      acceptanceCriteria: 'Jacking force within +/-5% of design force; lock-off force accounts for seating loss per manufacturer data; measured by calibrated jack gauge',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Force measurement (calibrated jack)',
      notes: 'MRTS89 — Record actual force, gauge reading, and jack calibration reference for each tendon.'
    },
    {
      description: 'Verify elongation of each tendon against theoretical calculation',
      acceptanceCriteria: 'Measured elongation within +/-7% of calculated theoretical; if outside, hold stressing and investigate (friction, misalignment, slip, calculation error)',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Elongation measurement',
      notes: 'MRTS89 — Elongation is primary independent check on stressing force. Discrepancies >7% require investigation.'
    },
    {
      description: 'Check for strand slip at anchorage after lock-off',
      acceptanceCriteria: 'No visible slip; wedge seating within manufacturer range (typically 6-8mm); any slip > limit requires re-stressing',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Slip measurement',
      notes: 'MRTS89 — Record draw-in/slip for each tendon. Compare to expected seating loss.'
    },
    {
      description: 'Submit complete stressing records for Administrator acceptance',
      acceptanceCriteria: 'Records per tendon: ID, date/time, concrete strength, jack ID/calibration, force, elongation (theoretical and actual), slip, sequence confirmation; all within tolerance',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 — Stressing records accepted before grouting can commence. Permanent quality documents.'
    },
    // =========================================================================
    // DUCT AIR TESTING & GROUTING
    // =========================================================================
    {
      description: 'Perform air pressure test on all ducts before grouting',
      acceptanceCriteria: 'Each duct pressurised to specified pressure (typically 50 kPa) and held; pressure drop within limits; all water blown out with oil-free air before testing',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Air pressure test per MRTS89',
      notes: 'MRTS89 Clause 10 — Critical PT Activity. Failed ducts repaired and retested.'
    },
    {
      description: 'Verify all vent and drain tubes clear and accessible for grouting',
      acceptanceCriteria: 'All vents/drains unblocked; locations match grouting plan; caps/valves functional; high points have vents for air escape',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 — Blocked vents prevent complete duct filling.'
    },
    {
      description: 'Perform grout trial/qualification test before production grouting',
      acceptanceCriteria: 'Trial grout demonstrates fluidity, bleed <= 0.3% at 3 hours, volume change within limits, strength >= specified at 7 and 28 days; accepted',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grout fluidity (flow cone), bleed, strength per MRTS89',
      notes: 'MRTS89 Clause 11 — Grout trial before production grouting.'
    },
    {
      description: 'Perform production grouting of ducts per approved procedure',
      acceptanceCriteria: 'Approved sequence; pumped from low point; continuous until consistent grout from all vents; completed in one operation per duct; temperature 5-30 deg C',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grout fluidity test during grouting',
      notes: 'MRTS89 Clause 11 — Critical PT Activity. Administrator must witness. Record pressure, fluidity, duration.'
    },
    {
      description: 'Verify grout fills entire duct volume (no voids)',
      acceptanceCriteria: 'Grout from all vents consistent; vents capped under pressure in sequence; no air pockets (pressure drops); level maintained at high points',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 — 100% ducts must be fully filled. Subsequent NDE may be required if voids suspected.'
    },
    {
      description: 'Take grout samples during production grouting for strength verification',
      acceptanceCriteria: 'Min 1 set grout cubes per duct (or per session); strength >= specified minimum (typically >= 27 MPa at 28 days); results submitted',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Grout compressive strength per MRTS89',
      notes: 'MRTS89 — Samples from representative points during grouting.'
    },
    // =========================================================================
    // ANCHORAGE PROTECTION
    // =========================================================================
    {
      description: 'Cut and cap exposed strand tails at anchorages',
      acceptanceCriteria: 'Cut at specified distance from anchorage (typically 30-40mm beyond wedge); method does not damage adjacent strands; capped if specified',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 — Do not cut until grouting complete and verified. Cutting before grouting prevents re-stressing.'
    },
    {
      description: 'Apply permanent corrosion protection to anchorage zone',
      acceptanceCriteria: 'Mortar cap min 25mm cover over anchorage (or approved proprietary cap); bonds to surrounding concrete; no voids or gaps',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'inspection',
      testType: null,
      notes: 'MRTS89 Clause 12 — Final critical step. Anchorage corrosion is primary durability risk for PT structures.'
    },
    // =========================================================================
    // DOCUMENTATION AND ACCEPTANCE
    // =========================================================================
    {
      description: 'Compile and submit complete post-tensioning quality records package',
      acceptanceCriteria: 'System approval, material certificates, strand samples register, jack calibration, duct records, stressing records (force + elongation every tendon), air test results, grout trial, grouting records, grout strength, anchorage protection; all accepted',
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'document',
      testType: null,
      notes: 'MRTS89 — Permanent structural documents required for bridge maintenance and assessment throughout design life.'
    }
  ]
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedTemplate(templateData) {
  console.log(`  Seeding: ${templateData.name}...`)
  const existing = await prisma.iTPTemplate.findFirst({
    where: { name: templateData.name, stateSpec: 'MRTS', projectId: null }
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
  console.log(' QLD (TMR/MRTS) ITP Template Seeder - Structures')
  console.log('═══════════════════════════════════════════════════════════════\n')
  try {
    await seedTemplate(qldStructuralConcreteTemplate)
    await seedTemplate(qldPilingTemplate)
    await seedTemplate(qldReinforcementTemplate)
    await seedTemplate(qldSteelworkTemplate)
    await seedTemplate(qldBearingsTemplate)
    await seedTemplate(qldPrecastTemplate)
    await seedTemplate(qldPostTensioningTemplate)
    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (7 structures templates)')
    console.log('═══════════════════════════════════════════════════════════════')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
