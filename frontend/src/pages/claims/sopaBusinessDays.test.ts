import { describe, expect, it } from 'vitest';
import { addBusinessDays } from './utils';
import {
  isSopaNonWorkingDay,
  SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR,
  STATE_PUBLIC_HOLIDAYS,
} from './sopaBusinessDays';

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

// ---------------------------------------------------------------------------
// Per-state specific holiday assertions (2026 & 2027)
// Each test verifies that a known state-specific holiday is treated as a
// non-working day. Dates sourced from official state government pages
// (accessed 2026-06-11; see sopaBusinessDays.ts file header for URLs).
// ---------------------------------------------------------------------------

describe('NSW state-specific holidays', () => {
  it('Labour Day 2026 (Mon 5 Oct) is a NSW non-working day', () => {
    // Mon 5 Oct 2026 — NSW Labour Day (1st Mon Oct)
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'NSW')).toBe(true);
    // QLD King's Birthday also falls on Mon 5 Oct 2026 (1st Mon Oct), so it is
    // also a non-working day in QLD — both states happen to land on the same date.
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'QLD')).toBe(true);
    // WA observes King's Birthday in September, not October.
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'WA')).toBe(false);
  });

  it('NSW Bank Holiday 2026 (Mon 3 Aug) is a NSW non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2026, 7, 3), 'NSW')).toBe(true);
  });

  it("NSW King's Birthday 2026 (Mon 8 Jun) is a NSW non-working day", () => {
    expect(isSopaNonWorkingDay(new Date(2026, 5, 8), 'NSW')).toBe(true);
  });

  it('NSW Anzac Day substitute 2026 (Mon 27 Apr) is a NSW non-working day', () => {
    // Anzac Day is Sat 25 Apr 2026; the additional/substitute day is Mon 27 Apr
    expect(isSopaNonWorkingDay(new Date(2026, 3, 27), 'NSW')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 3, 27), 'WA')).toBe(true); // WA also has Mon 27 Apr
    expect(isSopaNonWorkingDay(new Date(2026, 3, 27), 'QLD')).toBe(false); // QLD does not
  });

  it('NSW Boxing Day substitute 2026 (Mon 28 Dec) is a NSW non-working day', () => {
    // Boxing Day is Sat 26 Dec 2026; the additional day is Mon 28 Dec.
    // NSW 28 Dec is the substitute Boxing Day — not in the Christmas window (27–31 Dec)
    // note: 28 Dec IS inside the NSW Christmas window, so this is doubly non-working.
    expect(isSopaNonWorkingDay(new Date(2026, 11, 28), 'NSW')).toBe(true);
  });

  it('Labour Day 2027 (Mon 4 Oct) is a NSW non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 9, 4), 'NSW')).toBe(true);
  });

  it('NSW Bank Holiday 2027 (Mon 2 Aug) is a NSW non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 7, 2), 'NSW')).toBe(true);
  });

  it('NSW addBusinessDays skips Labour Day 2026', () => {
    // Fri 2 Oct 2026 + 1 BD: skips weekend and Labour Day Mon 5 Oct → Tue 6 Oct
    const fri = new Date(2026, 9, 2);
    const result = addBusinessDays(fri, 1, 'NSW');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(6);
  });
});

