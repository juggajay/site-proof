import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { AI_EXTRACTION_TIMEOUT_MS } from '../testResults/certificateExtraction.js';
import { cleanSetoutCandidate, extractSetoutRawCandidate } from './setoutExtraction.js';

vi.mock('../../lib/fetchWithTimeout.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';

describe('cleanSetoutCandidate', () => {
  it('groups multiple alignments, coercing string numbers and sorting each by chainage', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      alignments: [
        {
          name: 'Weinam Creek Rd',
          points: [
            { chainage: 100, easting: '500100', northing: 6000000 },
            { chainage: '0', easting: 500000, northing: '6000000' },
          ],
        },
        {
          name: 'Boat Harbour Dr',
          coordinateSystem: 'EPSG:7855',
          points: [
            { chainage: 0, easting: 300000, northing: 5800000 },
            { chainage: 60, easting: 300060, northing: 5800000 },
          ],
        },
      ],
    });

    expect(candidate.alignments).toHaveLength(2);
    expect(candidate.alignments[0]).toMatchObject({
      name: 'Weinam Creek Rd',
      // Falls back to the sheet-wide CRS when the alignment gave none.
      coordinateSystem: 'EPSG:7856',
    });
    expect(candidate.alignments[0].points).toEqual([
      { chainage: 0, easting: 500000, northing: 6000000 },
      { chainage: 100, easting: 500100, northing: 6000000 },
    ]);
    // A per-alignment CRS overrides the document default.
    expect(candidate.alignments[1].coordinateSystem).toBe('EPSG:7855');
    expect(candidate.warnings).toEqual([]);
  });

  it('wraps the old flat shape as a single unnamed alignment', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG: 7855 (GDA2020 MGA55)',
      points: [
        { chainage: 0, easting: 300000, northing: 5800000 },
        { chainage: 'CH twenty', easting: 'n/a', northing: 5800000 },
        { chainage: 40, easting: 300040, northing: 5800000 },
      ],
    });

    expect(candidate.alignments).toHaveLength(1);
    const [alignment] = candidate.alignments;
    expect(alignment.name).toBeNull();
    expect(alignment.coordinateSystem).toBe('EPSG:7855');
    expect(alignment.points).toHaveLength(2);
    expect(alignment.warnings.some((w) => /Row 2 dropped/.test(w))).toBe(true);
  });

  it('nulls an unsupported EPSG guess and records a document warning', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:9999',
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
    });

    expect(candidate.alignments[0].coordinateSystem).toBeNull();
    expect(candidate.warnings.some((w) => w.includes('EPSG:9999'))).toBe(true);
  });

  it('leaves coordinateSystem null without warning when the model was unsure', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: null,
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
    });

    expect(candidate.alignments[0].coordinateSystem).toBeNull();
    expect(candidate.warnings).toEqual([]);
  });

  it('drops a sub-2-point alignment into document warnings instead of failing', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      alignments: [
        {
          name: 'Good Rd',
          points: [
            { chainage: 0, easting: 1, northing: 2 },
            { chainage: 5, easting: 3, northing: 4 },
          ],
        },
        { name: 'Stub St', points: [{ chainage: 0, easting: 1, northing: 2 }] },
      ],
    });

    expect(candidate.alignments).toHaveLength(1);
    expect(candidate.alignments[0].name).toBe('Good Rd');
    expect(candidate.warnings.some((w) => /Stub St skipped/.test(w))).toBe(true);
  });

  it('rejects a sheet where NO alignment has at least 2 valid points', () => {
    try {
      cleanSetoutCandidate({ points: [{ chainage: 'x', easting: 'y', northing: 'z' }] });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).details).toMatchObject({ alignments: 0 });
    }

    expect(() =>
      cleanSetoutCandidate({
        alignments: [{ points: [{ chainage: 0, easting: 1, northing: 2 }] }],
      }),
    ).toThrow(AppError);
  });

  it('caps total output at 2000 points across all alignments', () => {
    const makePoints = (count: number, base: number) =>
      Array.from({ length: count }, (_, i) => ({
        chainage: count - i,
        easting: base + i,
        northing: base + i,
      }));
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      alignments: [
        { name: 'A', points: makePoints(1500, 0) },
        { name: 'B', points: makePoints(1000, 100000) },
      ],
    });

    const total = candidate.alignments.reduce((n, a) => n + a.points.length, 0);
    expect(total).toBe(2000);
    expect(candidate.alignments[0].points).toHaveLength(1500);
    // sorted ascending within the alignment: first kept point is the lowest chainage
    expect(candidate.alignments[0].points[0].chainage).toBe(1);
    // B is trimmed to the remaining 500 and warns.
    expect(candidate.alignments[1].points).toHaveLength(500);
    expect(candidate.alignments[1].warnings.some((w) => w.includes('2000'))).toBe(true);
  });

  it('passes through model-supplied warnings and tolerates a garbage root', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
      warnings: ['title block partly obscured'],
    });
    expect(candidate.warnings).toContain('title block partly obscured');

    expect(() => cleanSetoutCandidate('not-an-object')).toThrow(AppError);
    expect(() => cleanSetoutCandidate(null)).toThrow(AppError);
  });
});

describe('extractSetoutRawCandidate', () => {
  const file = {
    buffer: Buffer.from('%PDF-fake'),
    mimetype: 'application/pdf',
    originalname: 'setout.pdf',
  } as Express.Multer.File;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    vi.mocked(fetchWithTimeout).mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('calls Anthropic with the long AI-extraction timeout, not the 15 s default', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"coordinateSystem":null,"points":[],"warnings":[]}' }],
      }),
    } as unknown as Response);

    await extractSetoutRawCandidate(file);

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, , timeoutMs] = vi.mocked(fetchWithTimeout).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    // A vision read of an A1 sheet takes 20-60 s; the default 15 s aborted
    // every real call (prod incident 2026-07-15).
    expect(timeoutMs).toBe(AI_EXTRACTION_TIMEOUT_MS);
    expect(AI_EXTRACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('maps a fetch abort/failure to the 502 AI_REQUEST_FAILED contract', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('Fetch timed out after 120000ms'));

    await expect(extractSetoutRawCandidate(file)).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_REQUEST_FAILED',
    });
  });
});
