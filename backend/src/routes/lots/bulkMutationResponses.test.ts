import { describe, expect, it } from 'vitest';
import {
  buildLotsBulkDeletedResponse,
  buildLotsBulkStatusUpdatedResponse,
  buildLotsBulkSubcontractorAssignedResponse,
} from './bulkMutationResponses.js';

describe('lot bulk mutation responses', () => {
  it('preserves the bulk-delete response message', () => {
    expect(buildLotsBulkDeletedResponse(3)).toEqual({
      message: 'Successfully deleted 3 lot(s)',
      count: 3,
    });
  });

  it('preserves the bulk status-update response message and underscore replacement', () => {
    expect(buildLotsBulkStatusUpdatedResponse(2, 'in_progress')).toEqual({
      message: 'Successfully updated 2 lot(s) to "in progress"',
      count: 2,
    });
  });

  it('uses assigned when a subcontractor id is present', () => {
    expect(buildLotsBulkSubcontractorAssignedResponse(4, 'subbie-1')).toEqual({
      message: 'Successfully assigned 4 lot(s)',
      count: 4,
    });
  });

  it('uses unassigned when the subcontractor id is null', () => {
    expect(buildLotsBulkSubcontractorAssignedResponse(4, null)).toEqual({
      message: 'Successfully unassigned 4 lot(s)',
      count: 4,
    });
  });
});
