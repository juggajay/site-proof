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
                description: 'Awaiting inspection',
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
    // Rows keep the project name but drop the free-text description (A4 P1.3);
    // the PDF still prints it.
    expect(screen.getAllByText('Highway Upgrade')).toHaveLength(2);
    expect(screen.queryByText(/Cracked slab/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Awaiting inspection/)).not.toBeInTheDocument();
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
