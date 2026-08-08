import { describe, expect, it } from 'vitest';

import { buildMapLayerRows, type MapLayerMenuState } from './mapLayerRows';

function state(over: Partial<MapLayerMenuState> = {}): MapLayerMenuState {
  return {
    historyArmed: false,
    photosArmed: false,
    photoCount: 0,
    testPinsArmed: false,
    testPinCount: 0,
    registeredSheetCount: 0,
    plansOpen: false,
    coverageArmed: false,
    testingArmed: false,
    orthos: [],
    orthoShown: {},
    orthoOpacity: {},
    ...over,
  };
}

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);

describe('buildMapLayerRows', () => {
  it('keeps pin layers and panels apart — the chooser never mixes the two kinds', () => {
    const model = buildMapLayerRows(state());

    // Checkboxes only for passive marker layers.
    expect(ids(model.pins)).toEqual(['photos', 'testPins']);
    // Navigation for anything that opens a panel owning its own state.
    expect(ids(model.panels)).toEqual(['plans', 'coverage', 'testCoverage']);
  });

  it('names the row "Test coverage", never "Testing verdicts"', () => {
    // CIVOS states counts against a specified rule; it does not pronounce
    // conformance. The label is the whole guardrail.
    const labels = buildMapLayerRows(state()).panels.map((p) => p.label);
    expect(labels).toContain('Test coverage');
    expect(labels.join(' ')).not.toMatch(/verdict/i);
  });

  it('counts only ARMED pin layers, and only they carry a count', () => {
    const off = buildMapLayerRows(state({ photoCount: 51, testPinCount: 14 }));
    expect(off.armedCount).toBe(0);
    // Null is not zero: an unarmed layer has never been asked, so "0 in view"
    // would be an answer CIVOS does not have.
    expect(off.pins.map((p) => p.count)).toEqual([null, null]);

    const on = buildMapLayerRows(
      state({ photosArmed: true, photoCount: 51, testPinsArmed: true, testPinCount: 14 }),
    );
    expect(on.armedCount).toBe(2);
    expect(on.pins.map((p) => p.count)).toEqual([51, 14]);
    expect(on.pins.map((p) => p.checked)).toEqual([true, true]);
  });

  it('reports registered plan sheets, and says nothing when there are none', () => {
    expect(buildMapLayerRows(state({ registeredSheetCount: 2 })).panels[0].detail).toBe(
      '2 registered',
    );
    expect(buildMapLayerRows(state()).panels[0].detail).toBeNull();
  });

  it('allows at most two drone imagery rows to be armed', () => {
    const orthos = [
      { id: 'one', name: 'Flight one', capturedAt: null },
      { id: 'two', name: 'Flight two', capturedAt: null },
      { id: 'three', name: 'Flight three', capturedAt: null },
    ];
    const model = buildMapLayerRows(
      state({
        orthos,
        orthoShown: { one: true, two: true },
        orthoOpacity: { one: 0.5 },
      }),
    );
    expect(model.orthos.map((row) => row.disabled)).toEqual([false, false, true]);
    expect(model.orthos[0].opacity).toBe(0.5);
    expect(model.armedCount).toBe(2);
  });

  it('marks a panel whose panel is already open, so the row reads as a way back', () => {
    const model = buildMapLayerRows(
      state({ plansOpen: true, coverageArmed: true, testingArmed: false }),
    );
    expect(model.panels.find((p) => p.id === 'plans')?.active).toBe(true);
    expect(model.panels.find((p) => p.id === 'coverage')?.active).toBe(true);
    expect(model.panels.find((p) => p.id === 'testCoverage')?.active).toBe(false);
  });

  describe('Past view', () => {
    it('withdraws every live-only row and SAYS which ones', () => {
      const model = buildMapLayerRows(state({ historyArmed: true }));

      // Test pins, Coverage and Test coverage all read today's records; against
      // a past date they would put two dates in one picture.
      expect(ids(model.pins)).toEqual(['photos']);
      expect(ids(model.panels)).toEqual(['plans']);

      // The rule that makes the withdrawal honest: three missing rows without a
      // reason read as three missing features.
      expect(model.liveOnly).toEqual(['Test pins', 'Coverage', 'Test coverage']);
    });

    it('leaves photo pins and plan overlays alone — the rule is about the data, not the menu', () => {
      const model = buildMapLayerRows(
        state({ historyArmed: true, photosArmed: true, photoCount: 18, registeredSheetCount: 2 }),
      );
      expect(model.pins[0]).toMatchObject({ id: 'photos', checked: true, count: 18 });
      expect(model.panels[0]).toMatchObject({ id: 'plans', detail: '2 registered' });
      expect(model.armedCount).toBe(1);
    });

    it('never counts a withdrawn layer, even if its armed flag is somehow still set', () => {
      // `toggleHistory` disarms test pins on entry. If that ever regressed, the
      // trigger's count must still describe what is actually on the map.
      const model = buildMapLayerRows(
        state({ historyArmed: true, testPinsArmed: true, testPinCount: 9 }),
      );
      expect(model.armedCount).toBe(0);
      expect(ids(model.pins)).not.toContain('testPins');
    });

    it('says nothing about live-only layers in live view', () => {
      expect(buildMapLayerRows(state()).liveOnly).toEqual([]);
    });
  });
});
