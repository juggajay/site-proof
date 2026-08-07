import { describe, expect, it } from 'vitest';

import { applyMapUrlState, readMapUrlState } from './mapUrlState';

const base = {
  mode: 'map' as const,
  activeSheetId: null,
  selectedLotId: null,
  historyArmed: false,
  historyDateKey: '2026-08-07',
  todayKey: '2026-08-07',
};

describe('readMapUrlState', () => {
  it('reads valid keys and rejects junk', () => {
    const params = new URLSearchParams('view=plan&sheet=s1&lot=l1&date=2026-08-01');
    expect(readMapUrlState(params)).toEqual({
      view: 'plan',
      sheet: 's1',
      lot: 'l1',
      date: '2026-08-01',
    });
    expect(readMapUrlState(new URLSearchParams('view=3d&date=yesterday'))).toEqual({
      view: null,
      sheet: null,
      lot: null,
      date: null,
    });
  });
});

describe('applyMapUrlState', () => {
  it('writes nothing for the pristine default state (register role-defaults survive)', () => {
    expect(applyMapUrlState(new URLSearchParams(), base).toString()).toBe('');
  });

  it('round-trips plan view + sheet + lot + past date', () => {
    const written = applyMapUrlState(new URLSearchParams(), {
      mode: 'plan',
      activeSheetId: 's1',
      selectedLotId: 'l1',
      historyArmed: true,
      historyDateKey: '2026-08-01',
      todayKey: '2026-08-07',
    });
    expect(readMapUrlState(written)).toEqual({
      view: 'plan',
      sheet: 's1',
      lot: 'l1',
      date: '2026-08-01',
    });
  });

  it('clears its own keys when state returns to default, leaving foreign keys alone', () => {
    const params = new URLSearchParams(
      'status=in_progress&projectId=p1&view=plan&sheet=s1&lot=l1&date=2026-08-01',
    );
    const next = applyMapUrlState(params, base);
    expect(next.get('status')).toBe('in_progress');
    expect(next.get('projectId')).toBe('p1');
    expect(next.get('view')).toBeNull();
    expect(next.get('sheet')).toBeNull();
    expect(next.get('lot')).toBeNull();
    expect(next.get('date')).toBeNull();
  });

  it('omits the date when Past view sits on today', () => {
    const next = applyMapUrlState(new URLSearchParams(), { ...base, historyArmed: true });
    expect(next.get('date')).toBeNull();
  });
});
