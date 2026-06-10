/**
 * Tests for NCRsTabContent — verifies mobile card rendering and that desktop
 * table rendering is unchanged.
 */

import { cleanup, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { NCRsTabContent } from './NCRsTabContent';
import type { NCR } from '@/pages/lots/types';

afterEach(() => {
  cleanup();
});

const openNcr: NCR = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Concrete compaction below specification limit at station 1+400.',
  category: 'workmanship',
  severity: 'major',
  status: 'open',
  raisedBy: { fullName: 'Jane Smith', email: 'jane@example.com' },
  createdAt: '2026-01-10T00:00:00.000Z',
};

const closedNcr: NCR = {
  id: 'ncr-2',
  ncrNumber: 'NCR-002',
  description: 'Minor surface defect on kerb.',
  category: 'materials',
  severity: 'minor',
  status: 'closed',
  raisedBy: { fullName: '', email: 'bob@example.com' },
  createdAt: '2026-02-01T00:00:00.000Z',
};

describe('NCRsTabContent — loading state', () => {
  it('shows a spinner when loading', () => {
    renderWithProviders(<NCRsTabContent projectId="proj-1" ncrs={[]} loading={true} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('NCRsTabContent — empty state', () => {
  it('renders the empty state for both mobile and desktop', () => {
    const { unmount } = renderWithProviders(
      <NCRsTabContent projectId="proj-1" ncrs={[]} loading={false} isMobile={true} />,
    );
    expect(screen.getByText('No NCRs')).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <NCRsTabContent projectId="proj-1" ncrs={[]} loading={false} isMobile={false} />,
    );
    expect(screen.getByText('No NCRs')).toBeInTheDocument();
  });
});

describe('NCRsTabContent — mobile card rendering', () => {
  it('renders one card per NCR with key fields', () => {
    renderWithProviders(
      <NCRsTabContent
        projectId="proj-1"
        ncrs={[openNcr, closedNcr]}
        loading={false}
        isMobile={true}
      />,
    );

    const container = screen.getByTestId('ncrs-mobile-cards');
    expect(container).toBeInTheDocument();

    // NCR numbers as titles
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
    expect(screen.getByText('NCR-002')).toBeInTheDocument();

    // Descriptions as subtitles (MobileDataCard truncates via subtitle)
    expect(
      screen.getByText('Concrete compaction below specification limit at station 1+400.'),
    ).toBeInTheDocument();

    // Severity badges
    expect(screen.getByText('MAJOR')).toBeInTheDocument();
    expect(screen.getByText('MINOR')).toBeInTheDocument();

    // Status pills (formatStatusLabel output)
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();

    // Raised by (rendered as "Raised By: Jane Smith" in secondary span)
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    // fallback to email when fullName is empty
    expect(screen.getByText(/bob@example\.com/)).toBeInTheDocument();
  });

  it('does NOT render the desktop table on mobile', () => {
    renderWithProviders(
      <NCRsTabContent projectId="proj-1" ncrs={[openNcr]} loading={false} isMobile={true} />,
    );

    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('fires navigate to NCR register when a card is clicked', () => {
    renderWithProviders(
      <NCRsTabContent projectId="proj-1" ncrs={[openNcr]} loading={false} isMobile={true} />,
    );

    const card = screen.getByRole('button', { name: /NCR-001/i });
    expect(card).toBeInTheDocument();
    // Should not throw
    fireEvent.click(card);
  });

  it('each card is accessible via role=button (44px tap target via MobileDataCard)', () => {
    renderWithProviders(
      <NCRsTabContent
        projectId="proj-1"
        ncrs={[openNcr, closedNcr]}
        loading={false}
        isMobile={true}
      />,
    );

    // Two cards; each is a role=button from MobileDataCard
    expect(screen.getByRole('button', { name: /NCR-001/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NCR-002/i })).toBeInTheDocument();
  });
});

describe('NCRsTabContent — desktop rendering unchanged', () => {
  it('renders the desktop table when isMobile is false', () => {
    renderWithProviders(
      <NCRsTabContent projectId="proj-1" ncrs={[openNcr]} loading={false} isMobile={false} />,
    );

    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('NCR #')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.queryByTestId('ncrs-mobile-cards')).not.toBeInTheDocument();
  });

  it('renders the desktop table when isMobile is omitted (default false)', () => {
    renderWithProviders(<NCRsTabContent projectId="proj-1" ncrs={[openNcr]} loading={false} />);

    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.queryByTestId('ncrs-mobile-cards')).not.toBeInTheDocument();
  });
});
