// Every overlay the lot register can open, in one place. Split out of
// LotsPage.tsx so the page reads as register chrome + register views; the
// modals are wired straight from the actions hook and hold no state of their
// own. Mirrors LotDetailModals.tsx on the detail page.
import { BulkCreateLotsWizard } from '@/components/lots/BulkCreateLotsWizard';
import { ExportLotsModal } from '@/components/lots/ExportLotsModal';
import { LotQuickView } from '@/components/lots/LotQuickView';
import { PrintLabelsModal } from '@/components/lots/PrintLabelsModal';
import { ImportReviewModal } from '@/pages/projects/copilot/ImportReviewModal';
import { CreateLotModal } from './CreateLotModal';
import { DeleteLotModal } from './DeleteLotModal';
import { LotContextMenu } from './LotContextMenu';
import {
  BulkAssignModal,
  BulkDeleteModal,
  BulkStatusModal,
  BulkTestAttributesModal,
} from './BulkActionModals';
import type { useLotsActions } from '../hooks/useLotsActions';
import type { Lot } from '../lotsPageTypes';

type LotsActions = ReturnType<typeof useLotsActions>;

interface LotsPageModalsProps {
  projectId: string;
  actions: LotsActions;
  lots: Lot[];
  filteredLots: Lot[];
  projectName: string;
  subcontractors: { id: string; companyName: string }[];
  canCreate: boolean;
  canDelete: boolean;
  canViewBudgets: boolean;
  commercialAccessReason: string | null;
  isSubcontractor: boolean;
  activityFilter: string;
  /** Wave C1 §9.4 — present only where a shipped frequency ruleset governs. */
  governingRuleset: Parameters<typeof BulkTestAttributesModal>[0]['ruleset'] | null;
  importBatches: Parameters<typeof ImportReviewModal>[0]['batches'];
  onImportRollback: (proposalId: string) => void;
  onImportApplied: () => void;
  onBulkCreated: () => void;
  onError: (message: string) => void;
}

export function LotsPageModals({
  projectId,
  actions,
  lots,
  filteredLots,
  projectName,
  subcontractors,
  canCreate,
  canDelete,
  canViewBudgets,
  commercialAccessReason,
  isSubcontractor,
  activityFilter,
  governingRuleset,
  importBatches,
  onImportRollback,
  onImportApplied,
  onBulkCreated,
  onError,
}: LotsPageModalsProps) {
  return (
    <>
      <LotContextMenu
        contextMenu={actions.contextMenu}
        projectId={projectId}
        canCreate={canCreate}
        canDelete={canDelete}
        onClose={actions.closeContextMenu}
        onDeleteClick={actions.handleDeleteClick}
        onCloneLot={actions.handleCloneLot}
      />

      {actions.quickViewLot && (
        <LotQuickView
          lotId={actions.quickViewLot.id}
          projectId={projectId}
          position={actions.quickViewLot.position}
          onClose={actions.handleQuickViewClose}
        />
      )}

      <DeleteLotModal
        isOpen={actions.deleteModalOpen}
        lot={actions.lotToDelete}
        onClose={() => {
          actions.setDeleteModalOpen(false);
          actions.setLotToDelete(null);
        }}
        onDeleted={actions.handleDeleteSuccess}
        onError={onError}
      />

      <BulkDeleteModal
        isOpen={actions.bulkDeleteModalOpen}
        selectedCount={actions.selectedLots.size}
        onClose={() => actions.setBulkDeleteModalOpen(false)}
        onConfirm={actions.handleBulkDelete}
      />

      <BulkStatusModal
        isOpen={actions.bulkStatusModalOpen}
        selectedCount={actions.selectedLots.size}
        onClose={() => actions.setBulkStatusModalOpen(false)}
        onConfirm={actions.handleBulkStatusUpdate}
      />

      {governingRuleset && (
        <BulkTestAttributesModal
          isOpen={actions.bulkTestAttributesModalOpen}
          selectedCount={actions.selectedLots.size}
          ruleset={governingRuleset}
          onClose={() => actions.setBulkTestAttributesModalOpen(false)}
          onConfirm={actions.handleBulkSetTestAttributes}
        />
      )}

      <BulkAssignModal
        isOpen={actions.bulkAssignModalOpen}
        selectedCount={actions.selectedLots.size}
        subcontractors={subcontractors}
        onClose={() => actions.setBulkAssignModalOpen(false)}
        onConfirm={actions.handleBulkAssignSubcontractor}
      />

      <CreateLotModal
        isOpen={actions.createModalOpen}
        onClose={() => actions.setCreateModalOpen(false)}
        onSuccess={actions.handleCreateSuccess}
        projectId={projectId}
        canViewBudgets={canViewBudgets}
        commercialAccessReason={commercialAccessReason}
        initialActivityType={activityFilter || undefined}
      />

      {actions.bulkWizardOpen && (
        <BulkCreateLotsWizard
          projectId={projectId}
          onClose={() => actions.setBulkWizardOpen(false)}
          onSuccess={onBulkCreated}
        />
      )}

      {/* Lot register import — Wave B B2. Replaces the client-side CSV importer:
          the server parses the file, every lot is reviewed beside its register,
          nothing is written until one proposal is accepted, and the whole batch
          can be rolled back. */}
      {actions.importModalOpen && (
        <ImportReviewModal
          projectId={projectId}
          kind="lot_register"
          batches={importBatches}
          onRollback={onImportRollback}
          onApplied={onImportApplied}
          onClose={() => actions.setImportModalOpen(false)}
        />
      )}

      {actions.exportModalOpen && (
        <ExportLotsModal
          projectId={projectId}
          projectName={projectName}
          lots={filteredLots}
          canViewBudgets={canViewBudgets}
          isSubcontractor={isSubcontractor}
          onClose={() => actions.setExportModalOpen(false)}
        />
      )}

      {actions.printLabelsModalOpen && (
        <PrintLabelsModal
          lots={lots.filter((lot) => actions.selectedLots.has(lot.id))}
          projectId={projectId}
          onClose={() => actions.setPrintLabelsModalOpen(false)}
        />
      )}
    </>
  );
}
