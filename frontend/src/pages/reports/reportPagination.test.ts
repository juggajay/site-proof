import { describe, expect, it } from 'vitest';
import { buildReportPaginationCaption } from './reportPagination';

describe('buildReportPaginationCaption (M69)', () => {
  it('captions a truncated page (shown < total)', () => {
    expect(buildReportPaginationCaption(100, 250, 'lots')).toBe('Showing first 100 of 250 lots.');
  });

  it('returns null when the page shows everything (shown === total)', () => {
    expect(buildReportPaginationCaption(42, 42, 'NCRs')).toBeNull();
  });

  it('returns null when nothing is truncated even if counts look odd (shown > total)', () => {
    expect(buildReportPaginationCaption(10, 5, 'lots')).toBeNull();
  });
});
