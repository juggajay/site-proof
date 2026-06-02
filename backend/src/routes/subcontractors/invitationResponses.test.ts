import { describe, expect, it } from 'vitest';
import {
  buildEmptyPendingSubcontractorInvitationResponse,
  buildSubcontractorDirectoryResponse,
  buildSubcontractorInvitationAcceptedResponse,
  buildSubcontractorInvitationDetailsResponse,
  buildSubcontractorInvitedResponse,
  buildSubcontractorsForProjectResponse,
  buildUserPendingSubcontractorInvitationResponse,
} from './invitationResponses.js';

describe('invitationResponses', () => {
  it('builds public invitation details', () => {
    expect(
      buildSubcontractorInvitationDetailsResponse(
        {
          id: 'subbie-1',
          companyName: 'Civil Subbie Pty Ltd',
          project: { name: 'M1 Upgrade' },
          primaryContactEmail: 'subbie@example.com',
          primaryContactName: 'Sam',
          status: 'approved',
          invitationExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        'Head Contractor Pty Ltd',
        true,
      ),
    ).toEqual({
      invitation: {
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        projectName: 'M1 Upgrade',
        headContractorName: 'Head Contractor Pty Ltd',
        primaryContactEmail: 'subbie@example.com',
        primaryContactName: 'Sam',
        status: 'approved',
        expiresAt: '2026-06-01T00:00:00.000Z',
        canAccept: true,
      },
    });
  });

  it('builds pending invitation responses for none and found', () => {
    expect(buildEmptyPendingSubcontractorInvitationResponse()).toEqual({ invitation: null });

    expect(
      buildUserPendingSubcontractorInvitationResponse({
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        project: {
          id: 'project-1',
          name: 'M1 Upgrade',
          company: { name: 'Head Contractor Pty Ltd' },
        },
        primaryContactEmail: 'subbie@example.com',
        primaryContactName: 'Sam',
        status: 'approved',
        invitationExpiresAt: null,
      }),
    ).toEqual({
      invitation: {
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        projectId: 'project-1',
        projectName: 'M1 Upgrade',
        headContractorName: 'Head Contractor Pty Ltd',
        primaryContactEmail: 'subbie@example.com',
        primaryContactName: 'Sam',
        status: 'approved',
        expiresAt: null,
        canAccept: true,
      },
    });
  });

  it('builds the subcontractor directory response', () => {
    expect(
      buildSubcontractorDirectoryResponse([
        {
          id: 'global-1',
          companyName: 'Civil Subbie Pty Ltd',
          abn: null,
          primaryContactName: null,
          primaryContactEmail: null,
          primaryContactPhone: null,
        },
      ]),
    ).toEqual({
      subcontractors: [
        {
          id: 'global-1',
          companyName: 'Civil Subbie Pty Ltd',
          abn: '',
          primaryContactName: '',
          primaryContactEmail: '',
          primaryContactPhone: '',
        },
      ],
    });
  });

  it('builds invite and accept responses', () => {
    const subcontractor = {
      id: 'subbie-1',
      companyName: 'Civil Subbie Pty Ltd',
      abn: null,
      primaryContactName: 'Sam',
      primaryContactEmail: 'subbie@example.com',
      primaryContactPhone: null,
      status: 'approved',
      project: { name: 'M1 Upgrade' },
    };

    expect(buildSubcontractorInvitedResponse(subcontractor)).toEqual({
      message: 'Subcontractor invited successfully',
      subcontractor: {
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        abn: '',
        primaryContact: 'Sam',
        email: 'subbie@example.com',
        phone: '',
        status: 'approved',
        employees: [],
        plant: [],
        totalApprovedDockets: 0,
        totalCost: 0,
        assignedLotCount: 0,
      },
    });

    expect(buildSubcontractorInvitationAcceptedResponse(subcontractor)).toEqual({
      message: 'Invitation accepted successfully',
      subcontractor: {
        id: 'subbie-1',
        companyName: 'Civil Subbie Pty Ltd',
        projectName: 'M1 Upgrade',
        status: 'approved',
      },
    });
  });

  it('builds the project subcontractor list response', () => {
    const subcontractors = [{ id: 'subbie-1', companyName: 'Civil Subbie Pty Ltd' }];

    expect(buildSubcontractorsForProjectResponse(subcontractors)).toEqual({ subcontractors });
  });
});
