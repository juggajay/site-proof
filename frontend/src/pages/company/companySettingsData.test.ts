import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  buildCompanyPath,
  canCompanyActorManageMember,
  formatLimit,
  getCompanyLoadErrorMessage,
  getCompanyMemberRoleOptionsForActor,
  getPlanBillingLabel,
  getPlanStorageLabel,
  hasFiniteLimit,
  isOwnershipTransferEligibleMember,
  normalizeCompanyResponse,
  toCompanyFormData,
  type Company,
} from './companySettingsData';

const baseCompany: Company = {
  id: 'company-1',
  name: 'Ryox Civil Pty Ltd',
  abn: '12 345 678 901',
  address: '1 Test Street, Sydney NSW',
  logoUrl: 'https://cdn.example.com/logo.png',
  subscriptionTier: 'professional',
  projectCount: 8,
  projectLimit: 10,
  userCount: 20,
  userLimit: 25,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
};

describe('company settings data helpers', () => {
  describe('buildCompanyPath', () => {
    it('returns the company endpoint', () => {
      expect(buildCompanyPath()).toBe('/api/company');
    });
  });

  describe('normalizeCompanyResponse', () => {
    it('unwraps the company from the response envelope', () => {
      expect(normalizeCompanyResponse({ company: baseCompany })).toBe(baseCompany);
    });
  });

  describe('toCompanyFormData', () => {
    it('maps a loaded company into the editable form shape', () => {
      expect(toCompanyFormData(baseCompany)).toEqual({
        name: 'Ryox Civil Pty Ltd',
        abn: '12 345 678 901',
        address: '1 Test Street, Sydney NSW',
        logoUrl: 'https://cdn.example.com/logo.png',
      });
    });

    it('coerces null optional fields to empty strings', () => {
      expect(
        toCompanyFormData({ ...baseCompany, abn: null, address: null, logoUrl: null }),
      ).toEqual({
        name: 'Ryox Civil Pty Ltd',
        abn: '',
        address: '',
        logoUrl: '',
      });
    });
  });

  describe('formatLimit', () => {
    it('renders an explicit null limit as Unlimited', () => {
      expect(formatLimit(null, 3)).toBe('Unlimited');
    });

    it('renders a finite limit as its string value', () => {
      expect(formatLimit(10, 3)).toBe('10');
    });

    it('falls back when the limit is undefined', () => {
      expect(formatLimit(undefined, 5)).toBe('5');
    });
  });

  describe('hasFiniteLimit', () => {
    it('is true for a finite number', () => {
      expect(hasFiniteLimit(10)).toBe(true);
    });

    it('is false for null, undefined, and non-finite values', () => {
      expect(hasFiniteLimit(null)).toBe(false);
      expect(hasFiniteLimit(undefined)).toBe(false);
      expect(hasFiniteLimit(Number.POSITIVE_INFINITY)).toBe(false);
      expect(hasFiniteLimit(Number.NaN)).toBe(false);
    });
  });

  describe('getPlanBillingLabel', () => {
    it('maps each tier to its billing label', () => {
      expect(getPlanBillingLabel('professional')).toBe('$99/month');
      expect(getPlanBillingLabel('enterprise')).toBe('Custom pricing');
      expect(getPlanBillingLabel('unlimited')).toBe('Custom pricing');
      expect(getPlanBillingLabel('basic')).toBe('Contact billing');
    });

    it('is case-insensitive and defaults blank tiers to the basic label', () => {
      expect(getPlanBillingLabel('PROFESSIONAL')).toBe('$99/month');
      expect(getPlanBillingLabel(null)).toBe('Contact billing');
      expect(getPlanBillingLabel(undefined)).toBe('Contact billing');
    });
  });

  describe('getPlanStorageLabel', () => {
    it('maps each tier to its storage label', () => {
      expect(getPlanStorageLabel('professional')).toBe('100 GB');
      expect(getPlanStorageLabel('enterprise')).toBe('Unlimited');
      expect(getPlanStorageLabel('unlimited')).toBe('Unlimited');
      expect(getPlanStorageLabel('basic')).toBe('1 GB');
      expect(getPlanStorageLabel(null)).toBe('1 GB');
    });
  });

  describe('getCompanyLoadErrorMessage', () => {
    it('returns the no-company copy for a 404', () => {
      const error = new ApiError(404, JSON.stringify({ message: 'Not found' }));
      expect(getCompanyLoadErrorMessage(error)).toBe('No company associated with your account');
    });

    it('surfaces the server message for other API errors', () => {
      const error = new ApiError(500, JSON.stringify({ message: 'Company service unavailable' }));
      expect(getCompanyLoadErrorMessage(error)).toBe('Company service unavailable');
    });

    it('uses a plain error message when present', () => {
      expect(getCompanyLoadErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('falls back to a default message for opaque errors', () => {
      expect(getCompanyLoadErrorMessage(null)).toBe('Failed to load company settings');
    });
  });

  describe('isOwnershipTransferEligibleMember', () => {
    it('allows active OAuth-only members from the status field', () => {
      expect(isOwnershipTransferEligibleMember({ status: 'active', hasPassword: false })).toBe(
        true,
      );
    });

    it('blocks pending invited members', () => {
      expect(isOwnershipTransferEligibleMember({ status: 'pending', hasPassword: false })).toBe(
        false,
      );
    });

    it('falls back to the legacy hasPassword flag when status is absent', () => {
      expect(isOwnershipTransferEligibleMember({ hasPassword: false })).toBe(false);
      expect(isOwnershipTransferEligibleMember({ hasPassword: true })).toBe(true);
      expect(isOwnershipTransferEligibleMember({})).toBe(true);
    });
  });

  describe('company member role management helpers', () => {
    it('allows owners to grant admin but filters admin from non-owner admin choices', () => {
      expect(getCompanyMemberRoleOptionsForActor('owner').map((option) => option.value)).toContain(
        'admin',
      );
      expect(
        getCompanyMemberRoleOptionsForActor('admin').map((option) => option.value),
      ).not.toContain('admin');
    });

    it('mirrors the backend owner/admin rank rule for member actions', () => {
      expect(
        canCompanyActorManageMember({
          actorRole: 'owner',
          targetRole: 'admin',
          isCurrentUser: false,
        }),
      ).toBe(true);
      expect(
        canCompanyActorManageMember({
          actorRole: 'admin',
          targetRole: 'admin',
          isCurrentUser: false,
        }),
      ).toBe(false);
      expect(
        canCompanyActorManageMember({
          actorRole: 'admin',
          targetRole: 'foreman',
          isCurrentUser: false,
        }),
      ).toBe(true);
      expect(
        canCompanyActorManageMember({
          actorRole: 'owner',
          targetRole: 'site_engineer',
          isCurrentUser: true,
        }),
      ).toBe(false);
    });
  });
});
