import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildSeederNameMap,
  computeRetagPlan,
  computeSeededRetagPlan,
  extractSeederTemplateTags,
  type TemplateRow,
} from './activityRetag.js';

function row(partial: Partial<TemplateRow> & { activityType: string | null }): TemplateRow {
  return { id: 'id', name: 'name', projectId: null, ...partial };
}

describe('computeRetagPlan', () => {
  it('re-tags only exact folds that differ from the stored value', () => {
    const rows = [
      row({ id: '1', name: 'Earthworks', activityType: 'earthworks' }), // exact -> change
      row({ id: '2', name: 'Austroads Concrete', activityType: 'concrete' }), // exact -> change
      row({ id: '3', name: 'NSW Prime', activityType: 'asphalt_prep' }), // exact -> change
    ];
    const { actions, skipped } = computeRetagPlan(rows);
    expect(skipped).toBe(0);
    expect(actions).toEqual([
      {
        id: '1',
        name: 'Earthworks',
        projectId: null,
        from: 'earthworks',
        to: 'earthworks_general',
      },
      {
        id: '2',
        name: 'Austroads Concrete',
        projectId: null,
        from: 'concrete',
        to: 'structural_concrete',
      },
      { id: '3', name: 'NSW Prime', projectId: null, from: 'asphalt_prep', to: 'prime_primerseal' },
    ]);
  });

  it('never touches family-level, unclassifiable, empty, or null values', () => {
    const rows = [
      row({ activityType: 'drainage' }), // family — needs the name to disambiguate
      row({ activityType: 'structural' }), // family
      row({ activityType: 'pavements' }), // family
      row({ activityType: 'Concrete' }), // retired -> none
      row({ activityType: '' }),
      row({ activityType: null }),
      row({ activityType: 'totally unknown' }),
    ];
    const { actions, skipped } = computeRetagPlan(rows);
    expect(actions).toEqual([]);
    expect(skipped).toBe(rows.length);
  });

  it('skips rows already on a canonical slug (no no-op writes)', () => {
    const rows = [
      row({ activityType: 'culverts' }),
      row({ activityType: 'pavement_unbound' }),
      row({ activityType: 'structural_concrete' }),
    ];
    expect(computeRetagPlan(rows).actions).toEqual([]);
  });

  it('preserves projectId scope on custom (project-scoped) templates', () => {
    const rows = [
      row({ id: 'c1', name: 'Custom', projectId: 'proj-9', activityType: 'earthworks' }),
    ];
    expect(computeRetagPlan(rows).actions[0]).toMatchObject({
      projectId: 'proj-9',
      to: 'earthworks_general',
    });
  });
});

describe('extractSeederTemplateTags', () => {
  const SAMPLE = [
    'const t1 = {',
    "  name: 'Pipe Installation (Stormwater/Drainage)',",
    "  description: 'TfNSW drainage pipe installation per R11',",
    "  activityType: 'pipe_drainage',",
    '};',
    'const t2 = {',
    "  name: 'Box Culvert Construction',",
    "  description: 'TfNSW box culverts',",
    "  activityType: 'culverts',",
    '};',
    'const template = await prisma.iTPTemplate.create({',
    '  data: { name: templateFields.name },',
    '});',
  ].join('\n');

  it('extracts each template name/slug pair and ignores non-literal name refs', () => {
    expect(extractSeederTemplateTags(SAMPLE, 'sample.js')).toEqual([
      { name: 'Pipe Installation (Stormwater/Drainage)', activityType: 'pipe_drainage' },
      { name: 'Box Culvert Construction', activityType: 'culverts' },
    ]);
  });

  it('skips deliberate family-level tags without producing a pair', () => {
    const mixed = [
      "name: 'Warm Mix / Recycled Asphalt',",
      "  description: 'spans asphalt types',",
      "  activityType: 'asphalt',",
      "name: 'Box Culvert Construction',",
      "  activityType: 'culverts',",
    ].join('\n');
    expect(extractSeederTemplateTags(mixed, 'mixed.js')).toEqual([
      { name: 'Box Culvert Construction', activityType: 'culverts' },
    ]);
  });

  it('throws on an unknown activityType', () => {
    const bad = "name: 'X',\n  activityType: 'bitumen_stuff',";
    expect(() => extractSeederTemplateTags(bad, 'bad.js')).toThrow(/unknown activityType/);
  });

  it('throws when no pairs are found (shape drift guard)', () => {
    expect(() => extractSeederTemplateTags('const x = 1;', 'empty.js')).toThrow(/no template/);
  });

  it('parses every real seeder file and finds only canonical slugs', () => {
    const dir = join(__dirname, '..', '..', 'scripts', 'seeds', 'itp-templates');
    const files = readdirSync(dir).filter(
      (f) => f.startsWith('seed-itp-templates') && f.endsWith('.js'),
    );
    expect(files.length).toBeGreaterThanOrEqual(27);
    const tagsByFile = files.map((f) =>
      extractSeederTemplateTags(readFileSync(join(dir, f), 'utf8'), f),
    );
    const map = buildSeederNameMap(tagsByFile); // also asserts name uniqueness
    expect(map.size).toBeGreaterThanOrEqual(100);
  });
});

describe('buildSeederNameMap', () => {
  it('merges files and rejects one name with two different slugs', () => {
    const a = [{ name: 'X', activityType: 'culverts' }];
    const b = [{ name: 'X', activityType: 'pipe_drainage' }];
    expect(() => buildSeederNameMap([a, b])).toThrow(/maps to both/);
    expect(buildSeederNameMap([a, a]).get('X')).toBe('culverts');
  });
});

describe('computeSeededRetagPlan', () => {
  const nameMap = new Map([
    ['Box Culvert Construction', 'culverts'],
    ['Subsoil Drainage', 'subsoil_drainage'],
  ]);

  it('re-tags global rows by name, skipping project copies and canonical values', () => {
    const rows = [
      row({ id: 'g1', name: 'Box Culvert Construction', activityType: 'drainage' }),
      row({
        id: 'p1',
        name: 'Box Culvert Construction',
        projectId: 'proj-1',
        activityType: 'drainage',
      }),
      row({ id: 'g2', name: 'Subsoil Drainage', activityType: 'pipe_drainage' }), // canonical — deliberate, keep
      row({ id: 'g3', name: 'Unknown Template', activityType: 'drainage' }), // not seeded — keep
      row({ id: 'g4', name: 'Box Culvert Construction', activityType: 'culverts' }), // already right
    ];
    const { actions, skipped } = computeSeededRetagPlan(rows, nameMap);
    expect(actions).toEqual([
      {
        id: 'g1',
        name: 'Box Culvert Construction',
        projectId: null,
        from: 'drainage',
        to: 'culverts',
      },
    ]);
    expect(skipped).toBe(4);
  });
});
