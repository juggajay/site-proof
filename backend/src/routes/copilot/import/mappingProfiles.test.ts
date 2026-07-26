import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import {
  AU_ITP_HEADERS,
  buildCivilProWorkbook,
  CIVILPRO_MILESTONE_ROW,
  CIVILPRO_CSV_HEADERS,
  CIVILPRO_GRID_HEADERS,
  CIVILPRO_SHEET_NAME,
} from '../../../test/itpWorkbookFixture.js';
import { parseExcelWorkbook } from './excelParser.js';
import { computeItpImportDryRun } from './itpImportDryRun.js';
import {
  applyTransform,
  assertAllowedFieldMap,
  BUILT_IN_PROFILES,
  deriveFieldMapFromHeaders,
  mergeFieldMapWithAliases,
  resolveColumnIndexes,
  scoreFieldMapAgainstHeaders,
  suggestBuiltInProfile,
  type ItpImportTarget,
} from './mappingProfiles.js';

const HEADERS = [...AU_ITP_HEADERS];

describe('assertAllowedFieldMap — the apply-time gate', () => {
  it('accepts a well-formed map', () => {
    const map = assertAllowedFieldMap(
      [{ target: 'description', source: { header: 'Inspection / Test Activity' } }],
      'itp_template',
    );
    expect(map).toHaveLength(1);
  });

  it('refuses a target outside the allow-list, even when the profile was saved earlier', () => {
    expect(() =>
      assertAllowedFieldMap([{ target: 'projectId', source: { header: 'X' } }], 'itp_template'),
    ).toThrow(/not a field this import can write/);
  });

  it('refuses an unknown transform', () => {
    expect(() =>
      assertAllowedFieldMap(
        [{ target: 'description', source: { header: 'X' }, transform: 'exec_shell' }],
        'itp_template',
      ),
    ).toThrow(/not a supported transform/);
  });

  it('refuses two columns mapped to the same target', () => {
    expect(() =>
      assertAllowedFieldMap(
        [
          { target: 'description', source: { header: 'A' } },
          { target: 'description', source: { header: 'B' } },
        ],
        'itp_template',
      ),
    ).toThrow(/Two columns are both mapped/);
  });

  it('refuses a kind that has no importer yet (test_register stays reserved)', () => {
    expect(() =>
      assertAllowedFieldMap([{ target: 'description', source: { header: 'A' } }], 'test_register'),
    ).toThrow(/are not supported yet/);
  });

  it('refuses structurally invalid JSON', () => {
    expect(() => assertAllowedFieldMap({ not: 'an array' }, 'itp_template')).toThrow(AppError);
    expect(() => assertAllowedFieldMap([], 'itp_template')).toThrow(AppError);
  });

  it('validates every shipped built-in profile', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(() => assertAllowedFieldMap(profile.fieldMap, profile.kind)).not.toThrow();
    }
  });
});

describe('header aliasing', () => {
  it('derives the AU ITP columns from their headers', () => {
    const map = deriveFieldMapFromHeaders(HEADERS);
    const targets = map.map((entry) => entry.target);
    expect(targets).toContain('activityType');
    expect(targets).toContain('description');
    expect(targets).toContain('acceptanceCriteria');
    expect(targets).toContain('pointType');
    expect(targets).toContain('responsibleParty');
    expect(targets).toContain('testType');
  });

  it('auto-suggests the generic AU profile for an AU ITP sheet', () => {
    expect(suggestBuiltInProfile(HEADERS)?.key).toBe('generic_au_itp_excel');
  });

  it('suggests nothing for an unrecognisable layout', () => {
    expect(suggestBuiltInProfile(['Foo', 'Bar', 'Baz'])).toBeNull();
  });

  it('resolves target -> column index, ignoring punctuation and case', () => {
    const indexes = resolveColumnIndexes(
      [{ target: 'description', source: { header: 'inspection test activity' } }],
      HEADERS,
    );
    expect(indexes.get('description')).toBe(1);
  });
});

