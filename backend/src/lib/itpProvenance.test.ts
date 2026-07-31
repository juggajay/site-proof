/**
 * Wave G G2 §2.4 AT-G8 — the seeded library's provenance matches the seeder
 * header comment it was read from.
 *
 * Asserted by TEXT PARSE of the seeder files, never by importing one. Importing
 * a seeder connects to `DATABASE_URL`, takes an advisory lock and writes global
 * ITP templates — which for an agent with `backend/.env` loaded is Railway
 * production (spec §7 row 9). `verify-marketing-claims.mjs` reads them the same
 * way and for the same reason.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_BY_STATE_SPEC,
  TEMPLATE_PROVENANCE,
  provenanceFor,
} from '../../scripts/seeds/itp-templates/provenance.mjs';
import {
  ITP_PROVENANCE_FIELDS,
  itpProvenanceEnabled,
  withProvenanceVisibility,
} from './itpProvenance.js';

const SEED_DIR = join(process.cwd(), 'scripts/seeds/itp-templates');

/** Every `(stateSpec, name)` pair the 40 seeders declare, by text parse. */
function readSeededTemplates(): { file: string; name: string; stateSpec: string }[] {
  const templates: { file: string; name: string; stateSpec: string }[] = [];
  const files = readdirSync(SEED_DIR).filter(
    (file) => file.startsWith('seed-itp-templates-') && file.endsWith('.js'),
  );

  for (const file of files) {
    const source = readFileSync(join(SEED_DIR, file), 'utf8');
    // A template literal is a two-space-indented `name:` followed, within the
    // same object, by a two-space-indented `stateSpec:`. Same indentation
    // anchor `verify-marketing-claims.mjs` counts `activityType:` with.
    const blocks = source.split(/^ {2}name: /gm).slice(1);
    for (const block of blocks) {
      const name = /^'((?:[^'\\]|\\.)*)'/.exec(block)?.[1];
      const stateSpec = /^ {2}stateSpec: '([^']+)'/m.exec(block)?.[1];
      if (name && stateSpec) {
        templates.push({ file, name: name.replace(/\\'/g, "'"), stateSpec });
      }
    }
  }
  return templates;
}

const seededTemplates = readSeededTemplates();

