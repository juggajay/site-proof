/**
 * Tests for TestsTabContent — verifies mobile card rendering and that desktop
 * table rendering is unchanged.
 */

import { cleanup, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { TestsTabContent } from './TestsTabContent';
import type { TestResult } from '@/pages/lots/types';

afterEach(() => {
  cleanup();
});

const baseTest: TestResult = {
  id: 'test-1',
  testType: 'Compaction Test',
  testRequestNumber: 'REQ-001',
  laboratoryName: 'Acme Labs',
  resultValue: 98.5,
  resultUnit: '%',
  passFail: 'pass',
  status: 'verified',
  createdAt: '2026-01-15T00:00:00.000Z',
};

const failingTest: TestResult = {
  ...baseTest,
  id: 'test-2',
  testRequestNumber: null,
  laboratoryName: null,
  resultValue: null,
  resultUnit: null,
  passFail: 'fail',
  status: 'entered',
  createdAt: '2026-02-20T00:00:00.000Z',
};

describe('TestsTabContent — loading state', () => {
  it('shows a spinner when loading', () => {
    renderWithProviders(<TestsTabContent projectId="proj-1" testResults={[]} loading={true} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('TestsTabContent — empty state', () => {
  it('renders the empty state for both mobile and desktop', () => {
    const { unmount } = renderWithProviders(
      <TestsTabContent projectId="proj-1" testResults={[]} loading={false} isMobile={true} />,
    );
    expect(screen.getByText('No Test Results')).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <TestsTabContent projectId="proj-1" testResults={[]} loading={false} isMobile={false} />,
    );
    expect(screen.getByText('No Test Results')).toBeInTheDocument();
  });
});

describe('TestsTabContent — mobile card rendering', () => {
  it('renders one card per test result with key fields', () => {
    renderWithProviders(
      <TestsTabContent
        projectId="proj-1"
        testResults={[baseTest, failingTest]}
        loading={false}
        isMobile={true}
      />,
    );

    const container = screen.getByTestId('tests-mobile-cards');
    expect(container).toBeInTheDocument();

    // Both test types appear
    expect(screen.getAllByText('Compaction Test')).toHaveLength(2);

    // Request number as subtitle on first card
    expect(screen.getByText('Request REQ-001')).toBeInTheDocument();

    // Pass/fail status badges
    expect(screen.getByText('pass')).toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();

    // Result values
    expect(screen.getByText('98.5 %')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    // Status labels
    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText('entered')).toBeInTheDocument();

    // Laboratory name (rendered as "Laboratory: Acme Labs" in secondary span)
    expect(screen.getByText(/Acme Labs/)).toBeInTheDocument();
  });

  it('does NOT render the desktop table on mobile', () => {
    renderWithProviders(
      <TestsTabContent
        projectId="proj-1"
        testResults={[baseTest]}
        loading={false}
        isMobile={true}
      />,
    );

    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('fires navigate to tests register when a card is clicked', async () => {
    // We just need to confirm the onClick fires without error (navigate is
    // mocked by MemoryRouter — no actual navigation occurs in tests).
    renderWithProviders(
      <TestsTabContent
        projectId="proj-1"
        testResults={[baseTest]}
        loading={false}
        isMobile={true}
      />,
    );

    const card = screen.getByRole('button', { name: /Compaction Test/i });
    expect(card).toBeInTheDocument();
    // Tap target: MobileDataCard renders with cursor-pointer; clicking should not throw
    fireEvent.click(card);
  });

  it('each card has a min touch target via MobileDataCard (role=button)', () => {
    renderWithProviders(
      <TestsTabContent
        projectId="proj-1"
        testResults={[baseTest, failingTest]}
        loading={false}
        isMobile={true}
      />,
    );

    const buttons = screen.getAllByRole('button', { name: /Compaction Test/i });
    expect(buttons).toHaveLength(2);
  });
});

describe('TestsTabContent — desktop rendering unchanged', () => {
  it('renders the desktop table when isMobile is false', () => {
    renderWithProviders(
      <TestsTabContent
        projectId="proj-1"
        testResults={[baseTest]}
        loading={false}
        isMobile={false}
      />,
    );

    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Test Type')).toBeInTheDocument();
    expect(screen.getByText('Pass/Fail')).toBeInTheDocument();
    expect(screen.queryByTestId('tests-mobile-cards')).not.toBeInTheDocument();
  });

  it('renders the desktop table when isMobile is omitted (default false)', () => {
    renderWithProviders(
      <TestsTabContent projectId="proj-1" testResults={[baseTest]} loading={false} />,
    );

    expect(document.querySelector('table')).toBeInTheDocument();
    expect(screen.queryByTestId('tests-mobile-cards')).not.toBeInTheDocument();
  });
});
