import { describe, expect, it } from 'vitest';
import {
  buildProjectEntityLink,
  buildSubcontractorPortalEntityLink,
  getSubcontractorAlertPortalTarget,
} from './links.js';

/**
 * Characterizes the pure notification link / portal-target helpers extracted
 * verbatim from backend/src/routes/notifications.ts. These freeze the entity-type
 * → portal-module mapping, the entity-type → in-app URL mapping, entity-type
 * normalization (case, spaces, hyphens), id encoding, and the fallback/null
 * behaviour so the extraction is provably behaviour-preserving.
 */

describe('getSubcontractorAlertPortalTarget', () => {
  it('maps lot/ITP/hold-point/test/ncr/document/docket entity types to their portal module', () => {
    expect(getSubcontractorAlertPortalTarget('lot')).toBe('lots');

    expect(getSubcontractorAlertPortalTarget('itp')).toBe('itps');
    expect(getSubcontractorAlertPortalTarget('itp_instance')).toBe('itps');
    expect(getSubcontractorAlertPortalTarget('itpinstance')).toBe('itps');
    expect(getSubcontractorAlertPortalTarget('itp_completion')).toBe('itps');
    expect(getSubcontractorAlertPortalTarget('itpcompletion')).toBe('itps');

    expect(getSubcontractorAlertPortalTarget('holdpoint')).toBe('holdPoints');
    expect(getSubcontractorAlertPortalTarget('hold_point')).toBe('holdPoints');

    expect(getSubcontractorAlertPortalTarget('test')).toBe('testResults');
    expect(getSubcontractorAlertPortalTarget('test_result')).toBe('testResults');
    expect(getSubcontractorAlertPortalTarget('testresult')).toBe('testResults');

    expect(getSubcontractorAlertPortalTarget('ncr')).toBe('ncrs');
    expect(getSubcontractorAlertPortalTarget('document')).toBe('documents');
  });

  it('maps docket entity types (docket/daily_docket/dailydocket) to the dockets portal', () => {
    expect(getSubcontractorAlertPortalTarget('docket')).toBe('dockets');
    expect(getSubcontractorAlertPortalTarget('daily_docket')).toBe('dockets');
    expect(getSubcontractorAlertPortalTarget('dailydocket')).toBe('dockets');
  });

  it('returns null for entity types it does not map (labour, plant, drawing, diary, claim, unknown)', () => {
    // Current behaviour: only the cases above are mapped; everything else is null.
    // labour/plant/drawing are NOT routed to the dockets portal here.
    expect(getSubcontractorAlertPortalTarget('labour')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('plant')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('drawing')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('diary')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('claim')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('something-else')).toBeNull();
    expect(getSubcontractorAlertPortalTarget('')).toBeNull();
  });

  it('normalizes case, spaces, and hyphens before matching', () => {
    expect(getSubcontractorAlertPortalTarget('Lot')).toBe('lots');
    expect(getSubcontractorAlertPortalTarget('HOLD POINT')).toBe('holdPoints');
    expect(getSubcontractorAlertPortalTarget('hold-point')).toBe('holdPoints');
    expect(getSubcontractorAlertPortalTarget('Daily Docket')).toBe('dockets');
    expect(getSubcontractorAlertPortalTarget('daily-docket')).toBe('dockets');
    expect(getSubcontractorAlertPortalTarget('ITP Instance')).toBe('itps');
    expect(getSubcontractorAlertPortalTarget('Test-Result')).toBe('testResults');
  });
});

