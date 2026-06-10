/**
 * Unit tests for the "copy from yesterday" pure helper functions.
 *
 * Covers:
 *  - mapPersonnelEntryToPayload: Prisma-Decimal string hours → number,
 *    null hours omitted, all optional fields forwarded when present.
 *  - mapPlantEntryToPayload: same hours coercion, optional fields forwarded.
 *  - dedupePersonnel: skips names already on today's diary (case-insensitive).
 *  - dedupePlant: skips descriptions already on today's diary (case-insensitive).
 */

import { describe, expect, it } from 'vitest';
import {
  mapPersonnelEntryToPayload,
  mapPlantEntryToPayload,
  dedupePersonnel,
  dedupePlant,
} from './useCopyFromYesterday';
import type { Personnel, Plant } from '../types';

// ---- mapPersonnelEntryToPayload ----

describe('mapPersonnelEntryToPayload', () => {
  it('forwards name and all optional fields when present', () => {
    const result = mapPersonnelEntryToPayload({
      name: 'Alice',
      company: 'Acme',
      role: 'Labourer',
      startTime: '07:00',
      finishTime: '15:30',
      hours: 8.5,
    });
    expect(result).toEqual({
      name: 'Alice',
      company: 'Acme',
      role: 'Labourer',
      startTime: '07:00',
      finishTime: '15:30',
      hours: 8.5,
    });
  });

  it('coerces a Prisma-Decimal string hours to a number', () => {
    const result = mapPersonnelEntryToPayload({ name: 'Bob', hours: '8.5' });
    expect(result.hours).toBe(8.5);
    expect(typeof result.hours).toBe('number');
  });

  it('omits hours when null', () => {
    const result = mapPersonnelEntryToPayload({ name: 'Carol', hours: null });
    expect('hours' in result).toBe(false);
  });

  it('omits hours when undefined', () => {
    const result = mapPersonnelEntryToPayload({ name: 'Dave' });
    expect('hours' in result).toBe(false);
  });

  it('omits optional string fields when null or empty', () => {
    const result = mapPersonnelEntryToPayload({
      name: 'Eve',
      company: null,
      role: undefined,
      startTime: null,
      finishTime: null,
    });
    expect('company' in result).toBe(false);
    expect('role' in result).toBe(false);
    expect('startTime' in result).toBe(false);
    expect('finishTime' in result).toBe(false);
  });
});

// ---- mapPlantEntryToPayload ----

describe('mapPlantEntryToPayload', () => {
  it('forwards description and all optional fields when present', () => {
    const result = mapPlantEntryToPayload({
      description: 'Excavator CAT 320',
      idRego: 'AB1234',
      company: 'Hire Co',
      hoursOperated: 6,
      notes: 'GPS fitted',
    });
    expect(result).toEqual({
      description: 'Excavator CAT 320',
      idRego: 'AB1234',
      company: 'Hire Co',
      hoursOperated: 6,
      notes: 'GPS fitted',
    });
  });

  it('coerces Prisma-Decimal string hoursOperated to a number', () => {
    const result = mapPlantEntryToPayload({ description: 'Grader', hoursOperated: '7.5' });
    expect(result.hoursOperated).toBe(7.5);
    expect(typeof result.hoursOperated).toBe('number');
  });

  it('omits hoursOperated when null', () => {
    const result = mapPlantEntryToPayload({ description: 'Roller', hoursOperated: null });
    expect('hoursOperated' in result).toBe(false);
  });

  it('omits optional string fields when null', () => {
    const result = mapPlantEntryToPayload({
      description: 'Tip truck',
      idRego: null,
      company: null,
      notes: null,
    });
    expect('idRego' in result).toBe(false);
    expect('company' in result).toBe(false);
    expect('notes' in result).toBe(false);
  });
});

// ---- dedupePersonnel ----

function makePersonnel(name: string): Personnel {
  return {
    id: `p-${name}`,
    name,
    createdAt: '2026-06-11T00:00:00.000Z',
  };
}

describe('dedupePersonnel', () => {
  it('returns all entries when today has no personnel', () => {
    const incoming = [{ name: 'Alice' }, { name: 'Bob' }];
    const result = dedupePersonnel(incoming, []);
    expect(result).toHaveLength(2);
  });

  it("filters out entries already present in today's diary", () => {
    const incoming = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }];
    const existing = [makePersonnel('Alice'), makePersonnel('Carol')];
    const result = dedupePersonnel(incoming, existing);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });

  it('dedupes case-insensitively', () => {
    const incoming = [{ name: 'alice' }, { name: 'BOB' }];
    const existing = [makePersonnel('Alice'), makePersonnel('Bob')];
    const result = dedupePersonnel(incoming, existing);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when all incoming are already present', () => {
    const incoming = [{ name: 'Alice' }];
    const existing = [makePersonnel('Alice')];
    expect(dedupePersonnel(incoming, existing)).toHaveLength(0);
  });

  it('handles empty incoming array', () => {
    expect(dedupePersonnel([], [makePersonnel('Alice')])).toHaveLength(0);
  });
});

// ---- dedupePlant ----

function makePlant(description: string): Plant {
  return {
    id: `plant-${description}`,
    description,
    createdAt: '2026-06-11T00:00:00.000Z',
  };
}

describe('dedupePlant', () => {
  it('returns all entries when today has no plant', () => {
    const incoming = [{ description: 'Excavator' }, { description: 'Grader' }];
    expect(dedupePlant(incoming, [])).toHaveLength(2);
  });

  it("filters out plant already present in today's diary", () => {
    const incoming = [
      { description: 'Excavator' },
      { description: 'Grader' },
      { description: 'Roller' },
    ];
    const existing = [makePlant('Excavator'), makePlant('Roller')];
    const result = dedupePlant(incoming, existing);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Grader');
  });

  it('dedupes case-insensitively', () => {
    const incoming = [{ description: 'excavator' }];
    const existing = [makePlant('Excavator')];
    expect(dedupePlant(incoming, existing)).toHaveLength(0);
  });

  it('handles empty incoming array', () => {
    expect(dedupePlant([], [makePlant('Excavator')])).toHaveLength(0);
  });
});
