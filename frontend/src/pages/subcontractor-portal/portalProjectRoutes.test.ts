import { describe, expect, it } from 'vitest';
import {
  buildPortalProjectPath,
  getPortalProjectQuery,
  readRequestedProjectId,
} from './portalProjectRoutes';

describe('portal project route helpers', () => {
  it('omits the project query when no project id is supplied', () => {
    expect(getPortalProjectQuery(null)).toBe('');
    expect(buildPortalProjectPath('/subcontractor-portal/dockets', undefined)).toBe(
      '/subcontractor-portal/dockets',
    );
  });

  it('appends an encoded project query when a project id is supplied', () => {
    expect(getPortalProjectQuery('proj 1')).toBe('?projectId=proj%201');
    expect(buildPortalProjectPath('/api/subcontractors/my-company', 'proj 1')).toBe(
      '/api/subcontractors/my-company?projectId=proj%201',
    );
  });

  it('trims requested project ids from URL search params', () => {
    expect(readRequestedProjectId(new URLSearchParams('projectId=%20project-1%20'))).toBe(
      'project-1',
    );
    expect(readRequestedProjectId(new URLSearchParams('projectId=%20'))).toBeNull();
  });
});
