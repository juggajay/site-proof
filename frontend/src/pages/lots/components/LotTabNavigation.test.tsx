import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotTabNavigation } from './LotTabNavigation';
import type { TabConfig } from '../types';

afterEach(() => {
  cleanup();
});

const tabs: TabConfig[] = [
  { id: 'itp', label: 'ITP Checklist' },
  { id: 'photos', label: 'Photos' },
  { id: 'ncrs', label: 'NCRs' },
  { id: 'tests', label: 'Test Results' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
];

describe('LotTabNavigation', () => {
  it('renders the tabs in the order provided', () => {
    render(<LotTabNavigation tabs={tabs} currentTab="itp" onTabChange={vi.fn()} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'ITP Checklist',
      'Photos',
      'NCRs',
      'Test Results',
      'Documents',
      'Comments',
      'History',
    ]);
  });

  it('is horizontally scrollable with non-shrinking tabs so nothing clips at 390px', () => {
    render(<LotTabNavigation tabs={tabs} currentTab="itp" onTabChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Lot detail tabs' });
    // The strip scrolls horizontally instead of clipping/wrapping the 7 tabs.
    expect(nav.parentElement).toHaveClass('overflow-x-auto');
    // Each tab keeps its width (stable touch target) rather than squishing.
    expect(screen.getByRole('tab', { name: 'ITP Checklist' })).toHaveClass('flex-shrink-0');
  });
});
