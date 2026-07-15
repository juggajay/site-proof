import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotDetailModals } from './LotDetailModals';
import type { Lot } from '../types';

afterEach(() => {
  cleanup();
});

// Wiring tests for the modal cluster moved out of LotDetailPage. The modals'
// own behavior is tested elsewhere (e.g. ConformLotDialogs.test.tsx); these
// tests pin that the cluster forwards the page-owned values/callbacks with the
// right arguments — the main risk of a large prop pass-through.
const lot = { id: 'lot-1', lotNumber: 'L-001', status: 'in_progress' } as unknown as Lot;

function renderModals(overrides: Partial<Parameters<typeof LotDetailModals>[0]> = {}) {
  const props = {
    lot,
    lotId: 'lot-1',
    projectId: 'project-1',
    showOverrideModal: false,
    overriding: false,
    setShowOverrideModal: vi.fn(),
    handleOverrideStatus: vi.fn().mockResolvedValue(undefined),
    showAssignSubcontractorModal: false,
    editingAssignment: null,
    setShowAssignSubcontractorModal: vi.fn(),
    setEditingAssignment: vi.fn(),
    onAssignmentSuccess: vi.fn(),
    evidenceWarning: null,
    updatingCompletion: null,
    setEvidenceWarning: vi.fn(),
    toggleCompletion: vi.fn(),
    naModal: null,
    submittingNa: false,
    setNaModal: vi.fn(),
    handleSubmitNA: vi.fn().mockResolvedValue(undefined),
    failedModal: null,
    submittingFailed: false,
    setFailedModal: vi.fn(),
    handleSubmitFailed: vi.fn().mockResolvedValue(undefined),
    failedModalAddPhoto: vi.fn().mockResolvedValue(undefined),
    failedModalPhotoCount: 0,
    witnessModal: null,
    submittingWitness: false,
    setWitnessModal: vi.fn(),
    handleSubmitWitness: vi.fn().mockResolvedValue(undefined),
    classificationModal: null,
    savingClassification: false,
    handleSaveClassification: vi.fn().mockResolvedValue(undefined),
    handleSkipClassification: vi.fn(),
    showConformConfirm: false,
    showForceConformConfirm: false,
    forceConformReason: '',
    conforming: false,
    setShowConformConfirm: vi.fn(),
    setShowForceConformConfirm: vi.fn(),
    setForceConformReason: vi.fn(),
    handleConformLot: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<LotDetailModals {...props} />);
  return props;
}

describe('LotDetailModals', () => {
  it('renders no open modal in the default closed state', () => {
    renderModals();

    expect(screen.queryByRole('button', { name: 'Force Conform Lot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conform Lot' })).not.toBeInTheDocument();
    expect(screen.queryByText('Evidence Required')).not.toBeInTheDocument();
  });

  it('forwards force-conform confirmation with the typed reason', () => {
    const props = renderModals({
      showForceConformConfirm: true,
      forceConformReason: 'QA manager approved the exception',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Force Conform Lot' }));
    expect(props.handleConformLot).toHaveBeenCalledWith(true, 'QA manager approved the exception');
  });

  it('clears both the dialog flag and the reason on force-conform cancel', () => {
    const props = renderModals({
      showForceConformConfirm: true,
      forceConformReason: 'QA manager approved the exception',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.setShowForceConformConfirm).toHaveBeenCalledWith(false);
    expect(props.setForceConformReason).toHaveBeenCalledWith('');
  });

  it('force-completes the warned checklist item with its current notes', () => {
    const props = renderModals({
      evidenceWarning: {
        checklistItemId: 'item-9',
        itemDescription: 'Compaction test attached',
        evidenceType: 'Photo',
        currentNotes: 'existing note',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Complete Anyway' }));
    expect(props.toggleCompletion).toHaveBeenCalledWith('item-9', false, 'existing note', true);
  });
});
