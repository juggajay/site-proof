import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QualityManagementSection } from './QualityManagementSection';
import type { ConformStatus, Lot } from '../types';

const lot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: null,
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
  assignedSubcontractor: null,
};

const baseConformStatus: ConformStatus = {
  canConform: false,
  blockingReasons: ['2 hold point items marked N/A but not released'],
  prerequisites: {
    itpAssigned: true,
    itpCompleted: true,
    itpCompletedCount: 4,
    itpTotalCount: 4,
    testRequired: false,
    hasPassingTest: false,
    noOpenNcrs: true,
    openNcrs: [],
    noNaHoldPointBypass: false,
    naHoldPointBlockerCount: 2,
  },
};

function renderSection(conformStatus: ConformStatus = baseConformStatus) {
  return render(
    <QualityManagementSection
      lot={lot}
      conformStatus={conformStatus}
      loadingConformStatus={false}
      canConformLots={true}
      canForceConformLots={false}
      canVerifyTestResults={false}
      conforming={false}
      generatingReport={false}
      showReportFormatDialog={false}
      selectedReportFormat="standard"
      onConformLot={vi.fn()}
      onForceConformLot={vi.fn()}
      onTabChange={vi.fn()}
      onShowReportDialog={vi.fn()}
      onGenerateReport={vi.fn()}
      onCloseReportDialog={vi.fn()}
      onReportFormatChange={vi.fn()}
    />,
  );
}

describe('QualityManagementSection', () => {
  it('shows unreleased N/A hold-point blockers in the prerequisites checklist', () => {
    renderSection();

    expect(screen.getByText('N/A hold-point releases')).toBeInTheDocument();
    expect(screen.getByText('(2 unreleased)')).toBeInTheDocument();
    expect(screen.getByText('2 hold point items marked N/A but not released')).toBeInTheDocument();
  });
});
