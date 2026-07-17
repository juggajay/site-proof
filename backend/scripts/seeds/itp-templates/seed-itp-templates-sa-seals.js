/**
 * Seed Script: SA (DIT) ITP Templates - Sprayed Seals
 *
 * Creates global ITP templates for SA DIT sprayed bituminous surfacing, derived
 * from RD-BP-D2 "Design and Application of Sprayed Bituminous Surfacing"
 * (Document Version 1, 30/09/2024; K Net 13506215; formerly Part R26 / R26DA).
 * The one RD-BP-D2 spec governs primes, initial seals (formerly primer seals),
 * and secondary/final seals. Aggregate supply per RD-PV-S1; binder per RD-BP-S1.
 *
 * Templates:
 *   1. Sprayed Bituminous Surfacing (DIT RD-BP-D2) - activityType sprayed_seal
 *      (secondary/final seals, single/double seals, reseals)
 *   2. Prime and Initial Seal (DIT RD-BP-D2)        - activityType prime_primerseal
 *      (prime coats + initial seals - RD-BP-D2 calls a primerseal an "initial seal")
 *
 * All checklist content is derived directly from RD-BP-D2; clause references in
 * item text/notes cite the RD-BP-D2 section that supports the item.
 *
 * Note on the Table 20-1 / Cl 4.1d) inconsistency: RD-BP-D2 Table 20-1 labels the
 * Cl 4.1d) hold point "Geotextile test certificate", but the Cl 4.1d) body text is
 * about the aggregate/pavement-material NATA test certificate per RD-PV-S1. We follow
 * the body text (aggregate NATA cert) - see the Cl 4.1d) item note.
 *
 * Run with: pnpm seed:itp -- --script=seed-itp-templates-sa-seals.js --execute
 */

import { PrismaClient } from '@prisma/client';
import { withItpTemplateSeedLock } from './seed-lock.mjs';
const prisma = new PrismaClient()

// =============================================================================
// TEMPLATE 1: SPRAYED BITUMINOUS SURFACING (DIT RD-BP-D2)
// Secondary/final seals, single/double seals, reseals - the binder-application path.
// Relevant hold points: 4.1d) aggregate NATA cert, 4.4b) emulsion-for-all proposal,
// 10a) prior to binder application. Witness point: 18.2b) texture/retention testing.
// =============================================================================

