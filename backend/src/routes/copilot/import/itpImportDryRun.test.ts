import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import type { ParsedGrid } from './excelParser.js';
import {
  computeItpImportDryRun,
  MAX_IMPORT_TEMPLATES_PER_BATCH,
  templateDedupKey,
  type DryRunInput,
} from './itpImportDryRun.js';
import { deriveFieldMapFromHeaders } from './mappingProfiles.js';

const HEADERS = [
  'Activity',
  'Inspection / Test Activity',
  'Acceptance Criteria',
  'W/H/S',
  'Responsible',
  'Test Type',
];
const FIELD_MAP = deriveFieldMapFromHeaders(HEADERS, 'itp_template');

function grid(sheets: { name: string; rows: string[][]; headers?: string[] }[]): ParsedGrid {
  return {
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      headers: sheet.headers ?? HEADERS,
      rows: sheet.rows,
    })),
  };
}

function run(overrides: Partial<DryRunInput> & { grid: ParsedGrid }) {
  return computeItpImportDryRun({
    fieldMap: FIELD_MAP,
    projectSpecificationSet: 'TfNSW',
    existingTemplates: [],
    ...overrides,
  });
}

const CLEAN_ROW = [
  'Earthworks',
  'Proof roll subgrade',
  'No deflection',
  'H',
  'Contractor',
  'Proof roll',
];

describe('computeItpImportDryRun — happy path', () => {
  it('turns one sheet into one template with its checklist rows', () => {
    const { dryRun, templates } = run({
      grid: grid([
        {
          name: 'ITP-01 Subgrade',
          rows: [
            CLEAN_ROW,
            ['Earthworks', 'Survey levels', '+20/-30 mm', 'S', 'Contractor', 'Survey'],
          ],
        },
      ]),
    });

    expect(dryRun.counts.willCreate).toBe(1);
    expect(dryRun.canApply).toBe(true);
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('ITP-01 Subgrade');
    expect(templates[0].activityType).toBe('earthworks_general');
    expect(templates[0].checklistItems).toHaveLength(2);
    // The AU columns land in the right fields.
    expect(templates[0].checklistItems[0]).toMatchObject({
      description: 'Proof roll subgrade',
      acceptanceCriteria: 'No deflection',
      pointType: 'hold_point',
      responsibleParty: 'contractor',
      testType: 'Proof roll',
    });
  });

  it('captures the Wave-2 audit citation for every match', () => {
    const { templates } = run({ grid: grid([{ name: 'ITP-01', rows: [CLEAN_ROW] }]) });
    expect(templates[0].match).toEqual({
      activitySlug: 'earthworks_general',
      foldConfidence: 'exact',
      resolvedBy: 'source_column',
    });
  });

  it('flags a family-level activity fold as needing review but still applies it', () => {
    const { dryRun, templates } = run({
      grid: grid([
        { name: 'ITP-02', rows: [['Drainage', 'Inspect bedding', 'Compacted', 'H', '', '']] },
      ]),
    });
    expect(dryRun.counts.needsReview).toBe(1);
    expect(dryRun.counts.ambiguous).toBe(1);
    expect(dryRun.rows[0].reason).toBe('ambiguous_activity');
    expect(dryRun.canApply).toBe(true);
    expect(templates).toHaveLength(1);
  });
});

