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
  if (kind !== 'itp_template') {
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
    if (!ITP_IMPORT_TARGET_SET.has(entry.target)) {
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

// Header aliases per target, most-specific first. The lot-register equivalent of
// this table already exists in the shipped CSV importer
// (frontend/src/components/lots/importLotsCsv.ts) and is harvested in B2.
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
  testType: ['testtype', 'testmethod', 'test', 'testreference', 'testfrequency'],
};

/**
 * Best-effort field map from a sheet's headers alone — the "unknown layout"
 * starting point the reviewer then corrects in the mapping UI.
 */
export function deriveFieldMapFromHeaders(headers: string[]): FieldMapEntry[] {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const entries: FieldMapEntry[] = [];

  for (const target of ITP_IMPORT_TARGETS) {
    for (const alias of ITP_HEADER_ALIASES[target]) {
      const index = normalized.findIndex((value, i) => value === alias && !used.has(i));
      if (index >= 0) {
        used.add(index);
        entries.push({
          target,
          source: { header: headers[index] },
          ...(target === 'pointType' ? { transform: 'whs_to_point_type' as const } : {}),
          ...(target === 'responsibleParty' ? { transform: 'responsible_party' as const } : {}),
          ...(target === 'evidenceRequired' ? { transform: 'evidence_required' as const } : {}),
        });
        break;
      }
    }
  }

  return entries;
}

/** How well a field map fits a sheet: the share of its columns that resolve. */
export function scoreFieldMapAgainstHeaders(fieldMap: FieldMapEntry[], headers: string[]): number {
  if (fieldMap.length === 0) return 0;
  const normalized = new Set(headers.map(normalizeHeader));
  const hits = fieldMap.filter((entry) => normalized.has(normalizeHeader(entry.source.header)));
  return hits.length / fieldMap.length;
}

/** target -> column index for a given sheet; unresolved targets are absent. */
export function resolveColumnIndexes(
  fieldMap: FieldMapEntry[],
  headers: string[],
): Map<ItpImportTarget, number> {
  const normalized = headers.map(normalizeHeader);
  const indexes = new Map<ItpImportTarget, number>();
  for (const entry of fieldMap) {
    const index = normalized.indexOf(normalizeHeader(entry.source.header));
    if (index >= 0) indexes.set(entry.target as ItpImportTarget, index);
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

// NOTE: the CivilPro column names below are a reasoned starting point, NOT a
// measurement — no real CivilPro export was available at build time. They must
// be calibrated against a genuine export before the "imports a real CivilPro
// export without hand-mapping" exit claim can be made (the same posture the
// spec takes toward its provisional §9-D5 benchmark counts). Every column is
// still correctable in the mapping UI, so a wrong alias costs a re-map, not a
// bad import.
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
      { target: 'templateName', source: { header: 'ITP' } },
      { target: 'activityType', source: { header: 'Activity/Process' } },
      { target: 'description', source: { header: 'Inspection/Test Detail' } },
      { target: 'acceptanceCriteria', source: { header: 'Acceptance Criteria/Standard' } },
      { target: 'pointType', source: { header: 'Insp Type' }, transform: 'whs_to_point_type' },
      {
        target: 'responsibleParty',
        source: { header: 'Responsibility' },
        transform: 'responsible_party',
      },
      { target: 'testType', source: { header: 'Test Method' } },
      { target: 'specificationReference', source: { header: 'Specification' } },
    ],
  },
];

/** The built-in whose columns best fit these headers, if any fits well enough. */
export function suggestBuiltInProfile(headers: string[]): BuiltInProfile | null {
  let best: { profile: BuiltInProfile; score: number } | null = null;
  for (const profile of BUILT_IN_PROFILES) {
    const score = scoreFieldMapAgainstHeaders(profile.fieldMap, headers);
    if (!best || score > best.score) best = { profile, score };
  }
  // Below two-thirds the profile is guessing; the reviewer maps by hand instead.
  return best && best.score >= 2 / 3 ? best.profile : null;
}
