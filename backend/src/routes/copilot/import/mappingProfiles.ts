/**
 * Wave B B1 — column/field mapping.
 *
 * `ImportMappingProfile.fieldMap` is TENANT-WRITABLE JSON that outlives the
 * validation that admitted it. Every `target` and `transform` is therefore
 * re-validated against the fixed allow-lists in this module at APPLY time, not
 * only when the profile is saved (spec §4.3, §9-D9) — validating only on save is
 * a time-of-check/time-of-use gap.
 */
import { z } from 'zod';

import { AppError } from '../../../lib/AppError.js';

/** Every field an ITP import is allowed to write. Anything else is refused. */
export const ITP_IMPORT_TARGETS = [
  'templateName',
  'templateDescription',
  'activityType',
  'stateSpec',
  'specificationReference',
  'description',
  'acceptanceCriteria',
  'pointType',
  'responsibleParty',
  'evidenceRequired',
  'testType',
] as const;
export type ItpImportTarget = (typeof ITP_IMPORT_TARGETS)[number];

const ITP_IMPORT_TARGET_SET = new Set<string>(ITP_IMPORT_TARGETS);

/**
 * Every field a lot-register import is allowed to write. Deliberately a subset
 * of what a lot HAS: status, budget, subcontractor and geometry are not things a
 * migrated register gets to set — a lot is born fresh and those are decided in
 * SiteProof.
 */
export const LOT_IMPORT_TARGETS = [
  'lotNumber',
  'description',
  'activityType',
  'chainageStart',
  'chainageEnd',
  'layer',
  'testScale',
  'materialType',
  'quantityValue',
  'quantityUnit',
  /** Names an ITP already in this project; matched by name, never created. */
  'itpTemplateName',
] as const;
export type LotImportTarget = (typeof LOT_IMPORT_TARGETS)[number];

const LOT_IMPORT_TARGET_SET = new Set<string>(LOT_IMPORT_TARGETS);

const TARGETS_BY_KIND: Record<string, ReadonlySet<string>> = {
  itp_template: ITP_IMPORT_TARGET_SET,
  lot_register: LOT_IMPORT_TARGET_SET,
};

/** Every value transform a profile may name. */
export const IMPORT_TRANSFORMS = [
  'none',
  'whs_to_point_type',
  'responsible_party',
  'evidence_required',
] as const;
export type ImportTransform = (typeof IMPORT_TRANSFORMS)[number];

const IMPORT_TRANSFORM_SET = new Set<string>(IMPORT_TRANSFORMS);

export const fieldMapEntrySchema = z.object({
  target: z.string().trim().min(1).max(60),
  source: z.object({ header: z.string().trim().min(1).max(200) }),
  transform: z.string().trim().min(1).max(60).optional(),
});

export const fieldMapSchema = z.array(fieldMapEntrySchema).min(1).max(60);

export type FieldMapEntry = z.infer<typeof fieldMapEntrySchema>;

/**
 * The gate. Parses unknown JSON into a field map and refuses any target or
 * transform outside the allow-list, plus duplicate targets (which would make the
 * winning column arbitrary). Called on save AND immediately before every write.
 */
