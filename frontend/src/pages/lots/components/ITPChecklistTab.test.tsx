import { cleanup, fireEvent, screen } from '@testing-library/react';
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

describe('ITPChecklistTab desktop status actions (UTF-009)', () => {
  function makeActionInstance(
    itemOverrides: Partial<ITPChecklistItem> = {},
    completions: ITPCompletion[] = [],
  ): ITPInstance {
    const item = makeChecklistItem({
      id: 'action-item',
      description: 'Check compaction result',
      category: 'Field checks',
      order: 1,
      ...itemOverrides,
    });

    return {
      id: 'instance-actions',
      template: {
        id: 'template-1',
        name: 'Earthworks ITP',
        checklistItems: [item],
      },
      completions,
    };
  }

  it('passes an item through the existing completion handler', async () => {
    const onToggleCompletion = vi.fn().mockResolvedValue(true);
    renderChecklist({
      itpInstance: makeActionInstance({}, [
        makeCompletion({ checklistItemId: 'action-item', notes: 'Ready to pass' }),
      ]),
      onToggleCompletion,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Pass this check/i }));

    expect(onToggleCompletion).toHaveBeenCalledWith('action-item', false, 'Ready to pass');
  });

  it('opens the existing failed-item flow from the Fail action', async () => {
    const onOpenFailedModal = vi.fn();
    renderChecklist({
      itpInstance: makeActionInstance(),
      onOpenFailedModal,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Fail this check/i }));

    expect(onOpenFailedModal).toHaveBeenCalledWith({
      checklistItemId: 'action-item',
      itemDescription: 'Check compaction result',
    });
  });

  it('opens the existing N/A flow from the N/A action', async () => {
    const onOpenNaModal = vi.fn();
    renderChecklist({
      itpInstance: makeActionInstance(),
      onOpenNaModal,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Mark not applicable/i }));

    expect(onOpenNaModal).toHaveBeenCalledWith({
      checklistItemId: 'action-item',
      itemDescription: 'Check compaction result',
    });
  });

  it('does not offer Pass for an unreleased hold point', async () => {
    renderChecklist({
      itpInstance: makeActionInstance({
        pointType: 'hold_point',
        isHoldPoint: true,
        description: 'Hold point inspection',
      }),
    });

    expect(await screen.findByText(/Awaiting hold point release/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pass this check/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fail this check/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark not applicable/i })).toBeInTheDocument();
  });
});

describe('ITPChecklistTab verification field-state (M15)', () => {
  it('shows the head-contractor rejection badge and reason on a rejected item', async () => {
    const instance: ITPInstance = {
      id: 'instance-2',
      template: {
        id: 'template-1',
        name: 'Earthworks ITP',
        checklistItems: [
          makeChecklistItem({
            id: 'item-1',
            description: 'Place bedding',
            category: 'Drainage',
            order: 1,
          }),
          // A still-pending item keeps the Drainage category expanded by default.
          makeChecklistItem({
            id: 'item-2',
            description: 'Backfill trench',
            category: 'Drainage',
            order: 2,
          }),
        ],
      },
      completions: [
        makeCompletion({
          checklistItemId: 'item-1',
          isCompleted: true,
          isRejected: true,
          verificationStatus: 'rejected',
          verificationNotes: 'Photo does not show the bedding layer',
        }),
      ],
    };

    renderChecklist({ itpInstance: instance });

    expect(await screen.findByText(/Place bedding/i)).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Rejected by head contractor/i)).toBeInTheDocument();
    expect(screen.getByText(/Photo does not show the bedding layer/i)).toBeInTheDocument();
    expect(screen.getByText(/re-complete this item to resubmit/i)).toBeInTheDocument();
  });

  it('renders a rejected completed row as actionable rather than accepted complete', async () => {
    const onToggleCompletion = vi.fn();
    const instance: ITPInstance = {
      id: 'instance-rejected-action',
      template: {
        id: 'template-1',
        name: 'Earthworks ITP',
        checklistItems: [
          makeChecklistItem({
            id: 'item-1',
            description: 'Place bedding',
            category: 'Drainage',
            order: 1,
          }),
        ],
      },
      completions: [
        makeCompletion({
          checklistItemId: 'item-1',
          isCompleted: true,
          isRejected: true,
          verificationStatus: 'rejected',
          verificationNotes: 'Photo does not show the bedding layer',
        }),
      ],
    };

    renderChecklist({ itpInstance: instance, onToggleCompletion });

    const label = await screen.findByText('1. Place bedding');
    expect(label.className).not.toContain('line-through');

    fireEvent.click(screen.getByRole('button', { name: 'Mark "Place bedding" as complete' }));
    expect(onToggleCompletion).toHaveBeenCalledWith('item-1', false, '');
  });

  it('locks a pending-review row instead of rendering it as accepted complete', async () => {
    const instance: ITPInstance = {
      id: 'instance-pending-review-action',
      template: {
        id: 'template-1',
        name: 'Earthworks ITP',
        checklistItems: [
          makeChecklistItem({
            id: 'item-1',
            description: 'Place bedding',
            category: 'Drainage',
            order: 1,
          }),
        ],
      },
      completions: [
        makeCompletion({
          checklistItemId: 'item-1',
          isCompleted: true,
          isPendingVerification: true,
          verificationStatus: 'pending_verification',
        }),
      ],
    };

    renderChecklist({ itpInstance: instance, canReviewITP: false });

    const label = await screen.findByText('1. Place bedding');
    expect(label.className).not.toContain('line-through');
    expect(
      screen.getByRole('button', { name: 'Awaiting verification for "Place bedding"' }),
    ).toBeDisabled();
    expect(screen.queryByText('Mark as N/A')).not.toBeInTheDocument();
  });
});

