import { describe, expect, it } from 'vitest';
import { controlLineFormSchema, parsePastedControlPoints } from './controlPointsParsing';

describe('parsePastedControlPoints', () => {
  it('parses comma-separated rows', () => {
    const result = parsePastedControlPoints('0,500000,6250000\n100,500010,6250100');
    expect(result.ok).toBe(true);
    expect(result.points).toEqual([
      { chainage: 0, easting: 500000, northing: 6250000 },
      { chainage: 100, easting: 500010, northing: 6250100 },
    ]);
  });

  it('parses tab-separated rows', () => {
    const result = parsePastedControlPoints('0\t500000\t6250000\n100\t500010\t6250100');
    expect(result.ok).toBe(true);
    expect(result.points).toHaveLength(2);
    expect(result.points[1]).toEqual({ chainage: 100, easting: 500010, northing: 6250100 });
  });

  it('skips a header row and blank lines', () => {
    const result = parsePastedControlPoints(
      'Chainage,Easting,Northing\n\n0,500000,6250000\n\n100,500010,6250100\n',
    );
    expect(result.ok).toBe(true);
    expect(result.points).toHaveLength(2);
    // The header line is not reported as an error row.
    expect(result.rows).toHaveLength(2);
  });

  it('flags rows that are not fully numeric', () => {
    const result = parsePastedControlPoints('0,500000,6250000\nabc,def,ghi');
    expect(result.ok).toBe(false);
    expect(result.points).toHaveLength(1);
    const badRow = result.rows.find((r) => r.raw === 'abc,def,ghi');
    expect(badRow?.error).toMatch(/Not a number/);
  });

  it('flags rows with too few columns', () => {
    const result = parsePastedControlPoints('0,500000');
    expect(result.ok).toBe(false);
    expect(result.rows[0].error).toMatch(/Needs 3 values/);
  });

  it('strips thousands separators in tab-separated cells', () => {
    // Excel copy is tab-delimited, so comma thousands-separators survive the
    // split and must be stripped before parsing.
    const result = parsePastedControlPoints('0\t500,000\t6,250,000');
    expect(result.ok).toBe(true);
    expect(result.points[0]).toEqual({ chainage: 0, easting: 500000, northing: 6250000 });
  });

  it('returns not-ok for empty input', () => {
    const result = parsePastedControlPoints('   \n  ');
    expect(result.ok).toBe(false);
    expect(result.points).toHaveLength(0);
  });
});

describe('controlLineFormSchema', () => {
  const validPoints = [
    { chainage: 0, easting: 500000, northing: 6250000 },
    { chainage: 100, easting: 500010, northing: 6250100 },
  ];

  it('accepts a valid control line', () => {
    const result = controlLineFormSchema.safeParse({
      name: 'MC00 Mainline',
      coordinateSystem: 'EPSG:7856',
      points: validPoints,
    });
    expect(result.success).toBe(true);
  });

  it('rejects fewer than 2 points', () => {
    const result = controlLineFormSchema.safeParse({
      name: 'MC00',
      coordinateSystem: 'EPSG:7856',
      points: [validPoints[0]],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/At least 2 points/);
    }
  });

  it('rejects non-finite coordinates', () => {
    const result = controlLineFormSchema.safeParse({
      name: 'MC00',
      coordinateSystem: 'EPSG:7856',
      points: [validPoints[0], { chainage: 100, easting: NaN, northing: 6250100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a blank name', () => {
    const result = controlLineFormSchema.safeParse({
      name: '   ',
      coordinateSystem: 'EPSG:7856',
      points: validPoints,
    });
    expect(result.success).toBe(false);
  });
});
