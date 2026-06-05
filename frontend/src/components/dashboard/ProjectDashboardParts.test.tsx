import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityRow } from './ProjectDashboardParts';
import {
  formatRelativeTime,
  formatStatusLabel,
  getActivityFallbackRoute,
  getAttentionFallbackRoute,
  getSafeProjectLink,
} from './ProjectDashboardHelpers';

describe('ProjectDashboardParts helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats project status labels without changing the fallback', () => {
    expect(formatStatusLabel(undefined)).toBe('Draft');
    expect(formatStatusLabel('')).toBe('Draft');
    expect(formatStatusLabel('on_hold')).toBe('On Hold');
    expect(formatStatusLabel('in-progress')).toBe('In Progress');
    expect(formatStatusLabel('ACTIVE')).toBe('Active');
  });

  it('keeps dashboard links inside the current project route', () => {
    const projectRouteBase = '/projects/project-123';

    expect(getSafeProjectLink('/projects/project-123/lots', projectRouteBase, '/fallback')).toBe(
      '/projects/project-123/lots',
    );
    expect(getSafeProjectLink('/projects/other/lots', projectRouteBase, '/fallback')).toBe(
      '/fallback',
    );
    expect(
      getSafeProjectLink('//example.com/projects/project-123', projectRouteBase, '/fallback'),
    ).toBe('/fallback');
    expect(getSafeProjectLink(undefined, projectRouteBase, '/fallback')).toBe('/fallback');
  });

  it('maps attention and activity item types to project fallback routes', () => {
    const projectRouteBase = '/projects/project-123';

    expect(getAttentionFallbackRoute('ncr', projectRouteBase)).toBe('/projects/project-123/ncr');
    expect(getAttentionFallbackRoute('holdpoint', projectRouteBase)).toBe(
      '/projects/project-123/hold-points',
    );

    expect(getActivityFallbackRoute('lot', projectRouteBase)).toBe('/projects/project-123/lots');
    expect(getActivityFallbackRoute('ncr', projectRouteBase)).toBe('/projects/project-123/ncr');
    expect(getActivityFallbackRoute('holdpoint', projectRouteBase)).toBe(
      '/projects/project-123/hold-points',
    );
    expect(getActivityFallbackRoute('diary', projectRouteBase)).toBe('/projects/project-123/diary');
    expect(getActivityFallbackRoute('docket', projectRouteBase)).toBe(
      '/projects/project-123/dockets',
    );
  });

  it('formats relative activity time from the current clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T10:00:00.000Z'));

    expect(formatRelativeTime('2026-06-05T09:59:45.000Z')).toBe('Just now');
    expect(formatRelativeTime('2026-06-05T09:40:00.000Z')).toBe('20m ago');
    expect(formatRelativeTime('2026-06-05T07:00:00.000Z')).toBe('3h ago');
    expect(formatRelativeTime('2026-06-02T10:00:00.000Z')).toBe('3d ago');
    expect(formatRelativeTime('not-a-date')).toBe('Unknown time');
  });

  it('renders activity rows with safe project links or non-link content', () => {
    const projectRouteBase = '/projects/project-123';
    const timestamp = '2026-06-05T09:40:00.000Z';

    const { rerender } = render(
      <MemoryRouter>
        <ActivityRow
          activity={{
            id: 'activity-1',
            type: 'lot',
            description: 'Lot updated',
            timestamp,
            link: '/projects/other/lots',
          }}
          projectRouteBase={projectRouteBase}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /lot updated/i })).toHaveAttribute(
      'href',
      '/projects/project-123/lots',
    );

    rerender(
      <MemoryRouter>
        <ActivityRow
          activity={{
            id: 'activity-2',
            type: 'diary',
            description: 'Diary submitted',
            timestamp,
          }}
          projectRouteBase={projectRouteBase}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Diary submitted')).toBeInTheDocument();
  });
});