describe('AT-G8 ITP library provenance', () => {
  it('AT-G8 parses all 152 seeded templates across the 7 jurisdiction groups', () => {
    expect(seededTemplates).toHaveLength(152);
    expect(new Set(seededTemplates.map((t) => t.stateSpec))).toEqual(
      new Set(Object.keys(AUTHORITY_BY_STATE_SPEC)),
    );
  });

  it('AT-G8 gives every seeded template an authority — one per jurisdiction group', () => {
    const groups = new Map<string, string>();
    for (const template of seededTemplates) {
      const { authority } = provenanceFor(template.name, template.stateSpec);
      expect(authority, `${template.stateSpec}::${template.name}`).toBeTruthy();
      groups.set(template.stateSpec, authority!);
    }
    expect(groups.size).toBe(8);
  });

  it('AT-G8 exposes the spec edition and issue date its seeder header states', () => {
    // One assertion per jurisdiction group that states an edition. The groups
    // whose headers name a specification WITHOUT an edition are covered by the
    // "never fabricated" test below, not by an invented value here.
    const cases: [string, string, string | null][] = [
      ['MRWA::Concrete for Structures (MRWA Spec 820)', '04/10134', '2025-08-29T00:00:00.000Z'],
      ['MRWA::Steel Reinforcement (MRWA Spec 822)', '04/10136', '2023-06-21T00:00:00.000Z'],
      ['MRWA::Earthworks (MRWA Spec 302)', '04/10099-03', '2024-06-28T00:00:00.000Z'],
      ['TfNSW::Earthworks', 'Ed 6 / Rev 0', null],
      ['MRTS::Earthworks', 'March 2025', null],
      [
        'DIT::Sprayed Bituminous Surfacing (DIT RD-BP-D2)',
        'Document Version 1',
        '2024-09-30T00:00:00.000Z',
      ],
      ['VicRoads::Dense Graded Asphalt DGA (VIC)', 'v17', '2023-07-14T00:00:00.000Z'],
      [
        'AUS-SPEC::Concrete Flatwork — Footpaths and Cycleways (AUS-SPEC 0282)',
        'NATSPEC base Oct 2020; MidCoast Council NSW adoption Rev 0',
        '2020-12-14T00:00:00.000Z',
      ],
    ];

    for (const [key, specEdition, specIssuedOn] of cases) {
      const [stateSpec, ...rest] = key.split('::');
      const provenance = provenanceFor(rest.join('::'), stateSpec);
      expect(provenance.specEdition, key).toBe(specEdition);
      expect(provenance.specIssuedOn?.toISOString() ?? null, key).toBe(specIssuedOn);
    }
  });

  it('AT-G8 keys every provenance entry to a template that actually exists', () => {
    const seededKeys = new Set(seededTemplates.map((t) => `${t.stateSpec}::${t.name}`));
    const orphans = Object.keys(TEMPLATE_PROVENANCE).filter((key) => !seededKeys.has(key));
    expect(orphans).toEqual([]);
  });

  it('AT-G8 cites a seeder file for every provenance entry', () => {
    for (const [key, entry] of Object.entries(TEMPLATE_PROVENANCE)) {
      expect(entry.source, key).toMatch(/^seed-itp-templates-[a-z-]+\.js:[\d,]+$/);
    }
  });

  it('AT-G8 never fabricates an edition for a template whose header states none', () => {
    // The Austroads baselines cite guidelines and Australian Standards, not a
    // dated edition. A null here is the honest answer, and the test exists so a
    // later pass cannot quietly fill it in.
    const austroads = seededTemplates.filter((t) => t.stateSpec === 'Austroads');
    expect(austroads.length).toBeGreaterThan(0);
    for (const template of austroads) {
      const provenance = provenanceFor(template.name, template.stateSpec);
      expect(provenance.specEdition, template.name).toBeNull();
      expect(provenance.specIssuedOn, template.name).toBeNull();
    }
  });

  it('AT-G8 flags an annexure dependency only where the seeder says so', () => {
    const flagged = seededTemplates.filter(
      (t) => provenanceFor(t.name, t.stateSpec).annexureWarning,
    );
    expect(flagged.map((t) => `${t.stateSpec}::${t.name}`).sort()).toEqual([
      'MRWA::Prime and Primerseal (MRWA Spec 503)',
      'MRWA::Sprayed Bituminous Surfacing (MRWA Spec 503)',
      'WSA::Gravity Sewer Reticulation (WSA 02)',
      'WSA::Water Supply Reticulation (WSA 03)',
    ]);
  });
});

describe('ITP_PROVENANCE_ENABLED', () => {
  it('is opt-in: unset, empty and unrecognised values all read as off', () => {
    const original = process.env.ITP_PROVENANCE_ENABLED;
    try {
      for (const value of [undefined, '', 'off', 'FALSE', 'no', '0']) {
        if (value === undefined) delete process.env.ITP_PROVENANCE_ENABLED;
        else process.env.ITP_PROVENANCE_ENABLED = value;
        expect(itpProvenanceEnabled(), String(value)).toBe(false);
      }
      for (const value of ['true', 'TRUE', ' 1 ', 'yes']) {
        process.env.ITP_PROVENANCE_ENABLED = value;
        expect(itpProvenanceEnabled(), value).toBe(true);
      }
    } finally {
      if (original === undefined) delete process.env.ITP_PROVENANCE_ENABLED;
      else process.env.ITP_PROVENANCE_ENABLED = original;
    }
  });

  it('strips provenance from template responses while off, and keeps the rest intact', () => {
    const original = process.env.ITP_PROVENANCE_ENABLED;
    const template = {
      id: 't1',
      name: 'Earthworks',
      authority: 'MRWA',
      specEdition: '04/10099-03',
      supersededById: null,
      annexureWarning: true,
      checklistItems: [],
    };
    try {
      delete process.env.ITP_PROVENANCE_ENABLED;
      const off = withProvenanceVisibility(template) as Record<string, unknown>;
      for (const field of ITP_PROVENANCE_FIELDS) {
        expect(off).not.toHaveProperty(field);
      }
      expect(off.id).toBe('t1');
      expect(off.name).toBe('Earthworks');
      expect(off.checklistItems).toEqual([]);

      process.env.ITP_PROVENANCE_ENABLED = 'true';
      expect(withProvenanceVisibility(template)).toBe(template);
    } finally {
      if (original === undefined) delete process.env.ITP_PROVENANCE_ENABLED;
      else process.env.ITP_PROVENANCE_ENABLED = original;
    }
  });
});
