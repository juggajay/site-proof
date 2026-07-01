import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DocketEditTabs } from './DocketEditTabs';
import type { Docket, Employee, Plant } from '../docketEditData';

const employee: Employee = {
  id: 'employee-1',
  name: 'Tommy Vella',
  role: 'Pipe Layer',
  hourlyRate: 74,
  status: 'approved',
};

const plant: Plant = {
  id: 'plant-1',
  type: 'Excavator',
  description: 'CAT 320',
  idRego: 'EXC-014',
  dryRate: 150,
  wetRate: 180,
  status: 'approved',
};

const approvedDocket: Docket = {
  id: 'docket-1',
  docketNumber: 'DKT-001',
  date: '2026-06-12',
  status: 'approved',
  totalLabourSubmitted: 592,
  totalPlantSubmitted: 450,
  totalLabourApprovedCost: 444,
  totalPlantApprovedCost: 300,
  labourEntries: [
    {
      id: 'labour-1',
      employee,
      startTime: '07:00',
      finishTime: '15:00',
      submittedHours: 8,
      hourlyRate: 74,
      submittedCost: 592,
      approvedHours: 6,
      approvedCost: 444,
      lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 8 }],
    },
  ],
  plantEntries: [
    {
      id: 'plant-entry-1',
      plant,
      hoursOperated: 3,
      wetOrDry: 'dry',
      hourlyRate: 150,
      submittedCost: 450,
      approvedCost: 300,
      lotAllocations: [{ lotId: 'lot-1', lotNumber: 'LOT-014', hours: 3 }],
    },
  ],
};

function renderTabs(activeTab: 'labour' | 'plant' | 'summary') {
  return render(
    <MemoryRouter>
      <DocketEditTabs
        activeTab={activeTab}
        onTabChange={vi.fn()}
        docket={approvedDocket}
        canEdit={false}
        approvedEmployees={[employee]}
        approvedPlant={[plant]}
        myCompanyLink="/subcontractor-portal/my-company"
        today="2026-06-12"
        totalCost={744}
        notes=""
        onNotesChange={vi.fn()}
        onNotesBlur={vi.fn()}
        onAddLabour={vi.fn()}
        onAddPlant={vi.fn()}
        onDeleteLabour={vi.fn()}
        onDeletePlant={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('DocketEditTabs', () => {
  it('shows approved labour entry values with the submitted values as context', () => {
    renderTabs('labour');

    expect(screen.getByText('Tommy Vella')).toBeInTheDocument();
    expect(screen.getAllByText('$444').length).toBeGreaterThan(0);
    expect(screen.getByText('Submitted: 8h / $592')).toBeInTheDocument();
  });

  it('shows approved plant entry cost with the submitted value as context', () => {
    renderTabs('plant');

    expect(screen.getByText('Excavator')).toBeInTheDocument();
    expect(screen.getAllByText('$300').length).toBeGreaterThan(0);
    expect(screen.getByText('Submitted: 3h × $150/hr (dry) = $450')).toBeInTheDocument();
    expect(screen.getByText('LOT-014')).toBeInTheDocument();
  });
});