const saSprayedSealTemplate = {
  name: 'Sprayed Bituminous Surfacing (DIT RD-BP-D2)',
  description: 'DIT sprayed bituminous surfacing - secondary/final seals, single and double/double seals, and reseals - per RD-BP-D2 (Design and Application of Sprayed Bituminous Surfacing, Version 1 30/09/2024; formerly Part R26/R26DA). The Contractor designs the seal (binder + aggregate rates per AGPT04K). Covers design and materials submissions, sprayer/aggregate calibration, binder-application hold point, aggregate spreading and rolling/embedment, loose-aggregate removal, and texture/aggregate-retention acceptance testing.',
  activityType: 'sprayed_seal',
  specificationReference: 'RD-BP-D2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // DESIGN & DOCUMENTATION SUBMISSIONS (RD-BP-D2 s2, s3)
    // =========================================================================
    {
      description: 'HOLD: Aggregate NATA test certificate submitted (conformance to RD-PV-S1), at least 5 business days before Sprayed Sealing Works (RD-BP-D2 Cl 4.1d))',
      acceptanceCriteria: 'Test certificate endorsed by a NATA accredited laboratory showing cover aggregate conforms with RD-PV-S1, submitted no less than 5 business days before the Sprayed Sealing Works; application of sprayed bitumen must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RD-PV-S1 aggregate conformance (NATA endorsed)',
      notes: 'RD-BP-D2 Cl 4.1d) HOLD, 5 business days notice. Note: Table RD-BP-D2 20-1 mislabels this "Geotextile test certificate" - the Cl 4.1d) body text is the aggregate/pavement-material NATA certificate per RD-PV-S1, which is followed here.'
    },
    {
      description: 'Seal design submitted per AGPT04K in Construction Documentation - binder + aggregate rates, cutter proportions, additives, rolling method (RD-BP-D2 s3)',
      acceptanceCriteria: 'Seal design per AGPT04K provided for contractual purposes: design input data (ALD, flakiness, pavement hardness, AADT/EHV traffic data with lane allocation and voids factors), aggregate source and spread rates, binder source and application rates, surface-regulation activities, and NATA lab details. Design is not a Principal endorsement (Cl 3.3d).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 3.1e, 3.3c/d. Contractor designs the seal unless the Principal nominates treatment type/aggregate size/binder in the Contract Documents.'
    },
    {
      description: 'HOLD (if proposing bitumen emulsion for all treatment types): emulsion proposal released before seal design commences (RD-BP-D2 Cl 4.4b))',
      acceptanceCriteria: 'Where the Contractor proposes to use bitumen emulsions for all treatment types, details of the proposal are submitted; the seal design required in section 3 must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 4.4b) HOLD, 5 business days notice. Conditional - applies only when emulsion is proposed for all treatment types.'
    },
    {
      description: 'Binder, flux and cutter conform to RD-BP-S1; cover aggregate conforms to RD-PV-S1; aggregate precoated at the specified rate (RD-BP-D2 s4, s12.2)',
      acceptanceCriteria: 'Binder/flux/cutter comply with RD-BP-S1 (Supply of Bituminous Material); aggregate complies with RD-PV-S1; precoat applied as a uniform coat (plant or field) at the Cl 3.4 rate for the aggregate size (5mm 7-9 L/m3; 7mm 5-8; 10mm 5-8; 14mm 5-7; 16mm 4-6, increased for porous aggregate).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 s4, Cl 3.4, s12.2. Precoat rate increased for porous aggregate.'
    },
    {
      description: 'Bitumen sprayer calibration certificate and bitumen certificate on file (RD-BP-D2 s8)',
      acceptanceCriteria: 'Sprayer certified to AGPT-T530/T531 plus one of AGPT-T532/T533/T534, plus AGPT-T535 and AGPT-T536; sprayer calibration certificate and bitumen certificate included in the Construction Documentation.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AGPT-T530/T531 + T532/T533/T534 + T535 + T536',
      notes: 'RD-BP-D2 Cl 8e, 2.1k-iii. Hand spraying only where mechanical spraying is impracticable.'
    },

    // =========================================================================
    // SURFACE PREPARATION (RD-BP-D2 s6, s7)
    // =========================================================================
    {
      description: 'Road fixtures protected and pavement cleaned free of loose material, at least 250 mm beyond the spray area; raised pavement markers removed (RD-BP-D2 s6, s7)',
      acceptanceCriteria: 'Gratings, hydrants, valve boxes and kerbs masked and any damage recorded on the daily sheet; pavement free of loose material and cleaned at least 250 mm beyond the spray area; raised pavement markers removed. No steel brooms used on an unsealed base.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 s6 (protection of road fixtures), s7 (cleaning of pavement).'
    },

    // =========================================================================
    // BINDER APPLICATION HOLD (RD-BP-D2 s10)
    // =========================================================================
    {
      description: 'HOLD: pavement surface verified suitable and Contractor properly prepared prior to binder application - 24 hours notice (RD-BP-D2 Cl 10a))',
      acceptanceCriteria: 'Prior to application of binder, verification that the pavement surface is suitable for the binder and the Contractor is properly prepared; binder must not be applied until this Hold Point has been released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 10a) HOLD, 24 hours notice.'
    },
    {
      description: 'Application temperatures within Table 10-1; air temperature measured by thermocouple 1 m above the pavement, shaded and not wind-protected (RD-BP-D2 s10)',
      acceptanceCriteria: 'Binder application/reheat temperatures within RD-BP-D2 Table 10-1; air temperature measured by thermocouple 1 m above the pavement (shaded, not wind-protected) during spraying.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RD-BP-D2 Table 10-1',
      notes: 'RD-BP-D2 s10. Air temperature measurement method per s10.'
    },
    {
      description: 'Weather within Table 10-2 limits; adhesion agent no more than 1% by mass of binder (RD-BP-D2 s10)',
      acceptanceCriteria: 'Weather within RD-BP-D2 Table 10-2 limits; where used, adhesion agent does not exceed 1% by mass of the binder (Cl 10d).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RD-BP-D2 Table 10-2',
      notes: 'RD-BP-D2 s10, Cl 10d. Weather risk-rating limits ("low" or less) apply specifically to priming/initial sealing - see the Prime and Initial Seal template.'
    },
    {
      description: 'Binder applied within +/-20% (short bar / hand spray) of the design rate; longitudinal line within 50 mm (straight) / 100 mm (curves) (RD-BP-D2 s17)',
      acceptanceCriteria: 'Primer/primer binder/binder/overspray applied within +/-20% for short bar runs and hand spray work; longitudinal joint line within 50 mm on straight runs and 100 mm on curves. Binder rate variation deductions per Cl 18.1 / Table 18-1 (>+5% no payment for additional binder; 0 to +5% paid; <0% proportionate deduction).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Binder application rate (daily record sheet)',
      notes: 'RD-BP-D2 s17, Cl 18.1 / Table 18-1.'
    },

    // =========================================================================
    // AGGREGATE SPREADING, ROLLING & LOOSE-AGGREGATE REMOVAL (RD-BP-D2 s12, s13)
    // =========================================================================
    {
      description: 'Cover aggregate spread as a single uniform layer within +/-5% of the target spread rate (RD-BP-D2 Cl 12.3a, s17)',
      acceptanceCriteria: 'Aggregate spread in a single uniform layer at the target spread rate, within +/-5% (s17).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Aggregate spread rate (daily record sheet)',
      notes: 'RD-BP-D2 Cl 12.3a, s17.'
    },
    {
      description: 'Rolling commenced immediately after spreading starts, full pavement width incl. untrafficked areas, using rubber-tyred or rubber-coated drum rollers only (RD-BP-D2 Cl 12.3b)',
      acceptanceCriteria: 'Rolling commences immediately after aggregate spreading starts, covers the full pavement width including untrafficked areas, and uses rubber-tyred or rubber-coated drum rollers only.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 Cl 12.3b.'
    },
    {
      description: 'Loose aggregate removed commencing within 12 h of completing rolling; loose count within Table 13-1 (7 mm max 60/m2; 10 mm and larger max 40/m2) (RD-BP-D2 s13)',
      acceptanceCriteria: 'Removal of loose aggregate commences within 12 hours of completing rolling (all seals incl. first coat of a double), removing only loose aggregate without disturbing embedded aggregate; loose-aggregate count within Table 13-1 (7 mm max 60/m2; 10 mm and larger max 40/m2). Exceedance: warning signs within 12 h, sweep within 48 h.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Loose aggregate count (RD-BP-D2 Table 13-1)',
      notes: 'RD-BP-D2 s13, Table 13-1.'
    },
    {
      description: 'For double/double seals: both courses laid the same day, top course overlapping the bottom by 50 mm (RD-BP-D2 Table 5-1)',
      acceptanceCriteria: 'Where a double/double seal is specified, both courses are laid on the same day and the top course overlaps the bottom course by 50 mm.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 Table 5-1. Conditional - double/double seals only.'
    },

    // =========================================================================
    // RECORDS & ACCEPTANCE TESTING (RD-BP-D2 s16, s18)
    // =========================================================================
    {
      description: 'Daily record sheet (Appendix 3) completed after each run; completion report of surface condition and defects submitted (RD-BP-D2 s16)',
      acceptanceCriteria: 'Daily record sheet (RD-BP-D2 Appendix 3) completed after each run; completion report documenting surface condition and any defects submitted.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 s16.'
    },
    {
      description: 'WITNESS: texture (AGPT-T250) and aggregate retention (AGPT-T254) testing - 48 hours notice (RD-BP-D2 Cl 18.2b))',
      acceptanceCriteria: 'Texture depth (AGPT-T250) and aggregate retention/stripping (AGPT-T254) tested per Table 18-2 frequency (3 tests/Work Lot for 100-500 m2; 5 tests/Work Lot for 501-1000 m2; across the wheel paths / lane where loss is most severe). Contractor provides 48 hours notice of testing, which constitutes a Witness Point. Final texture/retention tested within 1 month before the end of the Defects Liability Period.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AGPT-T250 (texture) / AGPT-T254 (aggregate retention)',
      notes: 'RD-BP-D2 Cl 18.2b) WITNESS, 48 hours notice. Work Lot: individual lanes, visually uniform, 100 m min - 1 km max.'
    },
    {
      description: 'Texture within Table 18-3 bands and aggregate retention within Table 18-4 (degree 0-2 accept); Sealing Defects raised as NCR and rectified (RD-BP-D2 s18)',
      acceptanceCriteria: 'Surface texture within the treatment-specific Table 18-3 acceptance band (e.g. 5 mm seal 1.0-1.6 mm; 7 mm 1.2-1.8 mm; 14/16 mm 1.8-4.5 mm) - outside inner band, rectify or 10% payment reduction. Aggregate retention Table 18-4: degree 0-2 accept; 3-5 retest before end of DLP (NCR if worsened); >5 raise NCR and rectify within 5 days.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AGPT-T250 (Table 18-3) / AGPT-T254 (Table 18-4)',
      notes: 'RD-BP-D2 s18.3 (Table 18-3), s18.4 (Table 18-4). Texture sections <1 m2 excluded unless accumulated out-of-range >5 m2/Work Lot; retention sections <0.5 m2 excluded unless accumulated >3 m2/Work Lot.'
    },
    {
      description: 'Seal condition report submitted 20 days before the end of the Defects Liability Period (RD-BP-D2 Cl 16c, 18.5c)',
      acceptanceCriteria: 'Completion report and seal condition report submitted 20 days before the end of the Defects Liability Period; final texture and aggregate retention within 1 month before the end of the DLP.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 16c, 18.5c, 18.3d.'
    }
  ]
}

