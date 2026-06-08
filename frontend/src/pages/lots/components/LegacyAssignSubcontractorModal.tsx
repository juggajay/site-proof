import { Users } from 'lucide-react';
import type { Lot, SubcontractorCompany } from '../types';

interface LegacyAssignSubcontractorModalProps {
  isOpen: boolean;
  lot: Pick<Lot, 'lotNumber' | 'description' | 'assignedSubcontractorId' | 'assignedSubcontractor'>;
  subcontractors: SubcontractorCompany[];
  selectedSubcontractor: string;
  isAssigning: boolean;
  onSelectedChange: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Legacy single-assignment "Assign Subcontractor" modal.
 *
 * Verbatim extraction from LotDetailPage.tsx — markup and behavior are unchanged.
 * The open flag, selected-id and assigning state, the subcontractor fetch effect,
 * and the assign handler all stay in LotDetailPage and are passed in as props.
 *
 * Coexists with the newer permission-based AssignSubcontractorModal; whether the
 * legacy single-assignment flow is still needed is a product decision (see the
 * lot-detail refactor map, Red Flag #2). This change only relocates it.
 */
export function LegacyAssignSubcontractorModal({
  isOpen,
  lot,
  subcontractors,
  selectedSubcontractor,
  isAssigning,
  onSelectedChange,
  onClose,
  onSubmit,
}: LegacyAssignSubcontractorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Assign Subcontractor</h2>
            <p className="text-sm text-muted-foreground">
              Assign this lot to a subcontractor company
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Lot</label>
            <div className="px-3 py-2 rounded border bg-muted/50">
              <span className="font-medium">{lot.lotNumber}</span>
              {lot.description && (
                <span className="text-muted-foreground"> - {lot.description}</span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="subcontractor-select" className="block text-sm font-medium mb-1">
              Subcontractor Company
            </label>
            <select
              id="subcontractor-select"
              value={selectedSubcontractor}
              onChange={(e) => onSelectedChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background"
            >
              <option value="">No subcontractor assigned</option>
              {subcontractors
                .filter((sub) => sub.status === 'approved')
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Only approved subcontractors are shown. The subcontractor users will be notified.
            </p>
          </div>

          {lot.assignedSubcontractorId && selectedSubcontractor !== lot.assignedSubcontractorId && (
            <div className="text-sm text-warning-foreground bg-warning/10 border border-warning/20 rounded-lg p-3">
              <strong>Note:</strong> This will change the assigned subcontractor from{' '}
              <span className="font-medium">
                {lot.assignedSubcontractor?.companyName || 'current'}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {selectedSubcontractor
                  ? subcontractors.find((s) => s.id === selectedSubcontractor)?.companyName
                  : 'none'}
              </span>
              .
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
            disabled={isAssigning}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isAssigning || (!selectedSubcontractor && !lot.assignedSubcontractorId)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAssigning
              ? 'Assigning...'
              : selectedSubcontractor
                ? 'Assign Subcontractor'
                : lot.assignedSubcontractorId
                  ? 'Remove Assignment'
                  : 'Select subcontractor'}
          </button>
        </div>
      </div>
    </div>
  );
}