describe('[WBR2-10](d) unresolvable activities cannot be applied', () => {
  it('blocks a row whose activity folds to none — never defaults it', () => {
    const { dryRun, templates } = run({
      grid: grid([
        {
          name: 'ITP-03',
          rows: [['Kerb & Gutter Works', 'Check line', 'Within 10 mm', 'W', '', '']],
        },
      ]),
    });

    expect(dryRun.counts.blocked).toBe(1);
    expect(dryRun.rows[0].reason).toBe('unresolvable_activity');
    expect(dryRun.canApply).toBe(false);
    expect(templates).toHaveLength(0);
    // Explicitly NOT the shipped CSV importer's earthworks_general fallback.
    expect(JSON.stringify(dryRun)).not.toContain('earthworks_general');
  });

  it('applies once the reviewer resolves it to a real slug', () => {
    const sheets = grid([
      {
        name: 'ITP-03',
        rows: [['Kerb & Gutter Works', 'Check line', 'Within 10 mm', 'W', '', '']],
      },
    ]);
    const { dryRun, templates } = run({
      grid: sheets,
      resolutions: { 'ITP-03::ITP-03': { activitySlug: 'kerb_channel' } },
    });

    expect(dryRun.counts.blocked).toBe(0);
    expect(templates[0].activityType).toBe('kerb_channel');
    expect(templates[0].match.resolvedBy).toBe('reviewer');
  });

  it('lets the reviewer skip it instead', () => {
    const { dryRun, templates } = run({
      grid: grid([
        { name: 'ITP-03', rows: [['Kerb & Gutter Works', 'Check line', 'x', 'W', '', '']] },
        { name: 'ITP-01', rows: [CLEAN_ROW] },
      ]),
      resolutions: { 'ITP-03::ITP-03': { skip: true } },
    });
    expect(dryRun.counts.blocked).toBe(0);
    expect(dryRun.counts.willSkip).toBe(1);
    expect(templates).toHaveLength(1);
  });
});

describe('[WBR2-10](c) over-length cells are blocked, never truncated', () => {
  it('blocks a 1200-character description with the real length and cap', () => {
    const long = 'x'.repeat(1200);
    const { dryRun, templates } = run({
      grid: grid([{ name: 'ITP-01', rows: [['Earthworks', long, 'crit', 'H', '', '']] }]),
    });

    const rowEntry = dryRun.rows.find((row) => row.unit === 'checklist_row');
    expect(rowEntry?.outcome).toBe('blocked');
    expect(rowEntry?.reason).toBe('over_length');
    expect(rowEntry?.overLength).toEqual({ field: 'description', length: 1200, max: 1000 });
    expect(dryRun.canApply).toBe(false);
    expect(templates).toHaveLength(0);
  });

  it('blocks an over-length acceptanceCriteria the same way', () => {
    const { dryRun } = run({
      grid: grid([
        { name: 'ITP-01', rows: [['Earthworks', 'Item', 'y'.repeat(1500), 'H', '', '']] },
      ]),
    });
    const rowEntry = dryRun.rows.find((row) => row.unit === 'checklist_row');
    expect(rowEntry?.overLength).toEqual({ field: 'acceptanceCriteria', length: 1500, max: 1000 });
  });

  it('never emits a truncated value anywhere in the ledger', () => {
    const long = 'z'.repeat(1200);
    const { dryRun } = run({
      grid: grid([{ name: 'ITP-01', rows: [['Earthworks', long, 'crit', 'H', '', '']] }]),
    });
    expect(JSON.stringify(dryRun)).not.toContain('z'.repeat(1000));
  });

  it('blocks an over-length template name', () => {
    const { dryRun } = run({ grid: grid([{ name: 'N'.repeat(200), rows: [CLEAN_ROW] }]) });
    expect(dryRun.rows[0].outcome).toBe('blocked');
    expect(dryRun.rows[0].overLength).toMatchObject({ field: 'name', length: 200, max: 160 });
  });

  it('lets the reviewer skip just the offending row', () => {
    const { dryRun, templates } = run({
      grid: grid([
        { name: 'ITP-01', rows: [CLEAN_ROW, ['Earthworks', 'x'.repeat(1200), '', 'S', '', '']] },
      ]),
      resolutions: { 'ITP-01::ITP-01': { skipRows: [3] } },
    });
    expect(dryRun.counts.blocked).toBe(0);
    expect(templates[0].checklistItems).toHaveLength(1);
  });
});

