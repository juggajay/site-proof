import { describe, expect, it } from 'vitest';
import { buildDocketCreatedResponse, buildDocketUpdatedResponse } from './coreMutationResponses.js';

describe('coreMutationResponses', () => {
  it('builds the docket created response', () => {
    const docket = {
      id: 'abc123',
      subcontractorCompany: { companyName: 'Civil Subbie Pty Ltd' },
      date: new Date('2026-05-21T00:00:00.000Z'),
      status: 'draft',
      totalLabourSubmitted: '8.5',
      totalPlantSubmitted: '6',
      notes: 'Initial notes',
    };

    expect(buildDocketCreatedResponse(docket)).toEqual({
      docket: {
        id: 'abc123',
        docketNumber: 'DKT-ABC123',
        subcontractor: 'Civil Subbie Pty Ltd',
        date: '2026-05-21',
        status: 'draft',
        labourHours: 8.5,
        plantHours: 6,
        notes: 'Initial notes',
      },
    });
  });

  it('builds the docket updated response', () => {
    const docket = {
      id: 'abc123',
      date: new Date('2026-05-21T00:00:00.000Z'),
      status: 'draft',
      notes: 'Updated notes',
      foremanNotes: null,
      subcontractorCompany: { id: 'subbie-1', companyName: 'Civil Subbie Pty Ltd' },
    };

    expect(buildDocketUpdatedResponse(docket)).toEqual({
      docket: {
        id: 'abc123',
        docketNumber: 'DKT-ABC123',
        date: '2026-05-21',
        status: 'draft',
        notes: 'Updated notes',
        foremanNotes: null,
        subcontractor: { id: 'subbie-1', companyName: 'Civil Subbie Pty Ltd' },
      },
    });
  });
});
