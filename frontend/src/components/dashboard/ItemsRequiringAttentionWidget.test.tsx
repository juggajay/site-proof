import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemsRequiringAttentionWidget, type AttentionItem } from './ItemsRequiringAttentionWidget';

function buildItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: 'item-1',
    type: 'ncr',
    title: 'NCR-001',
    description: 'Cracked slab',
    status: 'open',
    project: { id: 'p1', name: 'Highway Upgrade', projectNumber: 'HW-1' },
    link: '/projects/p1/ncrs/n1',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('ItemsRequiringAttentionWidget', () => {
  it('renders nothing when there are no attention items', () => {
    const { container } = render(
      <ItemsRequiringAttentionWidget
        attentionItems={{ overdueNCRs: [], staleHoldPoints: [], total: 0 }}
        onNavigate={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Items Requiring Attention')).not.toBeInTheDocument();
  });

  it('renders overdue NCRs and stale hold points with their counts, without free-text descriptions', () => {
    render(
      <MemoryRouter>
        <ItemsRequiringAttentionWidget
          attentionItems={{
            overdueNCRs: [buildItem({ id: 'ncr-1', title: 'NCR-001', daysOverdue: 3 })],
            staleHoldPoints: [
              buildItem({
                id: 'hp-1',
                type: 'holdpoint',
                title: 'HP-009',
                // What statsRoute actually puts in a hold-point row's
                // `description` (statsRoute.ts: `Lot ${hp.lot.lotNumber}`) —
                // a structured field, not the NCR limb's free text.
                description: 'Lot LOT-014',
                daysStale: 1,
              }),
            ],
            total: 2,
          }}
          onNavigate={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Items Requiring Attention' })).toBeInTheDocument();
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
    expect(screen.getByText('HP-009')).toBeInTheDocument();
    expect(screen.getByText(/Overdue NCRs \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/3 days overdue/)).toBeInTheDocument();
    expect(screen.getByText(/Stale Hold Points \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 day waiting/)).toBeInTheDocument();
    // NCR rows keep the project name and drop the free text (A4 P1.3).
    expect(screen.getByText('Highway Upgrade')).toBeInTheDocument();
    expect(screen.queryByText(/Cracked slab/)).not.toBeInTheDocument();
  });

  // M8 (deep review 2026-07-28) — #de9e25a5 dropped the hold-point lot number
  // along with the NCR free text, so five "Subgrade proof roll" hold points
  // rendered as five identical rows. The dashboard PDF still printed the lot,
  // which made the PDF more useful than the screen.
  it('keeps the lot number on hold-point rows so identical descriptions stay distinguishable', () => {
    render(
      <MemoryRouter>
        <ItemsRequiringAttentionWidget
          attentionItems={{
            overdueNCRs: [],
            staleHoldPoints: [
              buildItem({
                id: 'hp-1',
                type: 'holdpoint',
                title: 'Subgrade proof roll',
                description: 'Lot LOT-014',
                daysStale: 9,
              }),
              buildItem({
                id: 'hp-2',
                type: 'holdpoint',
                title: 'Subgrade proof roll',
                description: 'Lot LOT-015',
                daysStale: 8,
              }),
            ],
            total: 2,
          }}
          onNavigate={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Lot LOT-014/)).toBeInTheDocument();
    expect(screen.getByText(/Lot LOT-015/)).toBeInTheDocument();
  });

  it('links the header through to the needs-attention screen', () => {
    render(
      <MemoryRouter>
        <ItemsRequiringAttentionWidget
          attentionItems={{ overdueNCRs: [buildItem()], staleHoldPoints: [], total: 1 }}
          onNavigate={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'View all →' })).toHaveAttribute(
      'href',
      '/dashboard/needs-attention',
    );
  });

  it('navigates to the item link, falling back to /projects for unsafe links', () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <ItemsRequiringAttentionWidget
          attentionItems={{
            overdueNCRs: [
              buildItem({ id: 'safe', title: 'Safe NCR', link: '/projects/p1/ncrs/n1' }),
              buildItem({ id: 'unsafe', title: 'Unsafe NCR', link: 'https://evil.example' }),
            ],
            staleHoldPoints: [],
            total: 2,
          }}
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Safe NCR'));
    expect(onNavigate).toHaveBeenCalledWith('/projects/p1/ncrs/n1');

    fireEvent.click(screen.getByText('Unsafe NCR'));
    expect(onNavigate).toHaveBeenCalledWith('/projects');
  });
});
