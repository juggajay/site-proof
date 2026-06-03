import { describe, expect, it } from 'vitest';
import { buildMyCompanyPath, normalizeMyCompanyResponse, type CompanyData } from './myCompanyData';
import { queryKeys } from '@/lib/queryKeys';

const baseCompany: CompanyData = {
  id: 'company-1',
  companyName: 'Acme Civil',
  abn: '11 222 333 444',
  projectId: 'project-1',
  projectName: 'Northern Bypass',
  primaryContactName: 'Ada Lovelace',
  primaryContactEmail: 'ada@example.com',
  primaryContactPhone: '0400 000 000',
  status: 'approved',
  employees: [],
  plant: [],
};

describe('buildMyCompanyPath', () => {
  it('omits the query string when no project id is requested', () => {
    expect(buildMyCompanyPath(null)).toBe('/api/subcontractors/my-company');
    expect(buildMyCompanyPath(undefined)).toBe('/api/subcontractors/my-company');
    expect(buildMyCompanyPath('')).toBe('/api/subcontractors/my-company');
  });

  it('appends the url-encoded project id when requested', () => {
    expect(buildMyCompanyPath('project-1')).toBe(
      '/api/subcontractors/my-company?projectId=project-1',
    );
  });

  it('url-encodes project ids containing reserved characters', () => {
    expect(buildMyCompanyPath('id/with space')).toBe(
      '/api/subcontractors/my-company?projectId=id%2Fwith%20space',
    );
  });
});

describe('normalizeMyCompanyResponse', () => {
  it('returns the company when present', () => {
    expect(normalizeMyCompanyResponse({ company: baseCompany })).toBe(baseCompany);
  });

  it('coerces a null company to null', () => {
    expect(normalizeMyCompanyResponse({ company: null })).toBeNull();
  });

  it('coerces a missing company to null', () => {
    expect(normalizeMyCompanyResponse({})).toBeNull();
  });
});

describe('queryKeys.myCompany', () => {
  it('produces a user- and project-scoped key', () => {
    expect(queryKeys.myCompany('user-1', 'project-1')).toEqual([
      'my-company',
      'user-1',
      'project-1',
    ]);
  });

  it('falls back to anonymous and default sentinels when ids are absent', () => {
    expect(queryKeys.myCompany(undefined, null)).toEqual(['my-company', 'anonymous', 'default']);
  });
});
