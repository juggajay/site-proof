import type { ComponentProps } from 'react';
import { AssignSubcontractorModal } from '@/components/lots/AssignSubcontractorModal';
import type { Lot, SubcontractorCompany, LotSubcontractorAssignment } from '../types';
import { LOT_OVERRIDE_STATUSES } from '../constants';
import { StatusOverrideModal } from './StatusOverrideModal';
import { LegacyAssignSubcontractorModal } from './LegacyAssignSubcontractorModal';
import { EvidenceWarningModal } from './EvidenceWarningModal';
import { MarkAsNAModal } from './MarkAsNAModal';
import { MarkAsFailedModal } from './MarkAsFailedModal';
import { WitnessPointModal } from './WitnessPointModal';
import { AIClassificationModal } from './AIClassificationModal';
import { ConformLotDialogs } from './ConformLotDialogs';

// The modal cluster rendered at the bottom of LotDetailPage, moved here
// verbatim. All state, mutations, query invalidation, and business handlers
// stay in the page; this component only renders the modals and forwards the
// page-owned values/callbacks. Handler prop types are derived from the modal
// components where they map 1:1, so the wiring cannot drift from the modals'
// own contracts.
type EvidenceWarning = NonNullable<ComponentProps<typeof EvidenceWarningModal>['warning']>;

interface ChecklistItemModalTarget {
  checklistItemId: string;
  itemDescription: string;
}

interface WitnessModalTarget extends ChecklistItemModalTarget {
  existingNotes: string | null;
}

interface LotDetailModalsProps {
  lot: Lot;
  lotId: string;
  projectId: string | undefined;
  // Status override
  showOverrideModal: boolean;
  overriding: boolean;
  setShowOverrideModal: (open: boolean) => void;
  handleOverrideStatus: ComponentProps<typeof StatusOverrideModal>['onSubmit'];
  // Assign subcontractor (legacy)
  showSubcontractorModal: boolean;
  subcontractors: SubcontractorCompany[];
  selectedSubcontractor: string;
  assigningSubcontractor: boolean;
  setShowSubcontractorModal: (open: boolean) => void;
  setSelectedSubcontractor: (id: string) => void;
  handleAssignSubcontractor: () => void;
  // Assign subcontractor (new permission system)
  showAssignSubcontractorModal: boolean;
  editingAssignment: LotSubcontractorAssignment | null;
  setShowAssignSubcontractorModal: (open: boolean) => void;
  setEditingAssignment: (assignment: LotSubcontractorAssignment | null) => void;
  /** Page-owned: invalidates the lot-assignments query after a save. */
  onAssignmentSuccess: () => void;
  // Evidence warning
  evidenceWarning: EvidenceWarning | null;
  updatingCompletion: string | null;
  setEvidenceWarning: (warning: EvidenceWarning | null) => void;
  toggleCompletion: (
    checklistItemId: string,
    currentlyCompleted: boolean,
    existingNotes: string | null,
    forceComplete?: boolean,
  ) => void;
  // Mark as N/A
  naModal: ChecklistItemModalTarget | null;
  submittingNa: boolean;
  setNaModal: (modal: ChecklistItemModalTarget | null) => void;
  handleSubmitNA: ComponentProps<typeof MarkAsNAModal>['onSubmit'];
  // Mark as failed (creates NCR)
  failedModal: ChecklistItemModalTarget | null;
  submittingFailed: boolean;
  setFailedModal: (modal: ChecklistItemModalTarget | null) => void;
  handleSubmitFailed: ComponentProps<typeof MarkAsFailedModal>['onSubmit'];
  // Witness point completion
  witnessModal: WitnessModalTarget | null;
  submittingWitness: boolean;
  setWitnessModal: (modal: WitnessModalTarget | null) => void;
  handleSubmitWitness: ComponentProps<typeof WitnessPointModal>['onSubmit'];
  // AI photo classification
  classificationModal: ComponentProps<typeof AIClassificationModal>['data'];
  savingClassification: boolean;
  handleSaveClassification: ComponentProps<typeof AIClassificationModal>['onSave'];
  handleSkipClassification: ComponentProps<typeof AIClassificationModal>['onSkip'];
  // Conform / force-conform dialogs
  showConformConfirm: boolean;
  showForceConformConfirm: boolean;
  forceConformReason: string;
  conforming: boolean;
  setShowConformConfirm: (open: boolean) => void;
  setShowForceConformConfirm: (open: boolean) => void;
  setForceConformReason: (reason: string) => void;
  handleConformLot: (force?: boolean, reason?: string) => Promise<void>;
}