describe('transforms', () => {
  it('maps W/H/S to the codebase point-type vocabulary', () => {
    expect(applyTransform('whs_to_point_type', 'H')).toBe('hold_point');
    expect(applyTransform('whs_to_point_type', 'Hold Point')).toBe('hold_point');
    expect(applyTransform('whs_to_point_type', 'W')).toBe('witness');
    expect(applyTransform('whs_to_point_type', 'S')).toBe('standard');
    expect(applyTransform('whs_to_point_type', 'Surveillance')).toBe('standard');
    expect(applyTransform('whs_to_point_type', '')).toBe('');
    // Unrecognised values fall through empty so the DB default applies rather
    // than a guess being written as fact.
    expect(applyTransform('whs_to_point_type', 'zzz')).toBe('');
  });

  it('maps responsible party', () => {
    expect(applyTransform('responsible_party', 'Contractor')).toBe('contractor');
    expect(applyTransform('responsible_party', 'Superintendent')).toBe('superintendent');
    expect(applyTransform('responsible_party', 'RE')).toBe('superintendent');
  });

  it('maps evidence required', () => {
    expect(applyTransform('evidence_required', 'Photo record')).toBe('photo');
    expect(applyTransform('evidence_required', 'Test certificate')).toBe('test');
    expect(applyTransform('evidence_required', 'Signed checklist')).toBe('signature');
  });

  it('trims by default', () => {
    expect(applyTransform(undefined, '  spaced  ')).toBe('spaced');
    expect(applyTransform('none', '  spaced  ')).toBe('spaced');
  });
});

// ---------------------------------------------------------------------------
// CivilPro calibration (see the profile's note for the vendor sources)
// ---------------------------------------------------------------------------

const CIVILPRO_PROFILE = BUILT_IN_PROFILES.find((profile) => profile.key === 'civilpro_itp_excel')!;

/** The reviewer's key for the one template in the fixture: `sheet::sheet`. */
const CIVILPRO_TEMPLATE_KEY = `${CIVILPRO_SHEET_NAME}::${CIVILPRO_SHEET_NAME}`;