describe('[WBR2-5](a) state/spec contradiction', () => {
  const specHeaders = [...HEADERS, 'Spec Set'];
  const specFieldMap = deriveFieldMapFromHeaders(specHeaders, 'itp_template');

  function specRun(resolutions?: DryRunInput['resolutions']) {
    return computeItpImportDryRun({
      grid: {
        sheets: [
          {
            name: 'ITP-01',
            headers: specHeaders,
            rows: [[...CLEAN_ROW, 'MRTS']],
          },
        ],
      },
      fieldMap: specFieldMap,
      projectSpecificationSet: 'TfNSW',
      existingTemplates: [],
      resolutions,
    });
  }

  it('blocks a template declaring MRTS in a TfNSW project', () => {
    const { dryRun, templates } = specRun();
    expect(dryRun.rows[0].outcome).toBe('blocked');
    expect(dryRun.rows[0].reason).toBe('state_spec_conflict');
    expect(dryRun.rows[0].declaredStateSpec).toBe('MRTS');
    expect(templates).toHaveLength(0);
  });

  it('applies once the reviewer affirms the conflict, and marks it affirmed', () => {
    const { dryRun, templates } = specRun({ 'ITP-01::ITP-01': { affirmSpec: true } });
    expect(dryRun.counts.blocked).toBe(0);
    expect(templates[0].specAffirmed).toBe(true);
    expect(templates[0].stateSpec).toBe('MRTS');
  });

  it('treats a blank declared spec as unaffirmed, not as a conflict', () => {
    const { dryRun, templates } = run({ grid: grid([{ name: 'ITP-01', rows: [CLEAN_ROW] }]) });
    expect(dryRun.counts.blocked).toBe(0);
    expect(templates[0].specAffirmed).toBe(false);
  });

  it('folds the rms/TfNSW synonym rather than calling it a conflict', () => {
    const { dryRun } = computeItpImportDryRun({
      grid: { sheets: [{ name: 'ITP-01', headers: specHeaders, rows: [[...CLEAN_ROW, 'rms']] }] },
      fieldMap: specFieldMap,
      projectSpecificationSet: 'TfNSW',
      existingTemplates: [],
    });
    expect(dryRun.counts.blocked).toBe(0);
  });
});

describe('[WBR2-7] intra-batch slug collision', () => {
  it('marks both twins needs_review with mutual collidesWith and blocks apply', () => {
    const { dryRun, templates } = run({
      grid: grid([
        { name: 'Subgrade Preparation', rows: [CLEAN_ROW] },
        { name: 'subgrade preparation', rows: [CLEAN_ROW] },
      ]),
    });

    const twins = dryRun.rows.filter((row) => row.reason === 'slug_collision');
    expect(twins).toHaveLength(2);
    expect(twins[0].collidesWith?.[0]).toEqual(twins[1].rowRef);
    expect(twins[1].collidesWith?.[0]).toEqual(twins[0].rowRef);
    expect(dryRun.canApply).toBe(false);
    expect(templates).toHaveLength(0);
  });

  it('clears once the reviewer skips one twin', () => {
    const { dryRun, templates } = run({
      grid: grid([
        { name: 'Subgrade Preparation', rows: [CLEAN_ROW] },
        { name: 'subgrade preparation', rows: [CLEAN_ROW] },
      ]),
      resolutions: { 'subgrade preparation::subgrade preparation': { skip: true } },
    });
    expect(dryRun.rows.filter((row) => row.reason === 'slug_collision')).toHaveLength(1);
    expect(templates).toHaveLength(0);
    // Still blocked: the surviving twin's key is shared, so the reviewer must
    // rename rather than silently import one of two identically-named ITPs.
    expect(dryRun.canApply).toBe(false);
  });
});

