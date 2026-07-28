/**
 * Wave B B2 — the lot-register dry run as a pure unit.
 *
 * Every rule that stops a bad register reaching the database is asserted here,
 * without a database, the same way the ITP dry run is. The rules that exist
 * BECAUSE of the CSV importer this stage retires (spec §2.5) are named as such.
 */
import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import { LOT_REGISTER_HEADERS, LOT_REGISTER_ROWS } from '../../../test/itpWorkbookFixture.js';
import type { ParsedGrid } from './excelParser.js';
import {
  computeLotRegisterDryRun,
  MAX_IMPORT_LOTS_PER_BATCH,
  type LotRegisterDryRunInput,
} from './lotRegisterDryRun.js';
import { deriveFieldMapFromHeaders } from './mappingProfiles.js';

const HEADERS = [...LOT_REGISTER_HEADERS];
const FIELD_MAP = deriveFieldMapFromHeaders(HEADERS, 'lot_register');

// VIC / VicRoads resolves a confirmed pack: scaleKeys A/B/C, materialTypes
// Type A / Type B / Type C.
const VIC = { state: 'VIC', specificationSet: 'VicRoads' };

function grid(rows: string[][], headers: string[] = HEADERS): ParsedGrid {
  return { sheets: [{ name: 'Lot Register', headers, rows }] };
}

function run(overrides: Partial<LotRegisterDryRunInput> = {}) {
  return computeLotRegisterDryRun({
    grid: grid(LOT_REGISTER_ROWS),
    fieldMap: FIELD_MAP,
    project: VIC,
    existingLots: [],
    // The register's ITP column names this one; tests that care override it.
    templates: [{ id: 'tpl-1', name: 'ITP-01 Subgrade' }],
    ...overrides,
  });
}

function rowFor(result: ReturnType<typeof run>, lotNumber: string) {
  const row = result.dryRun.rows.find((entry) => entry.label === lotNumber);
  if (!row) throw new Error(`no ledger row for ${lotNumber}`);
  return row;
}