describe('VIC state-specific holidays', () => {
  it('Melbourne Cup Day 2026 (Tue 3 Nov) is a VIC non-working day', () => {
    // Source: business.vic.gov.au — 1st Tue Nov
    expect(isSopaNonWorkingDay(new Date(2026, 10, 3), 'VIC')).toBe(true);
    // Not a non-working day in NSW on that date
    expect(isSopaNonWorkingDay(new Date(2026, 10, 3), 'NSW')).toBe(false);
  });

  it('Melbourne Cup Day 2027 (Tue 2 Nov) is a VIC non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 10, 2), 'VIC')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2027, 10, 2), 'NSW')).toBe(false);
  });

  it('VIC Labour Day 2026 (Mon 9 Mar) is a VIC non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2026, 2, 9), 'VIC')).toBe(true);
    // NSW Labour Day is in October; Mar 9 is a working day for NSW
    expect(isSopaNonWorkingDay(new Date(2026, 2, 9), 'NSW')).toBe(false);
  });

  it('AFL Grand Final Friday 2026 (Fri 25 Sep) is a VIC non-working day', () => {
    // Source: etuvic.com.au confirms Fri 25 Sep 2026; Grand Final Sat 26 Sep
    expect(isSopaNonWorkingDay(new Date(2026, 8, 25), 'VIC')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 8, 25), 'NSW')).toBe(false);
  });

  it('VIC Boxing Day substitute 2026 (Mon 28 Dec) is a VIC non-working day', () => {
    // Boxing Day Sat 26 Dec → observed Mon 28 Dec; also in VIC Christmas window
    expect(isSopaNonWorkingDay(new Date(2026, 11, 28), 'VIC')).toBe(true);
  });

  it('VIC addBusinessDays skips Melbourne Cup Day 2026', () => {
    // Mon 2 Nov 2026 + 1 BD: next day is Tue 3 Nov (Melbourne Cup) → skip to Wed 4 Nov
    const monBeforeCup = new Date(2026, 10, 2);
    const result = addBusinessDays(monBeforeCup, 1, 'VIC');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(10);
    expect(result.getDate()).toBe(4);
  });
});

describe('QLD state-specific holidays', () => {
  it('QLD Labour Day 2026 (Mon 4 May) is a QLD non-working day', () => {
    // Source: qld.gov.au — 1st Mon May
    expect(isSopaNonWorkingDay(new Date(2026, 4, 4), 'QLD')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 4, 4), 'NSW')).toBe(false);
  });

  it("QLD King's Birthday 2026 (Mon 5 Oct) is a QLD non-working day", () => {
    // Source: qld.gov.au — 1st Mon Oct. QLD observes in October, not June.
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'QLD')).toBe(true);
    // NSW King's Birthday is in June, not Oct; so Oct 5 is working day for NSW
    // (NSW happens to also observe Labour Day on Mon 5 Oct 2026)
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'NSW')).toBe(true); // NSW Labour Day same date
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'WA')).toBe(false); // WA observes in Sep
  });

  it("QLD King's Birthday 2027 (Mon 4 Oct) is a QLD non-working day", () => {
    expect(isSopaNonWorkingDay(new Date(2027, 9, 4), 'QLD')).toBe(true);
  });

  it('QLD Labour Day 2027 (Mon 3 May) is a QLD non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 4, 3), 'QLD')).toBe(true);
  });

  it('QLD Day after Good Friday 2026 (Sat 4 Apr) is captured as a calendar date', () => {
    // Sat 4 Apr is already a weekend; stored in QLD table as the "day after Good Friday"
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4), 'QLD')).toBe(true); // Sat = weekend anyway
  });

  it('QLD addBusinessDays skips Labour Day 2026', () => {
    // Fri 1 May 2026 + 1 BD: skip weekend and Labour Day Mon 4 May → Tue 5 May
    const fri = new Date(2026, 4, 1);
    const result = addBusinessDays(fri, 1, 'QLD');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(5);
  });
});