describe('[WBR2-9]/D2 duplicate detection against existing templates', () => {
  it('auto-skips an exact (normalized name, folded slug) match', () => {
    const { dryRun, templates } = run({
      grid: grid([{ name: 'ITP-01 Subgrade', rows: [CLEAN_ROW] }]),
      existingTemplates: [
        { id: 'tpl-1', name: 'itp-01  subgrade', activityType: 'earthworks_general' },
      ],
    });

    expect(dryRun.counts.willSkip).toBe(1);
    expect(dryRun.rows[0].reason).toBe('duplicate');
    expect(dryRun.rows[0].duplicateOf).toEqual({
      model: 'ITPTemplate',
      id: 'tpl-1',
      matchedOn: 'name + activity',
    });
    expect(templates).toHaveLength(0);
  });

  it('still dedups when stateSpec is blank on re-import (the key excludes it)', () => {
    const key = templateDedupKey('ITP-01 Subgrade', 'earthworks_general');
    expect(key).toBe(templateDedupKey('itp-01   subgrade', 'earthworks_general'));
  });

  it('does not dedup a same-named template with a different activity', () => {
    const { dryRun } = run({
      grid: grid([{ name: 'ITP-01', rows: [CLEAN_ROW] }]),
      existingTemplates: [{ id: 'tpl-1', name: 'ITP-01', activityType: 'pipe_drainage' }],
    });
    expect(dryRun.counts.willCreate).toBe(1);
  });
});

describe('mapping and cap failures', () => {
  it('blocks every template on a sheet whose description column is unmapped', () => {
    const { dryRun } = computeItpImportDryRun({
      grid: { sheets: [{ name: 'ITP-01', headers: ['Foo', 'Bar'], rows: [['a', 'b']] }] },
      fieldMap: FIELD_MAP,
      projectSpecificationSet: 'TfNSW',
      existingTemplates: [],
    });
    expect(dryRun.rows[0].outcome).toBe('blocked');
    expect(dryRun.rows[0].reason).toBe('unmapped_column');
  });

  it('reports unmapped columns so the mapping UI can call them out', () => {
    const { dryRun } = run({
      grid: grid([
        { name: 'ITP-01', headers: [...HEADERS, 'Frequency'], rows: [[...CLEAN_ROW, '1 per lot']] },
      ]),
    });
    expect(dryRun.unmappedHeaders[0]).toEqual({ sheet: 'ITP-01', headers: ['Frequency'] });
  });

  it('rejects a file past the template cap with a split-the-file message', () => {
    const sheets = Array.from({ length: MAX_IMPORT_TEMPLATES_PER_BATCH + 1 }, (_, i) => ({
      name: `ITP-${i}`,
      rows: [CLEAN_ROW],
    }));
    expect(() => run({ grid: grid(sheets) })).toThrow(/Split it into smaller files/);
  });

  it('rejects a file past the checklist-item cap', () => {
    const rows = Array.from({ length: 5_001 }, (_, i) => [
      'Earthworks',
      `Item ${i}`,
      '',
      'S',
      '',
      '',
    ]);
    expect(() => run({ grid: grid([{ name: 'Big', rows }]) })).toThrow(AppError);
  });

  it('skips a template with no usable checklist rows', () => {
    const { dryRun } = run({
      grid: grid([{ name: 'ITP-01', rows: [['Earthworks', '', '', '', '', '']] }]),
    });
    expect(dryRun.rows[0].outcome).toBe('skip');
    expect(dryRun.rows[0].reason).toBe('empty');
  });

  it('groups by a mapped template-name column when the sheet holds several ITPs', () => {
    const headers = ['ITP', ...HEADERS];
    const { templates } = computeItpImportDryRun({
      grid: {
        sheets: [
          {
            name: 'All ITPs',
            headers,
            rows: [
              ['Subgrade ITP', ...CLEAN_ROW],
              ['Subgrade ITP', 'Earthworks', 'Survey', 'x', 'S', '', ''],
              ['Drainage ITP', 'Drainage', 'Bedding', 'y', 'H', '', ''],
            ],
          },
        ],
      },
      fieldMap: deriveFieldMapFromHeaders(headers, 'itp_template'),
      projectSpecificationSet: 'TfNSW',
      existingTemplates: [],
    });

    expect(templates.map((template) => template.name).sort()).toEqual([
      'Drainage ITP',
      'Subgrade ITP',
    ]);
  });
});
