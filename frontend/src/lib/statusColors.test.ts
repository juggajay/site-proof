import { describe, it, expect } from 'vitest';
import {
  LOT_STATUS_COLORS,
  NCR_STATUS_COLORS,
  NCR_GATE_DOT_CLASSES,
  getLotStatusBadgeClass,
  getLotStatusSwatch,
  getNcrStatusBadgeClass,
  getNcrStatusMobileVariant,
  lotStatusUsesDarkText,
} from './statusColors';
import { LOT_STATUS_OVERVIEW_ITEMS } from './lotStatusOverview';
import { STATUS_LABELS } from './statusLabels';

describe('lot status colours', () => {
  it('covers exactly the canonical lot statuses', () => {
    expect(Object.keys(LOT_STATUS_COLORS)).toEqual(LOT_STATUS_OVERVIEW_ITEMS.map((i) => i.key));
  });

  // The whole point of the ticket: "Conformed" and "Not Started" used to be the
  // same grey pill, so a register carried no information at a glance.
  it('gives every status a distinct swatch and chip', () => {
    const swatches = Object.values(LOT_STATUS_COLORS).map((c) => c.swatch);
    expect(new Set(swatches).size).toBe(swatches.length);

    const chips = Object.values(LOT_STATUS_COLORS).map((c) => c.chip);
    expect(new Set(chips).size).toBe(chips.length);
  });

  it('keeps the shipped Okabe-Ito map palette', () => {
    expect(getLotStatusSwatch('conformed')).toBe('#009E73');
    expect(getLotStatusSwatch('ncr_raised')).toBe('#D55E00');
    expect(getLotStatusSwatch('claimed')).toBe('#CC79A7');
  });

  it('falls back to neutral for an unknown status', () => {
    expect(getLotStatusSwatch('teleported')).toBe('#9ca3af');
    expect(getLotStatusBadgeClass('teleported')).toBe('bg-muted text-muted-foreground');
    expect(lotStatusUsesDarkText('teleported')).toBe(false);
  });

  it('marks the light fills as needing dark text', () => {
    expect(lotStatusUsesDarkText('awaiting_test')).toBe(true);
    expect(lotStatusUsesDarkText('ncr_raised')).toBe(false);
  });
});

describe('NCR status colours', () => {
  it('covers every NCR lifecycle status the sort order knows about', () => {
    expect(Object.keys(NCR_STATUS_COLORS)).toEqual([
      'open',
      'investigating',
      'rectification',
      'verification',
      'closed',
      'closed_concession',
    ]);
  });

  // Five of six states used to render `bg-muted text-muted-foreground`.
  it('no longer renders the whole lifecycle as one grey', () => {
    const chips = Object.values(NCR_STATUS_COLORS).map((c) => c.chip);
    expect(new Set(chips).size).toBeGreaterThanOrEqual(4);
  });

  it('distinguishes a clean close from a concession', () => {
    expect(getNcrStatusBadgeClass('closed')).not.toBe(getNcrStatusBadgeClass('closed_concession'));
  });

  it('maps to the mobile card palette, with a neutral fallback', () => {
    expect(getNcrStatusMobileVariant('open')).toBe('error');
    expect(getNcrStatusMobileVariant('verification')).toBe('info');
    expect(getNcrStatusMobileVariant('teleported')).toBe('default');
    expect(getNcrStatusBadgeClass('teleported')).toBe('bg-muted text-foreground');
  });
});

describe('colour is never the only encoding', () => {
  // Every status this module colours must also have a plain-English label, so
  // a chip always carries text next to its tint.
  it('has a label for every status it colours', () => {
    for (const key of [...Object.keys(LOT_STATUS_COLORS), ...Object.keys(NCR_STATUS_COLORS)]) {
      expect(STATUS_LABELS[key]).toBeTruthy();
    }
  });

  it('encodes gate state by shape as well as colour', () => {
    expect(NCR_GATE_DOT_CLASSES.done).toContain('rounded-full');
    expect(NCR_GATE_DOT_CLASSES.pending).toContain('border');
    // A dash, not a disc — "not required" must not read as "not done".
    expect(NCR_GATE_DOT_CLASSES.not_required).toContain('h-px');
    expect(NCR_GATE_DOT_CLASSES.not_required).not.toContain('rounded-full');
  });
});
