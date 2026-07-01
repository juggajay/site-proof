import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LABOUR_HOURS_INPUT_ERROR, useDocketEntrySheetState } from './useDocketEntrySheetState';

describe('useDocketEntrySheetState', () => {
  it('flags labour entries whose start and finish times produce zero hours', () => {
    const { result } = renderHook(() =>
      useDocketEntrySheetState([{ id: 'lot-1', lotNumber: 'L-001', activity: 'Earthworks' }]),
    );

    expect(result.current.labourHoursError).toBeNull();
    expect(result.current.previewHours).toBe(8.5);

    act(() => {
      result.current.setFinishTime('07:00');
    });

    expect(result.current.previewHours).toBe(0);
    expect(result.current.labourHoursError).toBe(LABOUR_HOURS_INPUT_ERROR);
  });
});