// =============================================================================
// TEMPLATE 2: PRIME AND INITIAL SEAL (DIT RD-BP-D2)
// Prime coats and initial seals (RD-BP-D2 term for primerseal) - the prime/
// initial-seal path. Relevant hold points: 4.1d) aggregate NATA cert (initial
// seal has aggregate), 4.4b) emulsion-for-all proposal, 9a) surface verification
// prior to prime/initial seal, 10a) prior to binder application (initial seal).
// Witness point: 18.2b) texture/retention testing.
// =============================================================================

const saPrimeInitialSealTemplate = {
  name: 'Prime and Initial Seal (DIT RD-BP-D2)',
  description: 'DIT prime coats and initial seals per RD-BP-D2 (Design and Application of Sprayed Bituminous Surfacing, Version 1 30/09/2024; formerly Part R26/R26DA). RD-BP-D2 uses the term "initial seal" for what was previously called a primer seal. A prime penetrates and bonds the pavement surface; an initial seal waterproofs and holds cover aggregate. Covers seal design, the surface-verification hold point prior to prime/initial seal, prime/initial-seal binder application, curing before the secondary seal, and texture/aggregate-retention acceptance testing.',
  activityType: 'prime_primerseal',
  specificationReference: 'RD-BP-D2',
  stateSpec: 'DIT',
  checklistItems: [
    // =========================================================================
    // DESIGN & DOCUMENTATION SUBMISSIONS (RD-BP-D2 s2, s3)
    // =========================================================================
    {
      description: 'HOLD (initial seal): aggregate NATA test certificate submitted (conformance to RD-PV-S1), at least 5 business days before Sprayed Sealing Works (RD-BP-D2 Cl 4.1d))',
      acceptanceCriteria: 'For initial seals (which carry cover aggregate): test certificate endorsed by a NATA accredited laboratory showing aggregate conforms with RD-PV-S1, submitted no less than 5 business days before the Sprayed Sealing Works; application of sprayed bitumen must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RD-PV-S1 aggregate conformance (NATA endorsed)',
      notes: 'RD-BP-D2 Cl 4.1d) HOLD, 5 business days notice. Note: Table RD-BP-D2 20-1 mislabels this "Geotextile test certificate" - the Cl 4.1d) body text is the aggregate/pavement-material NATA certificate per RD-PV-S1, which is followed here. Applies to the initial-seal aggregate; a prime coat alone carries no aggregate.'
    },
    {
      description: 'Seal design submitted per AGPT04K in Construction Documentation, incl. cutter proportions and additives (RD-BP-D2 s3)',
      acceptanceCriteria: 'Seal design per AGPT04K provided in the Construction Documentation: prime/initial-seal binder source and application rates, cutter proportions and additives, aggregate source and spread rates (initial seal), and NATA lab details. Design is provided for contractual purposes only and is not a Principal endorsement (Cl 3.3d).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 3.1e, 3.3c/d.'
    },
    {
      description: 'HOLD (if proposing bitumen emulsion for all treatment types): emulsion proposal released before seal design commences (RD-BP-D2 Cl 4.4b))',
      acceptanceCriteria: 'Where the Contractor proposes to use bitumen emulsions for all treatment types, details of the proposal are submitted; the seal design required in section 3 must not commence until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 4.4b) HOLD, 5 business days notice. Conditional - applies only when emulsion is proposed for all treatment types.'
    },
    {
      description: 'Binder, flux and cutter conform to RD-BP-S1; initial-seal aggregate conforms to RD-PV-S1 and is precoated at the specified rate (RD-BP-D2 s4, s12.2)',
      acceptanceCriteria: 'Prime/initial-seal binder, flux and cutter comply with RD-BP-S1; initial-seal cover aggregate complies with RD-PV-S1 and is precoated as a uniform coat at the Cl 3.4 rate for the aggregate size (increased for porous aggregate).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 s4, Cl 3.4, s12.2.'
    },
    {
      description: 'Bitumen sprayer calibration certificate and bitumen certificate on file (RD-BP-D2 s8)',
      acceptanceCriteria: 'Sprayer certified to AGPT-T530/T531 plus one of AGPT-T532/T533/T534, plus AGPT-T535 and AGPT-T536; sprayer calibration certificate and bitumen certificate included in the Construction Documentation.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'AGPT-T530/T531 + T532/T533/T534 + T535 + T536',
      notes: 'RD-BP-D2 Cl 8e, 2.1k-iii. Hand spraying only where mechanical spraying is impracticable.'
    },

    // =========================================================================
    // SURFACE PREPARATION & VERIFICATION HOLD (RD-BP-D2 s6, s7, s9)
    // =========================================================================
    {
      description: 'Road fixtures protected and pavement cleaned free of loose material, at least 250 mm beyond the spray area; no steel brooms on an unsealed base (RD-BP-D2 s6, s7)',
      acceptanceCriteria: 'Road fixtures masked and any damage recorded; pavement cleaned free of loose material at least 250 mm beyond the spray area so the primer will be absorbed or the binder will adhere. No steel brooms used on an unsealed base.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: null,
      notes: 'RD-BP-D2 s6, s7.'
    },
    {
      description: 'HOLD: surface treatment verification records completed prior to application of prime or initial seal - 24 hours notice (RD-BP-D2 Cl 9a))',
      acceptanceCriteria: 'Prior to applying prime or initial seal, verification records confirm (i) the surface meets the preparation requirements of the relevant pavement/asphalt/concrete specification, (ii) marked guidelines are set out correctly, and (iii) the Contractor is properly prepared; the prime or initial seal must not be applied until this Hold Point is released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 9a) HOLD, 24 hours notice.'
    },
    {
      description: 'Priming/initial sealing undertaken only when the prevailing weather risk rating is "low" or less (AAPA HSE Guide 8); application temperatures within Table 10-1 (RD-BP-D2 s10)',
      acceptanceCriteria: 'Priming and initial sealing carried out only when the prevailing weather has a risk rating of "low" or less per AAPA HSE Guide 8 (Table 10-2); no rain during or pending; binder application temperatures within Table 10-1; air temperature measured by thermocouple 1 m above the pavement (shaded).',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: 'RD-BP-D2 Table 10-1 / Table 10-2',
      notes: 'RD-BP-D2 s10, Table 10-2. The "low" weather-risk limit is specific to priming and initial sealing.'
    },

    // =========================================================================
    // BINDER APPLICATION HOLD (initial seal) (RD-BP-D2 s10)
    // =========================================================================
    {
      description: 'HOLD: pavement surface verified suitable and Contractor properly prepared prior to binder application (initial seal) - 24 hours notice (RD-BP-D2 Cl 10a))',
      acceptanceCriteria: 'Prior to applying the initial-seal binder, verification that the pavement surface is suitable for the binder and the Contractor is properly prepared; binder must not be applied until this Hold Point has been released.',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 10a) HOLD, 24 hours notice. Applies to the initial-seal binder application.'
    },
    {
      description: 'Prime/initial-seal binder applied within +/-20% (short bar / hand spray) of design; adhesion agent no more than 1% by mass of binder; longitudinal line within 50 mm straight / 100 mm curve (RD-BP-D2 s10, s17)',
      acceptanceCriteria: 'Primer/primer binder/binder applied within +/-20% for short bar runs and hand spray work; adhesion agent (where used) no more than 1% by mass of binder (Cl 10d); longitudinal line within 50 mm on straight runs and 100 mm on curves.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Binder application rate (daily record sheet)',
      notes: 'RD-BP-D2 s17, Cl 10d.'
    },

    // =========================================================================
    // INITIAL-SEAL AGGREGATE, ROLLING & LOOSE-AGGREGATE REMOVAL (s12, s13)
    // =========================================================================
    {
      description: 'Initial-seal cover aggregate spread as a single uniform layer within +/-5% of target; rolling commenced immediately, full width, rubber-tyred/rubber-coated drum rollers only (RD-BP-D2 Cl 12.3a/b, s17)',
      acceptanceCriteria: 'Cover aggregate spread in a single uniform layer within +/-5% of target (s17); rolling commences immediately after spreading starts, covers the full pavement width including untrafficked areas, using rubber-tyred or rubber-coated drum rollers only.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'photo',
      testType: 'Aggregate spread rate (daily record sheet)',
      notes: 'RD-BP-D2 Cl 12.3a/b, s17. Initial seals only - a prime coat carries no aggregate.'
    },
    {
      description: 'Loose aggregate removed commencing within 12 h of completing rolling; loose count within Table 13-1 (7 mm max 60/m2; 10 mm and larger max 40/m2) (RD-BP-D2 s13)',
      acceptanceCriteria: 'Removal of loose aggregate commences within 12 hours of completing rolling, removing only loose aggregate without disturbing embedded aggregate; loose count within Table 13-1 (7 mm max 60/m2; 10 mm and larger max 40/m2). Exceedance: warning signs within 12 h, sweep within 48 h.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'Loose aggregate count (RD-BP-D2 Table 13-1)',
      notes: 'RD-BP-D2 s13, Table 13-1. Initial seals only.'
    },

    // =========================================================================
    // CURING & EARLY-TRAFFIC CONTROL (RD-BP-D2 Cl 4.3, Table 5-1)
    // =========================================================================
    {
      description: 'Prime: no traffic within 24 h or until dried; binder over cutback prime not within 72 h, over emulsion prime not within 12 h (RD-BP-D2 Table 5-1)',
      acceptanceCriteria: 'After priming, no traffic within 24 hours or until the prime has dried; a subsequent binder is not applied over a cutback prime within 72 hours, nor over an emulsion prime within 12 hours.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 4.3b, Table 5-1. Prime coats only.'
    },
    {
      description: 'Cutback initial seal cured before the secondary treatment: min 6 months warm/hot (12 cold), reduce to 3 months for low-cutter binders (e.g. AMC7); emulsion initial seal min 3 months warm/hot (6 cold), reduce to 24 h if overlaid with asphalt (RD-BP-D2 Cl 4.3c)',
      acceptanceCriteria: 'Cutback initial seal receives its secondary treatment only after curing a minimum of 6 months in warm/hot conditions (12 in cold), reduced to 3 months for low-cutter binders such as AMC7. Emulsion initial seal cures a minimum of 3 months warm/hot (6 in cold), reduced to 24 hours if it is to be overlaid with asphalt.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 Cl 4.3c. Initial seals only.'
    },

    // =========================================================================
    // RECORDS & ACCEPTANCE TESTING (RD-BP-D2 s16, s18)
    // =========================================================================
    {
      description: 'Daily record sheet (Appendix 3) completed after each run; completion report of surface condition and defects submitted (RD-BP-D2 s16)',
      acceptanceCriteria: 'Daily record sheet (RD-BP-D2 Appendix 3) completed after each run; completion report documenting surface condition and any defects submitted.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'document',
      testType: null,
      notes: 'RD-BP-D2 s16.'
    },
    {
      description: 'WITNESS: texture (AGPT-T250) and aggregate retention (AGPT-T254) testing of the initial seal at 10-15 weeks - 48 hours notice (RD-BP-D2 Cl 18.2b))',
      acceptanceCriteria: 'For initial seals, texture depth (AGPT-T250) and aggregate retention (AGPT-T254) tested at 10-15 weeks after placement, per Table 18-2 frequency and across the lane where loss is most severe. Contractor provides 48 hours notice of testing, which constitutes a Witness Point.',
      pointType: 'witness',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AGPT-T250 (texture) / AGPT-T254 (aggregate retention)',
      notes: 'RD-BP-D2 Cl 18.2b) WITNESS, 48 hours notice. Initial texture measured 10-15 weeks after placement.'
    },
    {
      description: 'Initial-seal texture within the Table 18-3 initial-seal bands and aggregate retention within Table 18-4 (degree 0-2 accept); Sealing Defects raised as NCR and rectified (RD-BP-D2 s18)',
      acceptanceCriteria: 'Initial-seal texture within the treatment-specific Table 18-3 initial-seal band (e.g. 7 mm 1.0-2.0 mm; 10 mm 1.2-3.0 mm); aggregate retention Table 18-4: degree 0-2 accept; 3-5 retest before end of DLP (NCR if worsened); >5 raise NCR and rectify within 5 days.',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'AGPT-T250 (Table 18-3) / AGPT-T254 (Table 18-4)',
      notes: 'RD-BP-D2 s18.3 (Table 18-3, initial-seal bands), s18.4 (Table 18-4).'
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
    include: {
      checklistItems: true
    }
  })

  // Print summary with hold/witness/standard counts
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
  console.log(' SA (DIT) ITP Template Seeder - Sprayed Seals (RD-BP-D2)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  try {
    await seedTemplate(saSprayedSealTemplate)
    await seedTemplate(saPrimeInitialSealTemplate)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log(' Seeding Complete! (2 sprayed-seal templates)')
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
