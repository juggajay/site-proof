import { useEffect, useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  AlertModalHeader,
  AlertModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';
import { QUANTITY_UNIT_OPTIONS, type SufficiencyRuleset } from '@/lib/testSufficiency';
import type { BulkAssignSubcontractorOptions } from '../lotsPageTypes';

// =====================
// Bulk Delete Modal
// =====================

interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function BulkDeleteModal({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
}: BulkDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal alert onClose={onClose}>
      <AlertModalHeader>Confirm Bulk Deletion</AlertModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-foreground">{selectedCount} lot(s)</span>?
        </p>
        <p className="mt-3 text-sm text-destructive">
          This action cannot be undone. All associated data will be permanently deleted.
        </p>
      </ModalBody>
      <AlertModalFooter>
        <Button variant="outline" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : `Delete ${selectedCount} Lot(s)`}
        </Button>
      </AlertModalFooter>
    </Modal>
  );
}

// =====================
// Bulk Status Update Modal
// =====================

interface BulkStatusModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: (status: string) => Promise<void>;
}

export function BulkStatusModal({
  isOpen,
  selectedCount,
  onClose,
  onConfirm,
}: BulkStatusModalProps) {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('in_progress');

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      await onConfirm(newStatus);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <ModalHeader>Update Lot Status</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Update status for{' '}
          <span className="font-semibold text-foreground">{selectedCount} lot(s)</span>
        </p>
        <div className="mt-4">
          <Label htmlFor="bulk-status-select">New Status</Label>
          <NativeSelect
            id="bulk-status-select"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="mt-1"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_test">Awaiting Test</option>
            <option value="hold_point">Hold Point</option>
            <option value="ncr_raised">NCR Raised</option>
            <option value="completed">Completed</option>
          </NativeSelect>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={updating}>
          Cancel
        </Button>
        <Button onClick={handleUpdate} disabled={updating}>
          {updating ? 'Updating...' : 'Update Status'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// =====================
// Bulk Assign Subcontractor Modal
// =====================

interface BulkAssignModalProps {
  isOpen: boolean;
  selectedCount: number;
  subcontractors: { id: string; companyName: string }[];
  onClose: () => void;
  onConfirm: (subcontractorId: string, options?: BulkAssignSubcontractorOptions) => Promise<void>;
}

export function BulkAssignModal({
  isOpen,
  selectedCount,
  subcontractors,
  onClose,
  onConfirm,
}: BulkAssignModalProps) {
  const [assigning, setAssigning] = useState(false);
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('');
  const [canCompleteITP, setCanCompleteITP] = useState(false);
  const [itpRequiresVerification, setItpRequiresVerification] = useState(true);

  const handleAssign = async () => {
    if (assigning) return;
    setAssigning(true);
    try {
      await onConfirm(
        selectedSubcontractorId,
        selectedSubcontractorId
          ? {
              canCompleteITP,
              itpRequiresVerification: canCompleteITP ? itpRequiresVerification : true,
            }
          : undefined,
      );
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <ModalHeader>Assign Subcontractor</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Assign {selectedCount} selected lot(s) to a subcontractor.
        </p>
        <div>
          <Label htmlFor="bulk-subcontractor">Subcontractor</Label>
          <NativeSelect
            id="bulk-subcontractor"
            value={selectedSubcontractorId}
            onChange={(e) => setSelectedSubcontractorId(e.target.value)}
            className="mt-1"
          >
            <option value="">-- Unassign --</option>
            {subcontractors.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.companyName}
              </option>
            ))}
          </NativeSelect>
        </div>
        {selectedSubcontractorId && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">ITP Permissions</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="bulk-can-complete-itp"
                checked={canCompleteITP}
                onChange={(e) => {
                  setCanCompleteITP(e.target.checked);
                  if (!e.target.checked) {
                    setItpRequiresVerification(true);
                  }
                }}
                className="h-4 w-4 rounded border-border accent-primary focus:ring-primary"
              />
              <label htmlFor="bulk-can-complete-itp" className="text-sm text-foreground">
                Allow ITP completion
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="bulk-itp-requires-verification"
                checked={itpRequiresVerification}
                onChange={(e) => setItpRequiresVerification(e.target.checked)}
                disabled={!canCompleteITP}
                className="h-4 w-4 rounded border-border accent-primary focus:ring-primary disabled:opacity-50"
              />
              <label
                htmlFor="bulk-itp-requires-verification"
                className={`text-sm ${canCompleteITP ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Require verification (recommended)
              </label>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={assigning}>
          Cancel
        </Button>
        <Button onClick={handleAssign} disabled={assigning}>
          {assigning ? 'Assigning...' : 'Assign'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// =====================
// Bulk Set Test Attributes Modal — Wave C1 (spec §9.1 [C1R-B10])
//
// Without a bulk path the frequency engine has no data and the launch is dead:
// a PM on a 500-lot project would open 500 forms. Only rendered where a shipped
// ruleset governs the project, so the scale options are the authority's own.
// =====================

interface BulkTestAttributesModalProps {
  isOpen: boolean;
  selectedCount: number;
  ruleset: SufficiencyRuleset;
  onClose: () => void;
  onConfirm: (values: {
    testScale?: string;
    quantityValue?: number;
    quantityUnit?: string;
  }) => Promise<void>;
}

export function BulkTestAttributesModal({
  isOpen,
  selectedCount,
  ruleset,
  onClose,
  onConfirm,
}: BulkTestAttributesModalProps) {
  const [saving, setSaving] = useState(false);
  const [testScale, setTestScale] = useState('');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');

  // C1 (F9): the component stays mounted between openings, so without this the
  // next selected batch inherits the previous batch's armed scale/quantity and
  // one Confirm silently overwrites it. A successful save closes the modal, so
  // resetting on open covers both "new selection" and "after save".
  useEffect(() => {
    if (!isOpen) return;
    setTestScale('');
    setQuantityValue('');
    setQuantityUnit('');
  }, [isOpen]);

  const parsedQuantity = parseOptionalNonNegativeDecimalInput(quantityValue);
  // A quantity is a number AND a unit or it is not a quantity — the backend
  // refuses half of one, so the button refuses it too rather than round-tripping
  // a 400.
  const quantityComplete =
    quantityValue.trim() === '' ? !quantityUnit : Boolean(parsedQuantity && quantityUnit);
  const canSave = Boolean(testScale || (parsedQuantity && quantityUnit)) && quantityComplete;

  const handleSave = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    try {
      await onConfirm({
        ...(testScale ? { testScale } : {}),
        ...(parsedQuantity && quantityUnit ? { quantityValue: parsedQuantity, quantityUnit } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <ModalHeader>Set Testing Attributes</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Applies to <span className="font-semibold text-foreground">{selectedCount} lot(s)</span>.
          Testing scale sets the test frequency required by {ruleset.authority} {ruleset.document};
          quantity is recorded for rules that use it. Leave a field blank to leave it unchanged.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="bulk-test-scale">Testing Scale</Label>
            <NativeSelect
              id="bulk-test-scale"
              value={testScale}
              onChange={(e) => setTestScale(e.target.value)}
              className="mt-1"
            >
              <option value="">Leave unchanged</option>
              {ruleset.scaleKeys.map((scale) => (
                <option key={scale} value={scale}>
                  {scale}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bulk-quantity-value">Quantity</Label>
              <Input
                id="bulk-quantity-value"
                inputMode="decimal"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                placeholder="e.g. 3200"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bulk-quantity-unit">Unit</Label>
              <NativeSelect
                id="bulk-quantity-unit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
                className="mt-1"
              >
                <option value="">Leave unchanged</option>
                {QUANTITY_UNIT_OPTIONS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Set Attributes'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
