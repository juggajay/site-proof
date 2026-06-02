import { describe, expect, it } from 'vitest';
import {
  buildSubcontractorDeletedResponse,
  buildSubcontractorPortalAccessResponse,
  buildSubcontractorPortalAccessUpdatedResponse,
  buildSubcontractorStatusUpdatedResponse,
} from './adminResponses.js';

describe('adminResponses', () => {
  it('builds the status updated response', () => {
    const subcontractor = { id: 'subbie-1', status: 'approved' };

    expect(buildSubcontractorStatusUpdatedResponse(subcontractor, 'approved')).toEqual({
      message: 'Subcontractor status updated to approved',
      subcontractor,
    });
  });

  it('builds the permanent delete response', () => {
    expect(
      buildSubcontractorDeletedResponse('Civil Subbie Pty Ltd', {
        dockets: 2,
        employees: 3,
        plant: 4,
      }),
    ).toEqual({
      message: 'Subcontractor Civil Subbie Pty Ltd permanently deleted',
      deletedCounts: {
        dockets: 2,
        employees: 3,
        plant: 4,
      },
    });
  });

  it('builds portal access responses', () => {
    const portalAccess = { lots: true, documents: false };

    expect(buildSubcontractorPortalAccessUpdatedResponse(portalAccess)).toEqual({
      message: 'Portal access updated successfully',
      portalAccess,
    });
    expect(buildSubcontractorPortalAccessResponse(portalAccess)).toEqual({ portalAccess });
  });
});
