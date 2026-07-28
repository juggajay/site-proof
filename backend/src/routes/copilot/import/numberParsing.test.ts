/**
 * The chainage grammar, exhaustively — what an imported register may say and
 * what it may not. Every REJECTED case below reaches the reviewer as
 * `invalid_value`, so the cost of accepting one wrongly is a lot silently
 * placed on the wrong part of the job.
 */
import { describe, expect, it } from 'vitest';

import { parseChainage, parseNumber } from './numberParsing.js';

describe('parseChainage', () => {
  const accepted: [string, number][] = [
    // Plain metres, the shape the Excel path always carried.
    ['0', 0],
    ['100', 100],
    ['1020', 1_020],
    ['1020.5', 1_020.5],
    ['  1020  ', 1_020],
    // Comma-grouped, as a spreadsheet formats it.
    ['1,020', 1_020],
    ['12,500', 12_500],
    // Stationing — the format the app itself prints.
    ['0+000', 0],
    ['1+020', 1_020],
    ['12+500', 12_500],
    ['1+020.5', 1_020.5],
    ['1,012+500', 1_012_500],
    // …with the printed CH prefix, in the spellings a register uses.
    ['CH 1+020', 1_020],
    ['ch 1+020', 1_020],
    ['Ch. 1+020', 1_020],
    ['CH1+020', 1_020],
    ['ch1+020', 1_020],
    ['CH 100', 100],
    ['CH 1,020', 1_020],
  ];

  it.each(accepted)('reads %j as %d', (raw, expected) => {
    expect(parseChainage(raw)).toBe(expected);
  });

  const rejected = [
    // Ambiguous stationing: is 1+20 metre 120 or metre 1020?
    '1+20',
    '1+2',
    '1+0200',
    '+020',
    '1+',
    '+',
    '1++020',
    '1+020+5',
    // Not a number at all.
    'about 100',
    'CH',
    'ch.',
    'start',
    'N/A',
    '-',
    'CH abc',
    '100m to 200m',
    '1 020',
  ];

  it.each(rejected)('refuses %j', (raw) => {
    expect(parseChainage(raw)).toBeNull();
  });

  it('reads an empty cell as "no chainage", not as zero', () => {
    expect(parseChainage('')).toBeNull();
    expect(parseChainage('   ')).toBeNull();
  });

  it('reads a negative chainage, which some jobs really do set out', () => {
    expect(parseChainage('-50')).toBe(-50);
  });
});

describe('parseNumber', () => {
  it('reads the plain quantities a register carries', () => {
    expect(parseNumber('1200')).toBe(1_200);
    expect(parseNumber('1,200.5')).toBe(1_200.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('lots')).toBeNull();
  });

  // Kept separate from parseChainage on purpose: a quantity of "1+020" is not a
  // quantity, and stationing must not leak into the quantity column.
  it('does not read stationing as a quantity', () => {
    expect(parseNumber('1+020')).toBeNull();
  });
});
