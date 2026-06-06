import { describe, expect, it } from 'vitest';
import {
  normalizeCompanyLogoUrl,
  normalizeCompanyMemberEmail,
  normalizeCompanyMemberRole,
  normalizeCompanyString,
} from './validation.js';

describe('company validation helpers', () => {
  describe('normalizeCompanyString', () => {
    it('trims strings and preserves optional empty values as null', () => {
      expect(normalizeCompanyString('  Site Proof Civil  ', 'Company name', 120)).toBe(
        'Site Proof Civil',
      );
      expect(normalizeCompanyString('   ', 'Company ABN', 32)).toBeNull();
      expect(normalizeCompanyString(undefined, 'Company ABN', 32)).toBeUndefined();
    });

    it('throws the existing validation messages for required, non-string, and long values', () => {
      expect(() => normalizeCompanyString(null, 'Company name', 120, { required: true })).toThrow(
        'Company name is required',
      );
      expect(() => normalizeCompanyString(123, 'Company name', 120)).toThrow(
        'Company name must be a string',
      );
      expect(() => normalizeCompanyString('abcd', 'Company name', 3)).toThrow(
        'Company name must be 3 characters or fewer',
      );
    });
  });

  describe('normalizeCompanyMemberEmail', () => {
    it('normalizes email addresses to lowercase', () => {
      expect(normalizeCompanyMemberEmail(' QA.User@Example.COM ')).toBe('qa.user@example.com');
    });

    it('rejects invalid email addresses with the existing message', () => {
      expect(() => normalizeCompanyMemberEmail('not-an-email')).toThrow(
        'Enter a valid email address',
      );
    });
  });

  describe('normalizeCompanyMemberRole', () => {
    it('allows supported invite roles', () => {
      expect(normalizeCompanyMemberRole('foreman')).toBe('foreman');
      expect(normalizeCompanyMemberRole('site_engineer')).toBe('site_engineer');
    });

    it('rejects unsupported invite roles with the existing message', () => {
      expect(() => normalizeCompanyMemberRole('owner')).toThrow(
        'Company member role is not supported',
      );
    });
  });

  describe('normalizeCompanyLogoUrl', () => {
    it('allows uploaded local logo paths and http/https URLs', () => {
      expect(normalizeCompanyLogoUrl('/uploads/company-logos/company-logo-123.png')).toBe(
        '/uploads/company-logos/company-logo-123.png',
      );
      expect(normalizeCompanyLogoUrl('https://cdn.example.com/company-logo.png')).toBe(
        'https://cdn.example.com/company-logo.png',
      );
    });

    it('rejects data URLs, credentials, backslashes, and wrong local upload paths', () => {
      expect(() => normalizeCompanyLogoUrl('data:image/png;base64,abc')).toThrow(
        'Company logo must be uploaded before saving',
      );
      expect(() => normalizeCompanyLogoUrl('https://user:pass@example.com/logo.png')).toThrow(
        'Company logo URL must not include credentials',
      );
      expect(() => normalizeCompanyLogoUrl('https://example.com\\logo.png')).toThrow(
        'Company logo URL is invalid',
      );
      expect(() => normalizeCompanyLogoUrl('/uploads/not-company-logo.png')).toThrow(
        'Company logo URL must reference an uploaded company logo',
      );
    });
  });
});
