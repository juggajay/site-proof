/**
 * Workspace state ↔ URL (demo requirement: any workspace state is linkable).
 *
 * Keys are additive to whatever else lives on the page's query string (the lot
 * register's filters, the shell's projectId) and defaults are OMITTED so a
 * pristine map writes nothing — the register's role-default landing filter
 * (applied only to an empty query string) keeps working.
 */

export interface MapUrlState {
  view: 'map' | 'plan' | null;
  sheet: string | null;
  lot: string | null;
  /** History (Past view) date, YYYY-MM-DD. */
  date: string | null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function readMapUrlState(params: URLSearchParams): MapUrlState {
  const view = params.get('view');
  const date = params.get('date');
  return {
    view: view === 'plan' || view === 'map' ? view : null,
    sheet: params.get('sheet'),
    lot: params.get('lot'),
    date: date && DATE_KEY.test(date) ? date : null,
  };
}

export interface MapUrlInputs {
  mode: 'map' | 'plan';
  activeSheetId: string | null;
  selectedLotId: string | null;
  historyArmed: boolean;
  historyDateKey: string;
  todayKey: string;
}

/**
 * Returns `params` with the workspace keys set/cleared; every other key is
 * left untouched. Pure so the write path is testable without a router.
 */
export function applyMapUrlState(params: URLSearchParams, state: MapUrlInputs): URLSearchParams {
  const next = new URLSearchParams(params);
  if (state.mode === 'plan') next.set('view', 'plan');
  else next.delete('view');
  if (state.mode === 'plan' && state.activeSheetId) next.set('sheet', state.activeSheetId);
  else next.delete('sheet');
  if (state.selectedLotId) next.set('lot', state.selectedLotId);
  else next.delete('lot');
  if (state.historyArmed && state.historyDateKey !== state.todayKey) {
    next.set('date', state.historyDateKey);
  } else {
    next.delete('date');
  }
  return next;
}
