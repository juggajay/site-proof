import { describe, expect, it } from 'vitest';
import {
  defaultPMData,
  formatCurrency,
  getProjectRoute,
  getSafeInternalLink,
} from './ProjectManagerDashboardHelpers';

describe('ProjectManagerDashboardHelpers', () => {
  it('keeps the default dashboard data empty and safe to render', () => {
    expect(defaultPMData.project).toBeNull();
    expect(defaultPMData.lotProgress).toEqual({
      total: 0,
      notStarted: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
      progressPercentage: 0,
    });
    expect(defaultPMData.openNCRs.items).toEqual([]);
    expect(defaultPMData.holdPointPipeline.items).toEqual([]);
    expect(defaultPMData.claimStatus.recentClaims).toEqual([]);
    expect(defaultPMData.costTracking.trend).toBe('on_track');
    expect(defaultPMData.attentionItems).toEqual([]);
  });

  it('builds encoded project routes and falls back to the project list without an id', () => {
    expect(getProjectRoute('project 1/2', '/claims')).toBe('/projects/project%201%2F2/claims');
    expect(getProjectRoute('abc-123', '')).toBe('/projects/abc-123');
    expect(getProjectRoute(undefined, '/claims')).toBe('/projects');
  });

  it('accepts only internal single-slash links from API payloads', () => {
    expect(getSafeInternalLink('/projects/abc/lots', '/projects')).toBe('/projects/abc/lots');
    expect(getSafeInternalLink('//evil.example/projects/abc', '/projects')).toBe('/projects');
    expect(getSafeInternalLink('https://evil.example/projects/abc', '/projects')).toBe('/projects');
    expect(getSafeInternalLink(undefined, '/projects')).toBe('/projects');
  });

  it('formats currency using whole-dollar Australian dollars', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(1200)).toBe('$1,200');
    expect(formatCurrency(-4500)).toBe('-$4,500');
  });
});