describe('computeLotRegisterDryRun', () => {
  it('derives the register columns from their real headers', () => {
    expect(FIELD_MAP.map((entry) => entry.target)).toEqual([
      'lotNumber',
      'description',
      'activityType',
      'chainageStart',
      'chainageEnd',
      'layer',
      'itpTemplateName',
    ]);
  });

  it('turns a register into lots, with the counts before any write', () => {
    const result = run();

    expect(result.dryRun.counts).toMatchObject({
      willCreate: 1, // L-001 folds exact
      needsReview: 1, // L-002 folds at family level
      blocked: 1, // L-003 has no activity
      willSkip: 1, // the trailing blank row
    });
    expect(result.dryRun.canApply).toBe(false);
    expect(result.lots.map((lot) => lot.lotNumber)).toEqual(['L-001', 'L-002']);
    expect(result.lots[0]).toMatchObject({
      lotNumber: 'L-001',
      description: 'Subgrade CH 0-100',
      activityType: 'earthworks_general',
      chainageStart: 0,
      chainageEnd: 100,
      layer: 'Subgrade',
    });
    // A family-level fold keeps the source text so the specific activity can be
    // chosen on the lot afterwards.
    expect(result.lots[1].activityType).toBe('Drainage');
    expect(rowFor(result, 'L-002')).toMatchObject({
      outcome: 'needs_review',
      reason: 'ambiguous_activity',
      activityFold: 'family',
    });
  });

  it('BLOCKS an activity it cannot resolve instead of defaulting it (§2.5 defect, §4.10d)', () => {
    const blocked = rowFor(run(), 'L-003');
    expect(blocked).toMatchObject({ outcome: 'blocked', reason: 'unresolvable_activity' });
    expect(blocked.detail).toContain('no activity');

    // …and an unrecognised one, not just an empty one.
    const unknown = run({
      grid: grid([['L-009', 'Something', 'Tunnelling', '', '', '', '']]),
    });
    expect(rowFor(unknown, 'L-009')).toMatchObject({
      outcome: 'blocked',
      reason: 'unresolvable_activity',
    });
    expect(unknown.lots).toHaveLength(0);
  });

  it('lets the reviewer resolve a blocked activity, and skip a row entirely', () => {
    const resolved = run({
      resolutions: { 'lot:Lot Register#4': { activitySlug: 'culverts' } },
    });
    expect(rowFor(resolved, 'L-003').outcome).toBe('create');
    expect(resolved.lots.find((lot) => lot.lotNumber === 'L-003')?.activityType).toBe('culverts');
    expect(resolved.dryRun.canApply).toBe(true);

    const skipped = run({ resolutions: { 'lot:Lot Register#4': { skip: true } } });
    expect(rowFor(skipped, 'L-003').outcome).toBe('skip');
    expect(skipped.dryRun.canApply).toBe(true);
  });

  it('auto-skips a lot number the project already has, naming what it matched', () => {
    const result = run({ existingLots: [{ id: 'lot-1', lotNumber: 'l-001' }] });
    expect(rowFor(result, 'L-001')).toMatchObject({
      outcome: 'skip',
      reason: 'duplicate',
      duplicateOf: { model: 'Lot', id: 'lot-1', matchedOn: 'lot number' },
    });
    expect(result.lots.map((lot) => lot.lotNumber)).not.toContain('L-001');
  });

  it('blocks the batch on two rows sharing a lot number inside the file', () => {
    const result = run({
      grid: grid([
        ['L-001', 'First', 'Earthworks', '', '', '', ''],
        ['l-001 ', 'Second', 'Earthworks', '', '', '', ''],
      ]),
    });
    const rows = result.dryRun.rows.filter((row) => row.reason === 'slug_collision');
    expect(rows).toHaveLength(2);
    expect(rows[0].collidesWith).toEqual([{ sheet: 'Lot Register', rowIndex: 3 }]);
    expect(result.dryRun.canApply).toBe(false);
  });

  it('blocks an over-length cell rather than truncating it', () => {
    const result = run({
      grid: grid([['L-1', 'x'.repeat(1_200), 'Earthworks', '', '', '', '']]),
    });
    expect(rowFor(result, 'L-1')).toMatchObject({
      outcome: 'blocked',
      reason: 'over_length',
      overLength: { field: 'description', length: 1_200, max: 1_000 },
    });
  });

  it('blocks chainage that is not a number, and a range that runs backwards', () => {
    const notNumber = run({ grid: grid([['L-1', '', 'Earthworks', 'about 100', '', '', '']]) });
    expect(rowFor(notNumber, 'L-1')).toMatchObject({
      outcome: 'blocked',
      reason: 'invalid_value',
    });

    const backwards = run({ grid: grid([['L-1', '', 'Earthworks', '400', '100', '', '']]) });
    expect(rowFor(backwards, 'L-1').detail).toContain('backwards');
  });

  // M10: the app PRINTS every chainage as "CH 1+020" (frontend `formatChainage`),
  // and surveyors write registers in the same stationing. Refusing the app's own
  // display format was the defect.
  it('reads chainage in the stationing format the app itself prints', () => {
    const result = run({
      grid: grid([['L-1', '', 'Earthworks', 'CH 1+020', '1+250', '', '']]),
    });
    expect(rowFor(result, 'L-1').outcome).toBe('create');
    expect(result.lots[0]).toMatchObject({ chainageStart: 1_020, chainageEnd: 1_250 });
  });

  it('still blocks stationing whose metre part is ambiguous', () => {
    const result = run({ grid: grid([['L-1', '', 'Earthworks', '1+20', '', '', '']]) });
    expect(rowFor(result, 'L-1')).toMatchObject({
      outcome: 'blocked',
      reason: 'invalid_value',
    });
  });

  it('BLOCKS a testScale the project spec does not use, quoting the validator (D14.1)', () => {
    const headers = [...HEADERS, 'Test Scale'];
    const fieldMap = deriveFieldMapFromHeaders(headers, 'lot_register');
    const result = computeLotRegisterDryRun({
      grid: grid([['L-1', '', 'Earthworks', '', '', '', '', 'Z']], headers),
      fieldMap,
      project: VIC,
      existingLots: [],
      templates: [],
    });

    const row = rowFor(result, 'L-1');
    expect(row).toMatchObject({ outcome: 'blocked', reason: 'unsupported_attribute' });
    // Never a 500, never silently dropped — the reviewer is told the vocabulary.
    expect(row.detail).toContain('Valid scales: A, B, C');
    expect(result.lots).toHaveLength(0);
  });

  it('carries a valid testScale straight through to the payload', () => {
    const headers = [...HEADERS, 'Test Scale'];
    const result = computeLotRegisterDryRun({
      grid: grid([['L-1', '', 'Earthworks', '', '', '', '', 'B']], headers),
      fieldMap: deriveFieldMapFromHeaders(headers, 'lot_register'),
      project: VIC,
      existingLots: [],
      templates: [],
    });
    expect(result.lots[0]).toMatchObject({ testScale: 'B' });
  });

  it('links a lot to the ITP its register names, and flags one it cannot find', () => {
    const oneRow = grid([['L-001', '', 'Earthworks', '', '', '', 'ITP-01 Subgrade']]);
    const linked = run({ grid: oneRow });
    expect(linked.lots[0].itpTemplateId).toBe('tpl-1');
    expect(linked.dryRun.canApply).toBe(true);

    const missing = run({ grid: oneRow, templates: [] });
    expect(rowFor(missing, 'L-001')).toMatchObject({
      outcome: 'needs_review',
      reason: 'template_not_found',
    });
    // Still imports — a register naming an ITP this project lacks is not fatal.
    expect(missing.lots[0].itpTemplateId).toBeNull();
    expect(missing.dryRun.canApply).toBe(true);
  });

  /**
   * M10: the Apply CTA is `willCreate + ambiguous`, and a `template_not_found`
   * row is neither — but it IS pushed to the payload. A register naming an ITP
   * this project lacks could therefore read "Import 1 lot" and create 200.
   * `willImport` is derived from the payload itself, so the two cannot drift.
   */
  it('counts exactly the rows Apply will create, template_not_found included', () => {
    const result = run({
      grid: grid([
        ['L-001', '', 'Earthworks', '', '', '', 'ITP nobody has'],
        ['L-002', '', 'Earthworks', '', '', '', 'ITP nobody has either'],
        ['L-003', '', 'Earthworks', '', '', '', ''],
        ['L-004', '', 'Drainage', '', '', '', ''],
      ]),
      templates: [],
    });

    expect(result.dryRun.counts.willImport).toBe(result.lots.length);
    expect(result.dryRun.counts.willImport).toBe(4);
    // The old CTA formula, for contrast: it saw 2 of the 4 lots it would make.
    expect(result.dryRun.counts.willCreate + result.dryRun.counts.ambiguous).toBe(2);
  });

  it('does not count a blocked, skipped or duplicate row as an import', () => {
    const result = run({ existingLots: [{ id: 'lot-1', lotNumber: 'L-001' }] });
    // L-001 duplicate, L-003 blocked, blank row skipped: only L-002 is made.
    expect(result.dryRun.counts.willImport).toBe(1);
    expect(result.lots).toHaveLength(1);
  });

  it('blocks every row when no column is mapped to the lot number', () => {
    const result = run({
      grid: grid([['x', 'y']], ['Some note', 'Another note']),
      fieldMap: FIELD_MAP,
    });
    expect(result.dryRun.rows.every((row) => row.reason === 'unmapped_column')).toBe(true);
    expect(result.dryRun.canApply).toBe(false);
  });

  it('rejects a register past the 500-lot cap with a split-the-file message', () => {
    const rows = Array.from({ length: MAX_IMPORT_LOTS_PER_BATCH + 1 }, (_, index) => [
      `L-${index}`,
      '',
      'Earthworks',
      '',
      '',
      '',
      '',
    ]);
    expect(() => run({ grid: grid(rows) })).toThrow(AppError);
    try {
      run({ grid: grid(rows) });
    } catch (error) {
      expect((error as AppError).message).toContain('Split it into smaller files');
    }
  });
});
