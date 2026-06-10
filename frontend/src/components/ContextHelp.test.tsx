import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContextHelp, HELP_CONTENT, useContextHelp } from './ContextHelp';

// Every register/page surface that mounts <ContextHelp> resolves its copy from
// HELP_CONTENT by key. This list is the contract: each key must exist with
// real, non-empty copy so no page ever ships an empty help modal.
const MOUNTED_PAGE_KEYS = [
  'lots',
  'itp',
  'hold-points',
  'tests',
  'ncr',
  'diary',
  'dockets',
  'claims',
  'costs',
  'documents',
  'subcontractors',
  'reports',
  'dashboard',
  'projects',
] as const;

describe('HELP_CONTENT', () => {
  it.each(MOUNTED_PAGE_KEYS)('resolves real help copy for the "%s" page', (key) => {
    const entry = HELP_CONTENT[key];

    expect(entry).toBeDefined();
    expect(entry.title.trim().length).toBeGreaterThan(0);
    expect(entry.content.trim().length).toBeGreaterThan(20);
  });

  it('has no orphaned entries beyond the mounted page keys', () => {
    expect(Object.keys(HELP_CONTENT).sort()).toEqual([...MOUNTED_PAGE_KEYS].sort());
  });
});

describe('useContextHelp', () => {
  it('returns the entry for a known page key', () => {
    const { result } = renderHook(() => useContextHelp('lots'));

    expect(result.current).toEqual(HELP_CONTENT.lots);
  });

  it('falls back to a generic entry for unknown keys', () => {
    const { result } = renderHook(() => useContextHelp('does-not-exist'));

    expect(result.current).toEqual({
      title: 'Help',
      content: 'Help content is not available for this page.',
    });
  });
});

describe('ContextHelp', () => {
  it('opens the help modal with the page title and copy', async () => {
    const user = userEvent.setup();
    render(<ContextHelp title={HELP_CONTENT.lots.title} content={HELP_CONTENT.lots.content} />);

    await user.click(screen.getByRole('button', { name: 'Help for Lot Register' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/central hub for managing work lots/)).toBeInTheDocument();
  });
});
