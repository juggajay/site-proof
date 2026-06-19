import { describe, expect, it } from 'vitest';

import {
  buildCompanyCreatedResponse,
  buildCompanyLeftResponse,
  buildCompanyLogoUploadedResponse,
  buildCompanyMembersResponse,
  buildCompanyOwnershipTransferredResponse,
  buildCompanyProfileResponse,
  buildCompanyUpdatedResponse,
} from './responses.js';

const createdAt = new Date('2026-06-01T00:00:00.000Z');
const updatedAt = new Date('2026-06-01T01:00:00.000Z');

const company = {
  id: 'company-1',
  name: 'SiteProof Civil',
  abn: '51 824 753 556',
  address: 'Sydney NSW',
  logoUrl: null,
  subscriptionTier: 'basic',
  createdAt,
  updatedAt,
};

describe('company response helpers', () => {
  it('preserves the company-created response user projection', () => {
    expect(
      buildCompanyCreatedResponse(company, {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        phone: null,
        roleInCompany: 'owner',
        companyId: 'company-1',
        avatarUrl: null,
        passwordHash: 'hashed',
      }),
    ).toEqual({
      company,
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        phone: null,
        role: 'owner',
        roleInCompany: 'owner',
        companyId: 'company-1',
        companyName: 'SiteProof Civil',
        avatarUrl: null,
        hasPassword: true,
      },
    });
  });

  it('preserves current company profile counts and tier limits', () => {
    expect(
      buildCompanyProfileResponse(company, {
        projectCount: 3,
        projectLimit: null,
        userCount: 7,
        userLimit: 25,
      }),
    ).toEqual({
      company: {
        ...company,
        projectCount: 3,
        projectLimit: null,
        userCount: 7,
        userLimit: 25,
      },
    });
  });

  it('preserves company leave timestamp response', () => {
    expect(buildCompanyLeftResponse(new Date('2026-06-01T02:03:04.000Z'))).toEqual({
      message: 'Successfully left the company',
      leftAt: '2026-06-01T02:03:04.000Z',
    });
  });

  it('preserves member list response', () => {
    const members = [
      {
        id: 'user-1',
        email: 'owner@example.com',
        fullName: 'Owner One',
        roleInCompany: 'owner',
      },
    ];

    expect(buildCompanyMembersResponse(members)).toEqual({
      members: [
        {
          ...members[0],
          hasPassword: false,
          status: 'pending',
        },
      ],
    });
  });

  it('preserves ownership transfer response', () => {
    expect(
      buildCompanyOwnershipTransferredResponse(
        { id: 'user-2', email: 'new-owner@example.com', fullName: 'New Owner' },
        new Date('2026-06-01T03:04:05.000Z'),
      ),
    ).toEqual({
      message: 'Ownership transferred successfully',
      newOwner: {
        id: 'user-2',
        email: 'new-owner@example.com',
        fullName: 'New Owner',
      },
      transferredAt: '2026-06-01T03:04:05.000Z',
    });
  });

  it('preserves logo upload and settings update responses', () => {
    const companyWithLogo = { ...company, logoUrl: '/uploads/logo.png' };

    expect(buildCompanyLogoUploadedResponse('/uploads/logo.png', companyWithLogo)).toEqual({
      logoUrl: '/uploads/logo.png',
      company: companyWithLogo,
    });

    expect(buildCompanyUpdatedResponse(company)).toEqual({
      message: 'Company settings updated successfully',
      company,
    });
  });
});