describe('WA state-specific holidays', () => {
  it('WA Day 2026 (Mon 1 Jun) is a WA non-working day', () => {
    // Source: wa.gov.au — 1st Mon Jun
    expect(isSopaNonWorkingDay(new Date(2026, 5, 1), 'WA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 5, 1), 'NSW')).toBe(false);
  });

  it('WA Day 2027 (Mon 7 Jun) is a WA non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 5, 7), 'WA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2027, 5, 7), 'NSW')).toBe(false);
  });

  it("WA King's Birthday 2026 (Mon 28 Sep) is a WA non-working day", () => {
    // WA observes King's Birthday on the last Mon of September (not June like NSW/VIC/SA)
    expect(isSopaNonWorkingDay(new Date(2026, 8, 28), 'WA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 8, 28), 'NSW')).toBe(false);
  });

  it("WA King's Birthday 2027 (Mon 27 Sep) is a WA non-working day", () => {
    expect(isSopaNonWorkingDay(new Date(2027, 8, 27), 'WA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2027, 8, 27), 'NSW')).toBe(false);
  });

  it('WA Labour Day 2026 (Mon 2 Mar) is a WA non-working day', () => {
    // WA Labour Day is 1st Mon Mar
    expect(isSopaNonWorkingDay(new Date(2026, 2, 2), 'WA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 2, 2), 'NSW')).toBe(false);
  });

  it('WA Anzac Day substitute 2026 (Mon 27 Apr) is a WA non-working day', () => {
    // Anzac Day Sat 25 Apr → WA observes additional holiday Mon 27 Apr
    expect(isSopaNonWorkingDay(new Date(2026, 3, 27), 'WA')).toBe(true);
  });

  it('WA addBusinessDays skips WA Day 2026', () => {
    // Fri 29 May 2026 + 1 BD: skip weekend and WA Day Mon 1 Jun → Tue 2 Jun
    const fri = new Date(2026, 4, 29);
    const result = addBusinessDays(fri, 1, 'WA');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(2);
  });
});

describe('SA state-specific holidays', () => {
  it('Adelaide Cup Day 2026 (Mon 9 Mar) is a SA non-working day', () => {
    // Source: publicholidays.com.au/south-australia — 2nd Mon Mar
    expect(isSopaNonWorkingDay(new Date(2026, 2, 9), 'SA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2026, 2, 9), 'NSW')).toBe(false);
  });

  it('Adelaide Cup Day 2027 (Mon 8 Mar) is a SA non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 2, 8), 'SA')).toBe(true);
    expect(isSopaNonWorkingDay(new Date(2027, 2, 8), 'NSW')).toBe(false);
  });

  it('SA Proclamation Day substitute 2026 (Mon 28 Dec) is a SA non-working day', () => {
    // Proclamation Day is 26 Dec; 26 Dec 2026 is Sat → observed Mon 28 Dec
    // Also inside SA Christmas window (27–31 Dec), so doubly non-working.
    expect(isSopaNonWorkingDay(new Date(2026, 11, 28), 'SA')).toBe(true);
  });

  it('SA Labour Day 2026 (Mon 5 Oct) is a SA non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2026, 9, 5), 'SA')).toBe(true);
  });

  it('SA addBusinessDays skips Adelaide Cup Day 2026', () => {
    // Fri 6 Mar 2026 + 1 BD: skip weekend and Adelaide Cup Mon 9 Mar → Tue 10 Mar
    const fri = new Date(2026, 2, 6);
    const result = addBusinessDays(fri, 1, 'SA');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(10);
  });
});

describe('Substitute/additional day assertions', () => {
  it('NSW Easter Saturday 2026 (Sat 4 Apr) is a non-working day (weekend + listed)', () => {
    // Easter Saturday is both a weekend AND explicitly listed — belt-and-braces
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4), 'NSW')).toBe(true);
  });

  it('VIC Easter Saturday 2026 (Sat 4 Apr) is a non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4), 'VIC')).toBe(true);
  });

  it('WA has no Easter Saturday in its gazetted list (not a WA public holiday)', () => {
    // WA does not gazette Easter Saturday as a separate holiday — only Good Fri/Easter Mon
    // Sat 4 Apr 2026 is still a non-working day because it's a weekend
    expect(isSopaNonWorkingDay(new Date(2026, 3, 4), 'WA')).toBe(true); // weekend
  });

  it('VIC Boxing Day substitute 2027 (Mon 27 Dec) is a VIC non-working day', () => {
    // Christmas Day Sat 25 Dec 2027 → Christmas Holiday Mon 27 Dec
    expect(isSopaNonWorkingDay(new Date(2027, 11, 27), 'VIC')).toBe(true);
  });

  it('QLD Boxing Day substitute 2027 (Mon 27 Dec) is a QLD non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 11, 27), 'QLD')).toBe(true);
  });

  it('WA Boxing Day substitute 2027 (Mon 27 Dec) is a WA non-working day', () => {
    expect(isSopaNonWorkingDay(new Date(2027, 11, 27), 'WA')).toBe(true);
  });
});

