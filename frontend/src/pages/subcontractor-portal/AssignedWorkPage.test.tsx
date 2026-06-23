import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LotCard } from './AssignedWorkPage';

describe('AssignedWorkPage LotCard (M51)', () => {
  it('renders the lot card as a link to the lot ITP run', () => {
    render(
      <MemoryRouter>
        <LotCard
          lot={{ id: 'lot-1', lotNumber: 'L-001', status: 'in_progress', activity: 'Earthworks' }}
          to="/subcontractor-portal/lots/lot-1/itp?projectId=p1"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /L-001/ });
    expect(link.getAttribute('href')).toContain('/subcontractor-portal/lots/lot-1/itp');
  });
});