export function LotDetailModals({
  lot,
  lotId,
  projectId,
  showOverrideModal,
  overriding,
  setShowOverrideModal,
  handleOverrideStatus,
  showSubcontractorModal,
  subcontractors,
  selectedSubcontractor,
  assigningSubcontractor,
  setShowSubcontractorModal,
  setSelectedSubcontractor,
  handleAssignSubcontractor,
  showAssignSubcontractorModal,
  editingAssignment,
  setShowAssignSubcontractorModal,
  setEditingAssignment,
  onAssignmentSuccess,
  evidenceWarning,
  updatingCompletion,
  setEvidenceWarning,
  toggleCompletion,
  naModal,
  submittingNa,
  setNaModal,
  handleSubmitNA,
  failedModal,
  submittingFailed,
  setFailedModal,
  handleSubmitFailed,
  witnessModal,
  submittingWitness,
  setWitnessModal,
  handleSubmitWitness,
  classificationModal,
  savingClassification,
  handleSaveClassification,
  handleSkipClassification,
  showConformConfirm,
  showForceConformConfirm,
  forceConformReason,
  conforming,
  setShowConformConfirm,
  setShowForceConformConfirm,
  setForceConformReason,
  handleConformLot,
}: LotDetailModalsProps) {
  return (
    <>
      {/* Status Override Modal */}
      <StatusOverrideModal
        isOpen={showOverrideModal}
        currentStatus={lot.status}
        validStatuses={LOT_OVERRIDE_STATUSES}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleOverrideStatus}
        isSubmitting={overriding}
      />

      {/* Assign Subcontractor Modal */}
      <LegacyAssignSubcontractorModal
        isOpen={showSubcontractorModal}
        lot={lot}
        subcontractors={subcontractors}
        selectedSubcontractor={selectedSubcontractor}
        isAssigning={assigningSubcontractor}
        onSelectedChange={setSelectedSubcontractor}
        onClose={() => {
          setShowSubcontractorModal(false);
          setSelectedSubcontractor('');
        }}
        onSubmit={handleAssignSubcontractor}
      />

      {/* Assign Subcontractor Modal (new permission system) */}
      {showAssignSubcontractorModal && (
        <AssignSubcontractorModal
          lotId={lotId}
          lotNumber={lot?.lotNumber || ''}
          projectId={projectId || ''}
          existingAssignment={editingAssignment}
          onClose={() => {
            setShowAssignSubcontractorModal(false);
            setEditingAssignment(null);
          }}
          onSuccess={onAssignmentSuccess}
        />
      )}

      {/* Evidence Warning Modal */}
      <EvidenceWarningModal
        isOpen={!!evidenceWarning}
        warning={evidenceWarning}
        onClose={() => setEvidenceWarning(null)}
        onConfirm={() => {
          if (evidenceWarning) {
            toggleCompletion(
              evidenceWarning.checklistItemId,
              false, // Currently not completed
              evidenceWarning.currentNotes,
              true, // Force complete without evidence
            );
          }
        }}
        isLoading={updatingCompletion === evidenceWarning?.checklistItemId}
      />

      {/* Mark as N/A Modal */}
      <MarkAsNAModal
        isOpen={!!naModal}
        itemDescription={naModal?.itemDescription || ''}
        onClose={() => setNaModal(null)}
        onSubmit={handleSubmitNA}
        isSubmitting={submittingNa}
      />

      {/* Mark as Failed Modal - Creates NCR */}
      <MarkAsFailedModal
        isOpen={!!failedModal}
        itemDescription={failedModal?.itemDescription || ''}
        onClose={() => setFailedModal(null)}
        onSubmit={handleSubmitFailed}
        isSubmitting={submittingFailed}
      />

      {/* Witness Point Completion Modal */}
      <WitnessPointModal
        isOpen={!!witnessModal}
        itemDescription={witnessModal?.itemDescription || ''}
        onClose={() => setWitnessModal(null)}
        onSubmit={handleSubmitWitness}
        isSubmitting={submittingWitness}
      />

      {/* Feature #247: AI Photo Classification Modal */}
      <AIClassificationModal
        isOpen={!!classificationModal}
        data={classificationModal}
        onSave={handleSaveClassification}
        onSkip={handleSkipClassification}
        isSaving={savingClassification}
      />

      <ConformLotDialogs
        lotNumber={lot?.lotNumber}
        showConformConfirm={showConformConfirm}
        onConformCancel={() => setShowConformConfirm(false)}
        onConformConfirm={() => void handleConformLot(false)}
        showForceConformConfirm={showForceConformConfirm}
        forceConformReason={forceConformReason}
        onForceConformReasonChange={setForceConformReason}
        onForceConformCancel={() => {
          setShowForceConformConfirm(false);
          setForceConformReason('');
        }}
        onForceConformConfirm={() => void handleConformLot(true, forceConformReason)}
        isConforming={conforming}
      />
    </>
  );
}
