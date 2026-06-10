import { describe, expect, it } from 'vitest';
import { addBusinessDays } from './utils';
import { isSopaNonWorkingDay } from './sopaBusinessDays';

// Dates are constructed with local parts (new Date(y, m0, d)) so the assertions
// are timezone-stable — the engine advances the date with local getDate().

describe('isSopaNonWorkingDay', () => {
  it('treats weekends as non-working regardless of state', () => {
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4))).toBe(true); // Sat 4 Apr 2026
    expect(isSopaNonWorkingDay(new Date(2026, 3, 5))).toBe(true); // Sun 5 Apr 2026
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4), 'NSW')).toBe(true);
  });

  it('only applies public holidays when a state is supplied', () => {
    const christmasDay = new Date(2026, 11, 25); // Fri 25 Dec 2026 (a weekday)
    expect(isSopaNonWorkingDay(christmasDay)).toBe(false); // weekends-only mode
    expect(isSopaNonWorkingDay(christmasDay, 'NSW')).toBe(true); // national holiday
    expect(isSopaNonWorkingDay(christmasDay, 'WA')).toBe(true);
  });

  it('applies the statutory Christmas window per state (NSW 27–31; QLD 22 Dec–10 Jan)', () => {
    // 29 Dec 2026 (Tue): inside NSW's 27–31 window AND QLD's 22 Dec–10 Jan window.
    expect(isSopaNonWorkingDay(new Date(2026, 11, 29), 'NSW')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 11, 29), 'QLD')).toBe(true);
    // 23 Dec 2026 (Wed): inside QLD's window but BEFORE NSW's 27th.
    expect(isSopaNonWorkingDay(new Date(2026, 11, 23), 'QLD')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 11, 23), 'NSW')).toBe(false);
    // 7 Jan 2027 (Thu): inside QLD's wrapped window; NSW's window has ended.
    expect(isSopaNonWorkingDay(new Date(2027, 0, 7), 'QLD')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2027, 0, 7), 'NSW')).toBe(false);
  });

  it('applies the WA Christmas window (verified 22 Dec–10 Jan) but not to unknown states', () => {
    // 29 Dec 2026 (Tue) is inside WA's window (same range as QLD/VIC).
    expect(isSopaNonWorkingDay(new Date(2026, 11, 29), 'WA')).toBe(true);
    // An unrecognised state still gets weekends only — 29 Dec is a working day.
    expect(isSopaNonWorkingDay(new Date(2026, 11, 29), 'ZZ')).toBe(false);
  });
});

describe('addBusinessDays with a state calendar', () => {
  it('skips national public holidays (Easter) for a state but not in weekends-only mode', () => {
    const thursBeforeEaster = new Date(2026, 3, 2); // Thu 2 Apr 2026
    // Weekends-only: next business day is Fri 3 Apr.
    const plain = addBusinessDays(thursBeforeEaster, 1);
    expect(plain.getFullYear()).toBe(2026);
    expect(plain.getMonth()).toBe(3);
    expect(plain.getDate()).toBe(3);
    // NSW: 3 Apr is Good Friday and 6 Apr is Easter Monday, so +1 BD lands Tue 7 Apr.
    const nsw = addBusinessDays(thursBeforeEaster, 1, 'NSW');
    expect(nsw.getMonth()).toBe(3);
    expect(nsw.getDate()).toBe(7);
  });

  it('skips the whole QLD 22 Dec–10 Jan window, landing in the new year', () => {
    const monDec21 = new Date(2026, 11, 21); // Mon 21 Dec 2026
    // NSW window starts on the 27th, so +1 BD is just Tue 22 Dec.
    const nsw = addBusinessDays(monDec21, 1, 'NSW');
    expect(nsw.getFullYear()).toBe(2026);
    expect(nsw.getDate()).toBe(22);
    // QLD window covers 22 Dec–10 Jan, so +1 BD jumps to Mon 11 Jan 2027.
    const qld = addBusinessDays(monDec21, 1, 'QLD');
    expect(qld.getFullYear()).toBe(2027);
    expect(qld.getMonth()).toBe(0);
    expect(qld.getDate()).toBe(11);
  });

  it('extends WA across the 22 Dec–10 Jan window, identical to QLD', () => {
    const monDec21 = new Date(2026, 11, 21);
    // WA's window (verified same as QLD) pushes +1 BD to Mon 11 Jan 2027.
    const wa = addBusinessDays(monDec21, 1, 'WA');
    const qld = addBusinessDays(monDec21, 1, 'QLD');
    expect(wa.getFullYear()).toBe(2027);
    expect(wa.getMonth()).toBe(qld.getMonth());
    expect(wa.getDate()).toBe(qld.getDate());
  });
});
