import { beforeEach, describe, expect, it } from 'vitest';
import { removeLocalStorageItem, writeLocalStorageItem } from './storagePreferences';
import { deleteView, listViews, saveView } from './savedViews';

describe('savedViews', () => {
  beforeEach(() => {
    // Guardrail: all storage access (tests included) goes through the safe helpers.
    for (const key of ['ncrs', 'lots', 'test-results', 'holdpoints']) {
      removeLocalStorageItem(`siteproof_saved_views.${key}`);
    }
  });

  it('returns an empty list when nothing is saved', () => {
    expect(listViews('ncrs')).toEqual([]);
  });

  it('saves and lists a view for a register', () => {
    const next = saveView('ncrs', 'Open weld NCRs', 'status=open&search=weld');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ name: 'Open weld NCRs', query: 'status=open&search=weld' });
    expect(next[0].id).toBeTruthy();
    expect(listViews('ncrs')).toEqual(next);
  });

  it('strips a leading ? from the stored query', () => {
    const [view] = saveView('test-results', 'Failed', '?passFail=fail');
    expect(view.query).toBe('passFail=fail');
  });

  it('keeps views isolated per register key', () => {
    saveView('ncrs', 'A', 'status=open');
    saveView('hold-points', 'B', 'status=pending');
    expect(listViews('ncrs').map((v) => v.name)).toEqual(['A']);
    expect(listViews('hold-points').map((v) => v.name)).toEqual(['B']);
  });

  it('ignores a blank name or empty query', () => {
    expect(saveView('ncrs', '   ', 'status=open')).toEqual([]);
    expect(saveView('ncrs', 'Named', '')).toEqual([]);
    expect(saveView('ncrs', 'Named', '   ')).toEqual([]);
    expect(listViews('ncrs')).toEqual([]);
  });

  it('deletes a view by id', () => {
    const saved = saveView('ncrs', 'A', 'status=open');
    const withB = saveView('ncrs', 'B', 'status=closed');
    expect(withB).toHaveLength(2);

    const afterDelete = deleteView('ncrs', saved[0].id);
    expect(afterDelete.map((v) => v.name)).toEqual(['B']);
    expect(listViews('ncrs').map((v) => v.name)).toEqual(['B']);
  });

  it('tolerates corrupt storage by returning an empty list', () => {
    writeLocalStorageItem('siteproof_saved_views.ncrs', 'not json{');
    expect(listViews('ncrs')).toEqual([]);
  });
});
