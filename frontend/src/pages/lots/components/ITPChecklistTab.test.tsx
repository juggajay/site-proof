import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ITPChecklistTab, type ITPChecklistTabProps } from './ITPChecklistTab';
import type { Lot, ITPTemplate, ITPInstance, ITPChecklistItem, ITPCompletion } from '../types';

afterEach(() => {
  cleanup();
});

const lot: Lot = {
  id: 'lot-1',
  lotNumber: 'EW-001',
  description: 'Earthworks lot',
  status: 'in_progress',
  activityType: 'earthworks',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
  assignedSubcontractor: null,
};

const template: ITPTemplate = {
  id: 'template-1',
  name: 'Earthworks ITP',
  activityType: 'earthworks',
  checklistItems: [],
};

function makeChecklistItem(
  overrides: Partial<ITPChecklistItem> & Pick<ITPChecklistItem, 'id'>,
): ITPChecklistItem {
  return {
    description: 'Checklist item',
    category: 'General',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: 1,
    testType: null,
    acceptanceCriteria: null,
    ...overrides,
  };
}

function makeCompletion(
  overrides: Partial<ITPCompletion> & Pick<ITPCompletion, 'checklistItemId'>,
): ITPCompletion {
  return {
    id: `completion-${overrides.checklistItemId}`,
    isCompleted: false,
    isNotApplicable: false,
    isFailed: false,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
    ...overrides,
  };
}

// Two categories: Earthworks complete, Pavement still has open work.
const itpInstance: ITPInstance = {
  id: 'instance-1',
  template: {
    id: 'template-1',
    name: 'Earthworks ITP',
    checklistItems: [
      makeChecklistItem({
        id: 'item-1',
        description: 'Strip topsoil',
        category: 'Earthworks',
        order: 1,
      }),
      makeChecklistItem({
        id: 'item-2',
        description: 'Compact subgrade',
        category: 'Pavement',
        order: 2,
      }),
    ],
  },
  completions: [makeCompletion({ checklistItemId: 'item-1', isCompleted: true })],
};

function renderChecklist(overrides: Partial<ITPChecklistTabProps> = {}) {
  const props: ITPChecklistTabProps = {
    lot,
    projectId: 'project-1',
    itpInstance: null,
    setItpInstance: vi.fn(),
    templates: [template],
    loadingItp: false,
    itpLoadError: null,
    isOnline: true,
    isOfflineData: false,
    offlinePendingCount: 0,
    isMobile: false,
    updatingCompletion: null,
    canCompleteITPItems: true,
    canAssignITPTemplate: true,
    onToggleCompletion: vi.fn(),
    onUpdateNotes: vi.fn(),
    onMarkAsNA: vi.fn(),
    onMarkAsFailed: vi.fn(),
    onAddPhoto: vi.fn(),
    onAddPhotoDesktop: vi.fn(),
    onAssignTemplate: vi.fn(),
    onRetryItp: vi.fn(),
    assigningTemplate: false,
    onOpenNaModal: vi.fn(),
    onOpenFailedModal: vi.fn(),
    ...overrides,
  };

  return renderWithProviders(<ITPChecklistTab {...props} />);
}

describe('ITPChecklistTab desktop default expansion', () => {
  it('default-expands the first category that still has incomplete items', async () => {
    renderChecklist({ itpInstance });

    // Pavement (incomplete) is expanded; Earthworks (complete) stays collapsed.
    expect(await screen.findByText(/Compact subgrade/i)).toBeInTheDocument();
    expect(screen.queryByText(/Strip topsoil/i)).not.toBeInTheDocument();
    expect(screen.getByText('Pavement')).toBeInTheDocument();
    expect(screen.getByText('Earthworks')).toBeInTheDocument();
  });
});

describe('ITPChecklistTab no-assignment state', () => {
  it('shows assignment controls when the user can manage ITP templates', () => {
    renderChecklist();

    expect(screen.getByText(/No ITP template assigned to this lot yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign ITP Template' })).toBeInTheDocument();
    expect(screen.queryByText(/Ask your project manager/i)).not.toBeInTheDocument();
  });

  it('shows the template creation action for template managers when no templates exist', () => {
    renderChecklist({ templates: [] });

    expect(screen.getByRole('button', { name: 'Create ITP Template First' })).toBeInTheDocument();
  });

  it('guides field users without showing template-management actions', () => {
    renderChecklist({ canAssignITPTemplate: false });

    expect(screen.getByText(/An ITP template needs to be assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask your project manager or site engineer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign ITP Template' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create ITP Template First' }),
    ).not.toBeInTheDocument();
  });
});