describe('ITPChecklistTab verify/reject actions (H4)', () => {
  const pendingInstance: ITPInstance = {
    id: 'instance-3',
    template: {
      id: 'template-1',
      name: 'Earthworks ITP',
      checklistItems: [
        makeChecklistItem({
          id: 'item-1',
          description: 'Place bedding',
          category: 'Drainage',
          order: 1,
        }),
        // A pending sibling keeps the Drainage category expanded by default.
        makeChecklistItem({
          id: 'item-2',
          description: 'Backfill trench',
          category: 'Drainage',
          order: 2,
        }),
      ],
    },
    completions: [
      makeCompletion({
        checklistItemId: 'item-1',
        id: 'completion-item-1',
        isCompleted: true,
        isPendingVerification: true,
        verificationStatus: 'pending_verification',
        completedBy: { id: 'subbie-9', fullName: 'Sub Bie', email: 's@x.test' },
      }),
    ],
  };

  it('offers Verify and Reject for a pending item completed by another user', async () => {
    renderChecklist({
      itpInstance: pendingInstance,
      canReviewITP: true,
      currentUserId: 'verifier-1',
    });

    expect(await screen.findByText(/Place bedding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('hides the actions on the reviewer’s own completion (assertDifferentVerifier)', async () => {
    renderChecklist({
      itpInstance: pendingInstance,
      canReviewITP: true,
      currentUserId: 'subbie-9',
    });

    expect(await screen.findByText(/Place bedding/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('hides the actions when the user lacks a review role', async () => {
    renderChecklist({
      itpInstance: pendingInstance,
      canReviewITP: false,
      currentUserId: 'verifier-1',
    });

    expect(await screen.findByText(/Place bedding/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
  });

  it('verifies a completion through the handler', async () => {
    const onVerifyCompletion = vi.fn().mockResolvedValue(true);
    renderChecklist({
      itpInstance: pendingInstance,
      canReviewITP: true,
      currentUserId: 'verifier-1',
      onVerifyCompletion,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    expect(onVerifyCompletion).toHaveBeenCalledWith('completion-item-1');
  });

  it('rejects a completion with a required reason via the modal', async () => {
    const onRejectCompletion = vi.fn().mockResolvedValue(true);
    renderChecklist({
      itpInstance: pendingInstance,
      canReviewITP: true,
      currentUserId: 'verifier-1',
      onRejectCompletion,
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const reason = screen.getByLabelText(/Reason for rejection/i);
    fireEvent.change(reason, { target: { value: 'Photo missing chainage marker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject item' }));

    expect(onRejectCompletion).toHaveBeenCalledWith(
      'completion-item-1',
      'Photo missing chainage marker',
    );
  });
});

describe('ITPChecklistTab requirement-first test entry', () => {
  function makeTestItemInstance(itemOverrides: Partial<ITPChecklistItem> = {}): ITPInstance {
    return {
      id: 'instance-test-entry',
      template: {
        id: 'template-1',
        name: 'Earthworks ITP',
        checklistItems: [
          makeChecklistItem({
            id: 'test-item',
            description: 'Compaction density',
            category: 'Field checks',
            order: 1,
            evidenceRequired: 'test',
            testType: 'Density Ratio',
            ...itemOverrides,
          }),
        ],
      },
      completions: [],
    };
  }

  it('offers Add test result for a test-required unsatisfied item and forwards the item', async () => {
    const onAddTestResult = vi.fn();
    renderChecklist({
      itpInstance: makeTestItemInstance(),
      canCreateTests: true,
      onAddTestResult,
    });

    const button = await screen.findByRole('button', { name: 'Add test result' });
    fireEvent.click(button);
    expect(onAddTestResult).toHaveBeenCalledWith({
      id: 'test-item',
      description: 'Compaction density',
      testType: 'Density Ratio',
    });
  });

  it('hides Add test result when the user cannot create tests', async () => {
    renderChecklist({
      itpInstance: makeTestItemInstance(),
      canCreateTests: false,
      onAddTestResult: vi.fn(),
    });

    expect(await screen.findByText(/Compaction density/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add test result' })).not.toBeInTheDocument();
  });

  it('hides Add test result when the item is not test-required', async () => {
    renderChecklist({
      itpInstance: makeTestItemInstance({ evidenceRequired: 'none', testType: null }),
      canCreateTests: true,
      onAddTestResult: vi.fn(),
    });

    expect(await screen.findByText(/Compaction density/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add test result' })).not.toBeInTheDocument();
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