describe('CivilPro profile — calibrated against the vendor-published layout', () => {
  it('fits the ITP item grid exactly, and is what gets auto-suggested', () => {
    expect(scoreFieldMapAgainstHeaders(CIVILPRO_PROFILE.fieldMap, [...CIVILPRO_GRID_HEADERS])).toBe(
      1,
    );
    expect(suggestBuiltInProfile([...CIVILPRO_GRID_HEADERS])?.key).toBe('civilpro_itp_excel');
  });

  it('binds description to Description, never to CivilPro’s short Reference Text', () => {
    const indexes = resolveColumnIndexes(CIVILPRO_PROFILE.fieldMap, [...CIVILPRO_GRID_HEADERS]);
    expect(indexes.get('description')).toBe(CIVILPRO_GRID_HEADERS.indexOf('Description'));
    expect(indexes.get('description')).not.toBe(CIVILPRO_GRID_HEADERS.indexOf('Reference Text'));
    expect(indexes.get('specificationReference')).toBe(CIVILPRO_GRID_HEADERS.indexOf('Clause'));
    // Every target the profile claims resolves — no half-mapped import.
    for (const entry of CIVILPRO_PROFILE.fieldMap) {
      expect(indexes.has(entry.target as ItpImportTarget)).toBe(true);
    }
  });

  it('reads CivilPro’s controlled vocabularies into the codebase ones', () => {
    expect(applyTransform('whs_to_point_type', 'Check Item')).toBe('standard');
    expect(applyTransform('whs_to_point_type', 'Witness Point')).toBe('witness');
    expect(applyTransform('whs_to_point_type', 'Hold Point')).toBe('hold_point');
    // Milestone deliberately does NOT fold (decision 2026-07-26): it is
    // approval-bearing, so it falls through unrecognised and the dry run routes
    // the row to the reviewer (milestone_point_type + milestoneAs resolution).
    expect(applyTransform('whs_to_point_type', 'Milestone')).toBe('');

    expect(applyTransform('evidence_required', 'QVC')).toBe('inspection');
    expect(applyTransform('evidence_required', 'QVC/ATP')).toBe('inspection');
    // The /test/ arm still wins these two — the QVC arm must stay last.
    expect(applyTransform('evidence_required', 'QVC/Tests')).toBe('test');
    expect(applyTransform('evidence_required', 'QVC/Test records')).toBe('test');
  });

  it('maps the real grid rows through parse → map → dry run', async () => {
    const grid = await parseExcelWorkbook(await buildCivilProWorkbook());
    const sheet = grid.sheets[0];
    expect(sheet.headers).toEqual([...CIVILPRO_GRID_HEADERS]);
    expect(sheet.rows).toHaveLength(3);

    const indexes = resolveColumnIndexes(CIVILPRO_PROFILE.fieldMap, sheet.headers);
    const column = (target: ItpImportTarget) => indexes.get(target)!;
    const cells = sheet.rows.map((row) => ({
      pointType: applyTransform('whs_to_point_type', row[column('pointType')]),
      evidenceRequired: applyTransform('evidence_required', row[column('evidenceRequired')]),
      responsibleParty: applyTransform('responsible_party', row[column('responsibleParty')]),
      specificationReference: row[column('specificationReference')],
      testType: row[column('testType')],
      description: row[column('description')],
    }));

    expect(cells.map((row) => row.pointType)).toEqual(['standard', 'hold_point', 'standard']);
    expect(cells.map((row) => row.evidenceRequired)).toEqual(['inspection', 'inspection', 'test']);
    // Every Clause value lands in specificationReference, on every row.
    expect(cells.map((row) => row.specificationReference)).toEqual([
      'MRTS04 Cl. 7.2.1',
      'MRTS04 Cl. 7.2.2',
      'MRTS04 Cl.12.2.1.3',
    ]);
    expect(cells.map((row) => row.testType)).toEqual(['Visual', 'Visual', 'Visual/Test']);
    expect(cells[0].description).toBe(
      'Limits of clearing identified and set out completed by survey.',
    );
    // OPEN domain call, pinned here rather than changed: CivilPro's
    // "Engineer and Supervisor" currently folds to superintendent.
    expect(cells[0].responsibleParty).toBe('superintendent');

    const result = computeItpImportDryRun({
      grid,
      fieldMap: CIVILPRO_PROFILE.fieldMap,
      projectSpecificationSet: null,
      existingTemplates: [],
      resolutions: { [CIVILPRO_TEMPLATE_KEY]: { activitySlug: 'earthworks_general' } },
    });

    expect(result.dryRun.canApply).toBe(true);
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].checklistItems).toHaveLength(3);
    expect(result.templates[0].checklistItems.map((item) => item.pointType)).toEqual([
      'standard',
      'hold_point',
      'standard',
    ]);
    expect(result.templates[0].name).toBe(CIVILPRO_SHEET_NAME);
  });

  it('routes Milestone rows to the reviewer instead of folding them (decision 2026-07-26)', async () => {
    const grid = await parseExcelWorkbook(
      await buildCivilProWorkbook({ extraRows: [CIVILPRO_MILESTONE_ROW] }),
    );
    const unresolved = computeItpImportDryRun({
      grid,
      fieldMap: CIVILPRO_PROFILE.fieldMap,
      projectSpecificationSet: null,
      existingTemplates: [],
      resolutions: { [CIVILPRO_TEMPLATE_KEY]: { activitySlug: 'earthworks_general' } },
    });

    // Unresolved: the template and the milestone row both flag, and the batch
    // cannot apply — an approval-bearing point must never silently become a
    // plain check item.
    expect(unresolved.dryRun.canApply).toBe(false);
    const flagged = unresolved.dryRun.rows.filter((row) => row.reason === 'milestone_point_type');
    expect(flagged.map((row) => row.unit).sort()).toEqual(['checklist_row', 'template']);

    // Resolved: the reviewer says this template's milestones are witness points.
    const resolved = computeItpImportDryRun({
      grid,
      fieldMap: CIVILPRO_PROFILE.fieldMap,
      projectSpecificationSet: null,
      existingTemplates: [],
      resolutions: {
        [CIVILPRO_TEMPLATE_KEY]: { activitySlug: 'earthworks_general', milestoneAs: 'witness' },
      },
    });
    expect(resolved.dryRun.canApply).toBe(true);
    expect(resolved.dryRun.rows.some((row) => row.reason === 'milestone_point_type')).toBe(false);
    expect(resolved.templates[0].checklistItems).toHaveLength(4);
    expect(resolved.templates[0].checklistItems[3].pointType).toBe('witness');
  });

  it('blocks on the missing activity column rather than defaulting a slug', async () => {
    const grid = await parseExcelWorkbook(await buildCivilProWorkbook());
    const result = computeItpImportDryRun({
      grid,
      fieldMap: CIVILPRO_PROFILE.fieldMap,
      projectSpecificationSet: null,
      existingTemplates: [],
    });

    expect(result.dryRun.canApply).toBe(false);
    expect(result.dryRun.rows[0].reason).toBe('unresolvable_activity');
  });

  it('suggests the profile for the register CSV column names too', () => {
    expect(suggestBuiltInProfile([...CIVILPRO_CSV_HEADERS])?.key).toBe('civilpro_itp_excel');

    // The CSV spells two columns differently, so the alias table (not the
    // profile's exact headers) is what resolves them in the mapping step.
    const derived = deriveFieldMapFromHeaders([...CIVILPRO_CSV_HEADERS]);
    const source = (target: string) =>
      derived.find((entry) => entry.target === target)?.source.header;
    expect(source('pointType')).toBe('Check Type');
    expect(source('testType')).toBe('Inspection Method');
    expect(source('description')).toBe('Description');
    expect(source('specificationReference')).toBe('Clause');
    expect(source('evidenceRequired')).toBe('Records');
  });

  it('merges a suggested profile with alias fills so the CSV resolves pointType', () => {
    const merged = mergeFieldMapWithAliases(CIVILPRO_PROFILE.fieldMap, [...CIVILPRO_CSV_HEADERS]);
    const source = (target: string) =>
      merged.find((entry) => entry.target === target)?.source.header;

    // Profile entries whose headers exist are kept...
    expect(source('description')).toBe('Description');
    expect(source('specificationReference')).toBe('Clause');
    // ...absent-header profile entries (HpWpC, Insp Meth) are dropped and the
    // alias table fills the target from the CSV's spelling instead.
    expect(source('pointType')).toBe('Check Type');
    expect(source('testType')).toBe('Inspection Method');
    // No dead mappings pointing at headers this sheet does not have.
    const headerSet = new Set<string>(CIVILPRO_CSV_HEADERS);
    for (const entry of merged) expect(headerSet.has(entry.source.header)).toBe(true);
    // No target mapped twice.
    const targets = merged.map((entry) => entry.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('merge is a no-op when the profile already resolves every header (grid layout)', () => {
    const gridHeaders = CIVILPRO_PROFILE.fieldMap.map((entry) => entry.source.header);
    const merged = mergeFieldMapWithAliases(CIVILPRO_PROFILE.fieldMap, gridHeaders);
    expect(merged).toEqual(CIVILPRO_PROFILE.fieldMap);
  });

  it('derives the grid layout from its headers alone, with no profile chosen', () => {
    const derived = deriveFieldMapFromHeaders([...CIVILPRO_GRID_HEADERS]);
    expect(derived.map((entry) => entry.target).sort()).toEqual(
      CIVILPRO_PROFILE.fieldMap.map((entry) => entry.target).sort(),
    );
  });
});