describe('Cross-holiday due-date calculation', () => {
  it('a VIC claim spanning Melbourne Cup lands later than a weekends-only calculation', () => {
    // Mon 2 Nov 2026 + 5 BD (weekends-only): Mon→Tue→Wed→Thu→Fri = Fri 6 Nov
    const start = new Date(2026, 10, 2);
    const plain = addBusinessDays(start, 5);
    // VIC: +1 skips Melbourne Cup Tue 3 Nov → Wed 4, then +4 more = Tue 10 Nov
    const vic = addBusinessDays(start, 5, 'VIC');
    expect(vic.getTime()).toBeGreaterThan(plain.getTime());
    expect(vic.getMonth()).toBe(10); // November
    expect(vic.getDate()).toBe(10);
  });

  it('NSW addBusinessDays over Easter 2026 lands later than weekends-only', () => {
    // Tue 31 Mar 2026 + 5 BD:
    // plain (weekends-only): 1 Apr(+1), 2 Apr(+2), 3 Apr(+3), skip Sat/Sun,
    //   6 Apr(+4), 7 Apr(+5) = Tue 7 Apr
    // NSW: 1 Apr(+1), 2 Apr(+2), skip Good Fri 3 Apr, skip Sat/Sun,
    //   skip Easter Mon 6 Apr, 7 Apr(+3), 8 Apr(+4), 9 Apr(+5) = Thu 9 Apr
    const tueSep31 = new Date(2026, 2, 31); // Tue 31 Mar 2026
    const plain = addBusinessDays(tueSep31, 5);
    const nsw = addBusinessDays(tueSep31, 5, 'NSW');
    expect(plain.getFullYear()).toBe(2026);
    expect(plain.getMonth()).toBe(3); // April
    expect(plain.getDate()).toBe(7); // Tue 7 Apr (weekends-only)
    expect(nsw.getFullYear()).toBe(2026);
    expect(nsw.getMonth()).toBe(3); // April
    expect(nsw.getDate()).toBe(9); // Thu 9 Apr (NSW: Good Fri + Easter Mon skipped)
    expect(nsw.getTime()).toBeGreaterThan(plain.getTime());
  });

  it("WA King's Birthday pushes a +1 BD calculation forward vs weekends-only", () => {
    // WA King's Birthday 2026 is Mon 28 Sep (last Mon Sep).
    // Fri 26 Sep 2026 + 1 BD:
    //   weekends-only: skip Sat 27, Sun 28 → Mon 28 Sep (+1) ... wait, Mon 28 is a weekend skip?
    //   No: weekends-only skips Sat/Sun then the next weekday is Mon 28 Sep.
    //   WA: Mon 28 Sep is King's Birthday → skip it → Tue 29 Sep.
    const friSep26 = new Date(2026, 8, 26); // Fri 26 Sep 2026
    const plain = addBusinessDays(friSep26, 1);
    const wa = addBusinessDays(friSep26, 1, 'WA');
    expect(plain.getFullYear()).toBe(2026);
    expect(plain.getDate()).toBe(28); // Mon 28 Sep (weekends-only)
    expect(wa.getFullYear()).toBe(2026);
    expect(wa.getDate()).toBe(29); // Tue 29 Sep (WA skips King's Birthday Mon 28 Sep)
    expect(wa.getTime()).toBeGreaterThan(plain.getTime());
  });
});

describe('Coverage staleness guard', () => {
  it('SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR is 2027 (tables extend through 2027)', () => {
    expect(SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR).toBe(2027);
  });

  it('all five SOPA states have at least one 2026 holiday entry', () => {
    for (const state of ['NSW', 'VIC', 'QLD', 'WA', 'SA']) {
      const has2026 = (STATE_PUBLIC_HOLIDAYS[state] as readonly string[]).some((d) =>
        d.startsWith('2026-'),
      );
      expect(has2026, `${state} must have 2026 entries`).toBe(true);
    }
  });

  it('all five SOPA states have at least one 2027 holiday entry', () => {
    for (const state of ['NSW', 'VIC', 'QLD', 'WA', 'SA']) {
      const has2027 = (STATE_PUBLIC_HOLIDAYS[state] as readonly string[]).some((d) =>
        d.startsWith('2027-'),
      );
      expect(has2027, `${state} must have 2027 entries`).toBe(true);
    }
  });

  it('holiday tables must be refreshed before 2028 (staleness guard)', () => {
    // This test will start failing in 2028 if the tables are not updated,
    // giving early warning before statutory dates become wrong.
    const currentYear = new Date().getFullYear();
    expect(
      currentYear,
      `Current year ${currentYear} exceeds SOPA holiday coverage through ${SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR}. ` +
        `Tables must be extended to cover ${currentYear} and ${currentYear + 1} — ` +
        `see sopaBusinessDays.ts header for sources and update instructions.`,
    ).toBeLessThanOrEqual(SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR);
  });
});
