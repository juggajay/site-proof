/**
 * DG-4b. The Layers chooser's contents as DATA.
 *
 * The chooser holds three kinds of row and they must never look interchangeable:
 *
 *   • PIN layers are CHECKBOXES. They paint passive markers on the map and do
 *     nothing else, so their whole state is the tick.
 *   • PANEL rows are NAVIGATION. They close the chooser and open a panel that
 *     owns its own state, so they get a chevron and never a tick.
 *   • ORTHO rows are bounded image toggles with their own opacity control.
 *
 * Which rows exist is a rule, not decoration: in Past view the live-only layers
 * are withdrawn, and the chooser has to SAY why rather than silently dropping
 * three rows (a reader who does not see "Test pins" concludes the feature is
 * gone, not that it is meaningless against 12 June). Keeping that rule here —
 * pure, no JSX — is what makes it testable without a DOM or a Radix portal.
 */

export type MapPinLayerId = 'photos' | 'testPins';
export type MapPanelId = 'plans' | 'coverage' | 'testCoverage';

/**
 * The ground the map sits on. Exactly one is drawn at a time — this is a choice,
 * never a set, which is why the mobile sheet renders it as radios and not ticks.
 */
export type MapBasemapId = 'satellite' | 'street';

export interface MapPinLayerRow {
  id: MapPinLayerId;
  label: string;
  checked: boolean;
  /**
   * Markers this layer is currently DRAWING, or null when it is off. Null is not
   * zero: an unarmed layer has never been asked, and "0 in view" would be an
   * answer CIVOS does not have.
   */
  count: number | null;
}

export interface MapPanelRow {
  id: MapPanelId;
  label: string;
  /** Right-hand hint (e.g. "2 registered"), or null when there is nothing factual to say. */
  detail: string | null;
  /** Its panel is already open — the row is a way back to it, not a second copy. */
  active: boolean;
}

export interface MapOrthoLayerRow {
  id: string;
  label: string;
  capturedAt: string | null;
  checked: boolean;
  disabled: boolean;
  opacity: number;
}

export interface MapOrthoLayerInput {
  id: string;
  name: string;
  capturedAt: string | null;
}

export interface MapLayerMenuState {
  /** Past view. Withdraws every layer whose data is about today. */
  historyArmed: boolean;
  photosArmed: boolean;
  photoCount: number | null;
  testPinsArmed: boolean;
  testPinCount: number | null;
  registeredSheetCount: number;
  plansOpen: boolean;
  coverageArmed: boolean;
  testingArmed: boolean;
  orthos: MapOrthoLayerInput[];
  orthoShown: Record<string, boolean>;
  orthoOpacity: Record<string, number>;
}

export interface MapLayerMenuModel {
  pins: MapPinLayerRow[];
  panels: MapPanelRow[];
  orthos: MapOrthoLayerRow[];
  /**
   * Names withdrawn because Past view is on, in reading order. Empty in live
   * view. The menu renders this as a sentence; it is never silently empty when
   * rows are missing.
   */
  liveOnly: string[];
  /** Passive pin/ortho layers currently painting — the number on the Layers trigger. */
  armedCount: number;
}

/**
 * "Test coverage", never "Testing verdicts". The panel behind it states counts
 * against a specified frequency ("3 of 5 Density verified") — a record of what
 * was tested, not a conformance judgement by CIVOS.
 */
const TEST_COVERAGE_LABEL = 'Test coverage';

export function buildMapLayerRows(state: MapLayerMenuState): MapLayerMenuModel {
  const pins: MapPinLayerRow[] = [
    {
      id: 'photos',
      label: 'Photo pins',
      checked: state.photosArmed,
      count: state.photosArmed ? state.photoCount : null,
    },
  ];

  // `toggleHistory` already disarms this layer (a sample point captured today is
  // not evidence about a past date). The row goes with it, and `liveOnly` below
  // is what stops that from reading as a missing feature.
  if (!state.historyArmed) {
    pins.push({
      id: 'testPins',
      label: 'Test pins',
      checked: state.testPinsArmed,
      count: state.testPinsArmed ? state.testPinCount : null,
    });
  }

  const panels: MapPanelRow[] = [
    {
      id: 'plans',
      label: 'Plan overlays',
      detail: state.registeredSheetCount > 0 ? `${state.registeredSheetCount} registered` : null,
      active: state.plansOpen,
    },
  ];

  // Coverage and Test coverage read today's records. Offered against a past date
  // they would put two dates in one picture. Both already exit Past view when
  // used, so withdrawing the rows costs no reachability — leaving Past restores
  // them.
  if (!state.historyArmed) {
    panels.push(
      { id: 'coverage', label: 'Coverage', detail: null, active: state.coverageArmed },
      {
        id: 'testCoverage',
        label: TEST_COVERAGE_LABEL,
        detail: null,
        active: state.testingArmed,
      },
    );
  }

  const activeOrthoCount = state.orthos.filter((ortho) => state.orthoShown[ortho.id]).length;
  const orthos = state.orthos.map((ortho) => ({
    id: ortho.id,
    label: ortho.name,
    capturedAt: ortho.capturedAt,
    checked: Boolean(state.orthoShown[ortho.id]),
    disabled: activeOrthoCount >= 2 && !state.orthoShown[ortho.id],
    opacity: state.orthoOpacity[ortho.id] ?? 0.85,
  }));

  return {
    pins,
    panels,
    orthos,
    liveOnly: state.historyArmed ? ['Test pins', 'Coverage', TEST_COVERAGE_LABEL] : [],
    armedCount: pins.filter((row) => row.checked).length + activeOrthoCount,
  };
}
