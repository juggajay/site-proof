import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LotMetaRow } from './LotMetaRow';
import type { Lot } from '../types';

afterEach(cleanup);

const baseLot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Bulk earthworks',
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
  assignedSubcontractor: null,
};

describe('LotMetaRow', () => {
  it('omits valueless fields instead of rendering em-dash placeholders', () => {
    render(<LotMetaRow lot={baseLot} />);

    expect(screen.queryByText('Chainage')).not.toBeInTheDocument();
    expect(screen.queryByText('Layer')).not.toBeInTheDocument();
    expect(screen.queryByText('Area/Zone')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();

    // The fields that do have values still render.
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Earthworks')).toBeInTheDocument();
  });

  it('renders every populated field with its label', () => {
    render(
      <LotMetaRow
        lot={{ ...baseLot, chainageStart: 100, chainageEnd: 250, layer: 'Subbase', areaZone: 'Z3' }}
      />,
    );

    expect(screen.getByText('100 - 250')).toBeInTheDocument();
    expect(screen.getByText('Subbase')).toBeInTheDocument();
    expect(screen.getByText('Z3')).toBeInTheDocument();
  });

  it('keeps chainage 0 — a real chainage, not an empty field', () => {
    render(<LotMetaRow lot={{ ...baseLot, chainageStart: 0, chainageEnd: 0 }} />);

    expect(screen.getByText('Chainage')).toBeInTheDocument();
    expect(screen.getByText('0 - 0')).toBeInTheDocument();
  });

  it('renders one open end of a chainage range on its own', () => {
    render(<LotMetaRow lot={{ ...baseLot, chainageStart: null, chainageEnd: 420 }} />);

    expect(screen.getByText('420')).toBeInTheDocument();
  });

  it('carries the exact instant in the timestamp tooltip', () => {
    render(<LotMetaRow lot={baseLot} />);

    const created = screen.getByText('Created').parentElement?.querySelector('time');
    expect(created).toHaveAttribute('datetime', '2026-01-01T00:00:00.000Z');
    expect(created).toHaveAttribute('title', '2026-01-01T00:00:00.000Z');
  });
});