describe('buildProjectEntityLink', () => {
  it('returns /dashboard when projectId is missing', () => {
    expect(buildProjectEntityLink('lot', 'lot-1')).toBe('/dashboard');
    expect(buildProjectEntityLink('lot', 'lot-1', null)).toBe('/dashboard');
    expect(buildProjectEntityLink('lot', 'lot-1', '')).toBe('/dashboard');
  });

  it('links a lot with the entity id in the path', () => {
    expect(buildProjectEntityLink('lot', 'lot-1', 'p1')).toBe('/projects/p1/lots/lot-1');
  });

  it('links query-param entity types to the expected paths', () => {
    expect(buildProjectEntityLink('ncr', 'n1', 'p1')).toBe('/projects/p1/ncr?ncr=n1');
    expect(buildProjectEntityLink('test', 't1', 'p1')).toBe('/projects/p1/tests?test=t1');
    expect(buildProjectEntityLink('test_result', 't1', 'p1')).toBe('/projects/p1/tests?test=t1');
    expect(buildProjectEntityLink('testresult', 't1', 'p1')).toBe('/projects/p1/tests?test=t1');
    expect(buildProjectEntityLink('holdpoint', 'h1', 'p1')).toBe(
      '/projects/p1/hold-points?holdPoint=h1',
    );
    expect(buildProjectEntityLink('hold_point', 'h1', 'p1')).toBe(
      '/projects/p1/hold-points?holdPoint=h1',
    );
    expect(buildProjectEntityLink('document', 'd1', 'p1')).toBe(
      '/projects/p1/documents?document=d1',
    );
    expect(buildProjectEntityLink('drawing', 'dr1', 'p1')).toBe(
      '/projects/p1/drawings?drawing=dr1',
    );
    expect(buildProjectEntityLink('docket', 'dk1', 'p1')).toBe('/projects/p1/dockets?docket=dk1');
    expect(buildProjectEntityLink('daily_docket', 'dk1', 'p1')).toBe(
      '/projects/p1/dockets?docket=dk1',
    );
    expect(buildProjectEntityLink('progress_claim', 'c1', 'p1')).toBe(
      '/projects/p1/claims?claim=c1',
    );
    expect(buildProjectEntityLink('claim', 'c1', 'p1')).toBe('/projects/p1/claims?claim=c1');
    expect(buildProjectEntityLink('itp', 'i1', 'p1')).toBe('/projects/p1/itp?itp=i1');
    expect(buildProjectEntityLink('itp_instance', 'i1', 'p1')).toBe('/projects/p1/itp?itp=i1');
  });

  it('links diary to the diary page without an entity query param', () => {
    expect(buildProjectEntityLink('diary', 'ignored-id', 'p1')).toBe('/projects/p1/diary');
    expect(buildProjectEntityLink('daily_diary', 'ignored-id', 'p1')).toBe('/projects/p1/diary');
    expect(buildProjectEntityLink('dailydiary', 'ignored-id', 'p1')).toBe('/projects/p1/diary');
  });

  it('falls back to the project root for unknown entity types', () => {
    expect(buildProjectEntityLink('mystery', 'x', 'p1')).toBe('/projects/p1');
  });

  it('normalizes case, spaces, and hyphens in the entity type', () => {
    expect(buildProjectEntityLink('Hold-Point', 'h1', 'p1')).toBe(
      '/projects/p1/hold-points?holdPoint=h1',
    );
    expect(buildProjectEntityLink('Daily Docket', 'dk1', 'p1')).toBe(
      '/projects/p1/dockets?docket=dk1',
    );
  });

  it('URL-encodes the project id and lot entity id in the path', () => {
    expect(buildProjectEntityLink('lot', 'lot/1 a', 'proj/A')).toBe(
      '/projects/proj%2FA/lots/lot%2F1%20a',
    );
    expect(buildProjectEntityLink('mystery', 'x', 'proj/A')).toBe('/projects/proj%2FA');
  });

  it('URL-encodes query-param entity ids', () => {
    expect(buildProjectEntityLink('ncr', 'n 1&2', 'p1')).toBe('/projects/p1/ncr?ncr=n+1%262');
  });

  it('merges extra params and skips undefined/empty values', () => {
    expect(buildProjectEntityLink('ncr', 'n1', 'p1', { source: 'email' })).toBe(
      '/projects/p1/ncr?ncr=n1&source=email',
    );
    expect(buildProjectEntityLink('ncr', 'n1', 'p1', { source: undefined, blank: '' })).toBe(
      '/projects/p1/ncr?ncr=n1',
    );
    expect(buildProjectEntityLink('diary', 'd1', 'p1', { source: 'digest' })).toBe(
      '/projects/p1/diary?source=digest',
    );
    expect(buildProjectEntityLink('mystery', 'x', 'p1', { source: 'digest' })).toBe(
      '/projects/p1?source=digest',
    );
  });
});

describe('buildSubcontractorPortalEntityLink', () => {
  it('returns the subcontractor portal home when projectId is missing', () => {
    expect(buildSubcontractorPortalEntityLink('lot', 'lot-1')).toBe('/subcontractor-portal');
  });

  it('links subcontractor-visible entity types to portal routes with project scope', () => {
    expect(buildSubcontractorPortalEntityLink('lot', 'lot-1', 'p1')).toBe(
      '/subcontractor-portal/work?lot=lot-1&projectId=p1',
    );
    expect(buildSubcontractorPortalEntityLink('ncr', 'n1', 'p1')).toBe(
      '/subcontractor-portal/ncrs?ncr=n1&projectId=p1',
    );
    expect(buildSubcontractorPortalEntityLink('test_result', 't1', 'p1')).toBe(
      '/subcontractor-portal/tests?test=t1&projectId=p1',
    );
    expect(buildSubcontractorPortalEntityLink('hold_point', 'h1', 'p1')).toBe(
      '/subcontractor-portal/holdpoints?holdPoint=h1&projectId=p1',
    );
    expect(buildSubcontractorPortalEntityLink('document', 'd1', 'p1')).toBe(
      '/subcontractor-portal/documents?document=d1&projectId=p1',
    );
    expect(buildSubcontractorPortalEntityLink('itp_completion', 'i1', 'p1')).toBe(
      '/subcontractor-portal/itps?itp=i1&projectId=p1',
    );
  });

  it('links docket alerts directly to the subcontractor docket detail route', () => {
    expect(
      buildSubcontractorPortalEntityLink('daily_docket', 'docket/1', 'p1', {
        subcontractorCompanyId: 'subbie-1',
      }),
    ).toBe('/subcontractor-portal/docket/docket%2F1?projectId=p1&subcontractorCompanyId=subbie-1');
  });

  it('falls back to the portal home for unknown entity types while preserving project scope', () => {
    expect(buildSubcontractorPortalEntityLink('mystery', 'x', 'p1')).toBe(
      '/subcontractor-portal?projectId=p1',
    );
  });
});
