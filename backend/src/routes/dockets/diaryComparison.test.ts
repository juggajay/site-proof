import { describe, expect, it } from 'vitest';
import { buildDocketDiaryComparison } from './diaryComparison.js';

// Pure comparison/presentation helper — characterized with plain object
// fixtures, no DB. Types are derived from the helper signature so the test
// stays in lockstep with the structural input shapes.
type Docket = Parameters<typeof buildDocketDiaryComparison>[0];
type Diary = NonNullable<Parameters<typeof buildDocketDiaryComparison>[1]>;

const rows = (n: number): unknown[] => Array.from({ length: n }, (_, i) => ({ i }));

const makeDocket = (labour: number, plant: number): Docket => ({
  labourEntries: rows(labour),
  plantEntries: rows(plant),
});

const makeDiary = (overrides: Partial<Diary> = {}): Diary => ({
  id: 'diary-1',
  date: new Date('2026-06-01T00:00:00.000Z'),
  status: 'submitted',
  weatherConditions: 'Fine',
  personnel: [],
  plant: [],
  activities: [],
  delays: [],
  ...overrides,
});

describe('buildDocketDiaryComparison (pure, DB-free)', () => {
  it('returns foremanDiary null and no discrepancies when there is no diary', () => {
    const result = buildDocketDiaryComparison(makeDocket(2, 1), null);
    expect(result.foremanDiary).toBeNull();
    expect(result.discrepancies).toEqual([]);
  });

  it('summarizes the diary into the foremanDiary response object', () => {
    const diary = makeDiary({
      id: 'd-9',
      date: new Date('2026-03-04T10:00:00.000Z'),
      status: 'draft',
      weatherConditions: 'Rain',
      personnel: rows(3),
      plant: rows(2),
      activities: rows(5),
      delays: [
        { delayType: 'weather', durationHours: 2 },
        { delayType: 'weather', durationHours: 1.5 },
        { delayType: 'breakdown', durationHours: 4 }, // excluded from weather total
      ],
    });

    const { foremanDiary } = buildDocketDiaryComparison(makeDocket(3, 2), diary);

    expect(foremanDiary).toEqual({
      id: 'd-9',
      date: '2026-03-04', // formatDocketDate -> ISO date part
      status: 'draft',
      personnelCount: 3,
      plantCount: 2,
      weatherConditions: 'Rain',
      weatherHoursLost: 3.5, // only the two 'weather' delays
      activitiesCount: 5,
    });
  });

  it('produces no discrepancies when counts match and there is no weather delay', () => {
    const diary = makeDiary({ personnel: rows(2), plant: rows(1), delays: [] });
    const { discrepancies } = buildDocketDiaryComparison(makeDocket(2, 1), diary);
    expect(discrepancies).toEqual([]);
  });

  it('flags personnel and plant count mismatches with the exact messages', () => {
    const diary = makeDiary({ personnel: rows(2), plant: rows(5) });
    const { discrepancies } = buildDocketDiaryComparison(makeDocket(3, 2), diary);
    expect(discrepancies).toEqual([
      'Personnel count may differ: docket has 3 entries, diary has 2',
      'Plant/equipment count may differ: docket has 2 entries, diary has 5',
    ]);
  });

  it('does not flag count discrepancies when the docket has zero entries', () => {
    // The `docketCount > 0` guard suppresses noise for empty dockets.
    const diary = makeDiary({ personnel: rows(4), plant: rows(3) });
    const { discrepancies } = buildDocketDiaryComparison(makeDocket(0, 0), diary);
    expect(discrepancies).toEqual([]);
  });

  it('flags weather hours lost with the exact message and summary field', () => {
    const diary = makeDiary({
      personnel: rows(2),
      plant: rows(1),
      delays: [{ delayType: 'weather', durationHours: 4 }],
    });
    const { foremanDiary, discrepancies } = buildDocketDiaryComparison(makeDocket(2, 1), diary);
    expect(foremanDiary?.weatherHoursLost).toBe(4);
    expect(discrepancies).toEqual(['Weather hours lost noted in diary: 4 hours']);
  });

  it('coerces null weather-delay durations to 0', () => {
    const diary = makeDiary({
      personnel: rows(1),
      plant: rows(1),
      delays: [
        { delayType: 'weather', durationHours: null },
        { delayType: 'weather', durationHours: 2 },
      ],
    });
    const { foremanDiary, discrepancies } = buildDocketDiaryComparison(makeDocket(1, 1), diary);
    expect(foremanDiary?.weatherHoursLost).toBe(2);
    expect(discrepancies).toEqual(['Weather hours lost noted in diary: 2 hours']);
  });
});