export function assertAllowedFieldMap(value: unknown, kind: string): FieldMapEntry[] {
  const allowed = TARGETS_BY_KIND[kind];
  if (!allowed) {
    throw AppError.badRequest(`Imports of kind "${kind}" are not supported yet.`, {
      code: 'IMPORT_KIND_UNSUPPORTED',
    });
  }

  const parsed = fieldMapSchema.safeParse(value);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }

  const seen = new Set<string>();
  for (const entry of parsed.data) {
    if (!allowed.has(entry.target)) {
      throw AppError.badRequest(`"${entry.target}" is not a field this import can write.`, {
        code: 'IMPORT_TARGET_NOT_ALLOWED',
      });
    }
    if (entry.transform && !IMPORT_TRANSFORM_SET.has(entry.transform)) {
      throw AppError.badRequest(`"${entry.transform}" is not a supported transform.`, {
        code: 'IMPORT_TRANSFORM_NOT_ALLOWED',
      });
    }
    if (seen.has(entry.target)) {
      throw AppError.badRequest(`Two columns are both mapped to "${entry.target}".`, {
        code: 'IMPORT_TARGET_DUPLICATED',
      });
    }
    seen.add(entry.target);
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Header aliasing
// ---------------------------------------------------------------------------

/** "Inspection / Test Activity" -> "inspectiontestactivity" */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Header aliases per target, most-specific first. The lot-register equivalent is
// LOT_HEADER_ALIASES below.
const ITP_HEADER_ALIASES: Record<ItpImportTarget, string[]> = {
  templateName: ['itp', 'itpname', 'itptitle', 'templatename', 'inspectiontestplan', 'planname'],
  templateDescription: ['itpdescription', 'templatedescription', 'scope'],
  activityType: [
    'activity',
    'activitytype',
    'workactivity',
    'activityprocess',
    'process',
    'lottype',
  ],
  stateSpec: ['specset', 'specificationset', 'statespec', 'authority', 'standard'],
  specificationReference: [
    'specification',
    'specificationreference',
    'specref',
    'clause',
    'specclause',
    'referencedocument',
    'reference',
  ],
  description: [
    'inspectiontestactivity',
    'inspectiontestdetail',
    'inspectiontest',
    'checklistitem',
    'activitydescription',
    'description',
    'task',
    'item',
    'inspectionitem',
  ],
  acceptanceCriteria: [
    'acceptancecriteria',
    'acceptancecriteriastandard',
    'acceptance',
    'criteria',
    'requirement',
    'tolerance',
  ],
  pointType: [
    'whs',
    'wh',
    // CivilPro: the grid column is "HpWpC", the CSV column is "Check Type" and
    // the KB spells the same field out in full.
    'hpwpc',
    'checktype',
    'holdpointandwitnesspointcheck',
    'hwspoint',
    'pointtype',
    'inspectiontype',
    'insptype',
    'holdwitness',
    'holdwitnesssurveillance',
    'type',
  ],
  responsibleParty: ['responsible', 'responsibleparty', 'responsibility', 'by', 'verifiedby'],
  evidenceRequired: ['evidence', 'evidencerequired', 'record', 'records', 'recordrequired'],
  testType: [
    'testtype',
    'testmethod',
    // CivilPro: "Insp Meth" in the grid, "Inspection Method" in the CSV.
    'inspectionmethod',
    'methodofinspection',
    'methofinspection',
    'inspmeth',
    'test',
    'testreference',
    'testfrequency',
  ],
};

// The lot-register alias table, harvested from the `getFieldValue` alias list in
// the client-side CSV importer this stage retires — that list is the one part of
// it worth keeping (spec §2.5, §4.3). The
// rest of its behaviour is deliberately NOT kept: it defaulted an unmappable
// activity to `earthworks_general` behind a non-blocking warning, and B2 blocks
// it instead (§4.10d).
const LOT_HEADER_ALIASES: Record<LotImportTarget, string[]> = {
  lotNumber: ['lotnumber', 'lotno', 'lotid', 'lotref', 'lot'],
  description: ['description', 'desc', 'lotdescription', 'scope', 'location'],
  activityType: ['activitytype', 'activity', 'worktype', 'lottype', 'type'],
  chainageStart: ['chainagestart', 'startchainage', 'chstart', 'fromchainage', 'from', 'start'],
  chainageEnd: ['chainageend', 'endchainage', 'chend', 'tochainage', 'to', 'end'],
  layer: ['layer', 'lift', 'course', 'level'],
  testScale: ['testscale', 'scale', 'testingscale', 'lotsize'],
  materialType: ['materialtype', 'material'],
  quantityValue: ['quantity', 'qty', 'quantityvalue', 'amount'],
  quantityUnit: ['quantityunit', 'unit', 'uom', 'units'],
  itpTemplateName: ['itp', 'itpname', 'itpref', 'inspectiontestplan', 'template'],
};

interface KindMapping {
  targets: readonly string[];
  aliases: Record<string, string[]>;
  transforms: Record<string, ImportTransform>;
}

const KIND_MAPPINGS: Record<string, KindMapping> = {
  itp_template: {
    targets: ITP_IMPORT_TARGETS,
    aliases: ITP_HEADER_ALIASES,
    transforms: {
      pointType: 'whs_to_point_type',
      responsibleParty: 'responsible_party',
      evidenceRequired: 'evidence_required',
    },
  },
  // Lot values are parsed by the lot dry run itself (numbers, vocabularies), so
  // no profile-level transform is needed and none is offered.
  lot_register: { targets: LOT_IMPORT_TARGETS, aliases: LOT_HEADER_ALIASES, transforms: {} },
};

function kindMapping(kind: string): KindMapping {
  const mapping = KIND_MAPPINGS[kind];
  if (!mapping) {
    throw AppError.badRequest(`Imports of kind "${kind}" are not supported yet.`, {
      code: 'IMPORT_KIND_UNSUPPORTED',
    });
  }
  return mapping;
}

/**
 * Best-effort field map from a sheet's headers alone — the "unknown layout"
 * starting point the reviewer then corrects in the mapping UI.
 */
export function deriveFieldMapFromHeaders(headers: string[], kind: string): FieldMapEntry[] {
  const { targets, aliases, transforms } = kindMapping(kind);
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const entries: FieldMapEntry[] = [];

  for (const target of targets) {
    for (const alias of aliases[target] ?? []) {
      const index = normalized.findIndex((value, i) => value === alias && !used.has(i));
      if (index >= 0) {
        used.add(index);
        const transform = transforms[target];
        entries.push({
          target,
          source: { header: headers[index] },
          ...(transform ? { transform } : {}),
        });
        break;
      }
    }
  }

  return entries;
}

/**
 * A suggested profile's field map, filled out with alias-derived entries for
 * any target the profile leaves unresolved against these headers. Profile
 * entries whose source header is absent are dropped rather than shown as dead
 * mappings; alias fills never reuse a header a kept profile entry claimed.
 */
export function mergeFieldMapWithAliases(
  fieldMap: FieldMapEntry[],
  headers: string[],
  kind: string,
): FieldMapEntry[] {
  const present = new Set(headers.map(normalizeHeader));
  const kept = fieldMap.filter((entry) => present.has(normalizeHeader(entry.source.header)));
  const coveredTargets = new Set(kept.map((entry) => entry.target));
  const claimedHeaders = new Set(kept.map((entry) => normalizeHeader(entry.source.header)));
  const fills = deriveFieldMapFromHeaders(headers, kind).filter(
    (entry) =>
      !coveredTargets.has(entry.target) &&
      !claimedHeaders.has(normalizeHeader(entry.source.header)),
  );
  return [...kept, ...fills];
}

/** How well a field map fits a sheet: the share of its columns that resolve. */
export function scoreFieldMapAgainstHeaders(fieldMap: FieldMapEntry[], headers: string[]): number {
  if (fieldMap.length === 0) return 0;
  const normalized = new Set(headers.map(normalizeHeader));
  const hits = fieldMap.filter((entry) => normalized.has(normalizeHeader(entry.source.header)));
  return hits.length / fieldMap.length;
}

/** target -> column index for a given sheet; unresolved targets are absent. */
export function resolveColumnIndexes<T extends string = ItpImportTarget>(
  fieldMap: FieldMapEntry[],
  headers: string[],
): Map<T, number> {
  const normalized = headers.map(normalizeHeader);
  const indexes = new Map<T, number>();
  for (const entry of fieldMap) {
    const index = normalized.indexOf(normalizeHeader(entry.source.header));
    if (index >= 0) indexes.set(entry.target as T, index);
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

// The vocabularies the ITP seeders and hold-point gating already use:
// pointType hold_point|witness|standard, responsibleParty contractor|
// superintendent, evidenceRequired document|inspection|photo|signature|test.
//
// Each table is ordered: the FIRST rule whose pattern matches wins, and an
// unmatched value yields '' so the database default applies rather than a guess
// being written as fact.
type VocabularyRule = [pattern: RegExp, value: string];

const POINT_TYPE_RULES: VocabularyRule[] = [
  [/^h|hold/, 'hold_point'],
  [/^w|witness/, 'witness'],
  [/^s|surveill|standard/, 'standard'],
  // CivilPro's controlled vocabulary is Check Item / Witness Point / Hold Point
  // / Milestone. LAST on purpose: "Check Item" must not shadow "Hold Point" (a
  // hold point that imported as a plain check is a gate that never gets held).
  // Milestone is DELIBERATELY absent (decision 2026-07-26): CivilPro's
  // Milestone is approval-bearing, so folding it to 'standard' silently drops a
  // gate and there is no fourth vocabulary value to fold to. It falls through
  // unrecognised (-> '') and the dry run routes the row to the reviewer, who
  // picks the real type per template (TemplateResolution.milestoneAs).
  [/^c|check/, 'standard'],
];

const RESPONSIBLE_PARTY_RULES: VocabularyRule[] = [
  [/superintend|client|principal|engineer|^re$/, 'superintendent'],
  [/contract|subbie/, 'contractor'],
];

const EVIDENCE_REQUIRED_RULES: VocabularyRule[] = [
  [/photo/, 'photo'],
  [/sign/, 'signature'],
  [/test/, 'test'],
  [/inspect/, 'inspection'],
  [/doc|cert|record/, 'document'],
  // CivilPro's Records column: QVC | QVC/ATP | QVC/Tests | QVC/Test records.
  // LAST on purpose — the /test/ arm above must keep claiming "QVC/Tests" and
  // "QVC/Test records", so only QVC and QVC/ATP land here.
  [/qvc|checklist|atp/, 'inspection'],
];

function toVocabulary(rules: VocabularyRule[], raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return '';
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? '';
}

/** Apply a profile's named transform. Unknown transforms cannot reach here —
 *  `assertAllowedFieldMap` rejects them first. */
export function applyTransform(transform: ImportTransform | undefined, raw: string): string {
  switch (transform) {
    case 'whs_to_point_type':
      return toVocabulary(POINT_TYPE_RULES, raw);
    case 'responsible_party':
      return toVocabulary(RESPONSIBLE_PARTY_RULES, raw);
    case 'evidence_required':
      return toVocabulary(EVIDENCE_REQUIRED_RULES, raw);
    case 'none':
    case undefined:
      return raw.trim();
  }
}

// ---------------------------------------------------------------------------
// Built-in profiles
// ---------------------------------------------------------------------------

export interface BuiltInProfile {
  /** Stable id so a batch can reference a built-in without a DB row. */
  key: string;
  name: string;
  kind: string;
  sourceFormat: string;
  fieldMap: FieldMapEntry[];
}

// NOTE on the CivilPro profile below: the column names are no longer guessed.
// They are calibrated against CivilPro's OWN published layout — the verbatim
// column list in civilpro.zendesk.com article 16952308349071 ("Converting ITPs
// to CivilPro Format using AI") plus the ITP grid and register screenshots in
// articles 4407191198351 (Create ITP) and 4406603407375 (Export Registers as
// Excel Files). What is still missing for the full tick is one real customer
// export: vendor documentation fixes the column NAMES, only a live file proves
// the sheet name, header band and value spellings a customer's build emits.
//
// Deliberately absent, and why:
//  - templateName: the ITP name is header-level metadata in CivilPro, not a row
//    column, so the sheet IS the template (the grouping the dry run already
//    falls back to).
//  - activityType: CivilPro has no activity column. The importer will block
//    each template as `unresolvable_activity` and the reviewer picks the slug —
//    correct, since a defaulted activity silently mis-files an ITP.
//  - acceptanceCriteria: by vendor design the criteria live INSIDE Description.
//    Mapping them to a second column would invent data that is not there.
//
// Future importer improvements, not built here: CivilPro's `Unique ID` column
// is a natural round-trip/dedup key (no import target exists for it yet), and
// `Included on ITP = FALSE` marks rows the customer excluded from the printed
// ITP — today they import like any other row.
//
// Every column is still correctable in the mapping UI, so a wrong alias costs a
// re-map, not a bad import.
export const BUILT_IN_PROFILES: BuiltInProfile[] = [
  {
    key: 'generic_au_itp_excel',
    name: 'Generic AU ITP sheet',
    kind: 'itp_template',
    sourceFormat: 'excel',
    fieldMap: [
      { target: 'activityType', source: { header: 'Activity' } },
      { target: 'description', source: { header: 'Inspection / Test Activity' } },
      { target: 'acceptanceCriteria', source: { header: 'Acceptance Criteria' } },
      { target: 'pointType', source: { header: 'W/H/S' }, transform: 'whs_to_point_type' },
      {
        target: 'responsibleParty',
        source: { header: 'Responsible' },
        transform: 'responsible_party',
      },
      { target: 'testType', source: { header: 'Test Type' } },
    ],
  },
  {
    key: 'civilpro_itp_excel',
    name: 'CivilPro ITP export',
    kind: 'itp_template',
    sourceFormat: 'excel',
    fieldMap: [
      // Description carries the check AND its acceptance criteria; Reference
      // Text is CivilPro's own short label and must NOT win the description.
      { target: 'description', source: { header: 'Description' } },
      { target: 'pointType', source: { header: 'HpWpC' }, transform: 'whs_to_point_type' },
      {
        target: 'responsibleParty',
        source: { header: 'Responsibility' },
        transform: 'responsible_party',
      },
      { target: 'evidenceRequired', source: { header: 'Records' }, transform: 'evidence_required' },
      { target: 'testType', source: { header: 'Insp Meth' } },
      { target: 'specificationReference', source: { header: 'Clause' } },
    ],
  },
  // The lot register B2 replaces the client-side CSV importer with. Column names
  // are the spellings that importer's alias table already proved against real
  // registers; every one is correctable in the mapping step, and the alias fills
  // above cover the common variants without a profile edit.
  {
    key: 'generic_au_lot_register_excel',
    name: 'Generic lot register',
    kind: 'lot_register',
    sourceFormat: 'excel',
    fieldMap: [
      { target: 'lotNumber', source: { header: 'Lot Number' } },
      { target: 'description', source: { header: 'Description' } },
      { target: 'activityType', source: { header: 'Activity' } },
      { target: 'chainageStart', source: { header: 'Chainage Start' } },
      { target: 'chainageEnd', source: { header: 'Chainage End' } },
      { target: 'layer', source: { header: 'Layer' } },
      // Registers routinely name the ITP per lot; matched against this project's
      // own templates by name, never created and never matched across projects.
      { target: 'itpTemplateName', source: { header: 'ITP' } },
    ],
  },
];

/** The built-in whose columns best fit these headers, if any fits well enough. */
export function suggestBuiltInProfile(headers: string[], kind: string): BuiltInProfile | null {
  let best: { profile: BuiltInProfile; score: number } | null = null;
  for (const profile of BUILT_IN_PROFILES) {
    if (profile.kind !== kind) continue;
    const score = scoreFieldMapAgainstHeaders(profile.fieldMap, headers);
    if (!best || score > best.score) best = { profile, score };
  }
  // Below two-thirds the profile is guessing; the reviewer maps by hand instead.
  return best && best.score >= 2 / 3 ? best.profile : null;
}
